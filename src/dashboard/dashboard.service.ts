import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

// Reuse the same Monday-normalisation logic as the capacity service.
function toMonday(d: Date): Date {
  const day  = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  const mon  = new Date(d);
  mon.setUTCDate(d.getUTCDate() + diff);
  mon.setUTCHours(0, 0, 0, 0);
  return mon;
}

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getSummary() {
    const now       = new Date();
    const weekStart = toMonday(now);

    // Payment alert window: show docs already overdue and those due within 10 days.
    const alertCutoff = new Date(now);
    alertCutoff.setDate(alertCutoff.getDate() + 10);

    // Fetch all base data in parallel — one round-trip to the DB.
    const [allPeople, activeProjects, thisWeekAllocations, paymentAlerts] = await Promise.all([
      this.prisma.person.findMany({
        select: { id: true, name: true, role: true, company: true, warmPool: true },
        orderBy: { name: 'asc' },
      }),
      // "Active" = anything not yet finished or cancelled.
      this.prisma.project.findMany({
        where:   { status: { notIn: ['DELIVERED', 'CANCELLED'] } },
        include: {
          producer: { select: { id: true, name: true } },
          pm:       { select: { id: true, name: true } },
        },
        orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
      }),
      this.prisma.capacity.findMany({
        where:   { weekStart },
        include: {
          person:  { select: { id: true, name: true, role: true, company: true } },
          project: { select: { id: true, name: true, quadrant: true, priority: true, company: true } },
        },
        orderBy: [{ person: { name: 'asc' } }, { pctWeek: 'desc' }],
      }),
      // Accounting documents due within 10 days (or already overdue but unpaid).
      this.prisma.accountingDocument.findMany({
        where: {
          status:  'ACTIVE',
          dueDate: { not: null, lte: alertCutoff },
        },
        include: {
          project: {
            select: {
              id: true, name: true,
              producer: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { dueDate: 'asc' },
      }),
    ]);

    // Compute derived stats in memory — avoids extra DB round-trips.
    const activePeople     = allPeople.filter(p => !p.warmPool);
    const warmPoolCount    = allPeople.filter(p =>  p.warmPool).length;
    const lpsPeople        = allPeople.filter(p => p.company === 'LPS').length;
    const pxlPeople        = allPeople.filter(p => p.company === 'PXL').length;

    // Overdue = past deadline AND not finished (ON_HOLD projects are flagged too — they may need attention).
    const overdueProjects  = activeProjects.filter(
      p => p.deadline && p.deadline < now,
    );

    // Who has NO allocation at all this week (active staff only).
    const allocatedPersonIds  = new Set(thisWeekAllocations.map(a => a.personId));
    const unallocatedPeople   = activePeople.filter(p => !allocatedPersonIds.has(p.id));

    return {
      stats: {
        totalPeople:       allPeople.length,
        activePeople:      activePeople.length,
        warmPool:          warmPoolCount,
        lpsPeople,
        pxlPeople,
        activeProjects:    activeProjects.length,
        overdueCount:      overdueProjects.length,
        allocatedThisWeek: allocatedPersonIds.size,
        freeThisWeek:      unallocatedPeople.length,
        paymentAlerts:     paymentAlerts.length,
      },
      activeProjects,
      overdueProjects,
      paymentAlerts,
      thisWeek: {
        weekStart,
        allocations:       thisWeekAllocations,
        unallocatedPeople,
      },
    };
  }
}
