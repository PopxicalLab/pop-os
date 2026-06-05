// GET /api/dashboard  →  aggregated summary for the command-centre tab
import { Controller, Get } from '@nestjs/common';
import { DashboardService } from './dashboard.service';

@Controller('api/dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get()
  getSummary() { return this.dashboard.getSummary(); }
}
