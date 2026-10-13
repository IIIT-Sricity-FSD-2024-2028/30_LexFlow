import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
  OnModuleInit,
} from '@nestjs/common';
import { PoolClient } from 'pg';
import { UsersService, FirmTier, TIER_LIMITS } from '../users/users.service';
import { BillingService } from '../billing/billing.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { UpdateTierPricingDto } from './dto/update-tier-pricing.dto';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';
import { q, tx } from '../db';

// ── Types ────────────────────────────────────────────────────────────────────

export type SubscriptionStatus = 'active' | 'cancelled' | 'past_due';
export type ChargeStatus = 'Paid' | 'Pending' | 'Overdue';

export interface TierPlan {
  tier: FirmTier;
  monthlyPrice: number;
  /** Seat caps come from the users module so pricing and limits never drift apart. */
  lawyerSeats: number;
  internSeats: number;
}

export interface Subscription {
  id: string;
  firmId: string;
  firmName: string;
  tier: FirmTier;
  status: SubscriptionStatus;
  monthlyPrice: number;
  startedAt: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelledAt?: string;
  /**
   * A tier the firm has requested but not yet paid for. Set by
   * requestTierChange, cleared the moment its charge is settled — the tier
   * itself does not move until payment lands.
   */
  pendingTier?: FirmTier;
  /** The unpaid charge that, once Paid, applies pendingTier. */
  pendingChargeId?: string;
  /**
   * Ids of the charges that are still unpaid AND required before pendingTier
   * can become active (see REQUIRED_OUTSTANDING_SQL). Empty/absent when there
   * is no pending change. The UI shows these as "pay these to upgrade".
   */
  requiredChargeIds?: string[];
}

/** How a charge was settled. 'simulated' = demo button, no real money moved. */
export type PaymentMode = 'simulated' | 'manual' | 'gateway';

/**
 * One charge LexFlow raises against a firm.
 * 'monthly'     — the firm's regular bill for its current tier, one per period.
 * 'tier_change' — a one-time charge for switching plans; paying it is what
 *                 actually moves the firm onto the new tier.
 */
export type ChargeKind = 'monthly' | 'tier_change';

export interface SubscriptionCharge {
  id: string;
  subscriptionId: string;
  firmId: string;
  firmName: string;
  tier: FirmTier;
  kind: ChargeKind;
  /** Present only on a 'tier_change' charge: the tier it will switch the firm to. */
  targetTier?: FirmTier;
  /** Billing period, as YYYY-MM. */
  period: string;
  periodStart: string;
  periodEnd: string;
  amount: number;
  status: ChargeStatus;
  issuedAt: string;
  paidAt?: string;
  /** How a Paid charge was settled (absent for legacy rows paid before payments were recorded). */
  paymentMode?: PaymentMode;
}

/**
 * BUSINESS RULE — which charges must be settled before a pending plan change
 * becomes the active plan:
 *
 *   1. the plan-change ("tier_change") charge itself, and
 *   2. every unpaid MONTHLY subscription charge of the same subscription that
 *      was issued on or before that plan-change charge (the firm may not
 *      upgrade while it still owes for the plan it is leaving).
 *
 * Deliberately NOT required: charges issued after the request (next month's
 * bill), and the firm's own client invoices (`invoices` table) — those are
 * between the firm and its clients, not the firm's debt to LexFlow.
 *
 * `$1` is left to the caller (a firm id for one firm, or no filter for all).
 */
const REQUIRED_OUTSTANDING_SQL = `
  SELECT s.lawfirm_id, ch.id, ch.kind, ch.amount, ch.status
  FROM subscriptions s
  JOIN subscription_charges pc ON pc.id = s.pending_charge_id
  JOIN subscription_charges ch ON ch.subscription_id = s.id
  WHERE ch.status <> 'Paid'
    AND (ch.id = pc.id OR (ch.kind = 'monthly' AND ch.issued_at <= pc.issued_at))`;

export interface PlatformSettings {
  /** Percentage of every paid client invoice that LexFlow keeps. */
  commissionRate: number;
  supportEmail: string;
  currency: string;
  maintenanceMode: boolean;
  disableSignup: boolean;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleString('en-US', {
    month: 'short',
    year: 'numeric',
  });
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, d.getDate());
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function iso(d: Date | string | null | undefined): string {
  return d ? new Date(d).toISOString() : undefined as unknown as string;
}

