//   GET    /api/notification-rules            -> { configured, events, rules }
//   POST   /api/notification-rules            -> create a rule
//   PATCH  /api/notification-rules/:id        -> edit (targets, when present, replace the list)
//   DELETE /api/notification-rules/:id        -> delete
//   POST   /api/notification-rules/:id/test   -> send a short test message to the rule's targets
//   POST   /api/notification-rules/:id/run    -> send the real message now
// ADMIN only — these rules decide who the studio's data is posted to.
import { Controller, Get, Post, Patch, Delete, Param, Body, Req, ForbiddenException } from '@nestjs/common';
import { NotificationRulesService } from './notification-rules.service';
import { CreateRuleDto, UpdateRuleDto } from './notification-rules.dto';
import { AuditService } from '../audit/audit.service';

function requireAdmin(req: any) {
  if (req.user?.role !== 'ADMIN') throw new ForbiddenException('Admin only');
}

@Controller('api/notification-rules')
export class NotificationRulesController {
  constructor(
    private readonly rules: NotificationRulesService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  list(@Req() req: any) { requireAdmin(req); return this.rules.list(); }

  @Post()
  async create(@Body() dto: CreateRuleDto, @Req() req: any) {
    requireAdmin(req);
    const result = await this.rules.create(dto);
    this.audit.log(req.user, 'CREATE', 'NotificationRule', result.id, result.name, result);
    return result;
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateRuleDto, @Req() req: any) {
    requireAdmin(req);
    const result = await this.rules.update(id, dto);
    this.audit.log(req.user, 'UPDATE', 'NotificationRule', id, result.name, result);
    return result;
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: any) {
    requireAdmin(req);
    const result = await this.rules.remove(id);
    this.audit.log(req.user, 'DELETE', 'NotificationRule', id, result.name, result);
    return { ok: true };
  }

  @Post(':id/test')
  test(@Param('id') id: string, @Req() req: any) { requireAdmin(req); return this.rules.sendTest(id); }

  @Post(':id/run')
  run(@Param('id') id: string, @Req() req: any) { requireAdmin(req); return this.rules.runNow(id); }
}
