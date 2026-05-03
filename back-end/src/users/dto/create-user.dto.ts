import {
  IsEmail,
  IsNotEmpty,
  IsString,
  IsEnum,
  IsOptional,
  MinLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum UserRole {
  CLIENT = 'client',
  LAWYER = 'lawyer',
  INTERN = 'intern',
  FIRM = 'firm',
  FIRMADMIN = 'firmadmin',
  SUPERADMIN = 'superadmin',
  USER = 'user',
}

export class CreateUserDto {
  @ApiProperty({
    description: 'Full name of the user',
    example: 'John Doe',
  })
  @IsNotEmpty()
  @IsString()
  fullName!: string;

  @ApiProperty({
    description: 'Email address of the user',
    example: 'john.doe@example.com',
  })
  @IsNotEmpty()
  @IsEmail()
  email!: string;

  @ApiProperty({
    description: 'User role (client, lawyer, intern, firmadmin, superadmin, user)',
    enum: UserRole,
    example: UserRole.CLIENT,
  })
  @IsNotEmpty()
  @IsEnum(UserRole)
  role!: UserRole;

  @ApiProperty({
    description: 'Password for account (create only)',
    example: 'S3cureP@ssw0rd',
  })
  @IsNotEmpty()
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiProperty({
    description: 'Phone number',
    example: '+91-9876543210',
    required: false,
  })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ required: false, example: 'active' })
  @IsOptional()
  @IsString()
  accountStatus?: 'active' | 'inactive';

  @ApiProperty({ required: false, example: 'available' })
  @IsOptional()
  @IsString()
  availability?: 'available' | 'unavailable';

  @ApiProperty({ required: false, example: 'firm-1' })
  @IsOptional()
  @IsString()
  firmId?: string;
}
