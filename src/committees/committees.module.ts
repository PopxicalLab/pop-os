import { Module } from '@nestjs/common';
import { CommitteesController } from './committees.controller';
import { CommitteesService } from './committees.service';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [CommitteesController],
  providers:   [CommitteesService, PrismaService],
})
export class CommitteesModule {}
