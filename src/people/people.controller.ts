import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, Req, ForbiddenException,
} from '@nestjs/common';
import { PeopleService } from './people.service';
import { CreatePersonDto, UpdatePersonDto, CreateOnboardDto } from './person.dto';
import { CreatePersonEventDto } from './person-profile.dto';

function requireAdmin(req: any) {
  if (req.user?.role !== 'ADMIN') throw new ForbiddenException('Admin only');
}

@Controller('api/people')
export class PeopleController {
  constructor(private readonly people: PeopleService) {}

  @Get()
  findAll(@Req() req: any) {
    return this.people.findAll(req.user?.company);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.people.findOne(id);
  }

  // Full lifecycle profile — admin sees all; own personId sees own.
  @Get(':id/profile')
  getProfile(@Param('id') id: string, @Req() req: any) {
    return this.people.getProfile(id, req.user?.role, req.user?.personId ?? null);
  }

  @Post()
  create(@Body() dto: CreatePersonDto, @Req() req: any) {
    requireAdmin(req);
    return this.people.create(dto);
  }

  @Post('onboard')
  onboard(@Body() dto: CreateOnboardDto, @Req() req: any) {
    requireAdmin(req);
    return this.people.onboard(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdatePersonDto) {
    return this.people.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: any) {
    requireAdmin(req);
    return this.people.remove(id);
  }

  // Timeline events — admin only
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
