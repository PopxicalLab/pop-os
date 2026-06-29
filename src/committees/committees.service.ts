import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import {
  CreateCommitteeDto, UpdateCommitteeDto,
  AddMemberDto, UpdateMemberDto,
  CreateActivityDto, UpdateActivityDto,
} from './committee.dto';

// Standard include shape — used on get-one and list.
const COMMITTEE_INCLUDE = {
  members: {
    include: { person: { select: { id: true, name: true, role: true, department: true, company: true, status: true } } },
    orderBy: [{ leftAt: 'asc' }, { joinedAt: 'asc' }] as any,
  },
  activities: {
    include: {
      attendees: {
        include: { person: { select: { id: true, name: true, role: true } } },
      },
    },
    orderBy: { activityDate: 'desc' } as any,
  },
  _count: { select: { members: true, activities: true } },
};

@Injectable()
export class CommitteesService {
  constructor(private prisma: PrismaService) {}

  // ── committees ───────────────────────────────────────────────

  findAll() {
    return this.prisma.committee.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { members: true, activities: true } },
        members: {
          where: { leftAt: null },
          include: { person: { select: { id: true, name: true, role: true } } },
        },
      },
    });
  }

  async findOne(id: string) {
    const c = await this.prisma.committee.findUnique({
      where: { id },
      include: COMMITTEE_INCLUDE,
    });
    if (!c) throw new NotFoundException(`Committee ${id} not found`);
    return c;
  }

  async create(dto: CreateCommitteeDto) {
    const exists = await this.prisma.committee.findUnique({ where: { name: dto.name } });
    if (exists) throw new ConflictException(`Committee "${dto.name}" already exists`);
    return this.prisma.committee.create({ data: { name: dto.name, purpose: dto.purpose ?? null } });
  }

  async update(id: string, dto: UpdateCommitteeDto) {
    await this.findOne(id);
    return this.prisma.committee.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.committee.delete({ where: { id } });
  }

  // ── members ─────────────────────────────────────────────────

  async addMember(committeeId: string, dto: AddMemberDto) {
    await this.findOne(committeeId);
    const existing = await this.prisma.committeeMember.findUnique({
      where: { committeeId_personId: { committeeId, personId: dto.personId } },
    });
    if (existing) throw new ConflictException('Person is already a member of this committee');
    return this.prisma.committeeMember.create({
      data: {
        committeeId,
        personId: dto.personId,
        role: dto.role ?? 'MEMBER',
        joinedAt: dto.joinedAt ? new Date(dto.joinedAt) : new Date(),
      },
      include: { person: { select: { id: true, name: true, role: true } } },
    });
  }

  async updateMember(memberId: string, dto: UpdateMemberDto) {
    const member = await this.prisma.committeeMember.findUnique({ where: { id: memberId } });
    if (!member) throw new NotFoundException(`Member record ${memberId} not found`);
    return this.prisma.committeeMember.update({
      where: { id: memberId },
      data: {
        role:   dto.role   ?? undefined,
        leftAt: dto.leftAt ? new Date(dto.leftAt) : undefined,
      },
      include: { person: { select: { id: true, name: true, role: true } } },
    });
  }

  async removeMember(memberId: string) {
    const member = await this.prisma.committeeMember.findUnique({ where: { id: memberId } });
    if (!member) throw new NotFoundException(`Member record ${memberId} not found`);
    return this.prisma.committeeMember.delete({ where: { id: memberId } });
  }

  // ── activities ───────────────────────────────────────────────

  async addActivity(committeeId: string, dto: CreateActivityDto) {
    await this.findOne(committeeId);
    return this.prisma.committeeActivity.create({
      data: {
        committeeId,
        title:        dto.title,
        activityDate: new Date(dto.activityDate),
        notes:        dto.notes   ?? null,
        outcome:      dto.outcome ?? null,
      },
      include: { attendees: { include: { person: { select: { id: true, name: true, role: true } } } } },
    });
  }

  async updateActivity(activityId: string, dto: UpdateActivityDto) {
    const act = await this.prisma.committeeActivity.findUnique({ where: { id: activityId } });
    if (!act) throw new NotFoundException(`Activity ${activityId} not found`);
    return this.prisma.committeeActivity.update({
      where: { id: activityId },
      data: {
        title:        dto.title        ?? undefined,
        activityDate: dto.activityDate ? new Date(dto.activityDate) : undefined,
        notes:        dto.notes        ?? undefined,
        outcome:      dto.outcome      ?? undefined,
      },
      include: { attendees: { include: { person: { select: { id: true, name: true, role: true } } } } },
    });
  }

  async removeActivity(activityId: string) {
    const act = await this.prisma.committeeActivity.findUnique({ where: { id: activityId } });
    if (!act) throw new NotFoundException(`Activity ${activityId} not found`);
    return this.prisma.committeeActivity.delete({ where: { id: activityId } });
  }

  // ── attendance ───────────────────────────────────────────────

  async markAttendee(activityId: string, personId: string) {
    const act = await this.prisma.committeeActivity.findUnique({ where: { id: activityId } });
    if (!act) throw new NotFoundException(`Activity ${activityId} not found`);
    const exists = await this.prisma.committeeActivityAttendee.findUnique({
      where: { activityId_personId: { activityId, personId } },
    });
    if (exists) throw new ConflictException('Person already marked as attendee');
    return this.prisma.committeeActivityAttendee.create({ data: { activityId, personId } });
  }

  async unmarkAttendee(activityId: string, personId: string) {
    const row = await this.prisma.committeeActivityAttendee.findUnique({
      where: { activityId_personId: { activityId, personId } },
    });
    if (!row) throw new NotFoundException('Attendee record not found');
    return this.prisma.committeeActivityAttendee.delete({
      where: { activityId_personId: { activityId, personId } },
    });
  }

  // ── person committees (for profile page) ─────────────────────

  getPersonCommittees(personId: string) {
    return this.prisma.committeeMember.findMany({
      where: { personId },
      include: {
        committee: {
          select: { id: true, name: true, purpose: true, active: true },
        },
      },
      orderBy: { joinedAt: 'asc' },
    });
  }
}
