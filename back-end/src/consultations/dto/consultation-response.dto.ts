import { ApiProperty } from '@nestjs/swagger';
import { ConsultationStatus, ConsultationType } from './create-consultation.dto';

export class ConsultationResponseDto {
  @ApiProperty({ example: 'CONS-1746123456789' })
  id!: string;

  @ApiProperty({ example: 'user-2' })
  clientId!: string;

  @ApiProperty({ example: 'Client Alice' })
  clientName!: string;

  @ApiProperty({ example: 'firm-1' })
  firmId!: string;

  @ApiProperty({ example: 'Voss & Associates' })
  firmName!: string;

  @ApiProperty({ example: 'user-3', required: false })
  lawyerId?: string;

  @ApiProperty({ example: 'Lawyer Bob', required: false })
  lawyerName?: string;

  @ApiProperty({ enum: ConsultationType, example: ConsultationType.VIDEO })
  type!: ConsultationType;

  @ApiProperty({ example: 'May 10, 2026' })
  date!: string;

  @ApiProperty({ example: '10:30 AM - 11:00 AM' })
  time!: string;

  @ApiProperty({ enum: ConsultationStatus, example: ConsultationStatus.PENDING })
  status!: ConsultationStatus;

  @ApiProperty({ example: 'I need advice regarding a property dispute.', required: false })
  caseDescription?: string;

  @ApiProperty({ example: '$250', required: false })
  consultationFee?: string;

  @ApiProperty({ example: 'blue', required: false })
  avatarClass?: string;

  @ApiProperty({ example: false })
  bookedViaWorkflow!: boolean;

  @ApiProperty({ example: 'Please bring relevant documents.', required: false })
  notes?: string;

  @ApiProperty({ example: '2026-05-03T10:00:00Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2026-05-03T10:00:00Z' })
  updatedAt!: Date;
}
