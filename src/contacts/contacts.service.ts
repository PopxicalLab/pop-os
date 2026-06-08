import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateContactDto, UpdateContactDto } from './contact.dto';

@Injectable()
export class ContactsService {
  constructor(private prisma: PrismaService) {}

  findAll(accountId?: string) {
    return this.prisma.contact.findMany({
      where:   accountId ? { accountId } : undefined,
      include: { account: { select: { id: true, name: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const c = await this.prisma.contact.findUnique({
      where:   { id },
      include: { account: { select: { id: true, name: true } } },
    });
    if (!c) throw new NotFoundException(`Contact ${id} not found`);
    return c;
  }

  create(dto: CreateContactDto) {
    return this.prisma.contact.create({
      data:    dto,
      include: { account: { select: { id: true, name: true } } },
    });
  }

  async update(id: string, dto: UpdateContactDto) {
    await this.findOne(id);
    return this.prisma.contact.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.contact.delete({ where: { id } });
  }
}
