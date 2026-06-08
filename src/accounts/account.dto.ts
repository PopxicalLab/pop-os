import { IsString, IsOptional, IsEnum } from 'class-validator';
import { Company } from '@prisma/client';

export class CreateAccountDto {
  @IsString()
  name: string;

  @IsOptional() @IsString() industry?: string;
  @IsOptional() @IsString() size?: string;
  @IsOptional() @IsString() website?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsEnum(Company) company?: Company;
}

export class UpdateAccountDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() industry?: string;
  @IsOptional() @IsString() size?: string;
  @IsOptional() @IsString() website?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsEnum(Company) company?: Company;
}
