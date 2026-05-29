import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateSkillDto, AssignSkillDto, ChangeRatingDto } from './skill.dto';

@Injectable()
export class SkillsService {
  constructor(private prisma: PrismaService) {}

  // ── Master skill list ─────────────────────────────────────────
  listSkills() {
    return this.prisma.skill.findMany({ orderBy: { name: 'asc' } });
  }

  async createSkill(dto: CreateSkillDto) {
    const existing = await this.prisma.skill.findUnique({
      where: { name: dto.name },
    });
    if (existing) throw new ConflictException(`Skill "${dto.name}" already exists`);
    return this.prisma.skill.create({ data: { name: dto.name } });
  }

  // ── Assign a skill to a person at a starting rating ───────────
  async assignSkill(personId: string, dto: AssignSkillDto) {
    const person = await this.prisma.person.findUnique({ where: { id: personId } });
    if (!person) throw new NotFoundException(`Person ${personId} not found`);

    const skill = await this.prisma.skill.findUnique({ where: { id: dto.skillId } });
    if (!skill) throw new NotFoundException(`Skill ${dto.skillId} not found`);

    const dup = await this.prisma.personSkill.findUnique({
      where: { personId_skillId: { personId, skillId: dto.skillId } },
    });
    if (dup) {
      throw new ConflictException(
        `${person.name} already has ${skill.name}. Use the change-rating action instead.`,
      );
    }

    // Create the live rating AND its first history row together.
    return this.prisma.personSkill.create({
      data: {
        personId,
        skillId: dto.skillId,
        rating: dto.rating,
        history: {
          create: {
            oldRating: null, // first entry has no "previous"
            newRating: dto.rating,
            source: dto.source ?? 'INTERVIEW',
            changedBy: dto.changedBy,
            note: dto.note,
          },
        },
      },
      include: { skill: true, history: true },
    });
  }

  // ── Change an existing rating (writes a history row) ──────────
  async changeRating(personSkillId: string, dto: ChangeRatingDto) {
    const ps = await this.prisma.personSkill.findUnique({
      where: { id: personSkillId },
    });
    if (!ps) throw new NotFoundException(`Skill assignment ${personSkillId} not found`);

    // Update the live score and log the movement in one transaction,
    // so the current rating and its history can never drift apart.
    const [updated] = await this.prisma.$transaction([
      this.prisma.personSkill.update({
        where: { id: personSkillId },
        data: { rating: dto.newRating },
        include: { skill: true },
      }),
      this.prisma.skillRatingChange.create({
        data: {
          personSkillId,
          oldRating: ps.rating,
          newRating: dto.newRating,
          source: dto.source,
          changedBy: dto.changedBy,
          note: dto.note,
        },
      }),
    ]);
    return updated;
  }

  // ── Full history for one person-skill ─────────────────────────
  history(personSkillId: string) {
    return this.prisma.skillRatingChange.findMany({
      where: { personSkillId },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ── Remove a skill from a person ──────────────────────────────
  async removeAssignment(personSkillId: string) {
    const ps = await this.prisma.personSkill.findUnique({ where: { id: personSkillId } });
    if (!ps) throw new NotFoundException(`Skill assignment ${personSkillId} not found`);
    return this.prisma.personSkill.delete({ where: { id: personSkillId } });
  }
}
