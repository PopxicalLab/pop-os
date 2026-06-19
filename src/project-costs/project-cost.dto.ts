import { IsString, IsNumber, IsEnum, IsOptional, Min } from 'class-validator';
import { CostType } from '@prisma/client';

export class CreateProjectCostDto {
  @IsString()
  projectId: string;

  @IsString()
  description: string;

  @IsNumber()
  @Min(0)
  amount: number;

  @IsEnum(CostType)
  @IsOptional()
  costType?: CostType;
}

export class UpdateProjectCostDto {
  @IsString() @IsOptional() description?: string;
  @IsNumber() @Min(0) @IsOptional() amount?: number;
  @IsEnum(CostType) @IsOptional() costType?: CostType;
}
