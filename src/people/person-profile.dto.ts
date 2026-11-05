import { IsString, IsNotEmpty, IsEnum, IsOptional, IsDateString, IsNumber, Min } from 'class-validator';
import { PersonEventType } from '@prisma/client';

export class CreatePersonEventDto {
  @IsEnum(PersonEventType) type: PersonEventType;
  @IsString() @IsNotEmpty() title: string;
  @IsString() @IsOptional() note?: string;
  @IsDateString() @IsOptional() eventDate?: string;
  // RM value of a reward (bonus, voucher…). Only kept for ACHIEVEMENT events.
  @IsNumber() @Min(0) @IsOptional() rewardValue?: number;
}
