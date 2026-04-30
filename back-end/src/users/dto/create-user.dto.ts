import { IsString, IsIn, IsEmail } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty()
  @IsString()
  name!: string;

  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiProperty({ enum: ['client', 'lawyer', 'admin', 'intern'] })
  @IsIn(['client', 'lawyer', 'admin', 'intern'])
  role!: string;
}