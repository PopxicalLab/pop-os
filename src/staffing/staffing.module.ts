import { Module } from '@nestjs/common';
import { StaffingController } from './staffing.controller';
import { StaffingService } from './staffing.service';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [StaffingController],
  providers:   [StaffingService, PrismaService],
})
export class StaffingModule {}
