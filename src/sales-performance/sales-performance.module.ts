import { Module } from '@nestjs/common';
import { SalesPerformanceController } from './sales-performance.controller';
import { SalesPerformanceService } from './sales-performance.service';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [SalesPerformanceController],
  providers:   [SalesPerformanceService, PrismaService],
})
export class SalesPerformanceModule {}
