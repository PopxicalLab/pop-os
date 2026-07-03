import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { PrismaService } from '../prisma.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports:     [NotificationsModule, AuditModule],
  controllers: [UsersController],
  providers:   [UsersService, PrismaService],
})
export class UsersModule {}
