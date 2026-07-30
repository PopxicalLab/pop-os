import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, Req, ForbiddenException,
} from '@nestjs/common';
import { PeopleService } from './people.service';
import { CreatePersonDto, UpdatePersonDto, CreateOnboardDto } from './person.dto';
import { CreatePersonEventDto } from './person-profile.dto';
import { AuditService } from '../audit/audit.service';

function requireAdmin(req: any) {
  if (req.user?.role !== 'ADMIN') throw new ForbiddenException('Admin only');
}

@Controller('api/people')
export class PeopleController {
  constructor(
    private readonly people: PeopleService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  findAll(@Req() req: any) { return this.people.findAll(req.user?.company); }

  @Get(':id')
  findOne(@Param('id') id: string) { return this.people.findOne(id); }

  @Get(':id/profile')
  getProfile(@Param('id') id: string, @Req() req: any) {
    return this.people.getProfile(id, req.user?.role, req.user?.personId ?? null);
  }

  @Post()
  async create(@Body() dto: CreatePersonDto, @Req() req: any) {
    requireAdmin(req);
    const result = await this.people.create(dto);
    this.audit.log(req.user, 'CREATE', 'Person', result.id, result.name, result);
    return result;
  }

  @Post('onboard')
  async onboard(@Body() dto: CreateOnboardDto, @Req() req: any) {
    requireAdmin(req);
    const result = await this.people.onboard(dto);
    this.audit.log(req.user, 'CREATE', 'Person', result.id, result.name, { onboarded: true, email: dto.email });
    return result;
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdatePersonDto, @Req() req: any) {
    const before = await this.people.findOne(id);
    const result = await this.people.update(id, dto);
    this.audit.log(req.user, 'UPDATE', 'Person', result.id, result.name, result, before);
    return result;
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: any) {
    requireAdmin(req);
    const existing = await this.people.findOne(id);
    const result   = await this.people.remove(id);
    this.audit.log(req.user, 'DELETE', 'Person', id, existing.name);
    return result;
  }

  @Post(':id/events')
  addEvent(@Param('id') id: string, @Body() dto: CreatePersonEventDto, @Req() req: any) {
    requireAdmin(req);
    return this.people.addEvent(id, dto);
  }

  @Delete('events/:eventId')
  removeEvent(@Param('eventId') eventId: string, @Req() req: any) {
    requireAdmin(req);
    return this.people.removeEvent(eventId);
  }
}