@Injectable()
export class PlatformService implements OnModuleInit {
  constructor(
    private readonly usersService: UsersService,
    private readonly billingService: BillingService,
  ) {}

  async onModuleInit() {
    // Generate the current month's charges at startup so the pay/settle flow
    // has something to demo even before the first read. No backdated billing
    // history is invented — lifetime earnings start at zero.
    await this.syncSubscriptions();
  }

  // ── Loaders (Postgres) ────────────────────────────────────────────────────

  private async loadTierPricing(): Promise<Record<FirmTier, number>> {
    const { rows } = await q(`SELECT tier, monthly_price FROM tier_pricing`);
    const out = { Starter: 2999, Growth: 9999, Enterprise: 24999 } as Record<FirmTier, number>;
    rows.forEach((r) => { out[r.tier as FirmTier] = Number(r.monthly_price); });
    return out;
  }

  private async loadSettings(): Promise<PlatformSettings> {
    const { rows } = await q(`SELECT * FROM platform_settings WHERE id = 1`);
    const r = rows[0];
    if (!r) {
      return { commissionRate: 10, supportEmail: 'support@lexflow.legal', currency: 'INR', maintenanceMode: false, disableSignup: false };
    }
    return {
      commissionRate: Number(r.commission_rate),
      supportEmail: r.support_email,
      currency: r.currency,
      maintenanceMode: !!r.maintenance_mode,
      disableSignup: !!r.disable_signup,
    };
  }

  private async loadSubscriptions(): Promise<Subscription[]> {
    const pricing = await this.loadTierPricing();
    const { rows } = await q(
      `SELECT s.*, f.name AS firm_name, f.tier
       FROM subscriptions s JOIN lawfirm_meta f ON f.id = s.lawfirm_id
       ORDER BY s.lawfirm_id`,
    );
    const required = await q(REQUIRED_OUTSTANDING_SQL);
    const requiredByFirm = new Map<number, string[]>();
    required.rows.forEach((r) => {
      const list = requiredByFirm.get(r.lawfirm_id) || [];
      list.push(r.id as string);
      requiredByFirm.set(r.lawfirm_id, list);
    });
    return rows.map((r) => {
      const tier = r.tier as FirmTier;
      const startedAt = iso(r.started_at);
      return {
        id: r.id as string,
        firmId: `firm-${r.lawfirm_id}`,
        firmName: r.firm_name as string,
        tier,
        status: r.status as SubscriptionStatus,
        monthlyPrice: pricing[tier] ?? 0,
        startedAt,
        currentPeriodStart: startOfMonth(new Date()).toISOString(),
        currentPeriodEnd: addMonths(startOfMonth(new Date()), 1).toISOString(),
        cancelledAt: r.cancelled_at ? iso(r.cancelled_at) : undefined,
        pendingTier: (r.pending_tier as FirmTier) || undefined,
        pendingChargeId: (r.pending_charge_id as string) || undefined,
        requiredChargeIds: r.pending_tier ? requiredByFirm.get(r.lawfirm_id) || [] : undefined,
      };
    });
  }

  private async loadCharges(): Promise<SubscriptionCharge[]> {
    const { rows } = await q(
      `SELECT ch.*, f.name AS firm_name, p.mode AS payment_mode
       FROM subscription_charges ch
       JOIN lawfirm_meta f ON f.id = ch.lawfirm_id
       LEFT JOIN subscription_payments p ON p.charge_id = ch.id
       ORDER BY ch.issued_at`,
    );
    return rows.map((r) => ({
      id: r.id as string,
      subscriptionId: r.subscription_id as string,
      firmId: `firm-${r.lawfirm_id}`,
      firmName: r.firm_name as string,
      tier: r.tier as FirmTier,
      kind: r.kind as ChargeKind,
      targetTier: (r.target_tier as FirmTier) || undefined,
      period: r.period as string,
      periodStart: iso(r.period_start),
      periodEnd: iso(r.period_end),
      amount: Number(r.amount),
      status: r.status as ChargeStatus,
      issuedAt: iso(r.issued_at),
      paidAt: r.paid_at ? iso(r.paid_at) : undefined,
      paymentMode: (r.payment_mode as PaymentMode) || undefined,
    }));
  }

