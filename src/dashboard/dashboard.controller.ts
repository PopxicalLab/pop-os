// GET /api/dashboard  →  aggregated summary for the command-centre tab
import { Controller, Get, Req } from '@nestjs/common';
import { DashboardService } from './dashboard.service';

@Controller('api/dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get()
  getSummary(@Req() req: any) { return this.dashboard.getSummary(req.user?.company, req.user?.role); }
}
