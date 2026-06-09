import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma.service';
import { CreateUserDto, UpdateUserDto } from './user.dto';

const SAFE_SELECT = { id: true, email: true, name: true, role: true, active: true, personId: true, createdAt: true };

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.user.findMany({ select: SAFE_SELECT, orderBy: { name: 'asc' } });
  }

  async findOne(id: string) {
    const u = await this.prisma.user.findUnique({ where: { id }, select: SAFE_SELECT });
    if (!u) throw new NotFoundException(`User ${id} not found`);
    return u;
  }

  async create(dto: CreateUserDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email.toLowerCase() } });
    if (existing) throw new ConflictException('Email already in use');

    const hash = await bcrypt.hash(dto.password, 12);
    return this.prisma.user.create({
      data: { ...dto, email: dto.email.toLowerCase(), password: hash },
      select: SAFE_SELECT,
    });
  }

  async update(id: string, dto: UpdateUserDto) {
    await this.findOne(id);
    const data: any = { ...dto };
    if (dto.email) data.email = dto.email.toLowerCase();
    if (dto.password) data.password = await bcrypt.hash(dto.password, 12);
    return this.prisma.user.update({ where: { id }, data, select: SAFE_SELECT });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.user.delete({ where: { id }, select: SAFE_SELECT });
  }
}
