// GET    /api/leads              → all leads
// GET    /api/leads/:id          → one lead
// POST   /api/leads              → create
// PATCH  /api/leads/:id          → update
// DELETE /api/leads/:id          → remove
// POST   /api/leads/:id/convert  → convert WON lead to Project
import { Controller, Get, Post, Patch, Delete, Param, Body } from '@nestjs/common';
import { LeadsService } from './leads.service';
import { CreateLeadDto, UpdateLeadDto } from './lead.dto';

@Controller('api/leads')
export class LeadsController {
  constructor(private readonly leads: LeadsService) {}

  @Get()      findAll()                                     { return this.leads.findAll(); }
  @Get(':id') findOne(@Param('id') id: string)              { return this.leads.findOne(id); }
  @Post()     create(@Body() dto: CreateLeadDto)            { return this.leads.create(dto); }
  @Patch(':id') update(@Param('id') id: string, @Body() dto: UpdateLeadDto) {
    return this.leads.update(id, dto);
  }
  @Delete(':id') remove(@Param('id') id: string)            { return this.leads.remove(id); }
  @Post(':id/convert') convert(@Param('id') id: string)     { return this.leads.convertToProject(id); }
}
