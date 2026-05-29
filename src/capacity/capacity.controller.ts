//   GET    /api/capacity?week=2026-05-26  -> board for a week (defaults to current)
//   GET    /api/capacity/:id              -> single entry
//   POST   /api/capacity                  -> add allocation
//   PATCH  /api/capacity/:id              -> update role or pct
//   DELETE /api/capacity/:id              -> remove
import { Controller, Get, Post, Patch, Delete, Param, Body, Query } from '@nestjs/common';
import { CapacityService } from './capacity.service';
import { CreateCapacityDto, UpdateCapacityDto } from './capacity.dto';

@Controller('api/capacity')
export class CapacityController {
  constructor(private readonly capacity: CapacityService) {}

  @Get()
  findByWeek(@Query('week') week?: string) { return this.capacity.findByWeek(week); }

  @Get(':id')
  findOne(@Param('id') id: string) { return this.capacity.findOne(id); }

  @Post()
  create(@Body() dto: CreateCapacityDto) { return this.capacity.create(dto); }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCapacityDto) {
    return this.capacity.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) { return this.capacity.remove(id); }
}
