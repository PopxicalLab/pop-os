// The SERVICE holds the logic: it talks to the database via Prisma.
// (The controller, next file, handles the web requests and calls these.)
import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma.service';
import { CreatePersonDto, UpdatePersonDto, CreateOnboardDto } from './person.dto';
import { CreatePersonEventDto } from './person-profile.dto';
import { companyWhere } from '../common/company-filter';
import { NotificationsService } from '../notifications/notifications.service';
import { computeBadges } from '../common/badges';

@Injectable()
export class PeopleService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  // List everyone, newest first, with their rated skills and login status.
  findAll(company?: string | null) {
    const co = companyWhere(company);
    return this.prisma.person.findMany({
      where:   co ?? undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        skills:   { include: { skill: true } },
        software: { include: { software: true }, orderBy: { software: { name: 'asc' } } },
        user:     { select: { id: true, email: true, role: true, active: true } },
      },
    });
  }

  // Get one person by id, or throw a clean 404 if not found.
  async findOne(id: string) {
    const person = await this.prisma.person.findUnique({
      where: { id },
      include: {
        skills:   { include: { skill: true } },
        software: { include: { software: true }, orderBy: { software: { name: 'asc' } } },
        user:     { select: { id: true, email: true, role: true, active: true } },
      },
    });
    if (!person) throw new NotFoundException(`Person ${id} not found`);
    return person;
  }

  // Create a new person — auto-logs initial salary if provided.
  async create(dto: CreatePersonDto) {
    return this.prisma.$transaction(async (tx) => {
      const person = await tx.person.create({
        data: {
          name: dto.name,
          role: dto.role,
          department: dto.department,
          startDate: new Date(dto.startDate),
          employmentType: dto.employmentType ?? 'FULL_TIME',
          status: dto.status ?? 'ACTIVE',
          company: dto.company ?? null,
          salary: dto.salary ?? null,
        },
      });
      if (dto.salary) {
        await tx.salaryHistory.create({
          data: { personId: person.id, amount: dto.salary, reason: 'Starting salary' },
        });
      }
      return person;
    });
  }

  // Update an existing person — auto-logs salary change if salary differs.
  async update(id: string, dto: UpdatePersonDto) {
    const existing = await this.findOne(id);
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.person.update({
        where: { id },
        data: { ...dto, startDate: dto.startDate ? new Date(dto.startDate) : undefined },
      });
      // Log salary history if salary actually changed
      if (dto.salary !== undefined && dto.salary !== existing.salary) {
        await tx.salaryHistory.create({
          data: {
            personId: id,
            amount: dto.salary,
            prevAmount: existing.salary ?? null,
            reason: 'Salary adjustment',
          },
        });
      }
      return updated;
    });
  }

  // Delete a person.
  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.person.delete({ where: { id } });
  }

  // New Joiner: create Person + User + initial salary log in one transaction.
  async onboard(dto: CreateOnboardDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (existing) throw new ConflictException('Email already in use');

    const hash = await bcrypt.hash(dto.password, 12);

    const person = await this.prisma.$transaction(async (tx) => {
      const p = await tx.person.create({
        data: {
          name: dto.name,
          role: dto.role,
          department: dto.department,
          startDate: new Date(dto.startDate),
          employmentType: dto.employmentType ?? 'FULL_TIME',
          status: 'ACTIVE',
          company: dto.company ?? null,
          salary: dto.salary ?? null,
        },
      });
      if (dto.salary) {
        await tx.salaryHistory.create({
          data: { personId: p.id, amount: dto.salary, reason: 'Starting salary' },
        });
      }
      await tx.user.create({
        data: {
          name: dto.name,
          email: dto.email.toLowerCase(),
          password: hash,
          role: dto.systemRole as any,
          personId: p.id,
        },
      });
      return p;
    });

    // Send welcome email after transaction commits — fire and forget, never blocks the response.
    this.notifications.sendWelcomeEmail({
      name:     dto.name,
      email:    dto.email.toLowerCase(),
      password: dto.password,
      role:     dto.systemRole,
      company:  dto.company ?? null,
    });

    return person;
  }

  // Full lifecycle profile for a person.
  async getProfile(id: string, requestingRole: string, requestingPersonId: string | null) {
    const isAdmin = requestingRole === 'ADMIN';
    const isSelf  = requestingPersonId === id;
    if (!isAdmin && !isSelf) throw new NotFoundException('Profile not found');

    const person = await this.prisma.person.findUnique({
      where: { id },
      include: {
        skills: {
          include: {
            skill: true,
            history: { orderBy: { createdAt: 'asc' } },
          },
        },
        events:       { orderBy: { eventDate: 'desc' } },
        salaryHistory: isAdmin ? { orderBy: { effectiveDate: 'asc' } } : false,
        user: { select: { email: true, role: true, active: true } },
      },
    });
    if (!person) throw new NotFoundException(`Person ${id} not found`);

    // Projects via capacity (distinct)
    const capacityRows = await this.prisma.capacity.findMany({
      where: { personId: id },
      include: { project: { select: { id: true, name: true, status: true, deadline: true, company: true } } },
      orderBy: { weekStart: 'desc' },
    });
    const seenProjects = new Set<string>();
    const projects = capacityRows
      .filter(r => { if (seenProjects.has(r.projectId)) return false; seenProjects.add(r.projectId); return true; })
      .map(r => r.project);

    // Computed badges — same list as the journey page (src/common/badges.ts).
    const [dealCount, committeeCount, ledProjects] = await Promise.all([
      this.prisma.lead.count({ where: { closedById: id, status: { in: ['WON', 'COMPLETED'] } } }),
      this.prisma.committeeMember.count({ where: { personId: id } }),
      // Projects they ran as Producer / PM count too (same as the journey page).
      this.prisma.project.findMany({
        where:  { OR: [{ producerId: id }, { pmId: id }], status: { not: 'CANCELLED' } },
        select: { id: true },
      }),
    ]);
    const badgeProjectIds = new Set([
      ...projects.filter(p => p.status !== 'CANCELLED').map(p => p.id),
      ...ledProjects.map(p => p.id),
    ]);
    const badges = computeBadges({
      startDate:      person.startDate,
      skillRatings:   person.skills.map(s => s.rating),
      projectCount:   badgeProjectIds.size,
      dealCount,
      committeeCount,
      awardCount:     person.events.filter(e => e.type === 'ACHIEVEMENT').length,
    });

    // Stats
    const skillRatings = person.skills.map(s => s.rating);
    const avgRating = skillRatings.length
      ? Math.round((skillRatings.reduce((a, b) => a + b, 0) / skillRatings.length) * 10) / 10
      : null;
    const topSkill = person.skills.sort((a, b) => b.rating - a.rating)[0]?.skill.name ?? null;
    const tenureDays = Math.floor((Date.now() - new Date(person.startDate).getTime()) / 86_400_000);

    return {
      person,
      projects,
      badges,
      stats: { tenureDays, projectCount: projects.length, avgRating, topSkill },
    };
  }

  // Add a manual event to the person's timeline (admin only).
  async addEvent(personId: string, dto: CreatePersonEventDto) {
    await this.findOne(personId);
    return this.prisma.personEvent.create({
      data: {
        personId,
        type: dto.type,
        title: dto.title,
        note: dto.note ?? null,
        // A cash value only makes sense on an award/reward — ignore it on other types.
        rewardValue: dto.type === 'ACHIEVEMENT' ? (dto.rewardValue ?? null) : null,
        eventDate: dto.eventDate ? new Date(dto.eventDate) : new Date(),
      },
    });
  }

  // Delete a timeline event (admin only).
  async removeEvent(eventId: string) {
    return this.prisma.personEvent.delete({ where: { id: eventId } });
  }
}
