import { IsString, IsNotEmpty, IsOptional, IsNumber, IsEnum, Min } from 'class-validator';
import { CRStatus } from '@prisma/client';

export class CreateChangeRequestDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsString()
  @IsNotEmpty()
  projectId: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  budgetImpact?: number;

  @IsOptional()
  @IsString()
  requestedBy?: string;
}

export class UpdateChangeRequestDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  budgetImpact?: number;

  @IsOptional()
  @IsEnum(CRStatus)
  status?: CRStatus;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsString()
  requestedBy?: string;
}
