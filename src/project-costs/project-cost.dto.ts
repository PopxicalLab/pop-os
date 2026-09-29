import { IsString, IsNumber, IsEnum, IsOptional, Min } from 'class-validator';
import { CostType } from '@prisma/client';

// Send projectId (from the project page) or leadId (from the job page) —
// the service links the cost to the job either way.
export class CreateProjectCostDto {
  @IsString()
  @IsOptional()
  projectId?: string;

  @IsString()
  @IsOptional()
  leadId?: string;

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
