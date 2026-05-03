import { ApiProperty } from '@nestjs/swagger';

export class FirmOnboardingResponseDto {
  @ApiProperty({
    description: 'Firm ID',
    example: 'firm-1',
  })
  firmId!: string;

  @ApiProperty({
    description: 'Firm name',
    example: 'Sharma & Associates',
  })
  name!: string;

  @ApiProperty({
    description: 'Primary email',
    example: 'contact@firm.com',
  })
  primaryEmail!: string;

  @ApiProperty({
    description: 'Admin user ID',
    example: 'user-5',
  })
  adminUserId!: string;

  @ApiProperty({
    description: 'Admin email',
    example: 'rahul.verma@lawfirm.in',
  })
  adminEmail!: string;

  @ApiProperty({
    description: 'Status message',
    example: 'Firm and admin account created successfully',
  })
  message!: string;

  @ApiProperty({
    description: 'Timestamp',
    example: '2026-04-30T10:30:00Z',
  })
  createdAt!: Date;
}
