import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateProjectDto, UpdateProjectDto } from './project.dto';
import { companyWhere } from '../common/company-filter';

// Fields we always include when returning a project — producer and PM names.
const WITH_PEOPLE = {
  producer: { select: { id: true, name: true, role: true } },
  pm:       { select: { id: true, name: true, role: true } },
  account:  { select: { id: true, name: true, industry: true } },
} as const;

@Injectable()
export class ProjectsService {
  constructor(private prisma: PrismaService) {}

  findAll(personId?: string, company?: string | null) {
    const co = companyWhere(company);
    // STAFF only see projects where they have a capacity allocation or an assigned asset.
    const staffFilter = personId
      ? { OR: [
          { capacityEntries: { some: { personId } } },
          { assets:          { some: { assignedToId: personId } } },
        ] }
      : undefined;
    const where = { ...(co ?? {}), ...(staffFilter ?? {}) };
    return this.prisma.project.findMany({
      where: Object.keys(where).length ? where : undefined,
      orderBy: { createdAt: 'desc' },
      include: WITH_PEOPLE,
    });
  }

  async findOne(id: string) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: WITH_PEOPLE,
    });
    if (!project) throw new NotFoundException(`Project ${id} not found`);
    return project;
  }

  create(dto: CreateProjectDto) {
    return this.prisma.project.create({
      data: {
        name:        dto.name,
        client:      dto.client,
        quadrant:    dto.quadrant,
        priority:    dto.priority    ?? 'P2',
        status:      dto.status      ?? 'BRIEF',
        startDate:   dto.startDate   ? new Date(dto.startDate) : undefined,
        deadline:    dto.deadline    ? new Date(dto.deadline) : undefined,
        producerId:  dto.producerId  ?? null,
        pmId:        dto.pmId        ?? null,
        drainApprovedByExec:     dto.drainApprovedByExec     ?? false,
        drainApprovedByProducer: dto.drainApprovedByProducer ?? false,
        estimatedValue:    dto.estimatedValue    ?? null,
        estimatedDuration: dto.estimatedDuration ?? null,
        complexityScore:   dto.complexityScore   ?? null,
        clientTier:        dto.clientTier        ?? null,
        marginTarget:      dto.marginTarget      ?? null,
      },
      include: WITH_PEOPLE,
    });
  }

  async update(id: string, dto: UpdateProjectDto) {
    await this.findOne(id);

    if (dto.status === 'DELIVERED') {
      const blocking = await this.prisma.asset.findMany({
        where: { projectId: id, stage: { not: 'FINAL_DELIVERY' } },
        select: { name: true },
      });
      if (blocking.length) {
        const names = blocking.map(a => a.name).join(', ');
        throw new BadRequestException(
          `Cannot deliver project — ${blocking.length} asset(s) not at Final Delivery: ${names}`,
        );
      }
    }

    return this.prisma.project.update({
      where: { id },
      data: {
        ...dto,
        startDate: dto.startDate !== undefined
          ? (dto.startDate ? new Date(dto.startDate) : null)
          : undefined,
        deadline: dto.deadline !== undefined
          ? (dto.deadline ? new Date(dto.deadline) : null)
          : undefined,
      },
      include: WITH_PEOPLE,
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.project.delete({ where: { id } });
  }

  // ── Required skills ───────────────────────────────────────────

  getAllSkills() {
    return this.prisma.skill.findMany({ orderBy: { name: 'asc' } });
  }

  async getProjectSkills(id: string) {
    await this.findOne(id);
    return this.prisma.projectSkill.findMany({
      where: { projectId: id },
      include: { skill: true },
      orderBy: { skill: { name: 'asc' } },
    });
  }

  async addProjectSkill(id: string, skillId: string) {
    await this.findOne(id);
    const skill = await this.prisma.skill.findUnique({ where: { id: skillId } });
    if (!skill) throw new NotFoundException(`Skill ${skillId} not found`);
    return this.prisma.projectSkill.upsert({
      where:  { projectId_skillId: { projectId: id, skillId } },
      create: { projectId: id, skillId },
      update: {},
      include: { skill: true },
    });
  }

  async removeProjectSkill(id: string, skillId: string) {
    await this.findOne(id);
    return this.prisma.projectSkill.deleteMany({ where: { projectId: id, skillId } });
  }

  // ── Staffing suggestion engine ────────────────────────────────
  // For each skill tagged on the project, ranks active staff by:
  //   60% skill rating (1–5 normalised)
  //   40% free capacity during the project window
  async getStaffSuggestions(id: string) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: { requiredSkills: { include: { skill: true } } },
    });
    if (!project) throw new NotFoundException(`Project ${id} not found`);
    if (!project.requiredSkills.length) return [];

    const windowStart = project.startDate ?? new Date();
    const windowEnd   = project.deadline  ?? new Date(windowStart.getTime() + 4 * 7 * 86_400_000);
    const weekCount   = Math.max(1, Math.round((windowEnd.getTime() - windowStart.getTime()) / (7 * 86_400_000)));

    const results: {
      skill: { id: string; name: string };
      candidates: {
        person: { id: string; name: string; role: string; department: string };
        skillRating: number;
        freeCapacityPct: number;
        score: number;
      }[];
    }[] = [];

    for (const ps of project.requiredSkills) {
      const matches = await this.prisma.personSkill.findMany({
        where: { skillId: ps.skillId, person: { status: 'ACTIVE' } },
        include: { person: { select: { id: true, name: true, role: true, department: true } } },
      });

      const candidates: { person: { id: string; name: string; role: string; department: string }; skillRating: number; freeCapacityPct: number; score: number }[] = [];
      for (const m of matches) {
        const caps = await this.prisma.capacity.findMany({
          where: { personId: m.personId, weekStart: { gte: windowStart, lte: windowEnd } },
        });

        // Sum allocations per week, then average across all project weeks.
        const weekTotals: Record<string, number> = {};
        for (const c of caps) {
          const key = c.weekStart.toISOString();
          weekTotals[key] = (weekTotals[key] ?? 0) + c.pctWeek;
        }
        const totalAllocated = Object.values(weekTotals).reduce((s, v) => s + v, 0);
        const avgAllocated   = totalAllocated / weekCount;
        const freeCapacityPct = Math.max(0, Math.round(100 - avgAllocated));

        const score = Math.round((m.rating / 5) * 60 + (freeCapacityPct / 100) * 40);

        candidates.push({ person: m.person, skillRating: m.rating, freeCapacityPct, score });
      }

      candidates.sort((a, b) => b.score - a.score);
      results.push({ skill: ps.skill, candidates: candidates.slice(0, 5) });
    }

    return results;
  }
}
