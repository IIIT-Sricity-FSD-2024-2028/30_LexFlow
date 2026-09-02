import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsEmail, IsOptional, IsIn } from 'class-validator';

/** Superadmin: patch any editable field on a law firm. */
export class UpdateFirmDto {
  @ApiProperty({ description: 'Law firm name', required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ description: 'Firm contact email', required: false })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ description: 'Phone number', required: false })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({
    description: 'Pricing tier',
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

  @ApiProperty({ description: 'Short tagline', required: false })
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
}
