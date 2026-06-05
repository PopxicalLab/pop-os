import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateAssetDto, UpdateAssetDto } from './asset.dto';

// Always include the project name so the frontend can display context.
const WITH_PROJECT = {
  project: { select: { id: true, name: true, company: true } },
} as const;

@Injectable()
export class AssetsService {
  constructor(private prisma: PrismaService) {}

  // List all assets, optionally filtered to one project.
  findAll(projectId?: string) {
    return this.prisma.asset.findMany({
      where:   projectId ? { projectId } : undefined,
      include: WITH_PROJECT,
      orderBy: [{ projectId: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async findOne(id: string) {
    const asset = await this.prisma.asset.findUnique({
      where: { id }, include: WITH_PROJECT,
    });
    if (!asset) throw new NotFoundException(`Asset ${id} not found`);
    return asset;
  }

  create(dto: CreateAssetDto) {
    return this.prisma.asset.create({
      data: {
        name:        dto.name,
        description: dto.description  ?? null,
        projectId:   dto.projectId,
        stage:       dto.stage        ?? 'BRIEF',
        cdSignedOff: dto.cdSignedOff  ?? false,
        changedBy:   dto.changedBy    ?? null,
      },
      include: WITH_PROJECT,
    });
  }

  async update(id: string, dto: UpdateAssetDto) {
    await this.findOne(id);
    return this.prisma.asset.update({
      where:   { id },
      data:    dto,
      include: WITH_PROJECT,
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.asset.delete({ where: { id } });
  }
}
