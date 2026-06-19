import { Controller, Get, Post, Delete, Query, Body, Param } from '@nestjs/common';
import { IsString, IsNumber, Min, Max } from 'class-validator';
import { SalesPerformanceService } from './sales-performance.service';

class UpsertPersonTierRateDto {
  @IsString() personId: string;
  @IsString() tierId:   string;
  @IsNumber() @Min(0) @Max(1) rate: number; // commission fraction 0–1
}

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

  // Set or update a custom commission rate for a specific person × tier.
  @Post('person-tier-rates')
  upsertPersonTierRate(@Body() dto: UpsertPersonTierRateDto) {
    return this.svc.upsertPersonTierRate(dto.personId, dto.tierId, dto.rate);
  }

  // Clear a custom rate — reverts to the global CommissionTier rate.
  @Delete('person-tier-rates/:personId/:tierId')
  deletePersonTierRate(
    @Param('personId') personId: string,
    @Param('tierId')   tierId:   string,
  ) {
    return this.svc.deletePersonTierRate(personId, tierId);
  }
}
