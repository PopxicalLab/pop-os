import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

// Studio cost assumptions — adjust as the business evolves.
const OVERHEAD_MULTIPLIER  = 1.20; // salary + 20% employer overhead
const WORKING_DAYS_PER_YEAR = 260; // 52 weeks × 5 days
const WORKING_DAYS_PER_WEEK =   5;

// Amber when cost has consumed >60% of estimated value; red when >85%.
const AMBER_THRESHOLD = 0.60;
const RED_THRESHOLD   = 0.85;

function dailyRate(salary: number): number {
  return (salary * OVERHEAD_MULTIPLIER) / WORKING_DAYS_PER_YEAR;
}

function manDaysFromPct(pctWeek: number): number {
  return (pctWeek / 100) * WORKING_DAYS_PER_WEEK;
}

function healthStatus(costToDate: number, estimatedValue: number | null) {
  if (!estimatedValue) return 'unknown';
  const ratio = costToDate / estimatedValue;
  if (ratio >= RED_THRESHOLD)   return 'red';
  if (ratio >= AMBER_THRESHOLD) return 'amber';
  return 'green';
}

@Injectable()
export class FinancialService {
  constructor(private prisma: PrismaService) {}

  // Cost breakdown per active project: man-days, cost to date, margin.
  async getProjectCosts() {
    const [projects, allAllocations] = await Promise.all([
      this.prisma.project.findMany({
        where:   { status: { notIn: ['DELIVERED', 'CANCELLED'] } },
        include: {
          producer: { select: { id: true, name: true } },
          pm:       { select: { id: true, name: true } },
        },
        orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
      }),
      // Fetch all capacity entries with person salary in one query.
      this.prisma.capacity.findMany({
        include: {
          person: { select: { id: true, name: true, salary: true } },
        },
      }),
    ]);

    // Group allocations by project for fast lookup.
    const byProject: Record<string, typeof allAllocations> = {};
    for (const a of allAllocations) {
      if (!byProject[a.projectId]) byProject[a.projectId] = [];
      byProject[a.projectId].push(a);
    }

    return projects.map(p => {
      const entries   = byProject[p.id] ?? [];
      let totalManDays = 0;
      let totalCost    = 0;

      for (const entry of entries) {
        const salary = entry.person.salary;
        const md     = manDaysFromPct(entry.pctWeek);
        totalManDays += md;
        if (salary) totalCost += md * dailyRate(salary);
      }

      const estimatedValue = p.estimatedValue ?? null;
      const grossMargin    = estimatedValue
        ? ((estimatedValue - totalCost) / estimatedValue) * 100
        : null;

      return {
        project:       p,
        totalManDays:  Math.round(totalManDays * 10) / 10,
        costToDate:    Math.round(totalCost),
        estimatedValue,
        grossMargin:   grossMargin != null ? Math.round(grossMargin * 10) / 10 : null,
        targetMargin:  p.marginTarget ?? null,
        health:        healthStatus(totalCost, estimatedValue),
        weeksTracked:  new Set(entries.map(e => e.weekStart.toISOString())).size,
        missingSalary: entries.some(e => !e.person.salary),
      };
    });
  }

  // Studio-wide summary: total capacity cost this week, total active project value.
  async getOverview() {
    const now       = new Date();
    const day       = now.getUTCDay();
    const diff      = day === 0 ? -6 : 1 - day;
    const weekStart = new Date(now);
    weekStart.setUTCDate(now.getUTCDate() + diff);
    weekStart.setUTCHours(0, 0, 0, 0);

    const [thisWeek, allProjects] = await Promise.all([
      this.prisma.capacity.findMany({
        where:   { weekStart },
        include: { person: { select: { salary: true } } },
      }),
      this.prisma.project.findMany({
        where:  { status: { notIn: ['DELIVERED', 'CANCELLED'] } },
        select: { estimatedValue: true, marginTarget: true },
      }),
    ]);

    const weekCost = thisWeek.reduce((sum, a) => {
      if (!a.person.salary) return sum;
      return sum + manDaysFromPct(a.pctWeek) * dailyRate(a.person.salary);
    }, 0);

    const totalPipelineValue = allProjects.reduce(
      (sum, p) => sum + (p.estimatedValue ?? 0), 0,
    );

    const avgTargetMargin = allProjects.filter(p => p.marginTarget != null).length
      ? allProjects.reduce((s, p) => s + (p.marginTarget ?? 0), 0) /
        allProjects.filter(p => p.marginTarget != null).length
      : null;

    return {
      weekStart,
      weekCost:          Math.round(weekCost),
      totalPipelineValue: Math.round(totalPipelineValue),
      avgTargetMargin:   avgTargetMargin != null ? Math.round(avgTargetMargin * 10) / 10 : null,
      activeProjects:    allProjects.length,
    };
  }
}
