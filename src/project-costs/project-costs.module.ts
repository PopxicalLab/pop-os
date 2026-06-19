import { Module } from '@nestjs/common';
import { ProjectCostsController } from './project-costs.controller';
import { ProjectCostsService } from './project-costs.service';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [ProjectCostsController],
  providers:   [ProjectCostsService, PrismaService],
})
export class ProjectCostsModule {}
