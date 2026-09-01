import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Body,
  Param,
  Query,
  Headers,
  UseGuards,
  HttpCode,
  HttpStatus,
  ForbiddenException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiHeader,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { PlatformService, ChargeStatus } from './platform.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { UpdateTierPricingDto } from './dto/update-tier-pricing.dto';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../users/dto';
import { FirmTier } from '../users/users.service';

/**
 * Platform — the business side of LexFlow itself.
 *
 * Everything here answers "what is the platform owner earning, and from whom".
 * Two revenue streams are tracked:
 *   1. Subscriptions — each law firm pays a monthly fee for its tier.
 *   2. Commission    — a configurable percentage of every client invoice that
 *                      a firm settles through the platform.
 *
 * Every route is superadmin-only, except the two subscription-charge
 * endpoints below, which a firmadmin may also call — scoped to their own
 * firm — so a firm can see and pay its own bill.
 */
@ApiTags('platform')
@ApiHeader({
  name: 'role',
  description: 'Must be "superadmin" for most endpoints; "firmadmin" is also accepted on the charges endpoints, scoped to the caller\'s own firm',
  required: true,
})
@ApiHeader({
  name: 'x-user-id',
  description: 'Caller user id — required on the charges endpoints when role is "firmadmin", to resolve their firm',
  required: false,
})
@UseGuards(RolesGuard)
@Roles(UserRole.SUPERADMIN)
@Controller('platform')
export class PlatformController {
  constructor(private readonly platformService: PlatformService) {}

  // ── Revenue ───────────────────────────────────────────────────────────────

  @Get('revenue/summary')
  @ApiOperation({
    summary: 'Platform earnings summary',
    description:
      'Headline numbers for the platform owner: MRR, ARR, lifetime earnings, ' +
      'subscription revenue collected vs outstanding, commission earned, and ' +
      'this month against last month.',
  })
  @ApiResponse({ status: 200, description: 'Revenue summary' })
  getRevenueSummary() {
    return this.platformService.getRevenueSummary();
  }

  @Get('revenue/monthly')
  @ApiOperation({
    summary: 'Monthly earnings series',
    description:
      'Earnings per month, oldest first, split into subscription and commission. ' +
      'Drives the revenue chart on the superadmin dashboard.',
  })
  @ApiQuery({
    name: 'months',
    required: false,
    description: 'How many months to return (1-24, default 6)',
  })
  @ApiResponse({ status: 200, description: 'Monthly revenue series' })
  getMonthlyRevenue(@Query('months') months?: string) {
    return this.platformService.getMonthlyRevenue(Number(months) || 6);
  }

  @Get('revenue/by-firm')
  @ApiOperation({
    summary: 'Earnings broken down by law firm',
    description:
      'Per-firm subscription revenue, commission and outstanding balance, ' +
      'sorted by total earned. Shows which firms actually carry the business.',
  })
  @ApiResponse({ status: 200, description: 'Per-firm revenue breakdown' })
  getRevenueByFirm() {
    return this.platformService.getRevenueByFirm();
  }

  // ── Subscriptions ─────────────────────────────────────────────────────────

  @Get('subscriptions')
  @ApiOperation({
    summary: 'List every firm subscription',
    description:
      'One record per law firm. Firms added after boot are picked up automatically.',
  })
  @ApiResponse({ status: 200, description: 'List of subscriptions' })
  getSubscriptions() {
    return this.platformService.getSubscriptions();
  }

  @Get('subscriptions/:firmId')
  @Roles(UserRole.FIRMADMIN, UserRole.SUPERADMIN)
  @ApiOperation({
    summary: 'Get one firm subscription',
    description:
      'SUPERADMIN → any firm. FIRMADMIN → only their own firm (pass x-user-id).',
  })
  @ApiParam({ name: 'firmId', example: 'firm-1' })
  @ApiResponse({ status: 200, description: 'Subscription' })
  @ApiResponse({ status: 403, description: 'firmadmin requested another firm\'s subscription' })
  @ApiResponse({ status: 404, description: 'No subscription for that firm' })
  async getSubscription(
    @Param('firmId') firmId: string,
    @Headers('role') role: string,
    @Headers('x-user-id') callerId: string,
  ) {
    if ((role || '').toLowerCase() === 'firmadmin') {
      const callerFirmId = await this.platformService.resolveCallerFirmId(callerId);
      if (callerFirmId !== firmId) {
        throw new ForbiddenException('You can only view your own firm\'s subscription');
      }
    }
    return this.platformService.getSubscriptionByFirm(firmId);
  }

