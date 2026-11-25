import {
  IsString,
  IsInt,
  IsNumber,
  IsPositive,
  IsOptional,
  IsEnum,
  IsDateString,
  Min,
} from 'class-validator';

import { ApiProperty } from '@nestjs/swagger';
import { InvoiceStatus } from './create-invoice.dto';

export class UpdateInvoiceDto {

  @ApiProperty({ description: 'New client user ID', required: false })
  @IsOptional()
  @IsString()
  clientId?: string;

  @ApiProperty({ description: 'ID of the replacement case', required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  caseId?: number;

  @ApiProperty({ description: 'Exact case name for older clients', required: false })
  @IsOptional()
  @IsString()
  caseName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  advocateName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  @Min(1)
  amount?: number;

  @ApiProperty({ enum: InvoiceStatus, required: false })
  @IsOptional()
  @IsEnum(InvoiceStatus)
  status?: InvoiceStatus;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  dueDate?: string;
}