  // ── Subscription lifecycle ────────────────────────────────────────────────

  /**
   * Make sure every firm has a subscription row and that its monthly charges
   * are generated up to the current month. Called at the top of every read so
   * a firm added through the users module is picked up without extra wiring.
   * Subscriptions/charges of deleted firms disappear via FK cascade.
   */
  private async syncSubscriptions(): Promise<void> {
    const firms = await this.usersService.getAllFirms();

    for (const firm of firms) {
      const fid = Number(firm.id.replace('firm-', ''));
      await q(
        `INSERT INTO subscriptions (id, lawfirm_id, status, started_at)
         VALUES ($1, $2, 'active', $3)
         ON CONFLICT (lawfirm_id) DO NOTHING`,
        [`sub-${fid}`, fid, firm.createdAt],
      );
    }

    await this.generateCharges();
  }

  /**
   * Issue the current billing period's charge for every active subscription,
   * idempotently (UNIQUE(subscription_id, period, kind)). Demo mode
   * deliberately does not backfill history for earlier months — a firm's
   * "lifetime earnings" start at zero and only grow once a real charge here is
   * actually marked Paid — but each firm always has this month's Pending
   * charge waiting so the pay/settle flow has something to demo.
   */
  private async generateCharges(): Promise<void> {
    const period = monthKey(new Date());
    const periodStart = startOfMonth(new Date());
    const periodEnd = addMonths(periodStart, 1);
    const pricing = await this.loadTierPricing();

    await q(
      `INSERT INTO subscription_charges
         (id, subscription_id, lawfirm_id, tier, kind, period, period_start, period_end, amount, status, issued_at)
       SELECT 'PSUB-' || s.lawfirm_id::text || '-' || $1,
              s.id, s.lawfirm_id, f.tier, 'monthly', $1, $2, $3,
              COALESCE(tp.monthly_price, 0), 'Pending', $2
       FROM subscriptions s
       JOIN lawfirm_meta f ON f.id = s.lawfirm_id
       LEFT JOIN tier_pricing tp ON tp.tier = f.tier
       WHERE s.status <> 'cancelled'
       ON CONFLICT (subscription_id, period) WHERE kind = 'monthly' DO NOTHING`,
      [period, periodStart, periodEnd],
    );
  }

  // ── Commission ────────────────────────────────────────────────────────────

  /**
   * LexFlow's cut of the law firms' own client invoices. Only invoices the
   * client has actually paid count towards earnings.
   */
  private async paidClientInvoices() {
    return (await this.billingService.findAllInvoices('SUPERADMIN'))
      .filter((inv) => inv.status === 'Paid');
  }

  private commissionOn(settings: PlatformSettings, amount: number): number {
    return round2((amount * settings.commissionRate) / 100);
  }

  // ── Revenue reporting ─────────────────────────────────────────────────────

