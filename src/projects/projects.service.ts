import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateProjectDto, UpdateProjectDto } from './project.dto';

// Fields we always include when returning a project — producer and PM names.
const WITH_PEOPLE = {
  producer: { select: { id: true, name: true, role: true } },
  pm:       { select: { id: true, name: true, role: true } },
} as const;

@Injectable()
export class ProjectsService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.project.findMany({
      orderBy: { createdAt: 'desc' },
      include: WITH_PEOPLE,
    });
  }

  async findOne(id: string) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: WITH_PEOPLE,
    });
    if (!project) throw new NotFoundException(`Project ${id} not found`);
    return project;
  }

  create(dto: CreateProjectDto) {
    return this.prisma.project.create({
      data: {
        name:        dto.name,
        client:      dto.client,
        quadrant:    dto.quadrant,
        priority:    dto.priority    ?? 'P2',
        status:      dto.status      ?? 'BRIEF',
        deadline:    dto.deadline    ? new Date(dto.deadline) : undefined,
        producerId:  dto.producerId  ?? null,
        pmId:        dto.pmId        ?? null,
        drainApprovedByExec:     dto.drainApprovedByExec     ?? false,
        drainApprovedByProducer: dto.drainApprovedByProducer ?? false,
        estimatedValue:    dto.estimatedValue    ?? null,
        estimatedDuration: dto.estimatedDuration ?? null,
        complexityScore:   dto.complexityScore   ?? null,
        clientTier:        dto.clientTier        ?? null,
        marginTarget:      dto.marginTarget      ?? null,
      },
      include: WITH_PEOPLE,
    });
  }

  async update(id: string, dto: UpdateProjectDto) {
    await this.findOne(id);
    return this.prisma.project.update({
      where: { id },
      data: {
        ...dto,
        deadline: dto.deadline ? new Date(dto.deadline) : undefined,
      },
      include: WITH_PEOPLE,
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.project.delete({ where: { id } });
  }
}
