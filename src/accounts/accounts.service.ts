import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateAccountDto, UpdateAccountDto } from './account.dto';

@Injectable()
export class AccountsService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.account.findMany({
      include: {
        _count: { select: { leads: true, projects: true, contacts: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const account = await this.prisma.account.findUnique({
      where: { id },
      include: {
        contacts: { orderBy: { name: 'asc' } },
        leads:    { orderBy: { createdAt: 'desc' } },
        projects: {
          include: { producer: { select: { id: true, name: true } } },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!account) throw new NotFoundException(`Account ${id} not found`);
    return account;
  }

  async create(dto: CreateAccountDto) {
    const clash = await this.prisma.account.findFirst({ where: { name: dto.name } });
    if (clash) throw new ConflictException(`Account "${dto.name}" already exists`);
    return this.prisma.account.create({ data: dto });
  }

  async update(id: string, dto: UpdateAccountDto) {
    await this.findOne(id);
    return this.prisma.account.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.account.delete({ where: { id } });
  }
}
