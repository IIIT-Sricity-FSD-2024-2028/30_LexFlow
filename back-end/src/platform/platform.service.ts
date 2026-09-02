import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  OnModuleInit,
} from '@nestjs/common';
import { UsersService, FirmTier, TIER_LIMITS } from '../users/users.service';
import { BillingService } from '../billing/billing.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { UpdateTierPricingDto } from './dto/update-tier-pricing.dto';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';
import { q } from '../db';

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
}

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
}

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
      };
    });
  }

  private async loadCharges(): Promise<SubscriptionCharge[]> {
    const { rows } = await q(
      `SELECT ch.*, f.name AS firm_name
       FROM subscription_charges ch JOIN lawfirm_meta f ON f.id = ch.lawfirm_id
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
       ON CONFLICT (subscription_id, period, kind) DO NOTHING`,
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
      await this.usersService.updateFirmTier(firmId, dto.tier);
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

  async updateChargeStatus(id: string, status: ChargeStatus): Promise<SubscriptionCharge> {
    await this.syncSubscriptions();
    const res = await q(
      `UPDATE subscription_charges SET status = $2, paid_at = $3 WHERE id = $1`,
      [id, status, status === 'Paid' ? new Date() : null],
    );
    if (!res.rowCount) {
      throw new NotFoundException(`Subscription charge "${id}" not found`);
    }
    await this.applyIfTierChangeCharge(id);
    return this.getChargeById(id);
  }

  /**
   * Firm-scoped write: a firmadmin may only settle a charge that belongs to
   * their own firm, and may only mark it Paid — the Pending/Overdue states
   * are the platform's own bookkeeping, not the firm's to set.
   */
  async payChargeAsFirm(chargeId: string, callerId: string | undefined): Promise<SubscriptionCharge> {
    await this.syncSubscriptions();
    const firmId = await this.resolveCallerFirmId(callerId);

    const charge = await this.getChargeById(chargeId);
    if (charge.firmId !== firmId) {
      throw new ForbiddenException(
        'You can only pay subscription charges that belong to your own firm',
      );
    }

    return this.updateChargeStatus(chargeId, 'Paid');
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
   * A 'tier_change' charge is a promise, not just a bill: paying it is the
   * moment the firm actually switches plans. Called right after any path
   * marks a charge Paid — a no-op for ordinary 'monthly' charges.
   */
  private async applyIfTierChangeCharge(chargeId: string): Promise<void> {
    const charge = await this.getChargeById(chargeId);
    if (charge.kind !== 'tier_change' || !charge.targetTier) return;

    const fid = Number(charge.firmId.replace('firm-', ''));
    await this.usersService.updateFirmTier(charge.firmId, charge.targetTier);
    await q(
      `UPDATE subscriptions SET pending_tier = NULL, pending_charge_id = NULL
       WHERE lawfirm_id = $1 AND pending_charge_id = $2`,
      [fid, charge.id],
    );
  }

  /**
   * Request a plan change. This does not move the firm onto the new tier —
   * it issues a one-time charge for the new plan's price, and only paying
   * that charge (payChargeAsFirm / updateChargeStatus) actually applies it.
   *
   * Requesting the tier the firm is already on cancels a pending request
   * instead of erroring, so "change your mind" doesn't need a separate
   * endpoint. Requesting again while a request is already pending replaces
   * the old unpaid charge rather than stacking a second one.
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
        'Invalid tier. Allowed values: Starter, Growth, Enterprise',
      );
    }

    const sub = await this.getSubscriptionByFirm(firmId);
    const fid = Number(firmId.replace('firm-', ''));

    // Clear out any earlier unpaid request before deciding what to do next —
    // there is only ever one live tier-change charge per firm.
    if (sub.pendingChargeId) {
      await q(`DELETE FROM subscription_charges WHERE id = $1`, [sub.pendingChargeId]);
    }

    if (targetTier === sub.tier) {
      await q(
        `UPDATE subscriptions SET pending_tier = NULL, pending_charge_id = NULL WHERE lawfirm_id = $1`,
        [fid],
      );
      return { subscription: await this.getSubscriptionByFirm(firmId), charge: null };
    }

    const now = new Date();
    const pricing = await this.loadTierPricing();
    const chargeId = `PTIER-${firmId.toUpperCase()}-${now.getTime()}`;
    const charge: SubscriptionCharge = {
      id: chargeId,
      subscriptionId: sub.id,
      firmId: sub.firmId,
      firmName: sub.firmName,
      tier: sub.tier,
      kind: 'tier_change',
      targetTier,
      period: monthKey(now),
      periodStart: now.toISOString(),
      periodEnd: now.toISOString(),
      amount: pricing[targetTier],
      status: 'Pending',
      issuedAt: now.toISOString(),
    };

    await q(
      `INSERT INTO subscription_charges
         (id, subscription_id, lawfirm_id, tier, kind, target_tier, period,
          period_start, period_end, amount, status, issued_at)
       VALUES ($1,$2,$3,$4,'tier_change',$5,$6,$7,$8,$9,'Pending',$7)`,
      [chargeId, sub.id, fid, sub.tier, targetTier, charge.period,
       now, now, charge.amount],
    );
    await q(
      `UPDATE subscriptions SET pending_tier = $2, pending_charge_id = $3 WHERE lawfirm_id = $1`,
      [fid, targetTier, chargeId],
    );

    return { subscription: await this.getSubscriptionByFirm(firmId), charge };
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
