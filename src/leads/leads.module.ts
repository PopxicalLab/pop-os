import { Module } from '@nestjs/common';
import { LeadsController } from './leads.controller';
import { LeadsService } from './leads.service';
import { PrismaService } from '../prisma.service';
import { AuditModule } from '../audit/audit.module';
import { WhatsappModule } from '../whatsapp/whatsapp.module';

@Module({
  imports:     [AuditModule, WhatsappModule],
  controllers: [LeadsController],
  providers:   [LeadsService, PrismaService],
})
export class LeadsModule {}
