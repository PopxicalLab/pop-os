import { Module } from '@nestjs/common';
import { JobAttachmentsController } from './job-attachments.controller';
import { JobAttachmentsService } from './job-attachments.service';
import { PrismaService } from '../prisma.service';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports:     [AuditModule],
  controllers: [JobAttachmentsController],
  providers:   [JobAttachmentsService, PrismaService],
})
export class JobAttachmentsModule {}
