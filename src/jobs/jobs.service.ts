import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { companyWhere } from '../common/company-filter';

// ── Jobs ────────────────────────────────────────────────────────────
// A Job is won work: a Lead that is WON / COMPLETED, or has a Project.
// It's the root of the deal — sales (the lead), production (its project)
// and money (value, costs, Autocount docs) — see src/common/job.ts.
// Read-only here: edits still go through /api/leads, /api/projects and
// /api/project-costs, so there's one place to change each thing.

// Open leads (Qualification → Negotiation, Lost with no project) stay on
// the Sales pipeline and aren't jobs yet.
const IS_JOB = { OR: [{ status: { in: ['WON', 'COMPLETED'] as ('WON' | 'COMPLETED')[] } }, { projectId: { not: null } }] };

// Same Monday-00:00-UTC rule as the Capacity board.
function toMonday(d: Date): Date {
  const day  = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  const mon  = new Date(d);
  mon.setUTCDate(d.getUTCDate() + diff);
  mon.setUTCHours(0, 0, 0, 0);
  return mon;
}

const PERSON = { select: { id: true, name: true } } as const;

@Injectable()
export class JobsService {
  constructor(private prisma: PrismaService) {}

  // Jobs list — one row per job with its money rolled up.
  async findAll(company?: string | null) {
    const co = companyWhere(company);
    const jobs = await this.prisma.lead.findMany({
      where:   co ? { AND: [co, IS_JOB] } : IS_JOB,
      orderBy: [{ wonAt: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true, name: true, status: true, company: true,
        estimatedValue: true, marginTarget: true, invoicedPct: true, paidPct: true, wonAt: true,
        quadrant: true, drainApprovedByExec: true, drainApprovedByProducer: true,
        account:  { select: { id: true, name: true } },
        closedBy: PERSON,
        project: {
          select: {
            id: true, name: true, status: true, priority: true, startDate: true, deadline: true,
            producer: PERSON, pm: PERSON,
          },
        },
        costs:               { select: { amount: true } },
        accountingDocuments: { select: { docType: true, amount: true, status: true, dueDate: true } },
      },
    });

    const now = new Date();
    return jobs.map(({ costs, accountingDocuments, ...j }) => {
      const costTotal = costs.reduce((s, c) => s + c.amount, 0);
      // Unpaid invoices = money still to collect for this job.
      const openInvoices = accountingDocuments.filter(d => d.docType === 'SALES_INVOICE' && d.status === 'ACTIVE');
      return {
        ...j,
        costTotal,
        net:         j.estimatedValue != null ? j.estimatedValue - costTotal : null,
        outstanding: openInvoices.reduce((s, d) => s + (d.amount ?? 0), 0),
        overdue:     openInvoices.filter(d => d.dueDate && d.dueDate < now).length,
      };
    });
  }

  // One job, everything on it: sales, production (incl. this week's
  // bookings) and money.
  async findOne(id: string) {
    const monday = toMonday(new Date());
    const job = await this.prisma.lead.findUnique({
      where: { id },
      include: {
        account:  { select: { id: true, name: true, autocountDebtorCode: true } },
        contact:  { select: { id: true, name: true, title: true } },
        closedBy: PERSON,
        costs:    { orderBy: { createdAt: 'asc' } },
        accountingDocuments: { orderBy: { docDate: 'desc' } },
        project: {
          include: {
            producer: PERSON,
            pm:       PERSON,
            capacityEntries: {
              where:   { weekStart: monday },
              select:  { id: true, pctWeek: true, role: true, person: PERSON },
              orderBy: { pctWeek: 'desc' },
            },
          },
        },
      },
    });
    if (!job) throw new NotFoundException(`Job ${id} not found`);
    return job;
  }
}
