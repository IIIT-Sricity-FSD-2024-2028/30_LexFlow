import {
  IsNotEmpty,
  IsString,
  IsNumber,
  IsPositive,
  IsOptional,
  IsEnum,
  IsDateString,
  Min,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum InvoiceStatus {
  PENDING = 'Pending',
  PAID = 'Paid',
  OVERDUE = 'Overdue',
}

export class CreateInvoiceDto {
  @ApiProperty({
    description: 'User ID of the client (from GET /billing/clients dropdown)',
    example: 'user-2',
  })
  @IsNotEmpty()
  @IsString()
  clientId!: string;

  @ApiProperty({
    description: 'Case name',
    example: 'Property Dispute vs. Urban Developers'
  })
  @IsNotEmpty()
  @IsString()
  caseName!: string;

  @ApiProperty({
    description: 'Advocate / lawyer name',
    example: 'Lawyer Bob',
    required: false
  })
  @IsOptional()
  @IsString()
  advocateName?: string;

  @ApiProperty({
    description: 'Invoice amount in INR',
    example: 25000
  })
  @IsNumber()
  @IsPositive()
  @Min(1)
  amount!: number;

  @ApiProperty({
    description: 'Initial status (auto-derived to Overdue if dueDate is past)',
    enum: InvoiceStatus,
    required: false,
    example: 'Pending',
  })
  @IsOptional()
  @IsEnum(InvoiceStatus)
  status?: InvoiceStatus;

  @ApiProperty({
    description: 'Due date in ISO format YYYY-MM-DD',
    example: '2026-12-31'
  })
  @IsNotEmpty()
  @IsDateString()
  dueDate!: string;
}