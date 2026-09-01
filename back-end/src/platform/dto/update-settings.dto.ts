import { ApiProperty } from '@nestjs/swagger';
import {
  IsOptional,
  IsNumber,
  IsEmail,
  IsBoolean,
  IsString,
  Min,
  Max,
} from 'class-validator';

/** Superadmin: platform-wide settings that drive billing and signup behaviour. */
export class UpdateSettingsDto {
  @ApiProperty({
    description:
      'Percentage LexFlow keeps from every paid client invoice. Changing this ' +
      'immediately re-values reported commission earnings.',
    example: 10,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  commissionRate?: number;

  @ApiProperty({
    description: 'Support address shown to firms and clients',
    example: 'support@lexflow.legal',
    required: false,
  })
  @IsOptional()
  @IsEmail()
  supportEmail?: string;

  @ApiProperty({ description: 'Reporting currency code', example: 'INR', required: false })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiProperty({ description: 'Put the platform into maintenance mode', required: false })
  @IsOptional()
  @IsBoolean()
  maintenanceMode?: boolean;

  @ApiProperty({ description: 'Block new firm and client signups', required: false })
  @IsOptional()
  @IsBoolean()
  disableSignup?: boolean;
}
