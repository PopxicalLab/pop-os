import { Module } from '@nestjs/common';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { PrismaService } from '../prisma.service';
import { AuditModule } from '../audit/audit.module';
import { MattermostModule } from '../mattermost/mattermost.module';

@Module({
  imports:     [AuditModule, MattermostModule],
  controllers: [ProjectsController],
  providers:   [ProjectsService, PrismaService],
})
export class ProjectsModule {}
