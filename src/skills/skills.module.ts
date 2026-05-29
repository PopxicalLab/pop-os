import { Module } from '@nestjs/common';
import { SkillsController } from './skills.controller';
import { SkillsService } from './skills.service';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [SkillsController],
  providers: [SkillsService, PrismaService],
})
export class SkillsModule {}
