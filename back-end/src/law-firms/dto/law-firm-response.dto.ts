import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class EducationEntry {
  @ApiProperty({ example: 'Harvard Law School' }) school!: string;
  @ApiProperty({ example: 'Juris Doctor (JD), 2011' }) degree!: string;
}

export class LawFirmResponseDto {
  @ApiProperty({ example: 'firm-1' })
  id!: string;

  @ApiProperty({ example: 'Sharma & Associates' })
  name!: string;

  @ApiProperty({ example: 'Corporate & Civil Law • New Delhi, Delhi' })
  subtitle!: string;

  @ApiProperty({ example: 'Full-service law firm offering expert legal counsel.' })
  description!: string;

  @ApiProperty({ example: 'new-delhi' })
  location!: string;

  @ApiProperty({ example: 'New Delhi, Delhi' })
  locationLabel!: string;

  /** 'corporate' | 'family' | 'ip' | 'criminal' | 'civil' | 'immigration' */
  @ApiProperty({ example: 'corporate' })
  practiceArea!: string;

  /** 'AVAILABLE' | 'TODAY' | 'BUSY' */
  @ApiProperty({ example: 'AVAILABLE' })
  availability!: string;

  @ApiProperty({ example: 4.8 })
  rating!: number;

  @ApiProperty({ example: 97 })
  reviews!: number;

  @ApiProperty({ example: 180 })
  price!: number;

  @ApiProperty({ example: '10+ Years' })
  experience!: string;

  @ApiProperty({ example: 'Sharma & Associates is a leading law firm…' })
  bio!: string;

  @ApiProperty({ type: [String], example: ['Corporate Law', 'Civil Law'] })
  practiceAreas!: string[];

  @ApiProperty({ type: [String], example: ['English (Fluent)', 'Hindi (Fluent)'] })
  languages!: string[];

  @ApiProperty({ type: [EducationEntry] })
  education!: EducationEntry[];

  @ApiProperty({ example: 'indigo' })
  avatarColor!: string;

  // ── Optional contact fields (populated for real registered firms) ─────────
  @ApiPropertyOptional({ example: 'hello@sharma.law' })
  email?: string;

  @ApiPropertyOptional({ example: '9876543210' })
  phone?: string;

  @ApiPropertyOptional({ example: '21, Connaught Place, New Delhi, Delhi - 110001' })
  address?: string;

  @ApiPropertyOptional({ example: 'https://www.sharma.law' })
  website?: string;
}