  @Post('subscriptions/:firmId/tier-change')
  @Roles(UserRole.FIRMADMIN, UserRole.SUPERADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Request a plan change',
    description:
      'Issues a one-time charge for the new tier\'s price. The firm stays on its ' +
      'current plan until that charge is paid — see PATCH /platform/charges/:id. ' +
      'Requesting the current tier again cancels a pending request instead of erroring. ' +
      'FIRMADMIN is scoped to their own firm (pass x-user-id); SUPERADMIN may act for any firm.',
  })
  @ApiParam({ name: 'firmId', example: 'firm-1' })
  @ApiResponse({ status: 200, description: 'Tier-change charge created (or pending request cancelled)' })
  @ApiResponse({ status: 400, description: 'Invalid tier' })
  @ApiResponse({ status: 403, description: 'firmadmin requested a change for another firm' })
  @ApiResponse({ status: 404, description: 'No subscription for that firm' })
  requestTierChange(
    @Param('firmId') firmId: string,
    @Headers('role') role: string,
    @Headers('x-user-id') callerId: string,
    @Body() body: { tier: FirmTier },
  ) {
    const isSuperAdmin = (role || '').toLowerCase() === 'superadmin';
    return this.platformService.requestTierChange(firmId, body.tier, callerId, isSuperAdmin);
  }

  @Patch('subscriptions/:firmId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Change a firm plan or subscription state',
    description:
      'Moving a firm to another tier also moves its seat caps in the users module. ' +
      'Cancelling stops future monthly charges from being generated.',
  })
  @ApiParam({ name: 'firmId', example: 'firm-1' })
  @ApiResponse({ status: 200, description: 'Subscription updated' })
  @ApiResponse({ status: 404, description: 'No subscription for that firm' })
  updateSubscription(
    @Param('firmId') firmId: string,
    @Body() dto: UpdateSubscriptionDto,
  ) {
    return this.platformService.updateSubscription(firmId, dto);
  }

  // ── Subscription charges (LexFlow bills the firm) ─────────────────────────

  @Get('charges')
  @Roles(UserRole.FIRMADMIN, UserRole.SUPERADMIN)
  @ApiOperation({
    summary: 'Subscription charges raised against firms',
    description:
      'The platform\'s own invoices — one per firm per month. Closed months are ' +
      'settled, the month in progress is still outstanding.\n\n' +
      'SUPERADMIN → every firm\'s charges, optionally filtered by ?firmId.\n' +
      'FIRMADMIN → only their own firm\'s charges (pass x-user-id); the firmId ' +
      'query param is ignored, since the caller cannot see any other firm\'s bill.',
  })
  @ApiQuery({
    name: 'firmId',
    required: false,
    description: 'Filter to one firm (superadmin only — ignored for firmadmin callers)',
  })
  @ApiResponse({ status: 200, description: 'List of subscription charges' })
  @ApiResponse({ status: 400, description: 'firmadmin caller could not be resolved to a firm' })
  getCharges(
    @Headers('role') role: string,
    @Headers('x-user-id') callerId: string,
    @Query('firmId') firmId?: string,
  ) {
    if ((role || '').toLowerCase() === 'firmadmin') {
      return this.platformService.getChargesForFirm(callerId);
    }
    return this.platformService.getCharges(firmId);
  }

  @Patch('charges/:id')
  @Roles(UserRole.FIRMADMIN, UserRole.SUPERADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Settle a subscription charge',
    description:
      'SUPERADMIN → set any status (Paid, Pending, Overdue).\n' +
      'FIRMADMIN → may only mark Paid, and only a charge belonging to their own ' +
      'firm (pass x-user-id); the request body\'s status is ignored for this role.',
  })
  @ApiParam({ name: 'id', example: 'PSUB-FIRM-1-2026-09' })
  @ApiResponse({ status: 200, description: 'Charge updated' })
  @ApiResponse({ status: 403, description: 'firmadmin tried to pay another firm\'s charge' })
  @ApiResponse({ status: 404, description: 'Charge not found' })
  updateCharge(
    @Param('id') id: string,
    @Headers('role') role: string,
    @Headers('x-user-id') callerId: string,
    @Body() body: { status: ChargeStatus },
  ) {
    if ((role || '').toLowerCase() === 'firmadmin') {
      return this.platformService.payChargeAsFirm(id, callerId);
    }
    return this.platformService.updateChargeStatus(id, body.status);
  }

  // ── Pricing ───────────────────────────────────────────────────────────────

  @Get('tiers')
  @Roles(UserRole.FIRMADMIN, UserRole.SUPERADMIN)
  @ApiOperation({
    summary: 'Subscription plans',
    description:
      'Monthly price and seat caps for each tier. Readable by firmadmin too, so ' +
      'onboarding and the plan-change picker can show live prices.',
  })
  @ApiResponse({ status: 200, description: 'List of tier plans' })
  getTierPlans() {
    return this.platformService.getTierPlans();
  }

  @Put('tiers/:tier')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reprice a subscription tier',
    description:
      'Sets the monthly list price. Charges already issued keep the price they ' +
      'were billed at; future months use the new price.',
  })
  @ApiParam({ name: 'tier', enum: ['Starter', 'Growth', 'Enterprise'] })
  @ApiResponse({ status: 200, description: 'Tier repriced' })
  @ApiResponse({ status: 400, description: 'Invalid tier' })
  updateTierPricing(
    @Param('tier') tier: FirmTier,
    @Body() dto: UpdateTierPricingDto,
  ) {
    return this.platformService.updateTierPricing(tier, dto);
  }

  // ── Settings ──────────────────────────────────────────────────────────────

  @Get('settings')
  @ApiOperation({
    summary: 'Platform settings',
    description:
      'Commission rate, support email, currency and the maintenance / signup switches.',
  })
  @ApiResponse({ status: 200, description: 'Platform settings' })
  getSettings() {
    return this.platformService.getSettings();
  }

  @Put('settings')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update platform settings',
    description:
      'Changing the commission rate immediately re-values reported commission earnings.',
  })
  @ApiResponse({ status: 200, description: 'Settings updated' })
  updateSettings(@Body() dto: UpdateSettingsDto) {
    return this.platformService.updateSettings(dto);
  }
}
