import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { SubmitSelfAssessDto, AdminSubmitSelfAssessDto } from './self-assess.dto';

// Category display order + in-category skill order, mirrors docs/Skillset.md
// exactly (same source data as prisma/seed-skills.js). Anything in the DB
// that isn't in this list (a skill added later, an uncategorised one) sorts
// after the documented ones, alphabetically, so nothing goes missing.
const SKILL_ORDER: Record<string, string[]> = {
  'General Management Core Skills': [
    'Project Management', 'Conflict Management',
  ],
  'Creative Studio Project Manager Skills': [
    'Creative Translation', 'Subjective Feedback Management', 'Workflow Empathy',
    'Resource Allocation for Creatives', 'Scope & Budget Management',
    'Project Scheduling & Phasing', 'Risk Mitigation', 'Tool Proficiency',
    'Shielding the Team', 'Cheerleading & Morale Building',
    'Production Management', 'Client Servicing',
  ],
  'Creative Technologist Skills': [
    'Immersive & Spatial Computing', 'Creative Coding & Real-Time Graphics',
    'Artificial Intelligence (AI) Fluency', 'Physical Computing',
    'Web & App Development', 'Rapid Prototyping', 'Design Fluency & Storytelling',
    'Translation & Communication', 'Innovation Management',
    'Real-time / Unreal', 'Generative Art', 'Projection Mapping',
    'Technical Direction', 'Web Frontend', 'Web Backend', 'UI/UX Design',
    'Mobile Development', 'Data Visualisation',
  ],
  'Digital Content Creation & Animation Skills': [
    '3D Modeling', 'Rigging', 'Animation', 'VFX (Visual Effects)', 'Motion Design',
    'Concept Art', 'Compositing', 'Lighting', 'Texturing', 'Rendering',
    'Character Design', 'Environment Design', 'Video Editing', 'Color Grading',
    'Storyboarding', 'Illustration', 'Art Direction', 'Graphic Design',
  ],
  'Marketing & Growth Skills': [
    'Brand Strategy', 'Content Marketing', 'SEO & SEM', 'Social Media Strategy',
    'Data Analytics & Reporting', 'Campaign Management', 'Performance Marketing',
    'Email Marketing', 'Copywriting / Scriptwriting',
  ],
};
const CATEGORY_ORDER = Object.keys(SKILL_ORDER);

function indexOrLast(arr: string[], v: string) {
  const i = arr.indexOf(v);
  return i === -1 ? arr.length : i;
}

@Injectable()
export class SelfAssessService {
  constructor(private prisma: PrismaService) {}

  // Public endpoints ──────────────────────────────────────────────

  // Minimal person list — used by the admin-only "match to existing member" picker.
  listPeople() {
    return this.prisma.person.findMany({
      where:   { status: 'ACTIVE' },
      select:  { id: true, name: true, department: true },
      orderBy: { name: 'asc' },
    });
  }

  // Master skill list, sorted to match the category/skill order defined in
  // docs/Skillset.md rather than raw alphabetical order.
  async listSkills() {
    const skills = await this.prisma.skill.findMany({
      select: { id: true, name: true, category: true },
    });
    return skills.sort((a, b) => {
      const catA = a.category ?? '', catB = b.category ?? '';
      const co = indexOrLast(CATEGORY_ORDER, catA) - indexOrLast(CATEGORY_ORDER, catB);
      if (co !== 0) return co;
      const order = SKILL_ORDER[catA] || [];
      const so = indexOrLast(order, a.name) - indexOrLast(order, b.name);
      return so !== 0 ? so : a.name.localeCompare(b.name);
    });
  }

  // Submit a self-assessment from the public form — no Person match yet.
  // Sits as PENDING until an admin matches and approves it.
  async submit(dto: SubmitSelfAssessDto) {
    if (dto.ratings.length === 0) throw new BadRequestException('Rate at least one skill');

    return this.prisma.skillSelfAssessment.create({
      data: {
        submittedName:  dto.name,
        submittedEmail: dto.email,
        note:           dto.note ?? null,
        ratings: {
          create: dto.ratings.map(r => ({ skillId: r.skillId, rating: r.rating })),
        },
      },
      include: { ratings: true },
    });
  }

  // Admin-only submission — the admin already knows which Person this is,
  // so ratings are written straight into the system instead of queuing.
  async adminSubmit(dto: AdminSubmitSelfAssessDto) {
    if (dto.ratings.length === 0) throw new BadRequestException('Rate at least one skill');

    const person = await this.prisma.person.findUnique({ where: { id: dto.personId } });
    if (!person) throw new NotFoundException('Person not found');

    const assessment = await this.prisma.skillSelfAssessment.create({
      data: {
        personId:       dto.personId,
        submittedName:  dto.name,
        submittedEmail: dto.email,
        note:           dto.note ?? null,
        status:         'APPROVED',
        ratings: {
          create: dto.ratings.map(r => ({ skillId: r.skillId, rating: r.rating })),
        },
      },
      include: { ratings: true },
    });

    await this.applyRatings(dto.personId, assessment.ratings, assessment.note, 'Self-assessment (admin submitted)');
    return assessment;
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
  // If the submission wasn't matched to a Person at submit time, `personId`
  // must be supplied here to match and approve it in one step.
  async approve(id: string, personId?: string) {
    const assessment = await this.prisma.skillSelfAssessment.findUnique({
      where:   { id },
      include: { ratings: true },
    });
    if (!assessment) throw new NotFoundException('Assessment not found');
    if (assessment.status !== 'PENDING') throw new BadRequestException('Already reviewed');

    const targetPersonId = assessment.personId ?? personId;
    if (!targetPersonId) throw new BadRequestException('Select a person to match this submission to first');

    if (targetPersonId !== assessment.personId) {
      const person = await this.prisma.person.findUnique({ where: { id: targetPersonId } });
      if (!person) throw new NotFoundException('Person not found');
    }

    await this.applyRatings(targetPersonId, assessment.ratings, assessment.note, 'Self-assessment (admin approved)');

    await this.prisma.skillSelfAssessment.update({
      where: { id },
      data:  { status: 'APPROVED', personId: targetPersonId },
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

  // Shared by approve() and adminSubmit() — upserts each rated skill onto
  // the Person's record and logs the change in the ratings history.
  private async applyRatings(
    personId: string,
    ratings: { skillId: string; rating: number }[],
    note: string | null,
    changedBy: string,
  ) {
    await this.prisma.$transaction(async (tx) => {
      for (const r of ratings) {
        const existing = await tx.personSkill.findUnique({
          where: { personId_skillId: { personId, skillId: r.skillId } },
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
            data: { personId, skillId: r.skillId, rating: r.rating },
          });
          personSkillId = created.id;
        }

        await tx.skillRatingChange.create({
          data: {
            personSkillId,
            oldRating: existing?.rating ?? null,
            newRating: r.rating,
            source:    'MANUAL_ADJUSTMENT',
            changedBy,
            note:      note ?? 'Self-assessment',
          },
        });
      }
    });
  }
}
