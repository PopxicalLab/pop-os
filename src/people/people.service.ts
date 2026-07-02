// The SERVICE holds the logic: it talks to the database via Prisma.
// (The controller, next file, handles the web requests and calls these.)
import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma.service';
import { CreatePersonDto, UpdatePersonDto, CreateOnboardDto } from './person.dto';
import { CreatePersonEventDto } from './person-profile.dto';
import { companyWhere } from '../common/company-filter';
import { NotificationsService } from '../notifications/notifications.service';

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
        skills: { include: { skill: true } },
        user:   { select: { id: true, email: true, role: true, active: true } },
      },
    });
  }

  // Get one person by id, or throw a clean 404 if not found.
  async findOne(id: string) {
    const person = await this.prisma.person.findUnique({
      where: { id },
      include: {
        skills: { include: { skill: true } },
        user: { select: { id: true, email: true, role: true, active: true } },
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

    // Assets
    const assets = await this.prisma.asset.findMany({
      where: { assignedToId: id },
      include: { project: { select: { id: true, name: true } } },
      orderBy: { updatedAt: 'desc' },
    });

    // Computed badges
    const badges = computeBadges(person, projects.length, assets.length);

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
      assets,
      badges,
      stats: { tenureDays, projectCount: projects.length, assetCount: assets.length, avgRating, topSkill },
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
        eventDate: dto.eventDate ? new Date(dto.eventDate) : new Date(),
      },
    });
  }

  // Delete a timeline event (admin only).
  async removeEvent(eventId: string) {
    return this.prisma.personEvent.delete({ where: { id: eventId } });
  }
}

// Compute achievement badges from existing data — no extra DB queries.
function computeBadges(person: any, projectCount: number, assetCount: number) {
  const badges: { id: string; label: string; icon: string; earned: boolean }[] = [];
  const tenureDays = Math.floor((Date.now() - new Date(person.startDate).getTime()) / 86_400_000);

  const add = (id: string, label: string, icon: string, earned: boolean) =>
    badges.push({ id, label, icon, earned });

  // Tenure
  add('tenure-90',   '3 Months',   '🌱', tenureDays >= 90);
  add('tenure-180',  '6 Months',   '🌿', tenureDays >= 180);
  add('tenure-365',  '1 Year',     '⭐', tenureDays >= 365);
  add('tenure-1095', '3 Years',    '🏅', tenureDays >= 1095);
  add('tenure-1825', '5 Years',    '🏆', tenureDays >= 1825);

  // Skills
  const skillCount = person.skills.length;
  const maxRating  = Math.max(0, ...person.skills.map((s: any) => s.rating));
  add('skill-first',  'First Skill',    '🎯', skillCount >= 1);
  add('skill-five',   '5 Skills',       '🧠', skillCount >= 5);
  add('skill-ten',    '10 Skills',      '💡', skillCount >= 10);
  add('skill-master', 'Skill Master',   '⚡', maxRating === 5);

  // Projects
  add('proj-first', 'First Project',  '🚀', projectCount >= 1);
  add('proj-five',  '5 Projects',     '📦', projectCount >= 5);
  add('proj-ten',   '10 Projects',    '🎬', projectCount >= 10);

  // Assets
  add('asset-first',  'First Asset',   '🎨', assetCount >= 1);
  add('asset-twenty', '20 Assets',     '🖼️',  assetCount >= 20);

  // Special
  add('sign-off', 'Sign-off Authority', '✅', person.canSignOff);

  return badges;
}
