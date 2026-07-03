import { Module } from '@nestjs/common';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [AuditController],
  providers:   [AuditService, PrismaService],
  exports:     [AuditService], // other modules import this to log actions
})
export class AuditModule {}
