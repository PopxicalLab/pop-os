import { Module } from '@nestjs/common';
import { CapacityController } from './capacity.controller';
import { CapacityService } from './capacity.service';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [CapacityController],
  providers:   [CapacityService, PrismaService],
})
export class CapacityModule {}
