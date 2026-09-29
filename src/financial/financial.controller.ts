// GET /api/financial/overview       →  studio-wide weekly cost summary
// GET /api/financial/projects        →  per-project cost breakdown
import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { FinancialService } from './financial.service';
import { FINANCE_ROLES, onlyRoles, requireRole } from '../common/roles';

// Financial tab: ADMIN + FINANCE, plus PM's cost-only view (src/common/roles.ts).
@UseGuards(onlyRoles(FINANCE_ROLES))
@Controller('api/financial')
export class FinancialController {
  constructor(private readonly financial: FinancialService) {}

  // Finance dashboard (receivables, overdue) — not part of the PM view.
  @Get('dashboard')
  getDashboard(@Req() req: any) {
    requireRole(req, ['ADMIN', 'FINANCE']);
    return this.financial.getFinanceDashboard(req.user?.company);
  }

  @Get('overview')
  getOverview(@Req() req: any) { return this.financial.getOverview(req.user?.company); }

  @Get('projects')
  getProjectCosts(@Req() req: any) { return this.financial.getProjectCosts(req.user?.company); }
}
