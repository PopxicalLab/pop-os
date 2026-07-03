import { Controller, Get, Post, Patch, Param, Body, Query, Req } from '@nestjs/common';
import { IsString, IsOptional, IsIn } from 'class-validator';
import { AutocountService } from './autocount.service';
import { AuditService } from '../audit/audit.service';

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

  @Get('reconcile')
  reconcile() { return this.svc.reconcile(); }
}
