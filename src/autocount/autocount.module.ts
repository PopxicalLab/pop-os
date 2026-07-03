import { Module } from '@nestjs/common';
import { AutocountController } from './autocount.controller';
import { AutocountService }    from './autocount.service';
import { PrismaService }       from '../prisma.service';
import { AuditModule }         from '../audit/audit.module';

@Module({
  imports:     [AuditModule],
  controllers: [AutocountController],
  providers:   [AutocountService, PrismaService],
})
export class AutocountModule {}
