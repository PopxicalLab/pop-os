import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateProjectDto, UpdateProjectDto } from './project.dto';
import { companyWhere } from '../common/company-filter';
import { JOB_MONEY, withJobMoney, autoJobId, isAutoJob, ensureJobForProject } from '../common/job';

// Fields we always include when returning a project — producer and PM names,
// plus the job's money fields (value/margin/tier now live on the job, not the
// project — see src/common/job.ts). Results go through withJobMoney().
const WITH_PEOPLE = {
  producer: { select: { id: true, name: true, role: true } },
  pm:       { select: { id: true, name: true, role: true } },
  account:  { select: { id: true, name: true, industry: true } },
  ...JOB_MONEY,
} as const;

// Money fields the project form still sends. They're saved on the job.
const MONEY_FIELDS = ['estimatedValue', 'marginTarget', 'clientTier'] as const;

@Injectable()
export class ProjectsService {
  constructor(private prisma: PrismaService) {}

  async findAll(personId?: string, company?: string | null) {
    const co = companyWhere(company);
    // STAFF only see projects where they have a capacity allocation.
    const staffFilter = personId
      ? { capacityEntries: { some: { personId } } }
      : undefined;
    const where = { ...(co ?? {}), ...(staffFilter ?? {}) };
    const projects = await this.prisma.project.findMany({
      where: Object.keys(where).length ? where : undefined,
      orderBy: { createdAt: 'desc' },
      include: WITH_PEOPLE,
    });
    return projects.map(withJobMoney);
  }

  async findOne(id: string) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: WITH_PEOPLE,
    });
    if (!project) throw new NotFoundException(`Project ${id} not found`);
    return withJobMoney(project);
  }

  // A project made on the Projects tab has no sale behind it, so it gets an
  // auto job to hold its money. (Won leads get their project via
  // LeadsService.convertToProject instead — there the lead is the job.)
  async create(dto: CreateProjectDto) {
    const project = await this.prisma.$transaction(async (tx) => {
      const p = await tx.project.create({
        data: {
          name:        dto.name,
          client:      dto.client,
          company:     dto.company,
          quadrant:    dto.quadrant,
          priority:    dto.priority    ?? 'P2',
          status:      dto.status      ?? 'BRIEF',
          startDate:   dto.startDate   ? new Date(dto.startDate) : undefined,
          deadline:    dto.deadline    ? new Date(dto.deadline) : undefined,
          timelineUrl: dto.timelineUrl ?? null,
          producerId:  dto.producerId  ?? null,
          pmId:        dto.pmId        ?? null,
          drainApprovedByExec:     dto.drainApprovedByExec     ?? false,
          drainApprovedByProducer: dto.drainApprovedByProducer ?? false,
          estimatedDuration: dto.estimatedDuration ?? null,
          complexityScore:   dto.complexityScore   ?? null,
        },
      });
      await tx.lead.create({
        data: {
          id:             autoJobId(p.id),
          name:           p.name,
          accountId:      p.accountId,
          company:        p.company,
          status:         'WON',   // no closer / wonAt → never counted in commission
          notes:          'Auto-created for a project with no sale logged behind it.',
          projectId:      p.id,
          estimatedValue: dto.estimatedValue ?? null,
          marginTarget:   dto.marginTarget   ?? null,
          clientTier:     dto.clientTier     ?? null,
        },
      });
      return p;
    });
    return this.findOne(project.id);
  }

  async update(id: string, dto: UpdateProjectDto) {
    await this.findOne(id);

    // Split the form data: money fields go to the job, the rest to the project.
    const { estimatedValue, marginTarget, clientTier, ...projectFields } = dto;
    const money = { estimatedValue, marginTarget, clientTier };
    const hasMoney = MONEY_FIELDS.some(f => money[f] !== undefined);

    await this.prisma.$transaction(async (tx) => {
      await tx.project.update({
        where: { id },
        data: {
          ...projectFields,
          startDate: dto.startDate !== undefined
            ? (dto.startDate ? new Date(dto.startDate) : null)
            : undefined,
          deadline: dto.deadline !== undefined
            ? (dto.deadline ? new Date(dto.deadline) : null)
            : undefined,
        },
      });
      if (hasMoney) {
        const jobId = await ensureJobForProject(tx, id);
        await tx.lead.update({ where: { id: jobId }, data: money });
      }
    });
    return this.findOne(id);
  }

  // Deleting a project also deletes its auto job (it only existed to hold
  // this project's money). A real sales lead is kept — it's sales history —
  // and just loses its project link.
  async remove(id: string) {
    const project = await this.findOne(id);
    return this.prisma.$transaction(async (tx) => {
      if (project.jobId && isAutoJob(project.jobId)) {
        await tx.lead.delete({ where: { id: project.jobId } });
      }
      return tx.project.delete({ where: { id } });
    });
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
        where: { skillId: ps.skillId, person: { status: 'ACTIVE', showInCapacityReports: true } },
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
