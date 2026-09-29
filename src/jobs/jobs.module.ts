import { Module } from '@nestjs/common';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';
import { PrismaService } from '../prisma.service';

// Read-only view over won leads + their projects — no DTO needed, since
// edits go through the leads / projects / project-costs endpoints.
@Module({
  controllers: [JobsController],
  providers:   [JobsService, PrismaService],
})
export class JobsModule {}
