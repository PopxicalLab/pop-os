// GET /api/jobs      → all won jobs, with money rolled up (Jobs tab)
// GET /api/jobs/:id  → one job: sales + production + money (Job page)
import { Controller, Get, Param, Req, ForbiddenException } from '@nestjs/common';
import { JobsService } from './jobs.service';

// Jobs show money (value, costs, net, invoices), so only money roles can
// open them. Keep in sync with TAB_ACCESS.jobs in public/js/shared.js.
const JOB_ROLES = ['ADMIN', 'PRODUCER', 'PM', 'FINANCE', 'SALES'];

function assertJobAccess(req: any) {
  if (!JOB_ROLES.includes(req.user?.role)) throw new ForbiddenException('Jobs are not available for your role');
}

@Controller('api/jobs')
export class JobsController {
  constructor(private readonly jobs: JobsService) {}

  @Get()
  findAll(@Req() req: any) {
    assertJobAccess(req);
    return this.jobs.findAll(req.user?.company);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: any) {
    assertJobAccess(req);
    return this.jobs.findOne(id);
  }
}
