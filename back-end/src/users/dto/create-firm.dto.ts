import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsEmail,
  IsOptional,
  IsIn,
  MinLength,
} from 'class-validator';

/**
 * Superadmin: create a law firm directly, without going through the
 * three-step self-service onboarding flow.
 *
 * When adminName / adminEmail / adminPassword are supplied, a FIRMADMIN user
 * is created alongside the firm and linked to it.
 */
export class CreateFirmDto {
  @ApiProperty({ description: 'Law firm name', example: 'Sharma & Associates' })
  @IsNotEmpty()
  @IsString()
  name!: string;

  @ApiProperty({ description: 'Firm contact email', example: 'contact@sharma.law' })
  @IsNotEmpty()
  @IsEmail()
  email!: string;

  @ApiProperty({ description: 'Phone number (10 digits)', example: '9876543210' })
  @IsNotEmpty()
  @IsString()
  phone!: string;

  @ApiProperty({
    description: 'Pricing tier. Defaults to Starter.',
    enum: ['Starter', 'Growth', 'Enterprise'],
    required: false,
  })
  @IsOptional()
  @IsIn(['Starter', 'Growth', 'Enterprise'])
  tier?: 'Starter' | 'Growth' | 'Enterprise';

  @ApiProperty({ description: 'Street address', required: false })
  @IsOptional()
  @IsString()
  street?: string;

  @ApiProperty({ description: 'City', required: false })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiProperty({ description: 'State', required: false })
  @IsOptional()
  @IsString()
  state?: string;

  @ApiProperty({ description: 'PIN code', required: false })
  @IsOptional()
  @IsString()
  pinCode?: string;

  @ApiProperty({ description: 'Public-facing primary email', required: false })
  @IsOptional()
  @IsEmail()
  primaryEmail?: string;

  @ApiProperty({ description: 'Website URL', required: false })
  @IsOptional()
  @IsString()
  website?: string;

  @ApiProperty({ description: 'Short tagline shown in firm search', required: false })
  @IsOptional()
  @IsString()
  subtitle?: string;

  @ApiProperty({ description: 'Longer firm description', required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Primary practice area', required: false })
  @IsOptional()
  @IsString()
  practiceArea?: string;

  // ===== Optional firm-admin account created together with the firm =====
  @ApiProperty({ description: 'Name of the firm admin to create', required: false })
  @IsOptional()
  @IsString()
  adminName?: string;

  @ApiProperty({ description: 'Login email for the firm admin', required: false })
  @IsOptional()
  @IsEmail()
  adminEmail?: string;

  @ApiProperty({
    description: 'Password for the firm admin (min 6 characters)',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MinLength(6)
  adminPassword?: string;
}