  async getRevenueSummary() {
    await this.syncSubscriptions();

    const settings = await this.loadSettings();
    const pricing = await this.loadTierPricing();
    const subscriptions = await this.loadSubscriptions();
    const charges = await this.loadCharges();

    const thisMonthKey = monthKey(new Date());
    const lastMonthKey = monthKey(addMonths(startOfMonth(new Date()), -1));

    const activeSubs = subscriptions.filter((s) => s.status === 'active');
    const mrr = activeSubs.reduce((sum, s) => sum + s.monthlyPrice, 0);

    const subCollected = charges
      .filter((c) => c.status === 'Paid')
      .reduce((sum, c) => sum + c.amount, 0);
    const subOutstanding = charges
      .filter((c) => c.status !== 'Paid')
      .reduce((sum, c) => sum + c.amount, 0);

    const paidInvoices = await this.paidClientInvoices();
    const gmv = paidInvoices.reduce((sum, inv) => sum + inv.amount, 0);
    const commissionCollected = this.commissionOn(settings, gmv);

    // Clients are not always linked to a firm, so some paid invoices carry no
    // firmId. That commission is still earned, it just cannot be shown against
    // a firm in the by-firm breakdown — surface it so the two views reconcile.
    const unattributedGmv = paidInvoices
      .filter((inv) => !inv.firmId)
      .reduce((sum, inv) => sum + inv.amount, 0);

    // Billed = everything charged for that period; collected = the part settled.
    // The month in progress is billed but not yet collected, so reporting only
    // collected would make the current month read as a cliff down to zero.
    const subBilledInMonth = (key: string) =>
      charges
        .filter((c) => c.period === key)
        .reduce((sum, c) => sum + c.amount, 0);

    const subCollectedInMonth = (key: string) =>
      charges
        .filter((c) => c.status === 'Paid' && c.period === key)
        .reduce((sum, c) => sum + c.amount, 0);

    const commissionInMonth = (key: string) =>
      this.commissionOn(
        settings,
        paidInvoices
          .filter((inv) => monthKey(new Date(inv.createdAt)) === key)
          .reduce((sum, inv) => sum + inv.amount, 0),
      );

    const thisMonthTotal =
      subBilledInMonth(thisMonthKey) + commissionInMonth(thisMonthKey);
    const lastMonthTotal =
      subBilledInMonth(lastMonthKey) + commissionInMonth(lastMonthKey);

    const byTier = (Object.keys(TIER_LIMITS) as FirmTier[]).map((tier) => {
      const subs = activeSubs.filter((s) => s.tier === tier);
      return {
        tier,
        firms: subs.length,
        monthlyPrice: pricing[tier],
        mrr: subs.reduce((sum, s) => sum + s.monthlyPrice, 0),
      };
    });

    return {
      currency: settings.currency,
      mrr: round2(mrr),
      arr: round2(mrr * 12),
      totalEarnings: round2(subCollected + commissionCollected),
      subscriptionRevenue: {
        collected: round2(subCollected),
        outstanding: round2(subOutstanding),
      },
      commissionRevenue: {
        rate: settings.commissionRate,
        collected: commissionCollected,
        // What the firms billed their own clients — the base commission comes from.
        billedThroughPlatform: round2(gmv),
        unattributed: this.commissionOn(settings, unattributedGmv),
        paidInvoiceCount: paidInvoices.length,
      },
      activeSubscriptions: activeSubs.length,
      cancelledSubscriptions: subscriptions.filter((s) => s.status === 'cancelled').length,
      totalFirms: subscriptions.length,
      thisMonth: {
        period: thisMonthKey,
        subscription: round2(subBilledInMonth(thisMonthKey)),
        subscriptionCollected: round2(subCollectedInMonth(thisMonthKey)),
        commission: commissionInMonth(thisMonthKey),
        total: round2(thisMonthTotal),
      },
      lastMonth: {
        period: lastMonthKey,
        subscription: round2(subBilledInMonth(lastMonthKey)),
        subscriptionCollected: round2(subCollectedInMonth(lastMonthKey)),
        commission: commissionInMonth(lastMonthKey),
        total: round2(lastMonthTotal),
      },
      growthPct:
        lastMonthTotal > 0
          ? round2(((thisMonthTotal - lastMonthTotal) / lastMonthTotal) * 100)
          : null,
      byTier,
    };
  }

  /** Month-by-month earnings, oldest first — feeds the dashboard chart. */
  async getMonthlyRevenue(months = 6) {
    await this.syncSubscriptions();

    const settings = await this.loadSettings();
    const span = Math.min(Math.max(Number(months) || 6, 1), 24);
    const paidInvoices = await this.paidClientInvoices();
    const charges = await this.loadCharges();
    const series: Array<{
      period: string;
      label: string;
      subscription: number;
      collected: number;
      commission: number;
      total: number;
    }> = [];

    for (let i = span - 1; i >= 0; i--) {
      const key = monthKey(addMonths(startOfMonth(new Date()), -i));

      const periodCharges = charges.filter((c) => c.period === key);
      const subscription = periodCharges.reduce((sum, c) => sum + c.amount, 0);
      const collected = periodCharges
        .filter((c) => c.status === 'Paid')
        .reduce((sum, c) => sum + c.amount, 0);

      const commission = this.commissionOn(
        settings,
        paidInvoices
          .filter((inv) => monthKey(new Date(inv.createdAt)) === key)
          .reduce((sum, inv) => sum + inv.amount, 0),
      );

      series.push({
        period: key,
        label: monthLabel(key),
        subscription: round2(subscription),
        collected: round2(collected + commission),
        commission,
        total: round2(subscription + commission),
      });
    }

    return series;
  }

