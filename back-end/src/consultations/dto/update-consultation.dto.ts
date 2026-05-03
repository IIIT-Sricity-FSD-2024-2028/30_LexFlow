import { IsString, IsEnum, IsOptional, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ConsultationStatus, ConsultationType } from './create-consultation.dto';

export class UpdateConsultationDto {
  @ApiProperty({
    description: 'New consultation status',
    enum: ConsultationStatus,
    example: ConsultationStatus.CONFIRMED,
    required: false,
  })
  @IsOptional()
  @IsEnum(ConsultationStatus)
  status?: ConsultationStatus;

  @ApiProperty({
    description: 'ID of the lawyer being assigned',
    example: 'user-3',
    required: false,
  })
  @IsOptional()
  @IsString()
  lawyerId?: string;

  @ApiProperty({
    description: 'Name of the assigned lawyer',
    example: 'Lawyer Bob',
    required: false,
  })
  @IsOptional()
  @IsString()
  lawyerName?: string;

  @ApiProperty({
    description: 'Updated consultation date',
    example: 'May 15, 2026',
    required: false,
  })
  @IsOptional()
  @IsString()
  date?: string;

  @ApiProperty({
    description: 'Updated consultation time slot',
    example: '02:00 PM - 03:00 PM',
    required: false,
  })
  @IsOptional()
  @IsString()
  time?: string;

  @ApiProperty({
    description: 'Updated consultation type',
    enum: ConsultationType,
    required: false,
  })
  @IsOptional()
  @IsEnum(ConsultationType)
  type?: ConsultationType;

  @ApiProperty({
    description: 'Updated case description',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  caseDescription?: string;

  @ApiProperty({
    description: 'Additional notes from the firm or lawyer',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
