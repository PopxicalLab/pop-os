import { IsString, IsNumber, IsInt, Min, Max, IsOptional } from 'class-validator';

export class UpsertSalesTargetDto {
  @IsString()
  personId: string;

  @IsInt() @Min(2020) @Max(2100)
  year: number;

  @IsInt() @Min(1) @Max(4)
  quarter: number;

  @IsNumber() @Min(0)
  targetAmount: number;
}

export class UpdateSalesTargetDto {
  @IsNumber() @Min(0) @IsOptional()
  targetAmount?: number;
}
