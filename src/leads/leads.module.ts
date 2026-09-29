import { Module } from '@nestjs/common';
import { LeadsController } from './leads.controller';
import { LeadsService } from './leads.service';
import { PrismaService } from '../prisma.service';
import { AuditModule } from '../audit/audit.module';
import { MattermostModule } from '../mattermost/mattermost.module';
import { PpmService } from '../ppm/ppm.service';

@Module({
  imports:     [AuditModule, MattermostModule],
  controllers: [LeadsController],
  providers:   [LeadsService, PrismaService, PpmService],
})
export class LeadsModule {}
