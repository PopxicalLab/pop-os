import {
  Injectable, NotFoundException, BadRequestException, ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateCapacityDto, UpdateCapacityDto } from './capacity.dto';

// Snap any date to the Monday of its ISO week at UTC midnight.
// This is the canonical weekStart stored in the DB so queries always match.
function toMonday(d: Date): Date {
  const day  = d.getUTCDay();            // 0 = Sun, 1 = Mon … 6 = Sat
  const diff = day === 0 ? -6 : 1 - day; // roll back to Monday
  const mon  = new Date(d);
  mon.setUTCDate(d.getUTCDate() + diff);
  mon.setUTCHours(0, 0, 0, 0);
  return mon;
}

// Fields included on every returned capacity entry.
const WITH_DETAILS = {
  person:  { select: { id: true, name: true, role: true } },
  project: { select: { id: true, name: true, quadrant: true, priority: true } },
} as const;

@Injectable()
export class CapacityService {
  constructor(private prisma: PrismaService) {}

  // Return all allocations for a given week.
  // If weekStr is omitted, default to the current week.
  findByWeek(weekStr?: string) {
    const weekStart = weekStr ? toMonday(new Date(weekStr)) : toMonday(new Date());
    return this.prisma.capacity.findMany({
      where: { weekStart },
      include: WITH_DETAILS,
      orderBy: [
        { person: { name: 'asc' } },
        { pctWeek: 'desc' },
      ],
    });
  }

  async findOne(id: string) {
    const entry = await this.prisma.capacity.findUnique({
      where: { id },
      include: WITH_DETAILS,
    });
    if (!entry) throw new NotFoundException(`Capacity entry ${id} not found`);
    return entry;
  }

  async create(dto: CreateCapacityDto) {
    const weekStart = toMonday(new Date(dto.weekStart));

    // Guard: this person-project-week combo must not already exist.
    const clash = await this.prisma.capacity.findUnique({
      where: { personId_projectId_weekStart: { personId: dto.personId, projectId: dto.projectId, weekStart } },
    });
    if (clash) throw new ConflictException('This person is already allocated to this project for that week.');

    // Guard: a person's total across all projects cannot exceed 100% in a week.
    const existing = await this.prisma.capacity.findMany({
      where: { personId: dto.personId, weekStart },
      select: { pctWeek: true },
    });
    const currentTotal = existing.reduce((sum, e) => sum + e.pctWeek, 0);
    if (currentTotal + dto.pctWeek > 100) {
      throw new BadRequestException(
        `Adding ${dto.pctWeek}% would take this person to ${currentTotal + dto.pctWeek}% this week (max 100%).`,
      );
    }

    return this.prisma.capacity.create({
      data: {
        personId:  dto.personId,
        projectId: dto.projectId,
        weekStart,
        role:      dto.role,
        pctWeek:   dto.pctWeek,
      },
      include: WITH_DETAILS,
    });
  }

  async update(id: string, dto: UpdateCapacityDto) {
    const entry = await this.findOne(id);

    // If changing pctWeek, re-check the person's total excluding this entry.
    if (dto.pctWeek !== undefined) {
      const others = await this.prisma.capacity.findMany({
        where: { personId: entry.personId, weekStart: entry.weekStart, NOT: { id } },
        select: { pctWeek: true },
      });
      const othersTotal = others.reduce((sum, e) => sum + e.pctWeek, 0);
      if (othersTotal + dto.pctWeek > 100) {
        throw new BadRequestException(
          `Changing to ${dto.pctWeek}% would put this person at ${othersTotal + dto.pctWeek}% this week (max 100%).`,
        );
      }
    }

    return this.prisma.capacity.update({
      where: { id },
      data: dto,
      include: WITH_DETAILS,
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.capacity.delete({ where: { id } });
  }
}
