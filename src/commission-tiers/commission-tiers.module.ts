import { Module } from '@nestjs/common';
import { CommissionTiersController } from './commission-tiers.controller';
import { CommissionTiersService } from './commission-tiers.service';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [CommissionTiersController],
  providers:   [CommissionTiersService, PrismaService],
})
export class CommissionTiersModule {}
