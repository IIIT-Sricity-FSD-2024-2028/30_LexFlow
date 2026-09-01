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

@Injectable()
export class PlatformService implements OnModuleInit {
  /**
   * List price per tier, in INR per month. Editable at runtime by the
   * superadmin via PUT /platform/tiers/:tier.
   */
  private tierPricing: Record<FirmTier, number> = {
    Starter: 2999,
    Growth: 9999,
    Enterprise: 24999,
  };

  private settings: PlatformSettings = {
    commissionRate: 10,
    supportEmail: 'support@lexflow.legal',
    currency: 'INR',
    maintenanceMode: false,
    disableSignup: false,
  };

  private subscriptions: Subscription[] = [];
  private charges: SubscriptionCharge[] = [];
  private subIdCounter = 1;

  constructor(
    private readonly usersService: UsersService,
    private readonly billingService: BillingService,
  ) {}

  onModuleInit() {
    // Demo mode: no backdated billing history is invented for the seeded
    // firms — subscriptions start "now", so lifetime earnings begin at zero.
    // Each firm does get its current month's charge generated below, since
    // that is what makes the pay/settle flow demoable at all.
    this.syncSubscriptions(false);
  }

  // ── Subscription lifecycle ────────────────────────────────────────────────

  /**
   * Make sure every firm has a subscription and that its monthly charges are
   * generated up to the current month. Called at the top of every read so a
   * firm added through the users module is picked up without extra wiring.
   */
  private syncSubscriptions(backdateSeedCohort = false): void {
    const firms = this.usersService.getAllFirms();

    firms.forEach((firm, index) => {
      if (this.subscriptions.some((s) => s.firmId === firm.id)) return;

      const startedAt = backdateSeedCohort
        ? addMonths(new Date(), -(3 + (index % 4)))
        : new Date(firm.createdAt);

      this.subscriptions.push({
        id: `sub-${this.subIdCounter++}`,
        firmId: firm.id,
        firmName: firm.name,
        tier: firm.tier,
        status: 'active',
        monthlyPrice: this.tierPricing[firm.tier],
        startedAt: startedAt.toISOString(),
        currentPeriodStart: startOfMonth(new Date()).toISOString(),
        currentPeriodEnd: addMonths(startOfMonth(new Date()), 1).toISOString(),
        cancelledAt: undefined,
      });
    });

    // Drop subscriptions whose firm has been deleted.
    const liveFirmIds = new Set(firms.map((f) => f.id));
    this.subscriptions = this.subscriptions.filter((s) => liveFirmIds.has(s.firmId));
    this.charges = this.charges.filter((c) => liveFirmIds.has(c.firmId));

    // Keep the denormalised firm name and tier in step with the firm record.
    this.subscriptions.forEach((sub) => {
      const firm = firms.find((f) => f.id === sub.firmId);
      if (!firm) return;
      sub.firmName = firm.name;
      if (sub.tier !== firm.tier) {
        sub.tier = firm.tier;
        sub.monthlyPrice = this.tierPricing[firm.tier];
      }
    });

    this.generateCharges();
  }

  /**
   * Issue the current billing period's charge for every active subscription,
   * idempotently. Demo mode deliberately does not backfill history for
   * earlier months — a firm's "lifetime earnings" start at zero and only
   * grow once a real charge here is actually marked Paid — but each firm
   * always has this month's Pending charge waiting so the pay/settle flow
   * has something to demo.
   */
  private generateCharges(): void {
    const period = monthKey(new Date());
    const periodStart = startOfMonth(new Date());
    const periodEnd = addMonths(periodStart, 1);

    this.subscriptions
      .filter((sub) => sub.status !== 'cancelled')
      .forEach((sub) => {
        const exists = this.charges.some(
          (c) => c.subscriptionId === sub.id && c.period === period && c.kind === 'monthly',
        );
        if (exists) return;

        this.charges.push({
          id: `PSUB-${sub.firmId.toUpperCase()}-${period}`,
          subscriptionId: sub.id,
          firmId: sub.firmId,
          firmName: sub.firmName,
          tier: sub.tier,
          kind: 'monthly',
          period,
          periodStart: periodStart.toISOString(),
          periodEnd: periodEnd.toISOString(),
          amount: sub.monthlyPrice,
          status: 'Pending',
          issuedAt: periodStart.toISOString(),
          paidAt: undefined,
        });
      });
  }

