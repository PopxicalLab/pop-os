import { Controller, Get, Query, Req, ForbiddenException } from '@nestjs/common';
import { AuditService } from './audit.service';

@Controller('api/audit')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  findAll(@Query() q: any, @Req() req: any) {
    if (req.user?.role !== 'ADMIN') throw new ForbiddenException('Admin only');
    return this.audit.findAll(q);
  }
}
