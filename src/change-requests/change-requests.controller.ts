// GET    /api/change-requests?projectId=xxx&status=PENDING  →  list (filterable)
// GET    /api/change-requests/:id                           →  single CR
// POST   /api/change-requests                               →  create
// PATCH  /api/change-requests/:id                           →  update / approve / reject
// DELETE /api/change-requests/:id                           →  remove
import { Controller, Get, Post, Patch, Delete, Param, Body, Query, Req } from '@nestjs/common';
import { ChangeRequestsService } from './change-requests.service';
import { CreateChangeRequestDto, UpdateChangeRequestDto } from './change-request.dto';
import { AuditService } from '../audit/audit.service';

@Controller('api/change-requests')
export class ChangeRequestsController {
  constructor(
    private readonly cr: ChangeRequestsService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  findAll(
    @Query('projectId') projectId?: string,
    @Query('status')    status?:    string,
  ) {
    return this.cr.findAll(projectId, status);
  }

  @Get(':id')
  findOne(@Param('id') id: string) { return this.cr.findOne(id); }

  @Post()
  async create(@Body() dto: CreateChangeRequestDto, @Req() req: any) {
    const result = await this.cr.create(dto);
    this.audit.log(req.user, 'CREATE', 'ChangeRequest', result.id, result.title, result);
    return result;
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateChangeRequestDto, @Req() req: any) {
    const result = await this.cr.update(id, dto);
    this.audit.log(req.user, 'UPDATE', 'ChangeRequest', result.id, result.title, result);
    return result;
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: any) {
    const existing = await this.cr.findOne(id);
    const result   = await this.cr.remove(id);
    this.audit.log(req.user, 'DELETE', 'ChangeRequest', id, existing.title);
    return result;
  }
}
