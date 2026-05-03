import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsEnum,
  IsNumber,
  IsOptional,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum AccessLevel {
  PRIVATE = 'PRIVATE',
  SHARED = 'SHARED',
}

export class CreateDocumentDto {
  @ApiProperty({ description: 'Name of the document', example: 'Contract.pdf' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({
    description: 'Case ID the document belongs to',
    example: 'CASE-45',
  })
  @IsNotEmpty()
  @IsString()
  caseId: string;

  @ApiProperty({ description: 'Type of document', example: 'CONTRACT' })
  @IsNotEmpty()
  @IsString()
  type: string;

  @ApiProperty({ description: 'File type extension', example: 'PDF' })
  @IsNotEmpty()
  @IsString()
  fileType: string;

  @ApiProperty({
    description: 'Access level',
    enum: AccessLevel,
    example: AccessLevel.PRIVATE,
  })
  @IsNotEmpty()
  @IsEnum(AccessLevel)
  access: AccessLevel;

  @ApiProperty({ description: 'Version number', example: 1, required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  version?: number;
}
