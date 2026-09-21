import { Module } from '@nestjs/common';
import { MattermostService } from './mattermost.service';
import { NotificationRulesService } from './notification-rules.service';
import { NotificationRulesController } from './notification-rules.controller';
import { PrismaService } from '../prisma.service';
import { AuditModule } from '../audit/audit.module';

// MattermostService is exported so other modules (leads, in phase 2) can post
// directly; NotificationRulesService owns the admin-configured rules + scheduler.
@Module({
  imports:     [AuditModule],
  controllers: [NotificationRulesController],
  providers:   [MattermostService, NotificationRulesService, PrismaService],
  exports:     [MattermostService, NotificationRulesService],
})
export class MattermostModule {}
