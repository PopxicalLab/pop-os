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

  // ── AI recommendation via k-Nearest Neighbours ───────────────
  // Learns from every past project where a producer confirmed the quadrant/priority.
  // Requires at least 3 projects with PPM data before activating.
  async aiRecommend(params: {
    estimatedValue?:  number | null;
    complexityScore?: number | null;
    clientTier?:      string | null;
    marginTarget?:    number | null;
    excludeId?:       string;           // don't include the project being edited
  }) {
    const TIER_NUM: Record<string, number> = { NEW: 0.2, RETURNING: 0.6, KEY_ACCOUNT: 1.0 };

    // Training set: all projects that at least have value + complexity.
    const training = await this.prisma.project.findMany({
      where: {
        id:             params.excludeId ? { not: params.excludeId } : undefined,
        estimatedValue:  { not: null },
        complexityScore: { not: null },
      },
      select: {
        id: true, name: true, quadrant: true, priority: true,
        estimatedValue: true, complexityScore: true,
        clientTier: true, marginTarget: true,
      },
    });

    if (training.length < 3) {
      return {
        source: 'insufficient' as const,
        trainingSize: training.length,
        recommendedQuadrant: null, recommendedPriority: null,
        confidence: null, neighbours: [],
      };
    }

    // Convert each project into a normalised feature vector [value, effort, tier, margin].
    // Slots are null when data is missing — distance is computed only over shared slots.
    const toFeatures = (v: number | null, c: number | null, t: string | null, m: number | null) => [
      v != null ? Math.min(v / VALUE_MIDPOINT, 2) / 2 : null,  // 0–1, capped at 2× midpoint
      c != null ? (6 - c) / 5                          : null,  // complexity 1→1.0, 5→0.2
      t != null ? (TIER_NUM[t] ?? 0.5)                : null,
      m != null ? m / 100                              : null,
    ];
    // Same weights as the PPM scoring formula.
    const WEIGHTS = [0.40, 0.15, 0.25, 0.20];

    const queryFeat = toFeatures(
      params.estimatedValue  ?? null,
      params.complexityScore ?? null,
      params.clientTier      ?? null,
      params.marginTarget    ?? null,
    );

    // Compute weighted Euclidean distance, skipping dimensions where either side is null.
    const withSim = training.map(p => {
      const pf = toFeatures(p.estimatedValue, p.complexityScore, p.clientTier, p.marginTarget);
      const pairs = pf
        .map((f, i) => ({ f, q: queryFeat[i], w: WEIGHTS[i] }))
        .filter(x => x.f != null && x.q != null);
      if (!pairs.length) return { ...p, similarity: 0 };
      const totalW = pairs.reduce((s, x) => s + x.w, 0);
      const dist   = Math.sqrt(pairs.reduce((s, x) => s + x.w * (x.f! - x.q!) ** 2, 0) / totalW);
      return { ...p, similarity: Math.round((1 - Math.min(dist, 1)) * 100) / 100 };
    }).sort((a, b) => b.similarity - a.similarity);

    // Take top K neighbours and use similarity-weighted voting.
    const K          = Math.min(5, training.length);
    const neighbours = withSim.slice(0, K);

    const vote = (field: 'quadrant' | 'priority') => {
      const tally: Record<string, number> = {};
      for (const n of neighbours)
        tally[n[field]] = (tally[n[field]] || 0) + n.similarity;
      return Object.entries(tally).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    };

    const topSim     = neighbours[0]?.similarity ?? 0;
    const confidence = topSim > 0.85 ? 'high' : topSim > 0.60 ? 'medium' : 'low';

    return {
      source:              'ai' as const,
      trainingSize:        training.length,
      recommendedQuadrant: vote('quadrant'),
      recommendedPriority: vote('priority'),
      confidence,
      neighbours: neighbours.map(n => ({
        name:       n.name,
        quadrant:   n.quadrant,
        priority:   n.priority,
        similarity: n.similarity,
      })),
    };
  }
}
