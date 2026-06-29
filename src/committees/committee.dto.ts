import {
  IsString, IsNotEmpty, IsOptional, IsBoolean,
  IsEnum, IsDateString,
} from 'class-validator';
import { CommitteeRole } from '@prisma/client';

export class CreateCommitteeDto {
  @IsString() @IsNotEmpty() name: string;
  @IsString() @IsOptional() purpose?: string;
}

export class UpdateCommitteeDto {
  @IsString() @IsOptional() name?: string;
  @IsString() @IsOptional() purpose?: string;
  @IsBoolean() @IsOptional() active?: boolean;
}

export class AddMemberDto {
  @IsString() @IsNotEmpty() personId: string;
  @IsEnum(CommitteeRole) @IsOptional() role?: CommitteeRole;
  @IsDateString() @IsOptional() joinedAt?: string;
}

export class UpdateMemberDto {
  @IsEnum(CommitteeRole) @IsOptional() role?: CommitteeRole;
  @IsDateString() @IsOptional() leftAt?: string;
}

export class CreateActivityDto {
  @IsString() @IsNotEmpty() title: string;
  @IsDateString() activityDate: string;
  @IsString() @IsOptional() notes?: string;
  @IsString() @IsOptional() outcome?: string;
}

export class UpdateActivityDto {
  @IsString() @IsOptional() title?: string;
  @IsDateString() @IsOptional() activityDate?: string;
  @IsString() @IsOptional() notes?: string;
  @IsString() @IsOptional() outcome?: string;
}
