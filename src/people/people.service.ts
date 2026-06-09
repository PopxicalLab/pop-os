// The SERVICE holds the logic: it talks to the database via Prisma.
// (The controller, next file, handles the web requests and calls these.)
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreatePersonDto, UpdatePersonDto } from './person.dto';

@Injectable()
export class PeopleService {
  constructor(private prisma: PrismaService) {}

  // List everyone, newest first, with their rated skills and login status.
  findAll() {
    return this.prisma.person.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        skills: { include: { skill: true } },
        // Include safe user fields only — never expose password
        user: { select: { id: true, email: true, role: true, active: true } },
      },
    });
  }

  // Get one person by id, or throw a clean 404 if not found.
  async findOne(id: string) {
    const person = await this.prisma.person.findUnique({
      where: { id },
      include: {
        skills: { include: { skill: true } },
        user: { select: { id: true, email: true, role: true, active: true } },
      },
    });
    if (!person) throw new NotFoundException(`Person ${id} not found`);
    return person;
  }

  // Create a new person.
  create(dto: CreatePersonDto) {
    return this.prisma.person.create({
      data: {
        name: dto.name,
        role: dto.role,
        department: dto.department,
        startDate: new Date(dto.startDate),
        employmentType: dto.employmentType ?? 'FULL_TIME',
        warmPool: dto.warmPool ?? false,
        company: dto.company ?? null,
        salary: dto.salary ?? null,
      },
    });
  }

  // Update an existing person.
  async update(id: string, dto: UpdatePersonDto) {
    await this.findOne(id); // ensures it exists (throws 404 otherwise)
    return this.prisma.person.update({
      where: { id },
      data: {
        ...dto,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
      },
    });
  }

  // Delete a person.
  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.person.delete({ where: { id } });
  }
}
