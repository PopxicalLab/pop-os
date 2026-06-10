// GET    /api/change-requests?projectId=xxx&status=PENDING  →  list (filterable)
// GET    /api/change-requests/:id                           →  single CR
// POST   /api/change-requests                               →  create
// PATCH  /api/change-requests/:id                           →  update / approve / reject
// DELETE /api/change-requests/:id                           →  remove
import { Controller, Get, Post, Patch, Delete, Param, Body, Query } from '@nestjs/common';
import { ChangeRequestsService } from './change-requests.service';
import { CreateChangeRequestDto, UpdateChangeRequestDto } from './change-request.dto';

@Controller('api/change-requests')
export class ChangeRequestsController {
  constructor(private readonly cr: ChangeRequestsService) {}

  @Get()
  findAll(
    @Query('projectId') projectId?: string,
    @Query('status')    status?:    string,
  ) {
    return this.cr.findAll(projectId, status);
  }

  @Get(':id')
  findOne(@Param('id') id: string) { return this.cr.findOne(id); }

  @Post()
  create(@Body() dto: CreateChangeRequestDto) { return this.cr.create(dto); }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateChangeRequestDto) {
    return this.cr.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) { return this.cr.remove(id); }
}
