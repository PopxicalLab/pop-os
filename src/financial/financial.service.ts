import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

// Studio cost assumptions — adjust as the business evolves.
const OVERHEAD_MULTIPLIER   = 1.20; // salary + 20% employer overhead
const MONTHS_PER_YEAR       =  12;
const WORKING_DAYS_PER_YEAR = 260; // 52 weeks × 5 days
const WORKING_DAYS_PER_WEEK =   5;

// Amber when cost has consumed >60% of estimated value; red when >85%.
const AMBER_THRESHOLD = 0.60;
const RED_THRESHOLD   = 0.85;

// salary is stored as monthly; multiply by 12 to get annual before dividing by working days.
function dailyRate(monthlySalary: number): number {
  return (monthlySalary * MONTHS_PER_YEAR * OVERHEAD_MULTIPLIER) / WORKING_DAYS_PER_YEAR;
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

  // ── Finance Dashboard ────────────────────────────────────────────
  // One call that returns everything a finance boss needs at a glance:
  // AR position, overdue invoices, due-soon alerts, pipeline, project health.
  async getFinanceDashboard() {
    const now         = new Date();
    const alertCutoff = new Date(now);
    alertCutoff.setDate(alertCutoff.getDate() + 10);

    const [allDocs, leads, projectCosts] = await Promise.all([
      this.prisma.accountingDocument.findMany({
        include: {
          project: {
            select: {
              id: true, name: true,
              producer: { select: { id: true, name: true } },
            },
          },
          lead: { select: { id: true, name: true } },
        },
        orderBy: { dueDate: 'asc' },
      }),
      // All leads except LOST — we want the full pipeline view.
      this.prisma.lead.findMany({
        where:  { status: { not: 'LOST' } },
        select: { estimatedValue: true, status: true },
      }),
      this.getProjectCosts(),
    ]);

    const invoices        = allDocs.filter(d => d.docType === 'SALES_INVOICE');
    const activeInvoices  = invoices.filter(d => d.status === 'ACTIVE');
    const paidInvoices    = invoices.filter(d => d.status === 'PAID');
    const overdueInvoices = activeInvoices.filter(d => d.dueDate && d.dueDate < now);
    const dueSoonInvoices = activeInvoices.filter(d => d.dueDate && d.dueDate >= now && d.dueDate <= alertCutoff);

    const sum = (arr: typeof invoices) => arr.reduce((s, d) => s + (d.amount ?? 0), 0);

    // Pipeline value bucketed by lead status.
    const pipelineByStage: Record<string, number> = {};
    for (const l of leads) {
      pipelineByStage[l.status] = (pipelineByStage[l.status] ?? 0) + (l.estimatedValue ?? 0);
    }

    // Project health counts for the RAG summary tile.
    const health = { green: 0, amber: 0, red: 0, unknown: 0 };
    for (const p of projectCosts) {
      health[p.health as keyof typeof health] = (health[p.health as keyof typeof health] ?? 0) + 1;
    }

    // Recent documents (last 10 pushed to Autocount).
    const recentDocs = allDocs
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 10);

    return {
      ar: {
        totalInvoiced: sum(invoices),
        totalPaid:     sum(paidInvoices),
        outstanding:   sum(activeInvoices),
        overdueAmount: sum(overdueInvoices),
      },
      overdueInvoices,
      dueSoonInvoices,
      pipelineByStage,
      health,
      recentDocs,
      // Pass active quotation count so the boss can see proposals in flight.
      activeQuotations: allDocs.filter(d => d.docType === 'QUOTATION' && d.status === 'ACTIVE').length,
    };
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
