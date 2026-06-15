// GET /api/reports/projects  → projects.csv
// GET /api/reports/capacity  → capacity.csv
// GET /api/reports/ar        → ar.csv
import { Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';
import { ReportsService } from './reports.service';

@Controller('api/reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('projects')
  async projects(@Res() res: Response) {
    const csv = await this.reports.projectsCsv();
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

  @Get('ar')
  async ar(@Res() res: Response) {
    const csv = await this.reports.arCsv();
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="pop-ar.csv"');
    res.send(csv);
  }
}
