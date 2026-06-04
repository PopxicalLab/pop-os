import {
  IsString, IsNotEmpty, IsEnum, IsDateString, IsNumber, Min, Max,
  IsOptional, IsBoolean,
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

  // 1–140: 100 = Mon–Fri full week; 101–140 = includes approved weekend days.
  @IsNumber() @Min(1) @Max(140)
  pctWeek: number;

  // Must be true when pctWeek > 100. Enforced in the service.
  @IsOptional() @IsBoolean()
  weekendApproved?: boolean;
}

export class UpdateCapacityDto {
  @IsOptional() @IsEnum(CapacityRole)
  role?: CapacityRole;

  @IsOptional() @IsNumber() @Min(1) @Max(140)
  pctWeek?: number;

  @IsOptional() @IsBoolean()
  weekendApproved?: boolean;
}
