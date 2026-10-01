import {
  Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, Res,
  UploadedFile, UseGuards, UseInterceptors, BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { JOB_ROLES, onlyRoles } from '../common/roles';
import { AuditService } from '../audit/audit.service';
import { JobAttachmentsService, MAX_UPLOAD_BYTES, UploadedFileLike } from './job-attachments.service';
import { CreateJobAttachmentDto, UpdateJobAttachmentDto } from './job-attachment.dto';

// Files on a job (contracts, POs, invoices, receipts…). They can contain
// money, so — like everything else on the job — job roles only.
@UseGuards(onlyRoles(JOB_ROLES))
@Controller('api/job-attachments')
export class JobAttachmentsController {
  constructor(private readonly svc: JobAttachmentsService, private readonly audit: AuditService) {}

  @Get()
  list(@Query('leadId') leadId?: string) {
    if (!leadId) throw new BadRequestException('leadId is required');
    return this.svc.findForJob(leadId);
  }

  // multipart/form-data: "file" + optional "category" and "note" fields.
  // Held in memory (max 25 MB) then written to disk by the service.
  @Post(':leadId')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 } }))
  async upload(@Param('leadId') leadId: string, @UploadedFile() file: UploadedFileLike,
               @Body() dto: CreateJobAttachmentDto, @Req() req: any) {
    const a = await this.svc.create(leadId, file, dto, req.user);
    this.audit.log(req.user, 'CREATE', 'JobAttachment', a.id, a.fileName, { leadId, category: a.category, size: a.size });
    return a;
  }

  // Sends the file. ?inline=1 lets the browser show PDFs / images in a tab;
  // otherwise it downloads under its original name.
  @Get(':id/file')
  async file(@Param('id') id: string, @Query('inline') inline: string, @Res() res: Response) {
    const { attachment: a, fullPath } = await this.svc.filePath(id);
    const viewable = /^(application\/pdf|image\/(png|jpe?g|webp|gif))$/.test(a.mimeType);
    const how = inline === '1' && viewable ? 'inline' : 'attachment';
    res.setHeader('Content-Type', viewable ? a.mimeType : 'application/octet-stream');
    res.setHeader('X-Content-Type-Options', 'nosniff');   // never let the browser guess a riskier type
    res.setHeader('Content-Disposition',
      `${how}; filename="${a.fileName.replace(/[^\x20-\x7e]|"/g, '_')}"; filename*=UTF-8''${encodeURIComponent(a.fileName)}`);
    res.sendFile(fullPath, (err) => {
      if (err && !res.headersSent) res.status(404).json({ message: 'File is missing on the server.' });
    });
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateJobAttachmentDto, @Req() req: any) {
    const a = await this.svc.update(id, dto);
    this.audit.log(req.user, 'UPDATE', 'JobAttachment', a.id, a.fileName, { category: a.category, note: a.note });
    return a;
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: any) {
    const a = await this.svc.remove(id);
    this.audit.log(req.user, 'DELETE', 'JobAttachment', a.id, a.fileName, { leadId: a.leadId });
    return { ok: true };
  }
}
