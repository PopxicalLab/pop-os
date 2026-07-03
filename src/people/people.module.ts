// A MODULE bundles related pieces together. This one groups the
// people controller (URLs) with the people service (logic).
import { Module } from '@nestjs/common';
import { PeopleController } from './people.controller';
import { PeopleService } from './people.service';
import { PrismaService } from '../prisma.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports:     [NotificationsModule, AuditModule],
  controllers: [PeopleController],
  providers:   [PeopleService, PrismaService],
})
export class PeopleModule {}
