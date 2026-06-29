//   GET    /api/projects                      -> list all
//   GET    /api/projects/all-skills           -> list all skills (for required-skill picker)
//   GET    /api/projects/:id                  -> get one
//   POST   /api/projects                      -> create
//   PATCH  /api/projects/:id                  -> update
//   DELETE /api/projects/:id                  -> delete
//   GET    /api/projects/:id/skills           -> list required skills
//   POST   /api/projects/:id/skills/:skillId  -> tag a required skill
//   DELETE /api/projects/:id/skills/:skillId  -> remove a required skill
//   GET    /api/projects/:id/staff-suggestions -> ranked staffing suggestions
import { Controller, Get, Post, Patch, Delete, Param, Body, Req, ForbiddenException } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { CreateProjectDto, UpdateProjectDto } from './project.dto';

@Controller('api/projects')
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  // Literal routes first — NestJS resolves /:id params last.
  @Get()
  findAll(@Req() req: any) {
    const personId = req.user?.role === 'STAFF' ? req.user.personId : undefined;
    return this.projects.findAll(personId ?? undefined, req.user?.company);
  }

  @Get('all-skills')
  getAllSkills() { return this.projects.getAllSkills(); }

  @Get(':id')
  findOne(@Param('id') id: string) { return this.projects.findOne(id); }

  @Post()
  create(@Body() dto: CreateProjectDto, @Req() req: any) {
    if (req.user?.role === 'STAFF') throw new ForbiddenException('Staff cannot create projects');
    return this.projects.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateProjectDto, @Req() req: any) {
    if (req.user?.role === 'STAFF') throw new ForbiddenException('Staff cannot edit projects');
    return this.projects.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: any) {
    if (req.user?.role === 'STAFF') throw new ForbiddenException('Staff cannot delete projects');
    return this.projects.remove(id);
  }

  // ── Required skills ────────────────────────────────────────────

  @Get(':id/skills')
  getProjectSkills(@Param('id') id: string) { return this.projects.getProjectSkills(id); }

  @Post(':id/skills/:skillId')
  addProjectSkill(@Param('id') id: string, @Param('skillId') skillId: string) {
    return this.projects.addProjectSkill(id, skillId);
  }

  @Delete(':id/skills/:skillId')
  removeProjectSkill(@Param('id') id: string, @Param('skillId') skillId: string) {
    return this.projects.removeProjectSkill(id, skillId);
  }

  // ── Staffing suggestions ────────────────────────────────────────

  @Get(':id/staff-suggestions')
  getStaffSuggestions(@Param('id') id: string) { return this.projects.getStaffSuggestions(id); }
}
