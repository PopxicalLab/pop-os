import { IsString, IsNotEmpty, IsEnum, IsOptional, IsDateString } from 'class-validator';
import { PersonEventType } from '@prisma/client';

export class CreatePersonEventDto {
  @IsEnum(PersonEventType) type: PersonEventType;
  @IsString() @IsNotEmpty() title: string;
  @IsString() @IsOptional() note?: string;
  @IsDateString() @IsOptional() eventDate?: string;
}
