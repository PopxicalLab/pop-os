import { Controller, Get, Post, Patch, Param, Body, Query, Req, UseGuards } from '@nestjs/common';
import { IsString, IsOptional, IsIn, IsNotEmpty } from 'class-validator';
import { AutocountService } from './autocount.service';
import { AuditService } from '../audit/audit.service';
import { JOB_ROLES, onlyRoles } from '../common/roles';

class PushQuotationDto {
  @IsString() debtorCode: string;
  @IsOptional() @IsString() creditTerm?: string;
}

class PushInvoiceDto {
  @IsString() debtorCode: string;
  @IsOptional() @IsString() creditTerm?: string;
}

class UpdateStatusDto {
  @IsIn(['PAID', 'VOID']) status: 'PAID' | 'VOID';
}

class FetchDocDto {
  @IsString() @IsNotEmpty() docNo: string;
}

// leadId = the job to attach the document to; null (or left out) = unlink.
class LinkDocDto {
  @IsOptional() @IsString() leadId?: string | null;
}

// Quotations, invoices, debtors — money. Job roles only (src/common/roles.ts).
@UseGuards(onlyRoles(JOB_ROLES))
@Controller('api/autocount')
export class AutocountController {
  constructor(
    private readonly svc: AutocountService,
    private readonly audit: AuditService,
  ) {}

  @Get('debtors')
  listDebtors() { return this.svc.listDebtors(); }

  @Post('sync-debtors')
  syncDebtors() { return this.svc.syncDebtors(); }

  @Post('sync-documents')
  syncDocuments() { return this.svc.syncDocuments(); }

  @Get('due-soon')
  getDueSoon(@Query('days') days?: string) {
    return this.svc.getDueSoon(days ? parseInt(days) : 10);
  }

  @Get('projects/:id/documents')
  getProjectDocuments(@Param('id') id: string) { return this.svc.getProjectDocuments(id); }

  @Post('leads/:id/quotation')
  async createQuotation(@Param('id') id: string, @Body() dto: PushQuotationDto, @Req() req: any) {
    const result = await this.svc.createQuotationFromLead(id, dto.debtorCode, dto.creditTerm);
    this.audit.log(req.user, 'CREATE', 'AccountingDocument', result.id, result.docNo, result);
    return result;
  }

  @Post('projects/:id/invoice')
  async createInvoice(@Param('id') id: string, @Body() dto: PushInvoiceDto, @Req() req: any) {
    const result = await this.svc.createInvoiceFromProject(id, dto.debtorCode, dto.creditTerm);
    this.audit.log(req.user, 'CREATE', 'AccountingDocument', result.id, result.docNo, result);
    return result;
  }

  // Mark a document PAID or VOID — high-value audit event.
  @Patch('documents/:id/status')
  async updateStatus(@Param('id') id: string, @Body() dto: UpdateStatusDto, @Req() req: any) {
    const result = await this.svc.updateStatus(id, dto.status);
    this.audit.log(req.user, 'UPDATE', 'AccountingDocument', id, result.docNo, { status: result.status, docNo: result.docNo });
    return result;
  }

  // ── Link documents made directly in Autocount to a job ──
  // ?kind=SALES (quotes + sales invoices) | PURCHASE (supplier invoices) | omitted = all
  @Get('documents/unlinked')
  listUnlinked(@Query('search') search?: string, @Query('kind') kind?: string) {
    return this.svc.listUnlinked(search, kind);
  }

  // Job page "↻ Sync": re-read this job's linked documents from Autocount
  // (paid status, amount, title) — Finance updates them there.
  @Post('leads/:id/refresh-documents')
  refreshJobDocuments(@Param('id') id: string) { return this.svc.refreshJobDocuments(id); }

  @Post('documents/fetch')
  fetchByDocNo(@Body() dto: FetchDocDto) { return this.svc.fetchByDocNo(dto.docNo); }

  @Patch('documents/:id/link')
  async linkDocument(@Param('id') id: string, @Body() dto: LinkDocDto, @Req() req: any) {
    const result = await this.svc.linkDocument(id, dto.leadId ?? null);
    this.audit.log(req.user, 'UPDATE', 'AccountingDocument', id, result.docNo,
      { docNo: result.docNo, leadId: result.leadId, projectId: result.projectId });
    return result;
  }

  @Get('reconcile')
  reconcile() { return this.svc.reconcile(); }
}
