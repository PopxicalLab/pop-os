import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

function toMonday(d: Date): Date {
  const day  = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  const mon  = new Date(d);
  mon.setUTCDate(d.getUTCDate() + diff);
  mon.setUTCHours(0, 0, 0, 0);
  return mon;
}

@Injectable()
export class StaffingService {
  constructor(private prisma: PrismaService) {}

  // For a given project + week, return all active staff ranked by availability.
  // Skills are included so the producer can see fit at a glance.
  async recommend(projectId: string, weekStr?: string) {
    const weekStart = weekStr ? toMonday(new Date(weekStr)) : toMonday(new Date());

    const project = await this.prisma.project.findUnique({
      where:  { id: projectId },
      select: { id: true, name: true, quadrant: true, priority: true, company: true, status: true },
    });
    if (!project) throw new NotFoundException(`Project ${projectId} not found`);

    const [people, allocations] = await Promise.all([
      this.prisma.person.findMany({
        where:   { warmPool: false }, // warm-pool / alumni not available for scheduling
        include: {
          skills: {
            include: { skill: true },
            orderBy: { rating: 'desc' }, // strongest skills first
          },
        },
        orderBy: { name: 'asc' },
      }),
      // All allocations for this week so we can tally up each person's committed %.
      this.prisma.capacity.findMany({
        where:  { weekStart },
        select: { personId: true, projectId: true, pctWeek: true },
      }),
    ]);

    // Sum committed % per person.
    const committed: Record<string, number> = {};
    for (const a of allocations) {
      committed[a.personId] = (committed[a.personId] || 0) + a.pctWeek;
    }

    // People already assigned to THIS project this week (handy context for the UI).
    const alreadyAssigned = new Set(
      allocations.filter(a => a.projectId === projectId).map(a => a.personId),
    );

    const candidates = people
      .map(p => ({
        person: {
          id:      p.id,
          name:    p.name,
          role:    p.role,
          company: p.company,
        },
        allocatedPct:    committed[p.id] || 0,
        availablePct:    Math.max(0, 100 - (committed[p.id] || 0)),
        alreadyAssigned: alreadyAssigned.has(p.id),
        skills: p.skills.map(s => ({ name: s.skill.name, rating: s.rating })),
      }))
      .sort((a, b) => {
        // Already-assigned people surface first so the board tells you what's happening.
        if (a.alreadyAssigned !== b.alreadyAssigned) return a.alreadyAssigned ? -1 : 1;
        // Then most available.
        return b.availablePct - a.availablePct;
      });

    return { project, weekStart, candidates };
  }
}