  /** Per-firm earnings breakdown — who is actually paying you. */
  async getRevenueByFirm() {
    await this.syncSubscriptions();

    const settings = await this.loadSettings();
    const subscriptions = await this.loadSubscriptions();
    const charges = await this.loadCharges();
    const paidInvoices = await this.paidClientInvoices();

    return subscriptions
      .map((sub) => {
        const firmCharges = charges.filter((c) => c.subscriptionId === sub.id);
        const collected = firmCharges
          .filter((c) => c.status === 'Paid')
          .reduce((sum, c) => sum + c.amount, 0);
        const outstanding = firmCharges
          .filter((c) => c.status !== 'Paid')
          .reduce((sum, c) => sum + c.amount, 0);

        const firmGmv = paidInvoices
          .filter((inv) => inv.firmId === sub.firmId)
          .reduce((sum, inv) => sum + inv.amount, 0);
        const commission = this.commissionOn(settings, firmGmv);

        return {
          firmId: sub.firmId,
          firmName: sub.firmName,
          tier: sub.tier,
          status: sub.status,
          monthlyPrice: sub.monthlyPrice,
          since: sub.startedAt,
          months: firmCharges.length,
          subscriptionCollected: round2(collected),
          subscriptionOutstanding: round2(outstanding),
          commission,
          billedThroughPlatform: round2(firmGmv),
          totalEarned: round2(collected + commission),
        };
      })
      .sort((a, b) => b.totalEarned - a.totalEarned);
  }

  // ── Subscriptions ─────────────────────────────────────────────────────────

  async getSubscriptions(): Promise<Subscription[]> {
    await this.syncSubscriptions();
    return this.loadSubscriptions();
  }

  async getSubscriptionByFirm(firmId: string): Promise<Subscription> {
    await this.syncSubscriptions();
    const sub = (await this.loadSubscriptions()).find((s) => s.firmId === firmId);
    if (!sub) {
      throw new NotFoundException(`No subscription found for firm "${firmId}"`);
    }
    return sub;
  }

  /**
   * Change a firm's plan or subscription state. Changing the tier here also
   * moves the firm's tier in the users module, so seat caps follow the plan.
   */
  async updateSubscription(firmId: string, dto: UpdateSubscriptionDto): Promise<Subscription> {
    const sub = await this.getSubscriptionByFirm(firmId);
    const fid = Number(firmId.replace('firm-', ''));

    if (dto.tier) {
      // Superadmin override. A pending change to this same tier is now moot.
      await this.usersService.updateFirmTier(firmId, dto.tier);
      await q(
        `UPDATE subscriptions SET pending_tier = NULL, pending_charge_id = NULL
         WHERE lawfirm_id = $1 AND pending_tier = $2`,
        [fid, dto.tier],
      );
    }

    if (dto.status) {
      await q(
        `UPDATE subscriptions SET status = $2, cancelled_at = $3 WHERE lawfirm_id = $1`,
        [fid, dto.status, dto.status === 'cancelled' ? new Date() : null],
      );
    }

    await this.generateCharges();
    return this.getSubscriptionByFirm(sub.firmId);
  }

  // ── Subscription charges (LexFlow → firm) ─────────────────────────────────

  async getCharges(firmId?: string): Promise<SubscriptionCharge[]> {
    await this.syncSubscriptions();
    const charges = await this.loadCharges();
    return firmId ? charges.filter((c) => c.firmId === firmId) : charges;
  }

  /**
   * Resolve the firm a firmadmin/lawyer caller belongs to, for scoping charge
   * reads and writes to "their own firm only". Throws rather than silently
   * returning nothing, so a bad or missing caller id fails loudly.
   */
  async resolveCallerFirmId(callerId: string | undefined): Promise<string> {
    if (!callerId) {
      throw new BadRequestException(
        'x-user-id header is required to scope subscription charges to your firm',
      );
    }
    const firm = await this.usersService.getUserFirm(callerId);
    if (!firm) {
      throw new BadRequestException(
        `Caller "${callerId}" is not linked to a law firm`,
      );
    }
    return firm.id;
  }

