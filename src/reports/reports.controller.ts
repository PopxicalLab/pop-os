// GET /api/reports/projects  → projects.csv
// GET /api/reports/capacity  → capacity.csv
// GET /api/reports/ar        → ar.csv
import { Controller, Get, Res, Req } from '@nestjs/common';
import { Response } from 'express';
import { ReportsService } from './reports.service';
import { FINANCE_ROLES, canSeeMoney, requireRole } from '../common/roles';

@Controller('api/reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  // Everyone who sees Projects can export it — money / PPM columns are only
  // included for job roles (src/common/roles.ts).
  @Get('projects')
  async projects(@Req() req: any, @Res() res: Response) {
    const csv = await this.reports.projectsCsv(canSeeMoney(req.user?.role));
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="pop-projects.csv"');
    res.send(csv);
  }

  @Get('capacity')
  async capacity(@Res() res: Response) {
    const csv = await this.reports.capacityCsv();
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="pop-capacity.csv"');
    res.send(csv);
  }

  // Accounts receivable — Financial tab roles only.
  @Get('ar')
  async ar(@Req() req: any, @Res() res: Response) {
    requireRole(req, FINANCE_ROLES);
    const csv = await this.reports.arCsv();
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="pop-ar.csv"');
    res.send(csv);
  }
}
