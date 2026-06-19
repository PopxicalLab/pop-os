import { IsNumber, IsString, IsOptional, Min, Max } from 'class-validator';

export class UpdateCommissionTierDto {
  @IsNumber() @Min(0) @Max(10) @IsOptional() threshold?: number;
  @IsNumber() @Min(0) @Max(1)  @IsOptional() rate?: number;
  @IsString()                  @IsOptional() label?: string;
}
