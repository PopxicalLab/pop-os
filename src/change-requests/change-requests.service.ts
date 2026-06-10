import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateChangeRequestDto, UpdateChangeRequestDto } from './change-request.dto';

// Always include the project name so the frontend can display context.
const WITH_PROJECT = {
  project: { select: { id: true, name: true, company: true } },
} as const;

@Injectable()
export class ChangeRequestsService {
  constructor(private prisma: PrismaService) {}

  // List all CRs, optionally filtered by project and/or status.
  findAll(projectId?: string, status?: string) {
    return this.prisma.changeRequest.findMany({
      where: {
        ...(projectId ? { projectId }       : {}),
        ...(status    ? { status: status as any } : {}),
      },
      include: WITH_PROJECT,
      orderBy: [{ createdAt: 'desc' }],
    });
  }

  async findOne(id: string) {
    const cr = await this.prisma.changeRequest.findUnique({
      where: { id }, include: WITH_PROJECT,
    });
    if (!cr) throw new NotFoundException(`Change request ${id} not found`);
    return cr;
  }

  create(dto: CreateChangeRequestDto) {
    return this.prisma.changeRequest.create({
      data: {
        title:        dto.title,
        description:  dto.description,
        projectId:    dto.projectId,
        budgetImpact: dto.budgetImpact ?? 0,
        requestedBy:  dto.requestedBy  ?? null,
      },
      include: WITH_PROJECT,
    });
  }

  async update(id: string, dto: UpdateChangeRequestDto) {
    await this.findOne(id);
    return this.prisma.changeRequest.update({
      where:   { id },
      data:    dto,
      include: WITH_PROJECT,
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.changeRequest.delete({ where: { id } });
  }
}
