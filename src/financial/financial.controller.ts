// GET /api/financial/overview       →  studio-wide weekly cost summary
// GET /api/financial/projects        →  per-project cost breakdown
import { Controller, Get, Req } from '@nestjs/common';
import { FinancialService } from './financial.service';

@Controller('api/financial')
export class FinancialController {
  constructor(private readonly financial: FinancialService) {}

  @Get('dashboard')
  getDashboard(@Req() req: any) { return this.financial.getFinanceDashboard(req.user?.company); }

  @Get('overview')
  getOverview(@Req() req: any) { return this.financial.getOverview(req.user?.company); }

  @Get('projects')
  getProjectCosts(@Req() req: any) { return this.financial.getProjectCosts(req.user?.company); }
}
