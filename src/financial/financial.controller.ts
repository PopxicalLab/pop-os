// GET /api/financial/overview       →  studio-wide weekly cost summary
// GET /api/financial/projects        →  per-project cost breakdown
import { Controller, Get } from '@nestjs/common';
import { FinancialService } from './financial.service';

@Controller('api/financial')
export class FinancialController {
  constructor(private readonly financial: FinancialService) {}

  @Get('dashboard')
  getDashboard() { return this.financial.getFinanceDashboard(); }

  @Get('overview')
  getOverview() { return this.financial.getOverview(); }

  @Get('projects')
  getProjectCosts() { return this.financial.getProjectCosts(); }
}
