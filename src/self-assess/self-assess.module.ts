import { Module } from '@nestjs/common';
import { SelfAssessController } from './self-assess.controller';
import { SelfAssessService } from './self-assess.service';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [SelfAssessController],
  providers:   [SelfAssessService, PrismaService],
})
export class SelfAssessModule {}
