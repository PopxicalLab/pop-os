import { Module } from '@nestjs/common';
import { SalesTargetsController } from './sales-targets.controller';
import { SalesTargetsService } from './sales-targets.service';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [SalesTargetsController],
  providers:   [SalesTargetsService, PrismaService],
})
export class SalesTargetsModule {}
