import { Controller, Get, Req } from '@nestjs/common';
import { MeService } from './me.service';

@Controller('api/me')
export class MeController {
  constructor(private readonly me: MeService) {}

  // Returns the personalised dashboard for the currently logged-in user.
  // The JWT payload (req.user) contains { sub: userId, role, name, email }.
  @Get('dashboard')
  getDashboard(@Req() req: any) {
    return this.me.getDashboard(req.user.sub);
  }
}
