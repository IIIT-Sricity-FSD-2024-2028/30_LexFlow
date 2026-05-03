import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from './create-user.dto';

export class UserResponseDto {
  @ApiProperty({
    description: 'Unique identifier',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id!: string;
  @ApiProperty({ required: false })
  firmName?: string;
  @ApiProperty({
    description: 'Full name of the user',
    example: 'John Doe',
  })
  fullName!: string;

  @ApiProperty({
    description: 'Email address',
    example: 'john.doe@example.com',
  })
  email!: string;

  @ApiProperty({
    description: 'User role',
    enum: UserRole,
    example: UserRole.CLIENT,
  })
  role!: UserRole;

  @ApiProperty({
    description: 'Account creation timestamp',
    example: '2026-04-30T10:30:00Z',
  })
  createdAt!: Date;

  @ApiProperty({ description: 'Phone number', required: false })
  phone?: string;

  @ApiProperty({
    description: 'Associated firm ID (for FIRMADMIN, LAWYER, INTERN roles)',
    example: 'firm-1',
    required: false,
  })
  firmId?: string;
}
