import { Controller, Get, Post, Patch, Param, Body, Req, ForbiddenException } from '@nestjs/common';
import { Public } from '../auth/public.decorator';
import { SelfAssessService } from './self-assess.service';
import { SubmitSelfAssessDto } from './self-assess.dto';

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

  @Get()
  findAll(@Req() req: any) {
    requireAdmin(req);
    return this.service.findAll();
  }

  @Patch(':id/approve')
  approve(@Param('id') id: string, @Req() req: any) {
    requireAdmin(req);
    return this.service.approve(id);
  }

  @Patch(':id/reject')
  reject(@Param('id') id: string, @Req() req: any) {
    requireAdmin(req);
    return this.service.reject(id);
  }
}
