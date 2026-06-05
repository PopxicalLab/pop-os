// GET /api/staffing/recommend?projectId=xxx&weekStart=2026-06-02
import { Controller, Get, Query } from '@nestjs/common';
import { StaffingService } from './staffing.service';

@Controller('api/staffing')
export class StaffingController {
  constructor(private readonly staffing: StaffingService) {}

  @Get('recommend')
  recommend(
    @Query('projectId') projectId: string,
    @Query('weekStart') weekStart?: string,
  ) {
    return this.staffing.recommend(projectId, weekStart);
  }
}
