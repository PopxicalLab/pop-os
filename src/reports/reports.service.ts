import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

function csvRow(cells: (string | number | null | undefined)[]): string {
  return cells.map(c => {
    const s = c == null ? '' : String(c);
    // Wrap in quotes if the value contains commas, quotes, or newlines
    return /[,"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(',');
}

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  async projectsCsv(): Promise<string> {
    const rows = await this.prisma.project.findMany({
      include: {
        producer: { select: { name: true } },
        pm:       { select: { name: true } },
        account:  { select: { name: true } },
      },
      orderBy: [{ priority: 'asc' }, { deadline: 'asc' }],
    });

    const header = csvRow(['Name','Client','Account','Status','Priority','Quadrant',
      'Producer','PM','Start Date','Deadline','Est. Value (RM)','Est. Duration (wk)',
      'Complexity','Margin Target (%)','Company']);

    const lines = rows.map(p => csvRow([
      p.name,
      p.client,
      p.account?.name,
      p.status,
      p.priority,
      p.quadrant,
      p.producer?.name,
      p.pm?.name,
      p.startDate  ? new Date(p.startDate).toISOString().slice(0,10)  : '',
      p.deadline   ? new Date(p.deadline).toISOString().slice(0,10)   : '',
      p.estimatedValue,
      p.estimatedDuration,
      p.complexityScore,
      p.marginTarget,
      p.company,
    ]));

    return [header, ...lines].join('\r\n');
  }

  async capacityCsv(): Promise<string> {
    const rows = await this.prisma.capacity.findMany({
      include: {
        person:  { select: { name: true, department: true } },
        project: { select: { name: true } },
      },
      orderBy: [{ weekStart: 'desc' }, { person: { name: 'asc' } }],
    });

    const header = csvRow(['Week Start','Person','Department','Project','Role','% Week']);
    const lines = rows.map(c => csvRow([
      new Date(c.weekStart).toISOString().slice(0,10),
      c.person.name,
      c.person.department,
      c.project.name,
      c.role,
      c.pctWeek,
    ]));

    return [header, ...lines].join('\r\n');
  }

  async arCsv(): Promise<string> {
    const rows = await this.prisma.accountingDocument.findMany({
      include: { project: { select: { name: true } } },
      orderBy: [{ dueDate: 'asc' }],
    });

    const header = csvRow(['Doc No','Type','Project','Client','Amount (RM)',
      'Doc Date','Due Date','Credit Term','Status']);

    const lines = rows.map(d => csvRow([
      d.docNo,
      d.docType,
      d.project?.name,
      d.debtorName,
      d.amount,
      d.docDate  ? new Date(d.docDate).toISOString().slice(0,10)  : '',
      d.dueDate  ? new Date(d.dueDate).toISOString().slice(0,10)  : '',
      d.creditTerm,
      d.status,
    ]));

    return [header, ...lines].join('\r\n');
  }
}
