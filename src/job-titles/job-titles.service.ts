import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateJobTitleDto } from './job-title.dto';

@Injectable()
export class JobTitlesService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.jobTitle.findMany({ orderBy: { name: 'asc' } });
  }

  async create(dto: CreateJobTitleDto) {
    const existing = await this.prisma.jobTitle.findUnique({ where: { name: dto.name } });
    if (existing) throw new ConflictException(`Job title "${dto.name}" already exists`);
    return this.prisma.jobTitle.create({ data: { name: dto.name } });
  }

  async remove(id: string) {
    const jt = await this.prisma.jobTitle.findUnique({ where: { id } });
    if (!jt) throw new NotFoundException(`Job title ${id} not found`);
    return this.prisma.jobTitle.delete({ where: { id } });
  }
}
