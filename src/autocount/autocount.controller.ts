import { Controller, Get, Post, Patch, Param, Body, Query } from '@nestjs/common';
import { IsString, IsOptional, IsIn, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { AutocountService } from './autocount.service';

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
  constructor(private readonly svc: AutocountService) {}

  // List active Autocount debtors — used to populate the debtor picker dropdown.
  @Get('debtors')
  listDebtors() {
    return this.svc.listDebtors();
  }

  // Documents due within N days — used by the Dashboard payment alert strip.
  @Get('due-soon')
  getDueSoon(@Query('days') days?: string) {
    return this.svc.getDueSoon(days ? parseInt(days) : 10);
  }

  // All accounting documents for a project — shown in the project detail view.
  @Get('projects/:id/documents')
  getProjectDocuments(@Param('id') id: string) {
    return this.svc.getProjectDocuments(id);
  }

  // Create a quotation in Autocount from a WON lead.
  @Post('leads/:id/quotation')
  createQuotation(@Param('id') id: string, @Body() dto: PushQuotationDto) {
    return this.svc.createQuotationFromLead(id, dto.debtorCode, dto.creditTerm);
  }

  // Create a sales invoice in Autocount from a project.
  @Post('projects/:id/invoice')
  createInvoice(@Param('id') id: string, @Body() dto: PushInvoiceDto) {
    return this.svc.createInvoiceFromProject(id, dto.debtorCode, dto.creditTerm);
  }

  // Mark a document as PAID or VOID.
  @Patch('documents/:id/status')
  updateStatus(@Param('id') id: string, @Body() dto: UpdateStatusDto) {
    return this.svc.updateStatus(id, dto.status);
  }
}
