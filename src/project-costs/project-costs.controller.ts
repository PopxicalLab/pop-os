import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ProjectCostsService } from './project-costs.service';
import { CreateProjectCostDto, UpdateProjectCostDto } from './project-cost.dto';
import { JOB_ROLES, onlyRoles } from '../common/roles';

// Job costs are money — job roles only (src/common/roles.ts).
@UseGuards(onlyRoles(JOB_ROLES))
@Controller('api/project-costs')
export class ProjectCostsController {
  constructor(private readonly svc: ProjectCostsService) {}

  @Get()
  findAll(@Query('projectId') projectId?: string, @Query('leadId') leadId?: string) {
    return this.svc.findAll(projectId, leadId);
  }

  @Post()
  create(@Body() dto: CreateProjectCostDto) {
    return this.svc.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateProjectCostDto) {
    return this.svc.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.svc.remove(id);
  }
}
