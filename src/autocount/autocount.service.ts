// Autocount Cloud accounting integration.
// All HTTP calls live here. Documents created in Autocount are also
// persisted as AccountingDocument rows so they stay visible in Pop OS
// on the project detail view and in the Dashboard payment alerts.
import { Injectable, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class AutocountService {
  private readonly base     = process.env.AUTOCOUNT_BASE_URL      || 'https://accounting-api.autocountcloud.com';
  private readonly bookId   = process.env.AUTOCOUNT_ACCOUNT_BOOK_ID || '';
  private readonly keyId    = process.env.AUTOCOUNT_KEY_ID         || '';
  private readonly apiKey   = process.env.AUTOCOUNT_API_KEY        || '';
  private readonly location = process.env.AUTOCOUNT_DEFAULT_LOCATION    || 'HQ';
  private readonly credit   = process.env.AUTOCOUNT_DEFAULT_CREDIT_TERM || 'C.O.D.';

  constructor(private prisma: PrismaService) {}

  // ── helpers ──────────────────────────────────────────────────────

  private authHeaders() {
    return { 'Content-Type': 'application/json', 'Key-ID': this.keyId, 'API-Key': this.apiKey };
  }

  private url(path: string) {
    return `${this.base}/${this.bookId}/${path}`;
  }

  // Location header from Autocount looks like: .../quotation?docNo=QT_0626-004
  private extractDocNo(locationHeader: string | null): string | null {
    if (!locationHeader) return null;
    try { return new URL(locationHeader).searchParams.get('docNo'); }
    catch { return null; }
  }

  // Convert "NET 30", "30 DAYS", "C.O.D." etc. to a day count.
  private parseCreditTermDays(term: string): number | null {
    if (!term) return null;
    const u = term.toUpperCase().trim();
    if (u === 'C.O.D.' || u === 'COD') return 0;
    const m = u.match(/(\d+)/);
    return m ? parseInt(m[1]) : null;
  }

  private calcDueDate(docDate: Date, creditTerm: string): Date | null {
    const days = this.parseCreditTermDays(creditTerm);
    if (days === null) return null;
    const due = new Date(docDate);
    due.setDate(due.getDate() + days);
    return due;
  }

  // ── debtors ──────────────────────────────────────────────────────

  async listDebtors() {
    const res = await fetch(
      this.url('debtor/listing?page=1&pageSize=200&activeOnly=true'),
      { headers: this.authHeaders() },
    );
    if (!res.ok) throw new InternalServerErrorException('Failed to fetch debtors from Autocount');
    const body = await res.json() as { data: any[] };
    return (body.data ?? []).map(d => ({
      accNo:        d.AccNo        || d.accNo,
      companyName:  d.CompanyName  || d.companyName,
      creditTerm:   d.CreditTerm   || d.creditTerm || this.credit,
      currencyCode: d.CurrencyCode || d.currencyCode,
    }));
  }

  // ── push quotation (from lead) ───────────────────────────────────

  async createQuotationFromLead(leadId: string, debtorCode: string, creditTerm?: string) {
    const lead = await this.prisma.lead.findUnique({
      where: { id: leadId },
      include: { account: true },
    });
    if (!lead) throw new BadRequestException('Lead not found');

    const term    = creditTerm ?? this.credit;
    const docDate = new Date();
    const body = {
      master: {
        debtorCode,
        debtorName:    lead.account?.name ?? lead.name,
        creditTerm:    term,
        salesLocation: this.location,
        docDate:       docDate.toISOString().split('T')[0],
        ref:           `POP-${lead.id.slice(-8).toUpperCase()}`,
        description:   lead.name,
      },
      details: [{
        description: `Production Services — ${lead.name}`,
        qty: 1,
        unitPrice: lead.estimatedValue ?? 0,
      }],
    };

    const res = await fetch(this.url('quotation'), {
      method: 'POST', headers: this.authHeaders(), body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as any;
      throw new InternalServerErrorException(err.message ?? `Autocount error ${res.status}`);
    }

    const docNo = this.extractDocNo(res.headers.get('location'));
    if (!docNo) throw new InternalServerErrorException('Autocount did not return a document number');

    // Persist as an AccountingDocument — linked to lead and project (if converted).
    const doc = await this.prisma.accountingDocument.create({
      data: {
        docType:    'QUOTATION',
        docNo,
        docDate,
        dueDate:    this.calcDueDate(docDate, term),
        amount:     lead.estimatedValue ?? null,
        debtorCode,
        debtorName: lead.account?.name ?? lead.name,
        creditTerm: term,
        leadId,
        projectId:  lead.projectId ?? null,  // already converted? link to project too
      },
    });

    // Remember the debtor code on the account for future documents.
    if (lead.accountId) {
      await this.prisma.account.update({ where: { id: lead.accountId }, data: { autocountDebtorCode: debtorCode } });
    }

    return doc;
  }

  // ── push invoice (from project) ──────────────────────────────────

  async createInvoiceFromProject(projectId: string, debtorCode: string, creditTerm?: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { account: true },
    });
    if (!project) throw new BadRequestException('Project not found');

    const term    = creditTerm ?? this.credit;
    const docDate = new Date();
    const body = {
      master: {
        debtorCode,
        debtorName:    project.account?.name ?? project.client ?? project.name,
        creditTerm:    term,
        salesLocation: this.location,
        docDate:       docDate.toISOString().split('T')[0],
        ref:           `POP-${project.id.slice(-8).toUpperCase()}`,
        description:   project.name,
      },
      details: [{
        description: `Production Services — ${project.name}`,
        qty: 1,
        unitPrice: project.estimatedValue ?? 0,
      }],
    };

    const res = await fetch(this.url('invoice'), {
      method: 'POST', headers: this.authHeaders(), body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as any;
      throw new InternalServerErrorException(err.message ?? `Autocount error ${res.status}`);
    }

    const docNo = this.extractDocNo(res.headers.get('location'));
    if (!docNo) throw new InternalServerErrorException('Autocount did not return a document number');

    const doc = await this.prisma.accountingDocument.create({
      data: {
        docType:    'SALES_INVOICE',
        docNo,
        docDate,
        dueDate:    this.calcDueDate(docDate, term),
        amount:     project.estimatedValue ?? null,
        debtorCode,
        debtorName: project.account?.name ?? project.client ?? project.name,
        creditTerm: term,
        projectId,
      },
    });

    if (project.accountId) {
      await this.prisma.account.update({ where: { id: project.accountId }, data: { autocountDebtorCode: debtorCode } });
    }

    return doc;
  }

  // ── read ─────────────────────────────────────────────────────────

  // All documents for a project — shown in the project detail view.
  getProjectDocuments(projectId: string) {
    return this.prisma.accountingDocument.findMany({
      where:   { projectId },
      orderBy: { docDate: 'desc' },
    });
  }

  // Documents due within the next N days — drives the Dashboard payment alert strip.
  async getDueSoon(days = 10) {
    const now    = new Date();
    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() + days);

    return this.prisma.accountingDocument.findMany({
      where: {
        status:  'ACTIVE',
        dueDate: { not: null, lte: cutoff },
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
    });
  }

  // Mark a document as PAID or VOID.
  async updateStatus(id: string, status: 'PAID' | 'VOID') {
    return this.prisma.accountingDocument.update({
      where: { id },
      data:  { status },
    });
  }
}
