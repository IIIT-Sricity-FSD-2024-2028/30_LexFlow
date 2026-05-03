import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsDateString,
  MinLength,
  MaxLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum ConsultationType {
  CHAT = 'chat',
  VIDEO = 'video',
  INPERSON = 'inperson',
}

export enum ConsultationStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  SCHEDULED = 'SCHEDULED',
  IN_PROGRESS = 'IN PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export class CreateConsultationDto {
  @ApiProperty({
    description: 'Unique identifier of the client booking the consultation',
    example: 'user-2',
  })
  @IsNotEmpty()
  @IsString()
  clientId!: string;

  @ApiProperty({
    description: 'Full name of the client',
    example: 'Client Alice',
  })
  @IsNotEmpty()
  @IsString()
  clientName!: string;

  @ApiProperty({
    description: 'Identifier of the law firm being consulted',
    example: 'firm-1',
  })
  @IsNotEmpty()
  @IsString()
  firmId!: string;

  @ApiProperty({
    description: 'Name of the law firm',
    example: 'Voss & Associates',
  })
  @IsNotEmpty()
  @IsString()
  firmName!: string;

  @ApiProperty({
    description: 'Consultation type',
    enum: ConsultationType,
    example: ConsultationType.VIDEO,
  })
  @IsNotEmpty()
  @IsEnum(ConsultationType)
  type!: ConsultationType;

  @ApiProperty({
    description: 'Consultation date (e.g., "May 10, 2026")',
    example: 'May 10, 2026',
  })
  @IsNotEmpty()
  @IsString()
  date!: string;

  @ApiProperty({
    description: 'Consultation time slot (e.g., "10:30 AM - 11:00 AM")',
    example: '10:30 AM - 11:00 AM',
  })
  @IsNotEmpty()
  @IsString()
  time!: string;

  @ApiProperty({
    description: 'Brief description of the legal case or issue',
    example: 'I need advice regarding a property dispute with my neighbor.',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  caseDescription?: string;

  @ApiProperty({
    description: 'Lawyer ID assigned to this consultation (set by firm admin)',
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
    description: 'Consultation fee string (e.g., "$250")',
    example: '$250',
    required: false,
  })
  @IsOptional()
  @IsString()
  consultationFee?: string;

  @ApiProperty({
    description: 'Avatar color class for UI display',
    example: 'blue',
    required: false,
  })
  @IsOptional()
  @IsString()
  avatarClass?: string;

  @ApiProperty({
    description: 'Whether this consultation was booked via the client search/discovery workflow',
    example: true,
    required: false,
  })
  @IsOptional()
  bookedViaWorkflow?: boolean;
}
