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

  // ── sync documents (quotations + invoices) ───────────────────────

  // Fetch all pages of a listing endpoint, handling pagination automatically.
  private async fetchAllDocumentPages(path: string): Promise<any[]> {
    const all: any[] = [];
    let page = 1;
    const pageSize = 200;

    while (true) {
      const res = await fetch(
        this.url(`${path}?page=${page}&pageSize=${pageSize}`),
        { headers: this.authHeaders() },
      );
      if (!res.ok) break;
      const body = await res.json() as { data?: any[] };
      const items = body.data ?? [];
      all.push(...items);
      if (items.length < pageSize) break; // last page
      page++;
      if (page > 50) break; // safety cap — 10 000 documents max
    }

    return all;
  }

  // Pull quotations and invoices from Autocount and upsert as AccountingDocument rows.
  // Preserves existing project/lead links — only updates status, amounts, and dates.
  async syncDocuments() {
    const [quotations, invoices] = await Promise.all([
      this.fetchAllDocumentPages('quotation/listing'),
      this.fetchAllDocumentPages('invoice/listing'),
    ]);

    const result = { quotationsTotal: quotations.length, invoicesTotal: invoices.length, created: 0, updated: 0, skipped: 0 };

    for (const item of quotations) {
      await this.upsertDocument(item, 'QUOTATION', result);
    }
    for (const item of invoices) {
      await this.upsertDocument(item, 'SALES_INVOICE', result);
    }

    return result;
  }

  private async upsertDocument(
    item: any,
    docType: 'QUOTATION' | 'SALES_INVOICE',
    result: { created: number; updated: number; skipped: number },
  ) {
    // Listing endpoint returns { master: {...}, details: [...] } per item.
    // Single-doc fetch returns the same shape. Normalise to flat master object.
    const m = item.master ?? item;

    const docNo      = m.docNo      ?? m.DocNo;
    const docDateRaw = m.docDate    ?? m.DocDate;
    const debtorCode = m.debtorCode ?? m.DebtorCode;
    const debtorName = m.debtorName ?? m.DebtorName ?? m.companyName ?? m.CompanyName;
    const amount     = m.finalTotal ?? m.FinalTotal ?? m.total ?? m.GrandTotal ?? 0;
    const creditTerm = m.creditTerm ?? m.CreditTerm ?? null;

    // DueDate for invoices; ExpiryDate for quotations.
    const dueDateRaw = m.dueDate    ?? m.DueDate
                    ?? m.expiryDate ?? m.ExpiryDate
                    ?? null;

    // Status: invoices have outstandingAmount (0 = fully paid); quotations have status string.
    let status: 'ACTIVE' | 'PAID' | 'VOID' = 'ACTIVE';
    if (docType === 'SALES_INVOICE') {
      const outstanding = m.outstandingAmount ?? m.OutstandingAmount ?? null;
      const isPaid      = m.isPaid ?? m.IsPaid ?? false;
      if (isPaid || (outstanding !== null && outstanding === 0 && (m.finalTotal ?? 0) > 0)) status = 'PAID';
      if (m.cancelled === true) status = 'VOID';
    } else {
      const s = String(m.status ?? m.Status ?? '').toLowerCase();
      if (s === 'void' || s === 'cancelled') status = 'VOID';
      if (m.cancelled === true) status = 'VOID';
    }

    if (!docNo) { result.skipped++; return; }

    const existing = await this.prisma.accountingDocument.findFirst({ where: { docNo } });

    if (existing) {
      await this.prisma.accountingDocument.update({
        where: { id: existing.id },
        data: {
          status,
          amount,
          dueDate:    dueDateRaw ? new Date(dueDateRaw) : existing.dueDate,
          debtorCode: debtorCode ?? existing.debtorCode,
          debtorName: debtorName ?? existing.debtorName,
          creditTerm: creditTerm ?? existing.creditTerm,
        },
      });
      result.updated++;
    } else {
      if (!docDateRaw) { result.skipped++; return; }
      await this.prisma.accountingDocument.create({
        data: {
          docType,
          docNo,
          docDate:    new Date(docDateRaw),
          dueDate:    dueDateRaw ? new Date(dueDateRaw) : null,
          amount,
          debtorCode: debtorCode ?? null,
          debtorName: debtorName ?? null,
          creditTerm: creditTerm ?? null,
          status,
        },
      });
      result.created++;
    }
  }

  // ── sync debtors → accounts ──────────────────────────────────────

  // Pull all Autocount debtors and upsert them as Account records in Pop OS.
  // Match priority: autocountDebtorCode → name (case-insensitive) → create new.
  // Returns a summary of what changed so the UI can report it.
  async syncDebtors() {
    const debtors = await this.listDebtors();
    const result  = { created: 0, updated: 0, skipped: 0, total: debtors.length };

    for (const d of debtors) {
      if (!d.accNo || !d.companyName) { result.skipped++; continue; }

      // 1. Look up by debtor code (most precise match).
      let account = await this.prisma.account.findFirst({
        where: { autocountDebtorCode: d.accNo },
      });

      if (account) {
        // Keep the name in sync in case it was renamed in Autocount.
        if (account.name !== d.companyName) {
          await this.prisma.account.update({
            where: { id: account.id },
            data:  { name: d.companyName },
          });
          result.updated++;
        } else {
          result.skipped++;
        }
        continue;
      }

      // 2. Fall back to name match — link the debtor code to an existing account.
      account = await this.prisma.account.findFirst({
        where: { name: { equals: d.companyName, mode: 'insensitive' } },
      });

      if (account) {
        await this.prisma.account.update({
          where: { id: account.id },
          data:  { autocountDebtorCode: d.accNo },
        });
        result.updated++;
        continue;
      }

      // 3. No match — create a new Account.
      await this.prisma.account.create({
        data: { name: d.companyName, autocountDebtorCode: d.accNo },
      });
      result.created++;
    }

    return result;
  }

  // ── reconciliation ───────────────────────────────────────────────
  // Compare every AccountingDocument in Pop OS against live Autocount record.
  // Uses single-doc fetch: GET /{bookId}/invoice?docNo=XX (confirmed in Swagger).
  async reconcile() {
    const docs = await this.prisma.accountingDocument.findMany({
      orderBy: { docDate: 'desc' },
    });

    const results = await Promise.all(docs.map(async (doc) => {
      try {
        const endpoint = doc.docType === 'SALES_INVOICE' ? 'invoice' : 'quotation';
        const res = await fetch(
          this.url(`${endpoint}?docNo=${encodeURIComponent(doc.docNo)}`),
          { headers: this.authHeaders() },
        );

        if (!res.ok) {
          return { ...this.docSummary(doc), acAmount: null, acStatus: null, acOutstanding: null, match: 'NOT_FOUND' as const };
        }

        const body        = await res.json() as { master?: any };
        const master      = body?.master ?? body ?? {};
        const acAmount      = master.finalTotal ?? master.total ?? null;
        const acOutstanding = master.outstandingAmount ?? null;
        const acStatusRaw   = String(master.status ?? '').toLowerCase();
        const acStatus      = acStatusRaw.includes('paid') ? 'PAID'
                            : acStatusRaw.includes('void') ? 'VOID'
                            : 'ACTIVE';

        const amountMatch = doc.amount != null && acAmount != null
          ? Math.abs(doc.amount - acAmount) <= 0.01
          : doc.amount == null && acAmount == null;
        const statusMatch = doc.status === acStatus;
        const match = amountMatch && statusMatch ? 'OK'
                    : !amountMatch && !statusMatch ? 'BOTH_MISMATCH'
                    : !amountMatch ? 'AMOUNT_MISMATCH'
                    : 'STATUS_MISMATCH';

        return { ...this.docSummary(doc), acAmount, acStatus, acOutstanding, match };
      } catch {
        return { ...this.docSummary(doc), acAmount: null, acStatus: null, acOutstanding: null, match: 'ERROR' as const };
      }
    }));

    const summary = {
      total:          results.length,
      ok:             results.filter(r => r.match === 'OK').length,
      amountMismatch: results.filter(r => r.match === 'AMOUNT_MISMATCH').length,
      statusMismatch: results.filter(r => r.match === 'STATUS_MISMATCH').length,
      bothMismatch:   results.filter(r => r.match === 'BOTH_MISMATCH').length,
      notFound:       results.filter(r => r.match === 'NOT_FOUND').length,
      errors:         results.filter(r => r.match === 'ERROR').length,
    };

    return { summary, items: results };
  }

  private docSummary(doc: any) {
    return {
      id: doc.id, docNo: doc.docNo, docType: doc.docType,
      docDate: doc.docDate, debtorName: doc.debtorName,
      popAmount: doc.amount, popStatus: doc.status,
    };
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
