import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsIn } from 'class-validator';

/** Superadmin: move a firm between plans, or pause/cancel its subscription. */
export class UpdateSubscriptionDto {
  @ApiProperty({
    description: 'Move the firm onto a different plan. Also updates its seat caps.',
    enum: ['Starter', 'Growth', 'Enterprise'],
    required: false,
  })
  @IsOptional()
  @IsIn(['Starter', 'Growth', 'Enterprise'])
  tier?: 'Starter' | 'Growth' | 'Enterprise';

  @ApiProperty({
    description:
      'Subscription state. A cancelled subscription stops generating monthly charges.',
    enum: ['active', 'cancelled', 'past_due'],
    required: false,
  })
  @IsOptional()
  @IsIn(['active', 'cancelled', 'past_due'])
  status?: 'active' | 'cancelled' | 'past_due';
}
