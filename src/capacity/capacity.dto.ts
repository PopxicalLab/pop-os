import {
  IsString, IsNotEmpty, IsEnum, IsDateString, IsNumber, Min, Max, IsOptional,
} from 'class-validator';
import { CapacityRole } from '@prisma/client';

export class CreateCapacityDto {
  @IsString() @IsNotEmpty()
  personId: string;

  @IsString() @IsNotEmpty()
  projectId: string;

  // Any date in the target week — the service normalises it to that Monday.
  @IsDateString()
  weekStart: string;

  @IsEnum(CapacityRole)
  role: CapacityRole;

  // Whole or decimal percentages accepted; 1–100 enforced.
  @IsNumber() @Min(1) @Max(100)
  pctWeek: number;
}

export class UpdateCapacityDto {
  @IsOptional() @IsEnum(CapacityRole)
  role?: CapacityRole;

  @IsOptional() @IsNumber() @Min(1) @Max(100)
  pctWeek?: number;
}
