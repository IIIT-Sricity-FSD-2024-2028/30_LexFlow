import { IsIn, IsOptional } from 'class-validator';
import { ChargeStatus } from '../platform.service';
import { TEST_PAYMENT_METHODS, TestPaymentMethod } from '../subscription-cycle';

export class SettleChargeDto {
  @IsIn(['Paid', 'Pending', 'Overdue'])
  status!: ChargeStatus;

  @IsOptional()
  @IsIn(Object.keys(TEST_PAYMENT_METHODS))
  paymentMethod?: TestPaymentMethod;
}
