// GET    /api/job-titles        → list all job titles
// POST   /api/job-titles        → add a job title (admin only)
// DELETE /api/job-titles/:id    → remove a job title (admin only)
import { Controller, Get, Post, Delete, Param, Body, Req, ForbiddenException } from '@nestjs/common';
import { JobTitlesService } from './job-titles.service';
import { CreateJobTitleDto } from './job-title.dto';

function requireAdmin(req: any) {
  if (req.user?.role !== 'ADMIN') throw new ForbiddenException('Admin only');
}

@Controller('api/job-titles')
export class JobTitlesController {
  constructor(private readonly jobTitles: JobTitlesService) {}

  @Get()
  findAll() { return this.jobTitles.findAll(); }

  @Post()
  create(@Body() dto: CreateJobTitleDto, @Req() req: any) {
    requireAdmin(req);
    return this.jobTitles.create(dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: any) {
    requireAdmin(req);
    return this.jobTitles.remove(id);
  }
}
