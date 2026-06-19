import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateProjectCostDto, UpdateProjectCostDto } from './project-cost.dto';

@Injectable()
export class ProjectCostsService {
  constructor(private prisma: PrismaService) {}

  findAll(projectId?: string) {
    return this.prisma.projectCost.findMany({
      where:   projectId ? { projectId } : undefined,
      orderBy: { createdAt: 'asc' },
    });
  }

  create(dto: CreateProjectCostDto) {
    return this.prisma.projectCost.create({ data: dto });
  }

  async update(id: string, dto: UpdateProjectCostDto) {
    const existing = await this.prisma.projectCost.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`ProjectCost ${id} not found`);
    return this.prisma.projectCost.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    const existing = await this.prisma.projectCost.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`ProjectCost ${id} not found`);
    return this.prisma.projectCost.delete({ where: { id } });
  }
}
