import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { promises as fs } from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma.service';
import { jobUploadDir } from '../common/uploads';
import { CreateJobAttachmentDto, UpdateJobAttachmentDto } from './job-attachment.dto';

// The bits of a multer upload we use (avoids needing @types/multer).
export interface UploadedFileLike {
  originalname: string;
  mimetype:     string;
  size:         number;
  buffer:       Buffer;
}

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25 MB per file

// Office docs, PDFs, images, design files, archives, emails. Deliberately
// NOT html / svg / js / exe — those could run code if someone opened them.
const ALLOWED_EXT = new Set([
  'pdf', 'png', 'jpg', 'jpeg', 'webp', 'gif', 'heic',
  'doc', 'docx', 'xls', 'xlsx', 'csv', 'ppt', 'pptx', 'txt',
  'zip', 'rar', '7z', 'ai', 'psd', 'eml', 'msg',
]);

@Injectable()
export class JobAttachmentsService {
  constructor(private prisma: PrismaService) {}

  findForJob(leadId: string) {
    return this.prisma.jobAttachment.findMany({ where: { leadId }, orderBy: { createdAt: 'desc' } });
  }

  async create(leadId: string, file: UploadedFileLike | undefined, dto: CreateJobAttachmentDto,
               user: { sub?: string; name?: string }) {
    if (!file) throw new BadRequestException('No file received.');
    const lead = await this.prisma.lead.findUnique({ where: { id: leadId }, select: { id: true } });
    if (!lead) throw new NotFoundException(`Job ${leadId} not found`);

    // Browsers send the name as UTF-8 but multer reads it as latin1 —
    // convert back so names like "报价单.pdf" survive.
    const fileName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    const ext = path.extname(fileName).slice(1).toLowerCase();
    if (!ALLOWED_EXT.has(ext)) {
      throw new BadRequestException(`".${ext || '?'}" files can't be attached. Allowed: ${[...ALLOWED_EXT].join(', ')}.`);
    }

    // Stored under a random name we choose — the user's file name never
    // touches the file system, so "../../etc" style names can't escape.
    const storedName = `${randomUUID()}.${ext}`;
    const dir = jobUploadDir(leadId);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, storedName), file.buffer);

    return this.prisma.jobAttachment.create({
      data: {
        leadId, fileName, storedName,
        mimeType:       file.mimetype || 'application/octet-stream',
        size:           file.size,
        category:       dto.category ?? 'OTHER',
        note:           dto.note?.trim() || null,
        uploadedById:   user?.sub  ?? null,
        uploadedByName: user?.name ?? null,
      },
    });
  }

  async findOne(id: string) {
    const a = await this.prisma.jobAttachment.findUnique({ where: { id } });
    if (!a) throw new NotFoundException(`Attachment ${id} not found`);
    return a;
  }

  // Full path on disk for a download.
  async filePath(id: string) {
    const a = await this.findOne(id);
    return { attachment: a, fullPath: path.join(jobUploadDir(a.leadId), a.storedName) };
  }

  async update(id: string, dto: UpdateJobAttachmentDto) {
    await this.findOne(id);
    return this.prisma.jobAttachment.update({
      where: { id },
      data: {
        category: dto.category,
        note:     dto.note === undefined ? undefined : (dto.note?.trim() || null),
      },
    });
  }

  async remove(id: string) {
    const a = await this.findOne(id);
    await this.prisma.jobAttachment.delete({ where: { id } });
    // Row first, then the file: if the file delete fails we only leave an
    // orphan file on disk, never a row pointing at nothing.
    await fs.rm(path.join(jobUploadDir(a.leadId), a.storedName), { force: true }).catch(() => undefined);
    return a;
  }
}
