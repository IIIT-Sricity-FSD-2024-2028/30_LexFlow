import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

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
  @IsString()
  filed_date?: string;
}
