import { IsBoolean, IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;

  // "Stay logged in" checkbox on the login page. When true, issues a
  // long-lived token instead of the normal 12h one — see auth.service.ts.
  @IsOptional()
  @IsBoolean()
  rememberMe?: boolean;
}

export class ForgotPasswordDto {
  @IsEmail()
  email: string;
}

export class ResetPasswordDto {
  @IsString()
  userId: string;

  @IsString()
  token: string;

  @IsString()
  @MinLength(6)
  password: string;
}
