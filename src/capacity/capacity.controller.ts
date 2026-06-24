//   GET    /api/capacity?week=2026-05-26      -> board for a week (defaults to current)
//   GET    /api/capacity?projectId=<id>       -> all allocations for a project
//   GET    /api/capacity/:id                  -> single entry
//   POST   /api/capacity                      -> add allocation
//   PATCH  /api/capacity/:id                  -> update role or pct
//   DELETE /api/capacity/:id                  -> remove
import { Controller, Get, Post, Patch, Delete, Param, Body, Query, Req, ForbiddenException } from '@nestjs/common';
import { CapacityService } from './capacity.service';
import { CreateCapacityDto, UpdateCapacityDto } from './capacity.dto';

@Controller('api/capacity')
export class CapacityController {
  constructor(private readonly capacity: CapacityService) {}

  @Get()
  find(@Query('week') week: string | undefined, @Query('projectId') projectId: string | undefined, @Req() req: any) {
    const personId = req.user?.role === 'STAFF' ? req.user.personId : undefined;
    if (projectId) return this.capacity.findByProject(projectId);
    return this.capacity.findByWeek(week, personId ?? undefined);
  }

  @Get(':id')
  findOne(@Param('id') id: string) { return this.capacity.findOne(id); }

  @Post()
  create(@Body() dto: CreateCapacityDto, @Req() req: any) {
    if (req.user?.role === 'STAFF') throw new ForbiddenException('Staff cannot manage capacity');
    return this.capacity.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCapacityDto, @Req() req: any) {
    if (req.user?.role === 'STAFF') throw new ForbiddenException('Staff cannot manage capacity');
    return this.capacity.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: any) {
    if (req.user?.role === 'STAFF') throw new ForbiddenException('Staff cannot manage capacity');
    return this.capacity.remove(id);
  }
}
