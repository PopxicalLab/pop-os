import { Controller, Get, Post, Patch, Delete, Body, Param, Query } from '@nestjs/common';
import { ProjectCostsService } from './project-costs.service';
import { CreateProjectCostDto, UpdateProjectCostDto } from './project-cost.dto';

@Controller('api/project-costs')
export class ProjectCostsController {
  constructor(private readonly svc: ProjectCostsService) {}

  @Get()
  findAll(@Query('projectId') projectId?: string) {
    return this.svc.findAll(projectId);
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
