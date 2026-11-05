import { Controller, Get, Param, Req } from '@nestjs/common';
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

  // "My Journey" — the logged-in user's own lifetime page: this year,
  // coming up, year-by-year history, badges and awards.
  @Get('journey')
  getMyJourney(@Req() req: any) {
    return this.me.getJourney(req.user, null);
  }

  // Someone else's journey. The service allows it for the person themself
  // or JOURNEY_VIEWERS (ADMIN / PRODUCER / PM); everyone else gets 403.
  @Get('journey/:personId')
  getJourney(@Param('personId') personId: string, @Req() req: any) {
    return this.me.getJourney(req.user, personId);
  }
}
