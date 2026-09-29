import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { canSeeMoney, stripJobColumns } from '../common/roles';

// How many days ahead to include in payment alerts for PM and Finance.
const PAYMENT_ALERT_DAYS = 14;

function thisMonday(): Date {
  const now = new Date();
  const day = now.getUTCDay(); // 0 = Sun
  const diff = day === 0 ? -6 : 1 - day;
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + diff));
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 86_400_000);
}

@Injectable()
export class MeService {
  constructor(private prisma: PrismaService) {}

  async getDashboard(userId: string) {
    const user = await this.prisma.user.findUnique({
      where:   { id: userId },
      include: { person: { select: { id: true, name: true } } },
    });

    const personId = user?.person?.id ?? null;
    const role     = user?.role ?? 'PRODUCER';
    const monday   = thisMonday();
    const nextWeek = addDays(monday, 7);
    const twoWeeks = addDays(monday, 14);

    // ── capacity: this week + next week ──────────────────────────
    const myCapacity = personId
      ? await this.prisma.capacity.findMany({
          where:   { personId, weekStart: { gte: monday, lt: twoWeeks } },
          include: { project: { select: { id: true, name: true, status: true, priority: true, deadline: true, company: true } } },
          orderBy: [{ weekStart: 'asc' }, { pctWeek: 'desc' }],
        })
      : [];

    // ── my projects (PM / PRODUCER / TEAM_LEAD / ADMIN) ─────────────
    let myProjects: any[] = [];
    if (personId && ['PM', 'PRODUCER', 'TEAM_LEAD', 'ADMIN'].includes(role)) {
      const projectFilter =
        role === 'PM'        ? { pmId:       personId } :
        role === 'PRODUCER'  ? { producerId: personId } :
        role === 'TEAM_LEAD' ? { capacityEntries: { some: { personId } } } :
        {};                                               // ADMIN: no scope filter
      const rows = await this.prisma.project.findMany({
        where:   { ...projectFilter, status: { notIn: ['DELIVERED', 'CANCELLED'] } },
        include: {
          producer: { select: { id: true, name: true } },
          pm:       { select: { id: true, name: true } },
          // Who's on this project this week
          capacityEntries: {
            where:   { weekStart: { gte: monday, lt: nextWeek } },
            include: { person: { select: { id: true, name: true } } },
            orderBy: { pctWeek: 'desc' },
          },
          // Open invoices are money — only for job roles (TEAM_LEAD gets none).
          ...(canSeeMoney(role) ? {
            accountingDocuments: {
              where:   { status: 'ACTIVE' as const },
              select:  { id: true, docNo: true, docType: true, amount: true, dueDate: true, debtorName: true },
              orderBy: { dueDate: 'asc' as const },
            },
          } : {}),
        },
        orderBy: [{ priority: 'asc' }, { deadline: 'asc' }],
      });
      // Drop the stale money / PPM columns still on the Project table.
      myProjects = rows.map(stripJobColumns);
    }

    // ── active leads (SALES) ──────────────────────────────────────
    const activeLeads = ['SALES', 'ADMIN'].includes(role)
      ? await this.prisma.lead.findMany({
          where:   { status: { notIn: ['WON', 'COMPLETED', 'LOST'] } },
          include: { account: { select: { id: true, name: true } } },
          orderBy: [{ priority: 'asc' }, { updatedAt: 'desc' }],
          take: 15,
        })
      : [];

    // ── payment alerts (FINANCE / ADMIN / PM scoped) ──────────────
    let paymentAlerts: any[] = [];
    const alertCutoff = addDays(new Date(), PAYMENT_ALERT_DAYS);
    if (['FINANCE', 'ADMIN'].includes(role)) {
      paymentAlerts = await this.prisma.accountingDocument.findMany({
        where: {
          status:  'ACTIVE',
          dueDate: { lte: alertCutoff },
          docType: { in: ['QUOTATION', 'SALES_INVOICE'] },
        },
        include: {
          project: { select: { id: true, name: true, producer: { select: { name: true } } } },
        },
        orderBy: { dueDate: 'asc' },
      });
    } else if (['PM', 'PRODUCER'].includes(role) && personId) {
      // PM: docs on their assigned projects; PRODUCER: docs on their produced projects
      const projectWhere = role === 'PM'
        ? { pmId: personId }
        : { producerId: personId };
      paymentAlerts = await this.prisma.accountingDocument.findMany({
        where: {
          status:  'ACTIVE',
          dueDate: { lte: alertCutoff },
          project: projectWhere,
        },
        include: {
          project: { select: { id: true, name: true } },
        },
        orderBy: { dueDate: 'asc' },
      });
    }

    return {
      profile: {
        name:          user?.name,
        role,
        personId,
        hasPersonLink: !!personId,
        personName:    user?.person?.name ?? null,
      },
      myCapacity,
      myProjects,
      activeLeads,
      paymentAlerts,
    };
  }
}
