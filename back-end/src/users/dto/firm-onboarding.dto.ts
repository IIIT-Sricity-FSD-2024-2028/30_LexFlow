import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsEmail, IsOptional, IsUrl, MinLength } from 'class-validator';

export class FirmOnboardingDto {
  // ===== Step 1: Firm Info (Required) =====
  @ApiProperty({
    description: 'Full name of the primary contact person',
    example: 'Amit Sharma',
    required: false,
  })
  @IsOptional()
  @IsString()
  fullName?: string;

  @ApiProperty({
    description: 'Email address of the primary contact',
    example: 'amit.sharma@example.in',
    required: false,
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({
    description: 'Phone number (10 digits)',
    example: '9876543210',
    required: false,
  })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({
    description: 'Street address',
    example: '21, Connaught Place',
    required: false,
  })
  @IsOptional()
  @IsString()
  street?: string;

  @ApiProperty({
    description: 'City name',
    example: 'New Delhi',
    required: false,
  })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiProperty({
    description: 'State name',
    example: 'Delhi',
    required: false,
  })
  @IsOptional()
  @IsString()
  state?: string;

  @ApiProperty({
    description: 'PIN / Zip Code',
    example: '110001',
    required: false,
  })
  @IsOptional()
  @IsString()
  pinCode?: string;

  @ApiProperty({
    description: 'Firm logo (base64 or file path)',
    required: false,
  })
  @IsOptional()
  @IsString()
  logo?: string;

  // ===== Step 2: Contact Info (Required) =====
  @ApiProperty({
    description: 'Primary email for firm operations',
    example: 'contact@firm.com',
    required: false,
  })
  @IsOptional()
  @IsEmail()
  primaryEmail?: string;

  @ApiProperty({
    description: 'Firm website URL',
    example: 'https://www.yourfirm.com',
    required: false,
  })
  @IsOptional()
  @IsUrl()
  website?: string;

  // ===== Step 3: Admin Setup (Required) =====
  @ApiProperty({
    description: 'Admin full name',
    example: 'Rahul Verma',
    required: false,
  })
  @IsOptional()
  @IsString()
  adminName?: string;

  @ApiProperty({
    description: 'Admin email address',
    example: 'rahul.verma@lawfirm.in',
    required: false,
  })
  @IsOptional()
  @IsEmail()
  adminEmail?: string;

  @ApiProperty({
    description: 'Admin password (minimum 8 characters)',
    example: 'SecurePass@123',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;

  @ApiProperty({
    description: 'Confirm password',
    example: 'SecurePass@123',
    required: false,
  })
  @IsOptional()
  @IsString()
  confirmPassword?: string;
}
