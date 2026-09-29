// GET /api/jobs      → all won jobs, with money rolled up (Jobs tab)
// GET /api/jobs/:id  → one job: sales + production + money (Job page)
import { Controller, Get, Param, Req } from '@nestjs/common';
import { JobsService } from './jobs.service';
import { JOB_ROLES, requireRole } from '../common/roles';

// Jobs show money (value, costs, net, invoices), so only job roles can
// open them — see src/common/roles.ts.
@Controller('api/jobs')
export class JobsController {
  constructor(private readonly jobs: JobsService) {}

  @Get()
  findAll(@Req() req: any) {
    requireRole(req, JOB_ROLES);
    return this.jobs.findAll(req.user?.company);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: any) {
    requireRole(req, JOB_ROLES);
    return this.jobs.findOne(id);
  }
}
