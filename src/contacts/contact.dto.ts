import { IsString, IsOptional, IsBoolean } from 'class-validator';

export class CreateContactDto {
  @IsString() name: string;
  @IsString() accountId: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() department?: string;
  @IsOptional() @IsBoolean() vip?: boolean;
}

export class UpdateContactDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() accountId?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() department?: string;
  @IsOptional() @IsBoolean() vip?: boolean;
}
