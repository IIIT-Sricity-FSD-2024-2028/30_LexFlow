import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { PoolClient } from 'pg';
import { randomUUID } from 'node:crypto';
import { UsersService, FirmTier, TIER_LIMITS } from '../users/users.service';
import { BillingService } from '../billing/billing.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { UpdateTierPricingDto } from './dto/update-tier-pricing.dto';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';
import { pool, q, tx } from '../db';
import { UpdateRenewalDto } from './dto/update-renewal.dto';
import { addBillingMonth, testPaymentMethod, TestPaymentMethod } from './subscription-cycle';

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
  currentPeriodStart?: string;
  currentPeriodEnd?: string;
  hasPaidAccess: boolean;
  autoRenew: boolean;
  paymentMethod?: { last4: string };
  scheduledTier?: FirmTier;
  renewalFailure?: string;
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
  failureReason?: string;
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
    AND (ch.id = pc.id OR (NOT pc.rolling AND ch.kind = 'monthly' AND ch.issued_at <= pc.issued_at))`;

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
export class PlatformService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PlatformService.name);
  private renewalTimer?: NodeJS.Timeout;
  private renewalsRunning?: Promise<void>;

  constructor(
    private readonly usersService: UsersService,
    private readonly billingService: BillingService,
  ) {}

  async onModuleInit() {
    await this.syncSubscriptions();
    this.renewalTimer = setInterval(() => {
      this.renewDueSubscriptions().catch((error: unknown) => {
        this.logger.error(error instanceof Error ? error.message : String(error));
      });
    }, 60_000);
    this.renewalTimer.unref();
  }

  onModuleDestroy() {
    clearInterval(this.renewalTimer);
  }

  private async loadTierPricing(db: Pick<PoolClient, 'query'> = pool): Promise<Record<FirmTier, number>> {
    const { rows } = await db.query('SELECT tier, monthly_price FROM tier_pricing');
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
      `SELECT s.*, f.name AS firm_name, f.tier,
              (SELECT ch.failure_reason FROM subscription_charges ch
               WHERE ch.subscription_id = s.id AND ch.rolling AND ch.kind = 'renewal'
                 AND ch.status <> 'Paid' AND ch.failure_reason IS NOT NULL
               ORDER BY ch.issued_at DESC LIMIT 1) AS renewal_failure
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
      const saved = testPaymentMethod(r.payment_method_ref);
      const hasPaidAccess = r.paid_through != null && new Date(r.paid_through) > new Date();
      return {
        id: r.id as string,
        firmId: `firm-${r.lawfirm_id}`,
        firmName: r.firm_name as string,
        tier,
        status: r.status === 'cancelled' ? 'cancelled' : hasPaidAccess ? 'active' : 'past_due',
        hasPaidAccess,
        autoRenew: r.status !== 'cancelled' && Boolean(r.auto_renew && saved),
        paymentMethod: saved ? { last4: saved.last4 } : undefined,
        scheduledTier: r.scheduled_tier || undefined,
        renewalFailure: r.renewal_failure || undefined,
        monthlyPrice: pricing[tier] ?? 0,
        startedAt,
        currentPeriodStart: r.period_started_at ? iso(r.period_started_at) : undefined,
        currentPeriodEnd: r.paid_through ? iso(r.paid_through) : undefined,
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
      kind: (r.kind === 'renewal' ? 'monthly' : r.kind) as ChargeKind,
      targetTier: (r.target_tier as FirmTier) || undefined,
      period: r.period as string,
      periodStart: iso(r.period_start),
      periodEnd: iso(r.period_end),
      amount: Number(r.amount),
      status: r.status as ChargeStatus,
      issuedAt: iso(r.issued_at),
      paidAt: r.paid_at ? iso(r.paid_at) : undefined,
      failureReason: r.failure_reason || undefined,
      paymentMode: (r.payment_mode as PaymentMode) || undefined,
    }));
  }

  // ── Subscription lifecycle ────────────────────────────────────────────────

  private async ensureSubscriptions(): Promise<void> {
    await q(
      `INSERT INTO subscriptions (id, lawfirm_id, status, started_at)
       SELECT 'sub-' || id, id, 'active', COALESCE(created_at, CURRENT_TIMESTAMP) FROM lawfirm_meta
       ON CONFLICT (lawfirm_id) DO NOTHING`,
    );
  }

  private async syncSubscriptions(): Promise<void> {
    await this.ensureSubscriptions();
    await this.renewDueSubscriptions();
  }

  private renewDueSubscriptions(firmId?: number): Promise<void> {
    if (firmId !== undefined) return this.runDueRenewals(firmId);
    if (!this.renewalsRunning) {
      this.renewalsRunning = this.runDueRenewals().finally(() => {
        this.renewalsRunning = undefined;
      });
    }
    return this.renewalsRunning;
  }

  private async runDueRenewals(firmId?: number): Promise<void> {
    const { rows } = await q<{ lawfirm_id: number }>(
      `SELECT s.lawfirm_id FROM subscriptions s
       WHERE s.auto_renew AND s.payment_method_ref IS NOT NULL AND s.status <> 'cancelled'
         AND s.paid_through <= CURRENT_TIMESTAMP
         AND ($1::int IS NULL OR s.lawfirm_id = $1)
         AND NOT EXISTS (
           SELECT 1 FROM subscription_charges ch WHERE ch.subscription_id = s.id AND ch.rolling
             AND ch.kind = 'renewal' AND ch.status <> 'Paid' AND ch.failure_reason IS NOT NULL
         )`,
      [firmId ?? null],
    );
    for (const { lawfirm_id } of rows) {
      await tx(async (db) => {
        const sub = await this.lockSubscription(db, lawfirm_id);
        const now = new Date();
        if (sub.status === 'cancelled' || !sub.auto_renew || !sub.payment_method_ref
            || !sub.paid_through || new Date(sub.paid_through) > now) return;
        const charge = await this.prepareCharge(db, sub, sub.scheduled_tier ?? sub.tier, 'renewal', now);
        if (charge.failure_reason) return;

        if (!testPaymentMethod(sub.payment_method_ref)?.renews) {
          await db.query(
            "UPDATE subscription_charges SET status = 'Overdue', failure_reason = $2 WHERE id = $1",
            [charge.id, 'The saved payment method declined the renewal. Pay the renewal with another test card.'],
          );
          return;
        }
        await this.recordChargePayment(db, charge, { mode: 'simulated', reference: sub.payment_method_ref }, now);
        await this.startPaidPeriod(db, charge, now);
      });
    }
  }

  private async lockSubscription(db: PoolClient, firmId: number) {
    const { rows } = await db.query(
      `SELECT s.*, f.tier FROM subscriptions s JOIN lawfirm_meta f ON f.id = s.lawfirm_id
       WHERE s.lawfirm_id = $1 FOR UPDATE OF s`,
      [firmId],
    );
    if (!rows[0]) throw new NotFoundException('Firm subscription not found');
    return rows[0];
  }

  private async prepareCharge(
    db: PoolClient,
    sub: { id: string; lawfirm_id: number; tier: FirmTier },
    tier: FirmTier,
    kind: 'renewal' | 'tier_change',
    now: Date,
  ) {
    const existing = await db.query(
      `SELECT * FROM subscription_charges
       WHERE subscription_id = $1 AND kind = $2 AND rolling AND status <> 'Paid'`,
      [sub.id, kind],
    );
    const sameTier = existing.rows.find((charge) => (charge.target_tier ?? charge.tier) === tier);
    if (sameTier) return sameTier;

    await db.query(
      `DELETE FROM subscription_charges WHERE subscription_id = $1
       AND kind = $2 AND rolling AND status <> 'Paid'`,
      [sub.id, kind],
    );
    const pricing = await this.loadTierPricing(db);
    const id = (kind === 'tier_change' ? 'PTIER-' : 'PSUB-') + randomUUID();
    const { rows } = await db.query(
      `INSERT INTO subscription_charges
         (id, subscription_id, lawfirm_id, tier, target_tier, kind, period, period_start,
          period_end, amount, status, rolling)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'Pending',TRUE) RETURNING *`,
      [id, sub.id, sub.lawfirm_id, kind === 'tier_change' ? sub.tier : tier,
       kind === 'tier_change' ? tier : null, kind, monthKey(now), now, addBillingMonth(now), pricing[tier]],
    );
    return rows[0];
  }

  async requirePaidAccess(firmId: string): Promise<void> {
    const fid = Number(firmId.replace('firm-', ''));
    await this.renewDueSubscriptions(fid);
    const active = await q(
      'SELECT 1 FROM subscriptions WHERE lawfirm_id = $1 AND paid_through > CURRENT_TIMESTAMP',
      [fid],
    );
    if (!active.rowCount) {
      throw new ForbiddenException('Your firm has read-only access. Renew the subscription in Firm Billing to make changes.');
    }
  }

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
  async payChargeAsFirm(
    chargeId: string,
    callerId: string | undefined,
    paymentMethod?: TestPaymentMethod,
  ): Promise<SubscriptionCharge> {
    const firmId = await this.resolveCallerFirmId(callerId);
    return this.settleCharge(chargeId, { firmId, mode: 'simulated', paidBy: callerId, reference: paymentMethod });
  }

  private async getChargeById(id: string): Promise<SubscriptionCharge> {
    const charges = await this.loadCharges();
    const charge = charges.find((c) => c.id === id);
    if (!charge) {
      throw new NotFoundException(`Subscription charge "${id}" not found`);
    }
    return charge;
  }

  private async recordChargePayment(
    db: PoolClient,
    charge: { id: string; lawfirm_id: number; amount: number },
    payment: { mode: PaymentMode; paidBy?: string; reference?: string },
    paidAt: Date,
  ) {
    await db.query(
      `INSERT INTO subscription_payments (id, charge_id, lawfirm_id, amount, mode, paid_by, reference, paid_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (charge_id) DO NOTHING`,
      ['PAY-' + charge.id, charge.id, charge.lawfirm_id, charge.amount, payment.mode,
       payment.paidBy ?? null, payment.reference ?? null, paidAt],
    );
    await db.query(
      "UPDATE subscription_charges SET status = 'Paid', paid_at = $2, failure_reason = NULL WHERE id = $1",
      [charge.id, paidAt],
    );
  }

  private async startPaidPeriod(
    db: PoolClient,
    charge: { id: string; lawfirm_id: number; tier: FirmTier; target_tier?: FirmTier },
    paidAt: Date,
  ) {
    const tier = charge.target_tier ?? charge.tier;
    const paidThrough = addBillingMonth(paidAt);
    await db.query(
      'UPDATE lawfirm_meta SET tier = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
      [charge.lawfirm_id, tier],
    );
    await db.query(
      `UPDATE subscriptions SET period_started_at = $2, paid_through = $3, status = 'active',
          scheduled_tier = NULL,
          pending_tier = CASE WHEN pending_charge_id = $4 THEN NULL ELSE pending_tier END,
          pending_charge_id = CASE WHEN pending_charge_id = $4 THEN NULL ELSE pending_charge_id END
       WHERE lawfirm_id = $1`,
      [charge.lawfirm_id, paidAt, paidThrough, charge.id],
    );
    await db.query(
      'UPDATE subscription_charges SET period_start = $2, period_end = $3, period = $4 WHERE id = $1 AND rolling',
      [charge.id, paidAt, paidThrough, monthKey(paidAt)],
    );
    await db.query(
      "DELETE FROM subscription_charges WHERE lawfirm_id = $1 AND rolling AND kind = 'renewal' AND status <> 'Paid'",
      [charge.lawfirm_id],
    );
  }

  private async settleCharge(
    chargeId: string,
    opts: { firmId?: string; mode: PaymentMode; paidBy?: string; reference?: TestPaymentMethod },
  ): Promise<SubscriptionCharge> {
    await this.ensureSubscriptions();
    await tx(async (db) => {
      const found = await db.query('SELECT lawfirm_id FROM subscription_charges WHERE id = $1', [chargeId]);
      if (!found.rows.length) throw new NotFoundException('Subscription charge not found');
      const fid = found.rows[0].lawfirm_id as number;
      if (opts.firmId && opts.firmId !== 'firm-' + fid) {
        throw new ForbiddenException('You can only pay subscription charges for your own firm.');
      }

      const sub = await this.lockSubscription(db, fid);
      const locked = await db.query('SELECT * FROM subscription_charges WHERE id = $1 FOR UPDATE', [chargeId]);
      const charge = locked.rows[0];
      if (!charge) throw new NotFoundException('This charge is no longer available. Refresh Firm Billing.');
      if (charge.status === 'Paid') return;
      if (sub.status === 'cancelled') throw new BadRequestException('This subscription was cancelled by the platform.');

      const paidAt = new Date();
      if (opts.reference) {
        await db.query(
          'UPDATE subscriptions SET payment_method_ref = $2, auto_renew = TRUE WHERE lawfirm_id = $1',
          [fid, opts.reference],
        );
      }
      await this.recordChargePayment(db, charge, opts, paidAt);
      if (charge.rolling) {
        await this.startPaidPeriod(db, charge, paidAt);
        return;
      }

      // Previously issued calendar charges remain payable. A legacy charge for
      // the active tier can start coverage when the firm has no paid period.
      if (await this.activateIfEligible(db, fid)) return;
      if (charge.kind === 'monthly' && charge.tier === sub.tier
          && (!sub.paid_through || new Date(sub.paid_through) <= paidAt) && !sub.scheduled_tier) {
        await this.startPaidPeriod(db, charge, paidAt);
      }
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

    await this.startPaidPeriod(c, {
      id: sub.rows[0].pending_charge_id,
      lawfirm_id: fid,
      tier: pendingTier,
    }, new Date());
    return true;
  }

  private async checkRenewalScope(firmId: string, callerId: string, isSuperAdmin: boolean) {
    if (!isSuperAdmin && await this.resolveCallerFirmId(callerId) !== firmId) {
      throw new ForbiddenException('You can only manage the subscription for your own firm.');
    }
  }

  async updateRenewal(firmId: string, callerId: string, isSuperAdmin: boolean, dto: UpdateRenewalDto) {
    await this.checkRenewalScope(firmId, callerId, isSuperAdmin);
    await this.ensureSubscriptions();
    const fid = Number(firmId.replace('firm-', ''));
    await tx(async (db) => {
      const sub = await this.lockSubscription(db, fid);
      if (sub.status === 'cancelled') throw new BadRequestException('This subscription was cancelled by the platform.');
      const method = dto.paymentMethod === undefined ? sub.payment_method_ref : dto.paymentMethod;
      if (dto.autoRenew && !testPaymentMethod(method)) {
        throw new BadRequestException('Add a test payment method before turning on automatic renewal.');
      }
      const enabled = method ? (dto.autoRenew ?? sub.auto_renew) : false;
      await db.query(
        'UPDATE subscriptions SET payment_method_ref = $2, auto_renew = $3 WHERE lawfirm_id = $1',
        [fid, method, enabled],
      );
      if (enabled && (dto.paymentMethod !== undefined || !sub.auto_renew)) {
        await db.query(
          `UPDATE subscription_charges SET failure_reason = NULL, status = 'Pending'
           WHERE subscription_id = $1 AND rolling AND kind = 'renewal' AND failure_reason IS NOT NULL`,
          [sub.id],
        );
      }
    });
    return this.getSubscriptionByFirm(firmId);
  }

  async prepareRenewal(firmId: string, callerId: string, isSuperAdmin: boolean): Promise<SubscriptionCharge> {
    await this.checkRenewalScope(firmId, callerId, isSuperAdmin);
    await this.syncSubscriptions();
    const fid = Number(firmId.replace('firm-', ''));
    const chargeId = await tx(async (db) => {
      const sub = await this.lockSubscription(db, fid);
      const now = new Date();
      if (sub.status === 'cancelled') throw new BadRequestException('This subscription was cancelled by the platform.');
      if (sub.paid_through && new Date(sub.paid_through) > now) {
        throw new BadRequestException('Your plan is paid through the current period.');
      }
      return (await this.prepareCharge(db, sub, sub.scheduled_tier ?? sub.tier, 'renewal', now)).id as string;
    });
    return this.getChargeById(chargeId);
  }

  async requestTierChange(
    firmId: string,
    targetTier: FirmTier,
    callerId: string,
    isSuperAdmin: boolean,
  ): Promise<{ subscription: Subscription; charge: SubscriptionCharge | null }> {
    await this.checkRenewalScope(firmId, callerId, isSuperAdmin);
    if (!Object.keys(TIER_LIMITS).includes(targetTier)) throw new BadRequestException('Select a valid plan.');
    await this.syncSubscriptions();
    const fid = Number(firmId.replace('firm-', ''));
    const chargeId = await tx(async (db) => {
      const sub = await this.lockSubscription(db, fid);
      if (sub.status === 'cancelled') throw new BadRequestException('This subscription was cancelled by the platform.');
      const now = new Date();
      const active = sub.paid_through && new Date(sub.paid_through) > now;
      const current = sub.tier as FirmTier;
      if (sub.pending_charge_id) {
        const { rows } = await db.query('SELECT status FROM subscription_charges WHERE id = $1', [sub.pending_charge_id]);
        if (targetTier === sub.pending_tier) return sub.pending_charge_id as string;
        if (rows[0]?.status === 'Paid') {
          throw new ConflictException('The existing upgrade is paid. Settle the remaining required charges first.');
        }
        await db.query("DELETE FROM subscription_charges WHERE id = $1 AND status <> 'Paid'", [sub.pending_charge_id]);
      }
      await db.query(
        'UPDATE subscriptions SET pending_tier = NULL, pending_charge_id = NULL, scheduled_tier = NULL WHERE lawfirm_id = $1',
        [fid],
      );
      if (targetTier === current) {
        await db.query(
          "DELETE FROM subscription_charges WHERE subscription_id = $1 AND rolling AND kind = 'renewal' AND status <> 'Paid' AND tier <> $2",
          [sub.id, current],
        );
        return null;
      }
      if (active && Object.keys(TIER_LIMITS).indexOf(targetTier) < Object.keys(TIER_LIMITS).indexOf(current)) {
        await db.query('UPDATE subscriptions SET scheduled_tier = $2 WHERE lawfirm_id = $1', [fid, targetTier]);
        return null;
      }

      const charge = await this.prepareCharge(db, sub, targetTier, 'tier_change', now);
      await db.query(
        'UPDATE subscriptions SET pending_tier = $2, pending_charge_id = $3 WHERE lawfirm_id = $1',
        [fid, targetTier, charge.id],
      );
      return charge.id as string;
    });
    const subscription = await this.getSubscriptionByFirm(firmId);
    return { subscription, charge: chargeId ? await this.getChargeById(chargeId) : null };
  }

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
