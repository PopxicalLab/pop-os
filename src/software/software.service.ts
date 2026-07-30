import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateSoftwareDto, UpdateSoftwareDto } from './software.dto';

@Injectable()
export class SoftwareService {
  constructor(private prisma: PrismaService) {}

  // ── master list ──────────────────────────────────────────────

  findAll() {
    return this.prisma.software.findMany({ orderBy: [{ category: 'asc' }, { name: 'asc' }] });
  }

  async create(dto: CreateSoftwareDto) {
    const exists = await this.prisma.software.findUnique({ where: { name: dto.name } });
    if (exists) throw new ConflictException(`Software "${dto.name}" already exists`);
    return this.prisma.software.create({ data: { name: dto.name, category: dto.category ?? null } });
  }

  async update(id: string, dto: UpdateSoftwareDto) {
    await this.findOne(id);
    return this.prisma.software.update({
      where: { id },
      data: {
        ...(dto.name     !== undefined && { name: dto.name }),
        ...(dto.category !== undefined && { category: dto.category || null }),
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.software.delete({ where: { id } });
  }

  async findOne(id: string) {
    const s = await this.prisma.software.findUnique({ where: { id } });
    if (!s) throw new NotFoundException(`Software ${id} not found`);
    return s;
  }

  // ── person tagging ───────────────────────────────────────────

  async tagPerson(personId: string, softwareId: string) {
    // Verify both exist
    const person = await this.prisma.person.findUnique({ where: { id: personId } });
    if (!person) throw new NotFoundException(`Person ${personId} not found`);
    await this.findOne(softwareId);

    const exists = await this.prisma.personSoftware.findUnique({
      where: { personId_softwareId: { personId, softwareId } },
    });
    if (exists) throw new ConflictException('Person already tagged with this software');

    return this.prisma.personSoftware.create({
      data: { personId, softwareId },
      include: { software: true },
    });
  }

  async untagPerson(personId: string, softwareId: string) {
    const row = await this.prisma.personSoftware.findUnique({
      where: { personId_softwareId: { personId, softwareId } },
    });
    if (!row) throw new NotFoundException('Tag not found');
    return this.prisma.personSoftware.delete({
      where: { personId_softwareId: { personId, softwareId } },
    });
  }
}
