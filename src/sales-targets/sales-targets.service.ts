import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { UpsertSalesTargetDto } from './sales-target.dto';

@Injectable()
export class SalesTargetsService {
  constructor(private prisma: PrismaService) {}

  findAll(year?: number, quarter?: number) {
    return this.prisma.salesTarget.findMany({
      where: {
        ...(year    ? { year }    : {}),
        ...(quarter ? { quarter } : {}),
      },
      include: { person: { select: { id: true, name: true, company: true } } },
      orderBy: [{ year: 'desc' }, { quarter: 'asc' }],
    });
  }

  // Upsert — creates or updates the target for a given person/year/quarter.
  upsert(dto: UpsertSalesTargetDto) {
    return this.prisma.salesTarget.upsert({
      where:  { personId_year_quarter: { personId: dto.personId, year: dto.year, quarter: dto.quarter } },
      create: { personId: dto.personId, year: dto.year, quarter: dto.quarter, targetAmount: dto.targetAmount },
      update: { targetAmount: dto.targetAmount },
      include: { person: { select: { id: true, name: true } } },
    });
  }

  remove(id: string) {
    return this.prisma.salesTarget.delete({ where: { id } });
  }
}
