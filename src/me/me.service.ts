import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

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

    // ── assets assigned to me (anything not final) ───────────────
    const assignedAssets = personId
      ? await this.prisma.asset.findMany({
          where:   { assignedToId: personId, stage: { not: 'FINAL_DELIVERY' } },
          include: { project: { select: { id: true, name: true, status: true } } },
          orderBy: { updatedAt: 'desc' },
        })
      : [];

    // ── my projects (PM or PRODUCER) ─────────────────────────────
    let myProjects: any[] = [];
    if (personId && ['PM', 'PRODUCER', 'ADMIN'].includes(role)) {
      const projectFilter =
        role === 'PM'       ? { pmId:       personId } :
        role === 'PRODUCER' ? { producerId: personId } :
        {};                                               // ADMIN: no scope filter
      myProjects = await this.prisma.project.findMany({
        where:   { ...projectFilter, status: { notIn: ['DELIVERED', 'CANCELLED'] } },
        include: {
          producer: { select: { id: true, name: true } },
          pm:       { select: { id: true, name: true } },
          assets: {
            where:  { stage: { in: ['INTERNAL_REVIEW', 'REVISION'] } },
            select: { id: true, name: true, stage: true, cdSignedOff: true },
          },
          // Who's on this project this week
          capacityEntries: {
            where:   { weekStart: { gte: monday, lt: nextWeek } },
            include: { person: { select: { id: true, name: true } } },
            orderBy: { pctWeek: 'desc' },
          },
          accountingDocuments: {
            where:   { status: 'ACTIVE' },
            select:  { id: true, docNo: true, docType: true, amount: true, dueDate: true, debtorName: true },
            orderBy: { dueDate: 'asc' },
          },
        },
        orderBy: [{ priority: 'asc' }, { deadline: 'asc' }],
      });
    }

    // ── sign-off queue (INTERNAL_REVIEW + not signed off) ────────
    let signOffQueue: any[] = [];
    if (['TEAM_LEAD', 'PRODUCER', 'ADMIN', 'PM'].includes(role)) {
      const whereClause: any = { stage: 'INTERNAL_REVIEW', cdSignedOff: false };
      // PM and PRODUCER see only their own projects' queues
      if (role === 'PM'       && personId) whereClause.project = { pmId:       personId };
      if (role === 'PRODUCER' && personId) whereClause.project = { producerId: personId };
      signOffQueue = await this.prisma.asset.findMany({
        where:   whereClause,
        include: {
          project:    { select: { id: true, name: true, priority: true } },
          assignedTo: { select: { id: true, name: true } },
        },
        orderBy: { updatedAt: 'asc' },
      });
    }

    // ── active leads (SALES) ──────────────────────────────────────
    const activeLeads = ['SALES', 'ADMIN'].includes(role)
      ? await this.prisma.lead.findMany({
          where:   { status: { notIn: ['WON', 'LOST'] } },
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
    } else if (role === 'PM' && personId) {
      // PM only sees docs tied to her projects
      paymentAlerts = await this.prisma.accountingDocument.findMany({
        where: {
          status:  'ACTIVE',
          dueDate: { lte: alertCutoff },
          project: { pmId: personId },
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
      assignedAssets,
      myProjects,
      signOffQueue,
      activeLeads,
      paymentAlerts,
    };
  }

  // Quick sign-off from the My Work tab — same as the Assets tab checkbox.
  async signOff(assetId: string) {
    return this.prisma.asset.update({
      where: { id: assetId },
      data:  { cdSignedOff: true },
      select: { id: true, cdSignedOff: true },
    });
  }
}
