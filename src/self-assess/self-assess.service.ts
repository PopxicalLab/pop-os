import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { SubmitSelfAssessDto } from './self-assess.dto';

@Injectable()
export class SelfAssessService {
  constructor(private prisma: PrismaService) {}

  // Public endpoints ──────────────────────────────────────────────

  // Minimal person list for the name picker on the public form.
  listPeople() {
    return this.prisma.person.findMany({
      where:   { status: 'ACTIVE' },
      select:  { id: true, name: true, department: true },
      orderBy: { name: 'asc' },
    });
  }

  // Master skill list (grouped in frontend via category field).
  listSkills() {
    return this.prisma.skill.findMany({
      select:  { id: true, name: true, category: true },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });
  }

  // Submit a self-assessment from the public form.
  async submit(dto: SubmitSelfAssessDto) {
    const person = await this.prisma.person.findUnique({ where: { id: dto.personId } });
    if (!person) throw new NotFoundException('Person not found');
    if (dto.ratings.length === 0) throw new BadRequestException('Rate at least one skill');

    return this.prisma.skillSelfAssessment.create({
      data: {
        personId: dto.personId,
        note:     dto.note ?? null,
        ratings: {
          create: dto.ratings.map(r => ({ skillId: r.skillId, rating: r.rating })),
        },
      },
      include: { ratings: true },
    });
  }

  // Admin endpoints ───────────────────────────────────────────────

  // All submissions, newest first.
  findAll() {
    return this.prisma.skillSelfAssessment.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        person:  { select: { id: true, name: true, department: true } },
        ratings: { include: { skill: { select: { id: true, name: true, category: true } } } },
      },
    });
  }

  // Approve: write ratings into PersonSkill + SkillRatingChange, then mark APPROVED.
  async approve(id: string) {
    const assessment = await this.prisma.skillSelfAssessment.findUnique({
      where:   { id },
      include: { ratings: true },
    });
    if (!assessment) throw new NotFoundException('Assessment not found');
    if (assessment.status !== 'PENDING') throw new BadRequestException('Already reviewed');

    await this.prisma.$transaction(async (tx) => {
      for (const r of assessment.ratings) {
        // Upsert PersonSkill (create if first time, update rating if exists)
        const existing = await tx.personSkill.findUnique({
          where: { personId_skillId: { personId: assessment.personId, skillId: r.skillId } },
        });

        let personSkillId: string;
        if (existing) {
          const updated = await tx.personSkill.update({
            where: { id: existing.id },
            data:  { rating: r.rating },
          });
          personSkillId = updated.id;
        } else {
          const created = await tx.personSkill.create({
            data: { personId: assessment.personId, skillId: r.skillId, rating: r.rating },
          });
          personSkillId = created.id;
        }

        // Log the change in audit trail
        await tx.skillRatingChange.create({
          data: {
            personSkillId,
            oldRating: existing?.rating ?? null,
            newRating: r.rating,
            source:    'MANUAL_ADJUSTMENT',
            changedBy: 'Self-assessment (admin approved)',
            note:      assessment.note ?? 'Approved self-assessment',
          },
        });
      }

      await tx.skillSelfAssessment.update({
        where: { id },
        data:  { status: 'APPROVED' },
      });
    });

    return { status: 'APPROVED' };
  }

  // Reject: just mark REJECTED, no ratings written.
  async reject(id: string) {
    const assessment = await this.prisma.skillSelfAssessment.findUnique({ where: { id } });
    if (!assessment) throw new NotFoundException('Assessment not found');
    if (assessment.status !== 'PENDING') throw new BadRequestException('Already reviewed');

    await this.prisma.skillSelfAssessment.update({
      where: { id },
      data:  { status: 'REJECTED' },
    });
    return { status: 'REJECTED' };
  }
}
