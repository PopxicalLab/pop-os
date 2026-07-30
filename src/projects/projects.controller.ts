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
import { AuditService } from '../audit/audit.service';

@Controller('api/projects')
export class ProjectsController {
  constructor(
    private readonly projects: ProjectsService,
    private readonly audit: AuditService,
  ) {}

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
  async create(@Body() dto: CreateProjectDto, @Req() req: any) {
    if (req.user?.role === 'STAFF') throw new ForbiddenException('Staff cannot create projects');
    const result = await this.projects.create(dto);
    this.audit.log(req.user, 'CREATE', 'Project', result.id, result.name, result);
    return result;
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateProjectDto, @Req() req: any) {
    if (req.user?.role === 'STAFF') throw new ForbiddenException('Staff cannot edit projects');
    const before = await this.projects.findOne(id);
    const result = await this.projects.update(id, dto);
    this.audit.log(req.user, 'UPDATE', 'Project', result.id, result.name, result, before);
    return result;
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: any) {
    if (req.user?.role === 'STAFF') throw new ForbiddenException('Staff cannot delete projects');
    const existing = await this.projects.findOne(id);
    const result   = await this.projects.remove(id);
    this.audit.log(req.user, 'DELETE', 'Project', id, existing.name);
    return result;
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
