import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, Min } from 'class-validator';

/** Superadmin: set the monthly list price of a subscription tier. */
export class UpdateTierPricingDto {
  @ApiProperty({
    description: 'New monthly price for this tier, in the platform currency',
    example: 9999,
  })
  @IsNumber()
  @Min(0)
  monthlyPrice!: number;
}
