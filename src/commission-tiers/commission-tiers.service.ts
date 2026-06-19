import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { UpdateCommissionTierDto } from './commission-tier.dto';

@Injectable()
export class CommissionTiersService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.commissionTier.findMany({ orderBy: { threshold: 'asc' } });
  }

  async update(id: string, dto: UpdateCommissionTierDto) {
    const existing = await this.prisma.commissionTier.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`CommissionTier ${id} not found`);
    return this.prisma.commissionTier.update({ where: { id }, data: dto });
  }
}