  /** Firm-scoped read: only ever returns the calling firm's own charges. */
  async getChargesForFirm(callerId: string | undefined): Promise<SubscriptionCharge[]> {
    const firmId = await this.resolveCallerFirmId(callerId);
    return this.getCharges(firmId);
  }

  /**
   * SUPERADMIN: set a charge's status.
   *  - 'Paid'    → recorded as a manual settlement through the same path as a
   *                firm payment (so the plan-activation rule applies equally).
   *  - 'Pending' / 'Overdue' → bookkeeping only; a Paid charge can never be
   *                re-opened, because a payment was already recorded for it.
   */
  async updateChargeStatus(
    id: string,
    status: ChargeStatus,
    actorId?: string,
  ): Promise<SubscriptionCharge> {
    if (!['Paid', 'Pending', 'Overdue'].includes(status)) {
      throw new BadRequestException('status must be one of: Paid, Pending, Overdue');
    }
    if (status === 'Paid') {
      return this.settleCharge(id, { mode: 'manual', paidBy: actorId });
    }
    const charge = await this.getChargeById(id);
    if (charge.status === 'Paid') {
      throw new ConflictException('A paid charge cannot be re-opened.');
    }
    await q(`UPDATE subscription_charges SET status = $2 WHERE id = $1`, [id, status]);
    return this.getChargeById(id);
  }

  /**
   * FIRM ADMIN: pay one of their own firm's charges. There is no payment
   * gateway in this project, so this is recorded honestly as a 'simulated'
   * payment (see subscription_payments.mode) — never as a real transaction.
   */
  async payChargeAsFirm(chargeId: string, callerId: string | undefined): Promise<SubscriptionCharge> {
    const firmId = await this.resolveCallerFirmId(callerId);
    return this.settleCharge(chargeId, { firmId, mode: 'simulated', paidBy: callerId });
  }

  private async getChargeById(id: string): Promise<SubscriptionCharge> {
    const charges = await this.loadCharges();
    const charge = charges.find((c) => c.id === id);
    if (!charge) {
      throw new NotFoundException(`Subscription charge "${id}" not found`);
    }
    return charge;
  }

  /**
   * The ONE place a charge becomes Paid. Everything happens in a single
   * transaction while holding the firm's subscription row lock, so concurrent
   * payments / plan requests for the same firm are serialised:
   *   1. ownership check (firmId, when the caller is a firm),
   *   2. already Paid → return as-is (idempotent: no second payment row),
   *   3. record the payment + mark the charge Paid,
   *   4. re-evaluate the pending plan change on the server and activate it
   *      only if every required charge is now settled.
   */
  private async settleCharge(
    chargeId: string,
    opts: { firmId?: string; mode: PaymentMode; paidBy?: string },
  ): Promise<SubscriptionCharge> {
    await this.syncSubscriptions();

    await tx(async (c) => {
      const found = await c.query(
        `SELECT lawfirm_id FROM subscription_charges WHERE id = $1`,
        [chargeId],
      );
      if (!found.rows[0]) {
        throw new NotFoundException(`Subscription charge "${chargeId}" not found`);
      }
      const fid = found.rows[0].lawfirm_id as number;
      if (opts.firmId && opts.firmId !== `firm-${fid}`) {
        throw new ForbiddenException(
          'You can only pay subscription charges that belong to your own firm',
        );
      }

      // Lock order is always: subscription row, then the charge row.
      await c.query(`SELECT 1 FROM subscriptions WHERE lawfirm_id = $1 FOR UPDATE`, [fid]);
      const locked = await c.query(
        `SELECT status, amount FROM subscription_charges WHERE id = $1 FOR UPDATE`,
        [chargeId],
      );

      if (locked.rows[0].status !== 'Paid') {
        await c.query(
          `INSERT INTO subscription_payments (id, charge_id, lawfirm_id, amount, mode, paid_by)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (charge_id) DO NOTHING`,
          [`PAY-${chargeId}`, chargeId, fid, locked.rows[0].amount, opts.mode, opts.paidBy || null],
        );
        await c.query(
          `UPDATE subscription_charges SET status = 'Paid', paid_at = CURRENT_TIMESTAMP WHERE id = $1`,
          [chargeId],
        );
      }
      await this.activateIfEligible(c, fid);
    });

    return this.getChargeById(chargeId);
  }

