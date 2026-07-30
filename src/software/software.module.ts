import { Module } from '@nestjs/common';
import { SoftwareController } from './software.controller';
import { SoftwareService } from './software.service';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [SoftwareController],
  providers:   [SoftwareService, PrismaService],
})
export class SoftwareModule {}
