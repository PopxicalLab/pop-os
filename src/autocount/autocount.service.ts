// Autocount Cloud accounting integration.
// All HTTP calls live here. Documents created in Autocount are also
// persisted as AccountingDocument rows so they stay visible in Pop OS
// on the project detail view and in the Dashboard payment alerts.
import { Injectable, BadRequestException, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { ensureJobForProject } from '../common/job';

// The three Autocount document kinds Pop OS keeps a copy of, and the API
// path for each (GET <path>?docNo=… fetches one, <path>/listing lists them).
type DocKind = 'QUOTATION' | 'SALES_INVOICE' | 'PURCHASE_INVOICE';
const ENDPOINT: Record<DocKind, string> = {
  QUOTATION:        'quotation',
  SALES_INVOICE:    'invoice',
  PURCHASE_INVOICE: 'purchaseinvoice',
};
const KIND_LABEL: Record<DocKind, string> = {
  QUOTATION: 'quotations', SALES_INVOICE: 'invoices', PURCHASE_INVOICE: 'supplier invoices',
};

// What a linked supplier invoice adds to the job's costs: the full amount
// (incl. SST — Malaysian SST can't be claimed back, so it's a real cost),
// or nothing once the invoice is cancelled in Autocount.
const costAmount = (d: { amount: number | null; status: string }) =>
  d.status === 'VOID' ? 0 : (d.amount ?? 0);
const costDescription = (d: { docNo: string; debtorName: string | null; title: string | null; status: string }) =>
  [d.debtorName || 'Supplier', d.docNo, d.title].filter(Boolean).join(' · ').slice(0, 250)
  + (d.status === 'VOID' ? ' (cancelled)' : '');

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
        title:      lead.name,   // same text we sent as the Autocount description
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
    // The invoice amount is the job's value (money lives on the job, not the project).
    const jobId = await ensureJobForProject(this.prisma, projectId);
    const job   = await this.prisma.lead.findUniqueOrThrow({ where: { id: jobId }, select: { estimatedValue: true } });

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
        unitPrice: job.estimatedValue ?? 0,
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
        amount:     job.estimatedValue ?? null,
        debtorCode,
        debtorName: project.account?.name ?? project.client ?? project.name,
        creditTerm: term,
        title:      project.name,
        projectId,
        leadId:     jobId,
      },
    });

    if (project.accountId) {
      await this.prisma.account.update({ where: { id: project.accountId }, data: { autocountDebtorCode: debtorCode } });
    }

    return doc;
  }

  // ── sync documents (quotations + invoices) ───────────────────────

  // Fetch all pages of a listing endpoint for the current calendar year only.
  private async fetchAllDocumentPages(path: string): Promise<any[]> {
    const all: any[] = [];
    let page = 1;
    const pageSize = 200;
    const year      = new Date().getFullYear();
    const startDate = `${year}-01-01`;
    const endDate   = `${year}-12-31`;

    while (true) {
      const res = await fetch(
        this.url(`${path}?page=${page}&pageSize=${pageSize}&startDate=${startDate}&endDate=${endDate}`),
        { headers: this.authHeaders() },
      );
      if (!res.ok) break;
      const body = await res.json() as { data?: any[] };
      const items = body.data ?? [];
      all.push(...items);
      if (items.length < pageSize) break;
      page++;
      if (page > 50) break;
    }

    return all;
  }

  // Pull quotations, sales invoices and supplier (purchase) invoices from
  // Autocount and upsert them as AccountingDocument rows.
  // Preserves existing project/lead links — only updates status, amounts, dates
  // and title. Status always comes from Autocount: Finance records payments
  // there, Pop OS just mirrors them.
  async syncDocuments() {
    const [quotations, invoices, purchases] = await Promise.all([
      this.fetchAllDocumentPages('quotation/listing'),
      this.fetchAllDocumentPages('invoice/listing'),
      this.fetchAllDocumentPages('purchaseinvoice/listing'),
    ]);

    const result = {
      quotationsTotal: quotations.length, invoicesTotal: invoices.length, purchaseInvoicesTotal: purchases.length,
      created: 0, updated: 0, skipped: 0,
    };

    for (const item of quotations) await this.upsertDocument(item, 'QUOTATION', result);
    for (const item of invoices)   await this.upsertDocument(item, 'SALES_INVOICE', result);
    for (const item of purchases)  await this.upsertDocument(item, 'PURCHASE_INVOICE', result);

    return result;
  }

  // Paid / void / still open, read from an Autocount document.
  //  - Invoices (sales and supplier): outstandingAmount 0 = fully paid. Supplier
  //    invoices also say so in words ("Full Payment").
  //  - Anything cancelled in Autocount = VOID.
  private statusOf(m: any, docType: DocKind): 'ACTIVE' | 'PAID' | 'VOID' {
    if (m.cancelled === true) return 'VOID';
    const s = String(m.status ?? m.Status ?? '').toLowerCase();
    if (s === 'void' || s === 'cancelled') return 'VOID';
    if (docType === 'QUOTATION') return 'ACTIVE';
    const outstanding = m.outstandingAmount ?? m.OutstandingAmount ?? null;
    const total       = m.finalTotal ?? m.FinalTotal ?? 0;
    if (m.isPaid ?? m.IsPaid) return 'PAID';
    if (outstanding !== null && outstanding === 0 && total > 0) return 'PAID';
    if (s.includes('full payment') || s === 'paid') return 'PAID';
    return 'ACTIVE';
  }

  // A short "what is this" line for the link picker: Autocount's description,
  // else the first line item. Whitespace squashed, capped at 200 characters.
  private titleOf(item: any): string | null {
    const m = item.master ?? item;
    const first = (item.details ?? [])[0];
    // `||` not `??`: Autocount sends an empty string (not null) for a blank
    // description, and that should fall through to the line item too.
    const raw = String(m.description || m.Description || first?.description || first?.Description || '').replace(/\s+/g, ' ').trim();
    return raw ? raw.slice(0, 200) : null;
  }

  private async upsertDocument(
    item: any,
    docType: DocKind,
    result: { created: number; updated: number; skipped: number },
  ) {
    // Returns the saved row (or null if skipped) so fetchByDocNo() can link it.
    // Listing endpoint returns { master: {...}, details: [...] } per item.
    // Single-doc fetch returns the same shape. Normalise to flat master object.
    const m = item.master ?? item;

    // Supplier invoices name the other side "creditor" instead of "debtor" —
    // both land in the same debtorCode / debtorName columns.
    const docNo      = m.docNo      ?? m.DocNo;
    const docDateRaw = m.docDate    ?? m.DocDate;
    const debtorCode = m.debtorCode ?? m.DebtorCode ?? m.creditorCode ?? m.CreditorCode;
    const debtorName = m.debtorName ?? m.DebtorName ?? m.creditorName ?? m.CreditorName ?? m.companyName ?? m.CompanyName;
    const amount     = m.finalTotal ?? m.FinalTotal ?? m.total ?? m.GrandTotal ?? 0;
    const creditTerm = m.creditTerm ?? m.CreditTerm ?? null;
    const title      = this.titleOf(item);
    const status     = this.statusOf(m, docType);

    // DueDate for invoices; ExpiryDate for quotations.
    const dueDateRaw = m.dueDate    ?? m.DueDate
                    ?? m.expiryDate ?? m.ExpiryDate
                    ?? null;

    if (!docNo) { result.skipped++; return null; }

    // Match on number AND type: a supplier's invoice number is the supplier's
    // own numbering, so it could in theory equal one of ours.
    const existing = await this.prisma.accountingDocument.findFirst({ where: { docNo, docType } });

    let saved;
    if (existing) {
      saved = await this.prisma.accountingDocument.update({
        where: { id: existing.id },
        data: {
          status,
          amount,
          dueDate:    dueDateRaw ? new Date(dueDateRaw) : existing.dueDate,
          debtorCode: debtorCode ?? existing.debtorCode,
          debtorName: debtorName ?? existing.debtorName,
          creditTerm: creditTerm ?? existing.creditTerm,
          title:      title      ?? existing.title,
        },
      });
      result.updated++;
    } else {
      if (!docDateRaw) { result.skipped++; return null; }
      saved = await this.prisma.accountingDocument.create({
        data: {
          docType,
          docNo,
          docDate:    new Date(docDateRaw),
          dueDate:    dueDateRaw ? new Date(dueDateRaw) : null,
          amount,
          debtorCode: debtorCode ?? null,
          debtorName: debtorName ?? null,
          creditTerm: creditTerm ?? null,
          title,
          status,
        },
      });
      result.created++;
    }

    // A linked supplier invoice has a cost line — keep it in step with the
    // invoice (amount changed, or cancelled in Autocount → 0).
    if (docType === 'PURCHASE_INVOICE') {
      await this.prisma.projectCost.updateMany({
        where: { documentId: saved.id },
        data:  { amount: costAmount(saved), description: costDescription(saved) },
      });
    }
    return saved;
  }

  // ── link documents made directly in Autocount ───────────────────
  // Quotes / invoices typed straight into Autocount arrive via Sync documents
  // (or fetchByDocNo) with no lead or project. These let a job claim them,
  // and let a wrongly linked one be detached again. Autocount itself is never
  // changed — only which Pop OS job the copy belongs to.

  // Documents not attached to any job yet, newest first. `search` matches the
  // doc number, the client / supplier name or the title. `kind` narrows to
  // 'SALES' (quotations + sales invoices) or 'PURCHASE' (supplier invoices).
  listUnlinked(search?: string, kind?: string) {
    const q = search?.trim();
    const docType = kind === 'PURCHASE' ? { docType: 'PURCHASE_INVOICE' as const }
                  : kind === 'SALES'    ? { docType: { in: ['QUOTATION', 'SALES_INVOICE'] as DocKind[] } }
                  : {};
    return this.prisma.accountingDocument.findMany({
      where: {
        leadId: null, projectId: null, ...docType,
        ...(q ? { OR: [
          { docNo:      { contains: q, mode: 'insensitive' as const } },
          { debtorName: { contains: q, mode: 'insensitive' as const } },
          { title:      { contains: q, mode: 'insensitive' as const } },
        ] } : {}),
      },
      orderBy: { docDate: 'desc' },
      take: 100,
    });
  }

  // Find one document by its number — in Pop OS first, else straight from
  // Autocount (any year, unlike Sync documents which is this year only).
  // Tries quotations, sales invoices, then supplier invoices. Returns the row
  // with its current job so the UI can warn "already linked to …" before
  // moving it.
  async fetchByDocNo(raw: string) {
    const docNo = raw.trim();
    const withLead = { lead: { select: { id: true, name: true } } };
    const known = await this.prisma.accountingDocument.findFirst({ where: { docNo }, include: withLead });
    if (known) return known;

    const tally = { created: 0, updated: 0, skipped: 0 };
    for (const type of Object.keys(ENDPOINT) as DocKind[]) {
      const body = await this.fetchOne(type, docNo);
      if (!body) continue;
      const saved = await this.upsertDocument(body, type, tally);
      if (saved) return this.prisma.accountingDocument.findUnique({ where: { id: saved.id }, include: withLead });
    }
    throw new NotFoundException(`${docNo} was not found in Autocount (checked ${Object.values(KIND_LABEL).join(', ')}).`);
  }

  // One document straight from Autocount, or null if it isn't there.
  private async fetchOne(type: DocKind, docNo: string): Promise<any | null> {
    const res = await fetch(this.url(`${ENDPOINT[type]}?docNo=${encodeURIComponent(docNo)}`), { headers: this.authHeaders() });
    if (!res.ok) return null;
    return res.json().catch(() => null);
  }

  // Attach a document to a job (leadId) — and to the job's project, so it
  // shows on both. leadId null = unlink: the copy stays in Pop OS (Financial
  // still counts it) but belongs to no job.
  //
  // Supplier invoices are money OUT, so linking one also creates its cost line
  // on the job (and moving / unlinking it moves / deletes that line). Done in
  // one transaction so the invoice and its cost can never disagree.
  async linkDocument(id: string, leadId: string | null) {
    const doc = await this.prisma.accountingDocument.findUnique({ where: { id } });
    if (!doc) throw new NotFoundException('Document not found');
    const isSupplier = doc.docType === 'PURCHASE_INVOICE';

    if (!leadId) {
      return this.prisma.$transaction(async tx => {
        if (isSupplier) await tx.projectCost.deleteMany({ where: { documentId: id } });
        return tx.accountingDocument.update({ where: { id }, data: { leadId: null, projectId: null } });
      });
    }
    const lead = await this.prisma.lead.findUnique({ where: { id: leadId }, select: { projectId: true, accountId: true } });
    if (!lead) throw new NotFoundException('Job not found');
    // Same rule as typing a cost in by hand: a cost row still needs the
    // job's project (until the step-4 cleanup makes projectId optional).
    if (isSupplier && !lead.projectId) {
      throw new BadRequestException('A supplier invoice becomes a cost on this job, and costs need the job\'s project. Create the project first, then link the invoice.');
    }

    const updated = await this.prisma.$transaction(async tx => {
      const row = await tx.accountingDocument.update({
        where: { id },
        data:  { leadId, projectId: lead.projectId ?? null },
      });
      if (isSupplier) {
        const job = { leadId, projectId: lead.projectId! };
        await tx.projectCost.upsert({
          where:  { documentId: id },
          create: { ...job, documentId: id, costType: 'SUPPLIER', amount: costAmount(row), description: costDescription(row) },
          update: job,   // moved to another job → the cost moves with it
        });
      }
      return row;
    });

    // Remember the debtor on the client if it has none yet (same as a push
    // does) — never overwrite one that's already set. Not for supplier
    // invoices: their code is the SUPPLIER's account, not the client's.
    if (!isSupplier && lead.accountId && doc.debtorCode) {
      await this.prisma.account.updateMany({
        where: { id: lead.accountId, autocountDebtorCode: null },
        data:  { autocountDebtorCode: doc.debtorCode },
      });
    }
    return updated;
  }

  // Job page "↻ Sync": re-read just this job's documents from Autocount, one
  // by one (fast — no full listing, and works for any year). Picks up what
  // Finance changed there: paid / cancelled, amount, title. Linked supplier-
  // invoice costs follow along (see upsertDocument).
  async refreshJobDocuments(leadId: string) {
    const lead = await this.prisma.lead.findUnique({ where: { id: leadId }, select: { projectId: true } });
    if (!lead) throw new NotFoundException('Job not found');
    const docs = await this.prisma.accountingDocument.findMany({
      where: { OR: [{ leadId }, ...(lead.projectId ? [{ projectId: lead.projectId }] : [])] },
    });

    const tally = { created: 0, updated: 0, skipped: 0 };
    const result = { checked: docs.length, changed: [] as string[], notFound: [] as string[] };
    await Promise.all(docs.map(async d => {
      const body = await this.fetchOne(d.docType as DocKind, d.docNo).catch(() => null);
      if (!body) { result.notFound.push(d.docNo); return; }
      const saved = await this.upsertDocument(body, d.docType as DocKind, tally);
      if (saved && (saved.status !== d.status || saved.amount !== d.amount)) result.changed.push(d.docNo);
    }));
    return result;
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
        const body = await this.fetchOne(doc.docType as DocKind, doc.docNo);
        if (!body) {
          return { ...this.docSummary(doc), acAmount: null, acStatus: null, acOutstanding: null, match: 'NOT_FOUND' as const };
        }

        const master        = body?.master ?? body ?? {};
        const acAmount      = master.finalTotal ?? master.total ?? null;
        const acOutstanding = master.outstandingAmount ?? null;
        // Same rule the sync uses, so "mismatch" means a real difference.
        const acStatus      = this.statusOf(master, doc.docType as DocKind);

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

  // All documents for a project's job — shown in the project detail view.
  // Matches on either link so older rows with only one side set still show.
  getProjectDocuments(projectId: string) {
    return this.prisma.accountingDocument.findMany({
      where:   { OR: [{ projectId }, { lead: { projectId } }] },
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
        docType: { not: 'PURCHASE_INVOICE' },   // bills we pay, not money owed to us
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
