// GET    /api/leads              → all leads
// GET    /api/leads/:id          → one lead
// POST   /api/leads              → create
// PATCH  /api/leads/:id          → update
// DELETE /api/leads/:id          → remove
// POST   /api/leads/:id/convert  → convert WON lead to Project
import { Controller, Get, Post, Patch, Delete, Param, Body, Req } from '@nestjs/common';
import { LeadsService } from './leads.service';
import { CreateLeadDto, UpdateLeadDto } from './lead.dto';
import { AuditService } from '../audit/audit.service';

@Controller('api/leads')
export class LeadsController {
  constructor(
    private readonly leads: LeadsService,
    private readonly audit: AuditService,
  ) {}

  @Get()      findAll(@Req() req: any)         { return this.leads.findAll(req.user?.company); }
  @Get(':id') findOne(@Param('id') id: string) { return this.leads.findOne(id); }

  @Post()
  async create(@Body() dto: CreateLeadDto, @Req() req: any) {
    const result = await this.leads.create(dto);
    this.audit.log(req.user, 'CREATE', 'Lead', result.id, result.name, result);
    return result;
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateLeadDto, @Req() req: any) {
    const result = await this.leads.update(id, dto);
    this.audit.log(req.user, 'UPDATE', 'Lead', result.id, result.name, result);
    return result;
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: any) {
    const existing = await this.leads.findOne(id);
    const result   = await this.leads.remove(id);
    this.audit.log(req.user, 'DELETE', 'Lead', id, existing.name);
    return result;
  }

  @Post(':id/convert')
  async convert(@Param('id') id: string, @Req() req: any) {
    const lead   = await this.leads.findOne(id);
    const result = await this.leads.convertToProject(id);
    this.audit.log(req.user, 'UPDATE', 'Lead', id, lead.name, { converted: true, projectId: result.id });
    return result;
  }
}
