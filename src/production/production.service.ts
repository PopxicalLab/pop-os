import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

// Each PPM quadrant maps to a named workflow lane with its own operating rules.
// These are fixed business rules — they don't live in the DB.
export const LANE_META: Record<string, {
  name: string;
  description: string;
  guidance: string[];
  colorKey: string; // used by the frontend for styling
}> = {
  GOLD: {
    name: 'Template Factory',
    colorKey: 'gold',
    description: 'High value, manageable complexity. Move fast using proven processes.',
    guidance: [
      'Brief-to-kickoff within 48 hours',
      'Use existing SOP templates — no reinvention',
      'CD reviews at Internal Review gate only',
      'Single revision round; scope-lock before production',
    ],
  },
  STRATEGIC_BET: {
    name: 'Innovation Lab',
    colorKey: 'emerald',
    description: 'High value, high complexity. Invest time — involve CD from the start.',
    guidance: [
      'Extended brief phase (minimum 1 week)',
      'CD joins the kickoff meeting',
      'Weekly producer check-ins throughout',
      'Two internal review rounds expected',
    ],
  },
  OPERATIONAL_FILLER: {
    name: 'Automated Stream',
    colorKey: 'sky',
    description: 'Lower value, manageable complexity. Keep lean — self-serve where possible.',
    guidance: [
      'PM manages independently; no weekly check-ins needed',
      'Single internal review round',
      'Director sign-off not required unless client requests',
      'Batch similar briefs where possible to save setup time',
    ],
  },
  DRAIN: {
    name: 'Gated Review',
    colorKey: 'warm',
    description: 'High risk — low return, high effort. Both approvals required before any work starts.',
    guidance: [
      'Exec + Producer BOTH approve before production begins',
      'Scope locked in writing before kickoff',
      'Weekly cost review against budget',
      'First sign of scope creep → escalate to Producer immediately',
    ],
  },
};

@Injectable()
export class ProductionService {
  constructor(private prisma: PrismaService) {}

  async getLanes() {
    const projects = await this.prisma.project.findMany({
      where:   { status: { notIn: ['DELIVERED', 'CANCELLED'] } },
      include: {
        producer: { select: { id: true, name: true } },
        pm:       { select: { id: true, name: true } },
        assets:   { select: { id: true, stage: true } },
      },
      orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
    });

    // Group projects into their lane and attach lane metadata.
    return Object.entries(LANE_META).map(([quadrant, meta]) => ({
      quadrant,
      ...meta,
      projects: projects.filter(p => p.quadrant === quadrant),
    }));
  }
}
