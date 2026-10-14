import { IsString, IsNotEmpty, IsOptional, IsNumber, IsArray } from 'class-validator';
import { Type } from 'class-transformer';

// Note: @Type(() => Object) on the array fields stops the global pipe's
// implicit conversion from turning each element into [] (it nested arrays).

export class CreateCaseDto {
  @IsOptional()
  @IsString()
  consultation_id?: string;

  @IsOptional()
  @IsString()
  lawfirm_id?: string;

  @IsOptional()
  @IsString()
  lawyer_id?: string;

  @IsOptional()
  @IsString()
  client_id?: string;

  @IsString()
  @IsNotEmpty()
  cnr: string;

  @IsString()
  @IsNotEmpty()
  case_type: string;

  @IsString()
  @IsNotEmpty()
  brief_description: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsNumber()
  progress?: number;

  @IsOptional()
  @IsArray()
  @Type(() => Object)
  timeline?: any[];

  @IsOptional()
  @IsArray()
  @Type(() => Object)
  documents?: any[];

  @IsOptional()
  client?: any;

  @IsOptional()
  @IsArray()
  @Type(() => Object)
  team?: any[];

  @IsOptional()
  @IsString()
  filed_date?: string;
}
