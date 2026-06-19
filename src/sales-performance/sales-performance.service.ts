import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

// Returns the UTC start and end of a calendar quarter.
function quarterRange(year: number, quarter: number): { start: Date; end: Date } {
  const startMonth = (quarter - 1) * 3;
  return {
    start: new Date(Date.UTC(year, startMonth, 1)),
    end:   new Date(Date.UTC(year, startMonth + 3, 1)),
  };
}

// Returns Jan 1 of year through end of today UTC.
function ytdRange(year: number): { start: Date; end: Date } {
  const now = new Date();
  return {
    start: new Date(Date.UTC(year, 0, 1)),
    end:   new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)),
  };
}

@Injectable()
export class SalesPerformanceService {
  constructor(private prisma: PrismaService) {}

  async getPerformance(year: number, quarter?: number) {
    const { start, end } = quarter ? quarterRange(year, quarter) : ytdRange(year);
    const quarters = quarter ? [quarter] : [1, 2, 3, 4];

    // Load tiers once — used to determine applicable commission rate.
    const tiers = await this.prisma.commissionTier.findMany({ orderBy: { threshold: 'asc' } });

    // All WON leads in the period with their closer, estimated value, and project costs.
    const leads = await this.prisma.lead.findMany({
      where: {
        status:    'WON',
        wonAt:     { gte: start, lt: end },
        closedById: { not: null },
      },
      select: {
        id:             true,
        name:           true,
        estimatedValue: true,
        closedById:     true,
        closedBy:       { select: { id: true, name: true, company: true } },
        // Project costs are stored on the linked project.
        project: {
          select: {
            id:    true,
            name:  true,
            costs: { select: { id: true, description: true, amount: true, costType: true } },
          },
        },
      },
    });

    // Sales targets for the period (all quarters if YTD).
    const targets = await this.prisma.salesTarget.findMany({
      where: { year, quarter: { in: quarters } },
      include: { person: { select: { id: true, name: true, company: true } } },
    });

    // Group leads by producer.
    const byProducer = new Map<string, {
      person:    any;
      revenue:   number;
      costs:     number;
      leadCount: number;
      deals:     any[];
    }>();

    for (const lead of leads) {
      if (!lead.closedById || !lead.closedBy) continue;
      const pid = lead.closedById;
      if (!byProducer.has(pid)) {
        byProducer.set(pid, { person: lead.closedBy, revenue: 0, costs: 0, leadCount: 0, deals: [] });
      }
      const entry      = byProducer.get(pid)!;
      const dealValue  = lead.estimatedValue ?? 0;
      const dealCosts  = lead.project?.costs.reduce((s, c) => s + c.amount, 0) ?? 0;

      entry.revenue   += dealValue;
      entry.costs     += dealCosts;
      entry.leadCount += 1;
      entry.deals.push({
        id:       lead.id,
        name:     lead.name,
        value:    dealValue,
        costs:    dealCosts,
        project:  lead.project ? { id: lead.project.id, name: lead.project.name } : null,
      });
    }

    // Build results — include producers with no wins but with targets set.
    const allPersonIds = new Set([
      ...byProducer.keys(),
      ...targets.map(t => t.personId),
    ]);

    const personCache = new Map<string, any>();
    for (const t of targets) {
      if (!personCache.has(t.personId)) personCache.set(t.personId, t.person);
    }

    const results: any[] = [];

    for (const personId of allPersonIds) {
      const data   = byProducer.get(personId) ?? { person: null, revenue: 0, costs: 0, leadCount: 0, deals: [] };
      const person = data.person ?? personCache.get(personId);
      if (!person) continue;

      const target     = targets.filter(t => t.personId === personId).reduce((s, t) => s + t.targetAmount, 0);
      const attainment = target > 0 ? data.revenue / target : 0;
      const netProfit  = data.revenue - data.costs;

      // Highest tier whose threshold is not exceeded by attainment.
      const tier           = [...tiers].reverse().find(t => attainment >= t.threshold) ?? null;
      const commissionRate = tier?.rate ?? 0;
      const commission     = netProfit > 0 ? netProfit * commissionRate : 0;

      results.push({
        person,
        revenue:        data.revenue,
        costs:          data.costs,
        netProfit,
        target,
        attainment:     Math.round(attainment * 1000) / 10, // e.g. 82.5 (%)
        tier,
        commissionRate: commissionRate * 100, // e.g. 2.5 (%)
        commission,
        leadCount:      data.leadCount,
        deals:          data.deals,
      });
    }

    results.sort((a, b) => b.attainment - a.attainment);

    return { year, quarter: quarter ?? null, tiers, results };
  }
}
