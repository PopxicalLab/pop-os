import { Controller, Get, Query } from '@nestjs/common';
import { SalesPerformanceService } from './sales-performance.service';

@Controller('api/sales-performance')
export class SalesPerformanceController {
  constructor(private readonly svc: SalesPerformanceService) {}

  // ?year=2026&quarter=2  →  specific quarter
  // ?year=2026            →  YTD (quarter omitted)
  @Get()
  getPerformance(
    @Query('year')    year?:    string,
    @Query('quarter') quarter?: string,
  ) {
    const y = year ? +year : new Date().getFullYear();
    const q = quarter ? +quarter : undefined;
    return this.svc.getPerformance(y, q);
  }
}
