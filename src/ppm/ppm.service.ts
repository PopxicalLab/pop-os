import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

// RM50 k is the midpoint for value normalisation: at or above = "high value".
// Adjust this constant as the studio's average project size changes.
const VALUE_MIDPOINT = 50_000;

// Complexity threshold: <= 3 is "manageable", 4–5 is "high effort".
const COMPLEXITY_THRESHOLD = 3;

export interface PpmBreakdown {
  valueScore:   number | null; // 0–100
  effortScore:  number | null; // 0–100  (high = easy / low complexity)
  tierScore:    number | null; // 0–100
  marginScore:  number | null; // 0–100
}

export interface PpmResult {
  projectId:           string;
  projectName:         string;
  currentQuadrant:     string;
  recommendedQuadrant: string | null; // null when value or complexity is missing
  score:               number | null; // 0–100 weighted aggregate, null when <2 inputs
  match:               boolean | null; // true = current matches recommendation
  breakdown:           PpmBreakdown;
  missingFields:       string[];
}

@Injectable()
export class PpmService {
  constructor(private prisma: PrismaService) {}

  async scoreProject(id: string): Promise<PpmResult> {
    const project = await this.prisma.project.findUnique({ where: { id } });
    if (!project) throw new NotFoundException(`Project ${id} not found`);
    return this.compute(project);
  }

  // Score all active projects in one call (used by the Projects tab badge list).
  async scoreAll(): Promise<PpmResult[]> {
    const projects = await this.prisma.project.findMany({
      where:   { status: { notIn: ['DELIVERED', 'CANCELLED'] } },
      orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
    });
    return projects.map(p => this.compute(p));
  }

  // Pure function — no DB calls — so tests can call it directly.
  compute(project: {
    id: string; name: string; quadrant: string;
    estimatedValue: number | null; complexityScore: number | null;
    clientTier: string | null;     marginTarget: number | null;
  }): PpmResult {
    const { estimatedValue, complexityScore, clientTier, marginTarget } = project;
    const missingFields: string[] = [];
    if (estimatedValue  == null) missingFields.push('estimatedValue');
    if (complexityScore == null) missingFields.push('complexityScore');
    if (!clientTier)             missingFields.push('clientTier');
    if (marginTarget    == null) missingFields.push('marginTarget');

    // Each component scores 0–100.
    // valueScore: RM0 → 0, RM50k → 50, RM100k+ → 100.
    const valueScore  = estimatedValue  != null
      ? Math.min((estimatedValue / VALUE_MIDPOINT) * 50, 100)
      : null;

    // effortScore: complexity 1 (simple) → 100, complexity 5 (very complex) → 0.
    const effortScore = complexityScore != null
      ? ((6 - complexityScore) / 5) * 100
      : null;

    const tierScore = clientTier != null
      ? ({ NEW: 20, RETURNING: 60, KEY_ACCOUNT: 100 } as Record<string, number>)[clientTier] ?? null
      : null;

    const marginScore = marginTarget != null
      ? Math.min((marginTarget / 100) * 100, 100)
      : null;

    // Weighted aggregate — skip components we don't have data for and
    // re-normalise the remaining weights so they still sum to 1.
    const components = [
      { score: valueScore,  w: 0.40 },
      { score: effortScore, w: 0.15 },
      { score: tierScore,   w: 0.25 },
      { score: marginScore, w: 0.20 },
    ];
    const available = components.filter(c => c.score != null);
    let score: number | null = null;
    if (available.length >= 2) {
      const totalW = available.reduce((s, c) => s + c.w, 0);
      score = Math.round(available.reduce((s, c) => s + c.score! * c.w, 0) / totalW);
    }

    // Quadrant recommendation: 2×2 matrix on value vs complexity.
    // Requires both axes — can't recommend without them.
    let recommendedQuadrant: string | null = null;
    if (estimatedValue != null && complexityScore != null) {
      const highValue = estimatedValue  >= VALUE_MIDPOINT;
      const lowEffort = complexityScore <= COMPLEXITY_THRESHOLD;
      if      ( highValue &&  lowEffort) recommendedQuadrant = 'GOLD';
      else if ( highValue && !lowEffort) recommendedQuadrant = 'STRATEGIC_BET';
      else if (!highValue &&  lowEffort) recommendedQuadrant = 'OPERATIONAL_FILLER';
      else                               recommendedQuadrant = 'DRAIN';
    }

    return {
      projectId:           project.id,
      projectName:         project.name,
      currentQuadrant:     project.quadrant,
      recommendedQuadrant,
      score,
      match: recommendedQuadrant != null ? recommendedQuadrant === project.quadrant : null,
      breakdown: { valueScore, effortScore, tierScore, marginScore },
      missingFields,
    };
  }
}