  // ── Commission ────────────────────────────────────────────────────────────

  /**
   * LexFlow's cut of the law firms' own client invoices. Only invoices the
   * client has actually paid count towards earnings.
   */
  private paidClientInvoices() {
    return this.billingService
      .findAllInvoices('SUPERADMIN')
      .filter((inv) => inv.status === 'Paid');
  }

  private commissionOn(amount: number): number {
    return round2((amount * this.settings.commissionRate) / 100);
  }

  // ── Revenue reporting ─────────────────────────────────────────────────────

  getRevenueSummary() {
    this.syncSubscriptions();

    const thisMonthKey = monthKey(new Date());
    const lastMonthKey = monthKey(addMonths(startOfMonth(new Date()), -1));

    const activeSubs = this.subscriptions.filter((s) => s.status === 'active');
    const mrr = activeSubs.reduce((sum, s) => sum + s.monthlyPrice, 0);

    const subCollected = this.charges
      .filter((c) => c.status === 'Paid')
      .reduce((sum, c) => sum + c.amount, 0);
    const subOutstanding = this.charges
      .filter((c) => c.status !== 'Paid')
      .reduce((sum, c) => sum + c.amount, 0);

    const paidInvoices = this.paidClientInvoices();
    const gmv = paidInvoices.reduce((sum, inv) => sum + inv.amount, 0);
    const commissionCollected = this.commissionOn(gmv);

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
      this.charges
        .filter((c) => c.period === key)
        .reduce((sum, c) => sum + c.amount, 0);

    const subCollectedInMonth = (key: string) =>
      this.charges
        .filter((c) => c.status === 'Paid' && c.period === key)
        .reduce((sum, c) => sum + c.amount, 0);

    const commissionInMonth = (key: string) =>
      this.commissionOn(
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
        monthlyPrice: this.tierPricing[tier],
        mrr: subs.reduce((sum, s) => sum + s.monthlyPrice, 0),
      };
    });

    return {
      currency: this.settings.currency,
      mrr: round2(mrr),
      arr: round2(mrr * 12),
      totalEarnings: round2(subCollected + commissionCollected),
      subscriptionRevenue: {
        collected: round2(subCollected),
        outstanding: round2(subOutstanding),
      },
      commissionRevenue: {
        rate: this.settings.commissionRate,
        collected: commissionCollected,
        // What the firms billed their own clients — the base commission comes from.
        billedThroughPlatform: round2(gmv),
        unattributed: this.commissionOn(unattributedGmv),
        paidInvoiceCount: paidInvoices.length,
      },
      activeSubscriptions: activeSubs.length,
      cancelledSubscriptions: this.subscriptions.filter((s) => s.status === 'cancelled').length,
      totalFirms: this.subscriptions.length,
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
  getMonthlyRevenue(months = 6) {
    this.syncSubscriptions();

    const span = Math.min(Math.max(Number(months) || 6, 1), 24);
    const paidInvoices = this.paidClientInvoices();
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

      const periodCharges = this.charges.filter((c) => c.period === key);
      const subscription = periodCharges.reduce((sum, c) => sum + c.amount, 0);
      const collected = periodCharges
        .filter((c) => c.status === 'Paid')
        .reduce((sum, c) => sum + c.amount, 0);

      const commission = this.commissionOn(
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
  getRevenueByFirm() {
    this.syncSubscriptions();

    const paidInvoices = this.paidClientInvoices();

    return this.subscriptions
      .map((sub) => {
        const firmCharges = this.charges.filter((c) => c.subscriptionId === sub.id);
        const collected = firmCharges
          .filter((c) => c.status === 'Paid')
          .reduce((sum, c) => sum + c.amount, 0);
        const outstanding = firmCharges
          .filter((c) => c.status !== 'Paid')
          .reduce((sum, c) => sum + c.amount, 0);

        const firmGmv = paidInvoices
          .filter((inv) => inv.firmId === sub.firmId)
          .reduce((sum, inv) => sum + inv.amount, 0);
        const commission = this.commissionOn(firmGmv);

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

  getSubscriptions(): Subscription[] {
    this.syncSubscriptions();
    return this.subscriptions;
  }

  getSubscriptionByFirm(firmId: string): Subscription {
    this.syncSubscriptions();
    const sub = this.subscriptions.find((s) => s.firmId === firmId);
    if (!sub) {
      throw new NotFoundException(`No subscription found for firm "${firmId}"`);
    }
    return sub;
  }

  /**
   * Change a firm's plan or subscription state. Changing the tier here also
   * moves the firm's tier in the users module, so seat caps follow the plan.
   */
  updateSubscription(firmId: string, dto: UpdateSubscriptionDto): Subscription {
    const sub = this.getSubscriptionByFirm(firmId);

    if (dto.tier) {
      this.usersService.updateFirmTier(firmId, dto.tier);
      sub.tier = dto.tier;
      sub.monthlyPrice = this.tierPricing[dto.tier];
    }

    if (dto.status) {
      sub.status = dto.status;
      sub.cancelledAt =
        dto.status === 'cancelled' ? new Date().toISOString() : undefined;
    }

    this.generateCharges();
    return sub;
  }

  // ── Subscription charges (LexFlow → firm) ─────────────────────────────────

  getCharges(firmId?: string): SubscriptionCharge[] {
    this.syncSubscriptions();
    return firmId ? this.charges.filter((c) => c.firmId === firmId) : this.charges;
  }

  /**
   * Resolve the firm a firmadmin/lawyer caller belongs to, for scoping charge
   * reads and writes to "their own firm only". Throws rather than silently
   * returning nothing, so a bad or missing caller id fails loudly.
   */
  resolveCallerFirmId(callerId: string | undefined): string {
    if (!callerId) {
      throw new BadRequestException(
        'x-user-id header is required to scope subscription charges to your firm',
      );
    }
    const firm = this.usersService.getUserFirm(callerId);
    if (!firm) {
      throw new BadRequestException(
        `Caller "${callerId}" is not linked to a law firm`,
      );
    }
    return firm.id;
  }

  /** Firm-scoped read: only ever returns the calling firm's own charges. */
  getChargesForFirm(callerId: string | undefined): SubscriptionCharge[] {
    const firmId = this.resolveCallerFirmId(callerId);
    return this.getCharges(firmId);
  }

  updateChargeStatus(id: string, status: ChargeStatus): SubscriptionCharge {
    this.syncSubscriptions();
    const charge = this.charges.find((c) => c.id === id);
    if (!charge) {
      throw new NotFoundException(`Subscription charge "${id}" not found`);
    }
    charge.status = status;
    charge.paidAt = status === 'Paid' ? new Date().toISOString() : undefined;
    if (status === 'Paid') this.applyIfTierChangeCharge(charge);
    return charge;
  }

  /**
   * Firm-scoped write: a firmadmin may only settle a charge that belongs to
   * their own firm, and may only mark it Paid — the Pending/Overdue states
   * are the platform's own bookkeeping, not the firm's to set.
   */
  payChargeAsFirm(chargeId: string, callerId: string | undefined): SubscriptionCharge {
    this.syncSubscriptions();
    const firmId = this.resolveCallerFirmId(callerId);

    const charge = this.charges.find((c) => c.id === chargeId);
    if (!charge) {
      throw new NotFoundException(`Subscription charge "${chargeId}" not found`);
    }
    if (charge.firmId !== firmId) {
      throw new ForbiddenException(
        'You can only pay subscription charges that belong to your own firm',
      );
    }

    charge.status = 'Paid';
    charge.paidAt = new Date().toISOString();
    this.applyIfTierChangeCharge(charge);
    return charge;
  }

  /**
   * A 'tier_change' charge is a promise, not just a bill: paying it is the
   * moment the firm actually switches plans. Called right after any path
   * marks a charge Paid — a no-op for ordinary 'monthly' charges.
   */
  private applyIfTierChangeCharge(charge: SubscriptionCharge): void {
    if (charge.kind !== 'tier_change' || !charge.targetTier) return;

    const sub = this.subscriptions.find((s) => s.id === charge.subscriptionId);
    if (!sub) return;

    this.usersService.updateFirmTier(charge.firmId, charge.targetTier);
    sub.tier = charge.targetTier;
    sub.monthlyPrice = this.tierPricing[charge.targetTier];
    if (sub.pendingChargeId === charge.id) {
      sub.pendingTier = undefined;
      sub.pendingChargeId = undefined;
    }
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
  requestTierChange(
    firmId: string,
    targetTier: FirmTier,
    callerId: string | undefined,
    isSuperAdmin: boolean,
  ): { subscription: Subscription; charge: SubscriptionCharge | null } {
    if (!isSuperAdmin) {
      const callerFirmId = this.resolveCallerFirmId(callerId);
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

    const sub = this.getSubscriptionByFirm(firmId);

    // Clear out any earlier unpaid request before deciding what to do next —
    // there is only ever one live tier-change charge per firm.
    if (sub.pendingChargeId) {
      this.charges = this.charges.filter((c) => c.id !== sub.pendingChargeId);
    }

    if (targetTier === sub.tier) {
      sub.pendingTier = undefined;
      sub.pendingChargeId = undefined;
      return { subscription: sub, charge: null };
    }

    const now = new Date();
    const charge: SubscriptionCharge = {
      id: `PTIER-${firmId.toUpperCase()}-${now.getTime()}`,
      subscriptionId: sub.id,
      firmId: sub.firmId,
      firmName: sub.firmName,
      tier: sub.tier,
      kind: 'tier_change',
      targetTier,
      period: monthKey(now),
      periodStart: now.toISOString(),
      periodEnd: now.toISOString(),
      amount: this.tierPricing[targetTier],
      status: 'Pending',
      issuedAt: now.toISOString(),
    };

    this.charges.push(charge);
    sub.pendingTier = targetTier;
    sub.pendingChargeId = charge.id;

    return { subscription: sub, charge };
  }

  // ── Tier pricing ──────────────────────────────────────────────────────────

  getTierPlans(): TierPlan[] {
    return (Object.keys(TIER_LIMITS) as FirmTier[]).map((tier) => ({
      tier,
      monthlyPrice: this.tierPricing[tier],
      lawyerSeats: TIER_LIMITS[tier].lawyers,
      internSeats: TIER_LIMITS[tier].interns,
    }));
  }

  /**
   * Reprice a tier. Existing subscriptions move to the new price from the next
   * charge onwards; charges already issued keep the price they were billed at.
   */
  updateTierPricing(tier: FirmTier, dto: UpdateTierPricingDto): TierPlan {
    if (!TIER_LIMITS[tier]) {
      throw new BadRequestException(
        'Invalid tier. Allowed values: Starter, Growth, Enterprise',
      );
    }

    this.tierPricing[tier] = dto.monthlyPrice;
    this.subscriptions
      .filter((s) => s.tier === tier)
      .forEach((s) => {
        s.monthlyPrice = dto.monthlyPrice;
      });

    return {
      tier,
      monthlyPrice: dto.monthlyPrice,
      lawyerSeats: TIER_LIMITS[tier].lawyers,
      internSeats: TIER_LIMITS[tier].interns,
    };
  }

  // ── Platform settings ─────────────────────────────────────────────────────

  getSettings(): PlatformSettings {
    return this.settings;
  }

  updateSettings(dto: UpdateSettingsDto): PlatformSettings {
    Object.entries(dto).forEach(([key, value]) => {
      if (value !== undefined) {
        (this.settings as unknown as Record<string, unknown>)[key] = value;
      }
    });
    return this.settings;
  }
}
