import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, Req, ForbiddenException,
} from '@nestjs/common';
import { CommitteesService } from './committees.service';
import {
  CreateCommitteeDto, UpdateCommitteeDto,
  AddMemberDto, UpdateMemberDto,
  CreateActivityDto, UpdateActivityDto,
} from './committee.dto';

function requireAdmin(req: any) {
  if (req.user?.role !== 'ADMIN') throw new ForbiddenException('Admin only');
}

@Controller('api/committees')
export class CommitteesController {
  constructor(private readonly svc: CommitteesService) {}

  // ── committees ─────────────────────────────────────────────

  @Get()
  findAll() { return this.svc.findAll(); }

  @Get(':id')
  findOne(@Param('id') id: string) { return this.svc.findOne(id); }

  @Post()
  create(@Body() dto: CreateCommitteeDto, @Req() req: any) {
    requireAdmin(req);
    return this.svc.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCommitteeDto, @Req() req: any) {
    requireAdmin(req);
    return this.svc.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: any) {
    requireAdmin(req);
    return this.svc.remove(id);
  }

  // ── members ────────────────────────────────────────────────

  @Post(':id/members')
  addMember(@Param('id') id: string, @Body() dto: AddMemberDto, @Req() req: any) {
    requireAdmin(req);
    return this.svc.addMember(id, dto);
  }

  @Patch('members/:memberId')
  updateMember(@Param('memberId') memberId: string, @Body() dto: UpdateMemberDto, @Req() req: any) {
    requireAdmin(req);
    return this.svc.updateMember(memberId, dto);
  }

  @Delete('members/:memberId')
  removeMember(@Param('memberId') memberId: string, @Req() req: any) {
    requireAdmin(req);
    return this.svc.removeMember(memberId);
  }

  // ── activities ─────────────────────────────────────────────

  @Post(':id/activities')
  addActivity(@Param('id') id: string, @Body() dto: CreateActivityDto, @Req() req: any) {
    requireAdmin(req);
    return this.svc.addActivity(id, dto);
  }

  @Patch('activities/:activityId')
  updateActivity(@Param('activityId') activityId: string, @Body() dto: UpdateActivityDto, @Req() req: any) {
    requireAdmin(req);
    return this.svc.updateActivity(activityId, dto);
  }

  @Delete('activities/:activityId')
  removeActivity(@Param('activityId') activityId: string, @Req() req: any) {
    requireAdmin(req);
    return this.svc.removeActivity(activityId);
  }

  // ── attendance ─────────────────────────────────────────────

  @Post('activities/:activityId/attendees/:personId')
  markAttendee(
    @Param('activityId') activityId: string,
    @Param('personId') personId: string,
    @Req() req: any,
  ) {
    requireAdmin(req);
    return this.svc.markAttendee(activityId, personId);
  }

  @Delete('activities/:activityId/attendees/:personId')
  unmarkAttendee(
    @Param('activityId') activityId: string,
    @Param('personId') personId: string,
    @Req() req: any,
  ) {
    requireAdmin(req);
    return this.svc.unmarkAttendee(activityId, personId);
  }

  // ── person view (profile page) ─────────────────────────────

  @Get('person/:personId')
  getPersonCommittees(@Param('personId') personId: string) {
    return this.svc.getPersonCommittees(personId);
  }
}
