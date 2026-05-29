//   GET    /api/projects        -> list all
//   GET    /api/projects/:id    -> get one
//   POST   /api/projects        -> create
//   PATCH  /api/projects/:id    -> update
//   DELETE /api/projects/:id    -> delete
import { Controller, Get, Post, Patch, Delete, Param, Body } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { CreateProjectDto, UpdateProjectDto } from './project.dto';

@Controller('api/projects')
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Get()
  findAll() { return this.projects.findAll(); }

  @Get(':id')
  findOne(@Param('id') id: string) { return this.projects.findOne(id); }

  @Post()
  create(@Body() dto: CreateProjectDto) { return this.projects.create(dto); }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateProjectDto) {
    return this.projects.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) { return this.projects.remove(id); }
}
