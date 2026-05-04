import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsEnum, IsNumber, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { AccessLevel } from './create-document.dto';

export class UpdateDocumentDto {
  @ApiProperty({
    description: 'Name of the document',
    example: 'Updated_Contract.pdf',
    required: false,
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({
    description: 'Access level',
    enum: AccessLevel,
    example: AccessLevel.SHARED,
    required: false,
  })
  @IsOptional()
  @IsEnum(AccessLevel)
  access?: AccessLevel;

  @ApiProperty({ description: 'Version number', example: 2, required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  version?: number;
}
