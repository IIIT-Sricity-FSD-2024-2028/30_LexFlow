import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty } from 'class-validator';

export enum PaymentMethod {
    CARD = 'Card',
    UPI = 'UPI',
    NET_BANKING = 'Net Banking',
    BANK_TRANSFER = 'Bank Transfer',
    CASH = 'Cash',
}

export class RecordPaymentDto {
    @ApiProperty({
        description: 'Payment method used by the client',
        enum: PaymentMethod,
        example: PaymentMethod.CARD,
    })
    @IsNotEmpty()
    @IsEnum(PaymentMethod, {
        message: `paymentMethod must be one of: ${Object.values(PaymentMethod).join(', ')}`,
    })
    paymentMethod!: PaymentMethod;
}