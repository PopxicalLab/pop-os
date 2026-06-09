import { IsEmail, IsString, MinLength, IsEnum, IsOptional, IsBoolean } from 'class-validator';

export enum Role { ADMIN = 'ADMIN', PRODUCER = 'PRODUCER', SALES = 'SALES', FINANCE = 'FINANCE' }

export class CreateUserDto {
  @IsEmail()        email: string;
  @IsString()       name: string;
  @IsString() @MinLength(6) password: string;
  @IsEnum(Role)     role: Role;
  @IsOptional() @IsString() personId?: string;
}

export class UpdateUserDto {
  @IsOptional() @IsString()               name?: string;
  @IsOptional() @IsEmail()                email?: string;
  @IsOptional() @IsString() @MinLength(6) password?: string;
  @IsOptional() @IsEnum(Role)             role?: Role;
  @IsOptional() @IsBoolean()              active?: boolean;
  @IsOptional() @IsString()               personId?: string;
}
