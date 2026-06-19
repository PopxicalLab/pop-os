import { Controller, Get, Post, Delete, Body, Param, Query } from '@nestjs/common';
import { SalesTargetsService } from './sales-targets.service';
import { UpsertSalesTargetDto } from './sales-target.dto';

@Controller('api/sales-targets')
export class SalesTargetsController {
  constructor(private readonly svc: SalesTargetsService) {}

  @Get()
  findAll(@Query('year') year?: string, @Query('quarter') quarter?: string) {
    return this.svc.findAll(year ? +year : undefined, quarter ? +quarter : undefined);
  }

  @Post()
  upsert(@Body() dto: UpsertSalesTargetDto) {
    return this.svc.upsert(dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.svc.remove(id);
  }
}
