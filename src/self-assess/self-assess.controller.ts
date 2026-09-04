import { Controller, Get, Post, Patch, Param, Body, Req, ForbiddenException } from '@nestjs/common';
import { Public } from '../auth/public.decorator';
import { SelfAssessService } from './self-assess.service';
import { SubmitSelfAssessDto, AdminSubmitSelfAssessDto, ApproveSelfAssessDto } from './self-assess.dto';

function requireAdmin(req: any) {
  if (req.user?.role !== 'ADMIN') throw new ForbiddenException('Admin only');
}

@Controller('api/self-assess')
export class SelfAssessController {
  constructor(private service: SelfAssessService) {}

  // ── Public (no auth) ──────────────────────────────────────────

  @Public() @Get('people')
  listPeople() { return this.service.listPeople(); }

  @Public() @Get('skills')
  listSkills() { return this.service.listSkills(); }

  @Public() @Post()
  submit(@Body() dto: SubmitSelfAssessDto) { return this.service.submit(dto); }

  // ── Admin only ────────────────────────────────────────────────

  // Admin has already matched the submitter to an existing Person —
  // ratings are written straight into the system, no pending review.
  @Post('admin-submit')
  adminSubmit(@Body() dto: AdminSubmitSelfAssessDto, @Req() req: any) {
    requireAdmin(req);
    return this.service.adminSubmit(dto);
  }

  @Get()
  findAll(@Req() req: any) {
    requireAdmin(req);
    return this.service.findAll();
  }

  @Patch(':id/approve')
  approve(@Param('id') id: string, @Body() body: ApproveSelfAssessDto, @Req() req: any) {
    requireAdmin(req);
    return this.service.approve(id, body?.personId);
  }

  @Patch(':id/reject')
  reject(@Param('id') id: string, @Req() req: any) {
    requireAdmin(req);
    return this.service.reject(id);
  }
}
