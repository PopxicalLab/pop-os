import { Module } from '@nestjs/common';
import { PpmController } from './ppm.controller';
import { PpmService } from './ppm.service';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [PpmController],
  providers:   [PpmService, PrismaService],
})
export class PpmModule {}
