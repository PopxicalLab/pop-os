import { Module } from '@nestjs/common';
import { ChangeRequestsController } from './change-requests.controller';
import { ChangeRequestsService } from './change-requests.service';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [ChangeRequestsController],
  providers:   [ChangeRequestsService, PrismaService],
})
export class ChangeRequestsModule {}
