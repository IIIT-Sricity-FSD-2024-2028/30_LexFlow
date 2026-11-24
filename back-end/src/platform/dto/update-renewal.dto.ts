import { IsBoolean, IsIn, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';
import { TEST_PAYMENT_METHODS, TestPaymentMethod } from '../subscription-cycle';

export class UpdateRenewalDto {
  @IsOptional()
  @Transform(({ obj, key }) => obj[key])
  @IsBoolean()
  autoRenew?: boolean;

  @IsOptional()
  @IsIn(Object.keys(TEST_PAYMENT_METHODS))
  paymentMethod?: TestPaymentMethod | null;
}
