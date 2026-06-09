import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './auth.dto';
import { Public } from './public.decorator';

@Controller('api/auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  // Public — no token needed to log in
  @Public()
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  // Returns the currently logged-in user's info (useful for the frontend on load)
  @Get('me')
  me(@Req() req: any) {
    return req.user;
  }
}