  /**
   * Server-side activation check (the only code that moves a firm onto a
   * pending tier). Runs inside the caller's transaction: activates the pending
   * tier iff NO required charge (see REQUIRED_OUTSTANDING_SQL) is still unpaid.
   * Safe to call any number of times — once activated, pending is cleared.
   */
  private async activateIfEligible(c: PoolClient, fid: number): Promise<boolean> {
    const sub = await c.query(
      `SELECT pending_tier, pending_charge_id FROM subscriptions WHERE lawfirm_id = $1`,
      [fid],
    );
    const pendingTier = sub.rows[0]?.pending_tier as FirmTier | null;
    if (!pendingTier || !sub.rows[0].pending_charge_id) return false;

    const blocking = await c.query(`${REQUIRED_OUTSTANDING_SQL} AND s.lawfirm_id = $1`, [fid]);
    if (blocking.rows.length > 0) return false;

    await c.query(
      `UPDATE lawfirm_meta SET tier = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [fid, pendingTier],
    );
    await c.query(
      `UPDATE subscriptions SET pending_tier = NULL, pending_charge_id = NULL WHERE lawfirm_id = $1`,
      [fid],
    );
    return true;
  }

  /**
   * Request a plan change. This never moves the firm onto the new tier — it
   * records a pending change and one charge for the new plan's price. The tier
   * only changes in activateIfEligible, after every required charge is paid.
   *
   * Idempotent and race-safe (single transaction under the subscription row
   * lock, plus a partial unique index on unpaid tier-change charges):
   *  - same target requested again          → returns the existing request,
   *  - a different target while one is open → replaces the unpaid request,
   *  - the active tier                      → cancels the unpaid request,
   *  - once the plan-change charge is Paid the request can no longer be
   *    swapped or cancelled (409).
   */
  async requestTierChange(
    firmId: string,
    targetTier: FirmTier,
    callerId: string | undefined,
    isSuperAdmin: boolean,
  ): Promise<{ subscription: Subscription; charge: SubscriptionCharge | null }> {
    if (!isSuperAdmin) {
      const callerFirmId = await this.resolveCallerFirmId(callerId);
      if (callerFirmId !== firmId) {
        throw new ForbiddenException(
          'You can only request a plan change for your own firm',
        );
      }
    }
    if (!TIER_LIMITS[targetTier]) {
      throw new BadRequestException(
        'Invalid tier. Allowed values: ' + Object.keys(TIER_LIMITS).join(', '),
      );
    }

    await this.syncSubscriptions();
    const sub = await this.getSubscriptionByFirm(firmId); // 404 when there is none
    if (sub.status === 'cancelled') {
      throw new BadRequestException('This subscription is cancelled; plan changes are not possible.');
    }
    const fid = Number(firmId.replace('firm-', ''));
    const pricing = await this.loadTierPricing();

    const chargeId = await tx(async (c) => {
      await c.query(`SELECT 1 FROM subscriptions WHERE lawfirm_id = $1 FOR UPDATE`, [fid]);
      // Re-read inside the lock: another request may have changed things.
      const cur = await c.query(
        `SELECT f.tier, s.id AS sub_id, s.pending_tier, s.pending_charge_id,
                pc.status AS pending_status
         FROM subscriptions s
         JOIN lawfirm_meta f ON f.id = s.lawfirm_id
         LEFT JOIN subscription_charges pc ON pc.id = s.pending_charge_id
         WHERE s.lawfirm_id = $1`,
        [fid],
      );
      const row = cur.rows[0];

      // Upgrades only: there is no refund flow, so a firm cannot move to a cheaper plan.
      const order = Object.keys(TIER_LIMITS);
      if (order.indexOf(targetTier) < order.indexOf(row.tier)) {
        throw new BadRequestException('Plan downgrades are not supported. You can only upgrade to a higher plan.');
      }

      if (row.pending_tier) {
        if (row.pending_tier === targetTier && targetTier !== row.tier) {
          return row.pending_charge_id as string; // repeated request: nothing new
        }
        if (row.pending_status === 'Paid') {
          throw new ConflictException(
            `A change to ${row.pending_tier} is already paid and waiting for the remaining dues; it cannot be changed or cancelled.`,
          );
        }
        // Unpaid request being replaced or cancelled: drop it.
        await c.query(`DELETE FROM subscription_charges WHERE id = $1`, [row.pending_charge_id]);
        await c.query(
          `UPDATE subscriptions SET pending_tier = NULL, pending_charge_id = NULL WHERE lawfirm_id = $1`,
          [fid],
        );
      }
      if (targetTier === row.tier) return null; // back to the active plan: no request

      const now = new Date();
      const id = `PTIER-${firmId.toUpperCase()}-${now.getTime()}`;
      await c.query(
        `INSERT INTO subscription_charges
           (id, subscription_id, lawfirm_id, tier, kind, target_tier, period,
            period_start, period_end, amount, status, issued_at)
         VALUES ($1,$2,$3,$4,'tier_change',$5,$6,$7,$7,$8,'Pending',$7)`,
        [id, row.sub_id, fid, row.tier, targetTier, monthKey(now), now, pricing[targetTier]],
      );
      await c.query(
        `UPDATE subscriptions SET pending_tier = $2, pending_charge_id = $3 WHERE lawfirm_id = $1`,
        [fid, targetTier, id],
      );
      return id;
    });

    return {
      subscription: await this.getSubscriptionByFirm(firmId),
      charge: chargeId ? await this.getChargeById(chargeId) : null,
    };
  }

  // ── Tier pricing ──────────────────────────────────────────────────────────

  async getTierPlans(): Promise<TierPlan[]> {
    const pricing = await this.loadTierPricing();
    return (Object.keys(TIER_LIMITS) as FirmTier[]).map((tier) => ({
      tier,
      monthlyPrice: pricing[tier],
      lawyerSeats: TIER_LIMITS[tier].lawyers,
      internSeats: TIER_LIMITS[tier].interns,
    }));
  }

  /**
   * Reprice a tier. Existing subscriptions move to the new price from the next
   * charge onwards; charges already issued keep the price they were billed at.
   */
  async updateTierPricing(tier: FirmTier, dto: UpdateTierPricingDto): Promise<TierPlan> {
    if (!TIER_LIMITS[tier]) {
      throw new BadRequestException(
        'Invalid tier. Allowed values: Starter, Growth, Enterprise',
      );
    }

    await q(
      `INSERT INTO tier_pricing (tier, monthly_price) VALUES ($1, $2)
       ON CONFLICT (tier) DO UPDATE SET monthly_price = $2`,
      [tier, dto.monthlyPrice],
    );

    return {
      tier,
      monthlyPrice: dto.monthlyPrice,
      lawyerSeats: TIER_LIMITS[tier].lawyers,
      internSeats: TIER_LIMITS[tier].interns,
    };
  }

  // ── Platform settings ─────────────────────────────────────────────────────

  async getSettings(): Promise<PlatformSettings> {
    return this.loadSettings();
  }

  async updateSettings(dto: UpdateSettingsDto): Promise<PlatformSettings> {
    const sets: string[] = [];
    const params: unknown[] = [];
    const add = (col: string, value: unknown) => {
      params.push(value);
      sets.push(`${col} = $${params.length}`);
    };

    if (dto.commissionRate !== undefined) add('commission_rate', dto.commissionRate);
    if (dto.supportEmail !== undefined) add('support_email', dto.supportEmail);
    if (dto.currency !== undefined) add('currency', dto.currency);
    if (dto.maintenanceMode !== undefined) add('maintenance_mode', dto.maintenanceMode);
    if (dto.disableSignup !== undefined) add('disable_signup', dto.disableSignup);

    if (sets.length) {
      await q(`UPDATE platform_settings SET ${sets.join(', ')} WHERE id = 1`, params);
    }
    return this.loadSettings();
  }
}
