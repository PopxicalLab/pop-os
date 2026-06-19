// Seed Q1 and Q2 2026 sales performance demo data.
// Generates WON leads, sales targets, and project costs for YJ and Huey.
// Safe to re-run — skips targets that already exist.

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Fixed IDs from the seeded people and accounts
const YJ    = 'cmq0x6ppn000axdriz1kpg2f0';
const HUEY  = 'cmq0x6ppp000bxdriwg2i6k90';

const ACCOUNTS = [
  'cmq5376bv00009kp6x6mskmne', // Spectrum Films Asia
  'cmq5376c000019kp6djz6pd8e', // LOKi Digital Agency
  'cmq5376c400029kp66fr9hv3h', // Media Prima Omnia Berhad
  'cmq5376c700039kp62ykkuuge', // MBCS, Fastbridge Malaysia
  'cmq5376ca00049kp6cr6flsjg', // Jspace Development
];

// Leads: name, producerId, estimatedValue (RM), wonAt, costs
const DEALS = [
  // ── YJ — Q1 (Jan–Mar 2026) ─────────────────────────────────────
  // YJ hits ~108% of Q1 target (target RM 200k) → lands in 100% tier
  { name: 'Spectrum TVC — CNY Hero',         closedById: YJ, estimatedValue: 85000,  wonAt: new Date('2026-01-15T08:00:00Z'), accountIdx: 0, costs: [{ description: 'Warm pool director', amount: 12000, costType: 'WARM_POOL' }] },
  { name: 'LOKi Digital — Brand Refresh',    closedById: YJ, estimatedValue: 72000,  wonAt: new Date('2026-02-08T08:00:00Z'), accountIdx: 1, costs: [{ description: 'Freelance animator', amount: 8000,  costType: 'WARM_POOL' }] },
  { name: 'Jspace — Property Launch Film',   closedById: YJ, estimatedValue: 58000,  wonAt: new Date('2026-03-20T08:00:00Z'), accountIdx: 4, costs: [{ description: 'Drone supplier',     amount: 4500,  costType: 'SUPPLIER'  }] },

  // ── YJ — Q2 (Apr–Jun 2026) ─────────────────────────────────────
  // YJ hits ~73% of Q2 target (target RM 220k) → lands in 50% tier
  { name: 'Media Prima — Raya Campaign',     closedById: YJ, estimatedValue: 95000,  wonAt: new Date('2026-04-10T08:00:00Z'), accountIdx: 2, costs: [{ description: 'Warm pool colourist', amount: 6000,  costType: 'WARM_POOL' }, { description: 'Studio rental', amount: 3500, costType: 'ADDITIONAL' }] },
  { name: 'Spectrum — Product TVC Series',   closedById: YJ, estimatedValue: 65000,  wonAt: new Date('2026-05-22T08:00:00Z'), accountIdx: 0, costs: [{ description: 'Freelance VO talent', amount: 2000,  costType: 'WARM_POOL' }] },

  // ── HUEY — Q1 (Jan–Mar 2026) ───────────────────────────────────
  // HUEY hits ~155% of Q1 target (target RM 150k) → hits the 150% tier
  { name: 'MBCS — Corporate Identity Film',  closedById: HUEY, estimatedValue: 68000, wonAt: new Date('2026-01-22T08:00:00Z'), accountIdx: 3, costs: [{ description: 'Warm pool 3D generalist', amount: 9000, costType: 'WARM_POOL' }] },
  { name: 'LOKi — Social Content Pack x12',  closedById: HUEY, estimatedValue: 52000, wonAt: new Date('2026-02-14T08:00:00Z'), accountIdx: 1, costs: [] },
  { name: 'Jspace — CGI Walkthrough',        closedById: HUEY, estimatedValue: 48000, wonAt: new Date('2026-03-05T08:00:00Z'), accountIdx: 4, costs: [{ description: 'Arch-viz supplier', amount: 7500, costType: 'SUPPLIER' }] },
  { name: 'Spectrum — Event Highlight Reel', closedById: HUEY, estimatedValue: 65000, wonAt: new Date('2026-03-28T08:00:00Z'), accountIdx: 0, costs: [] },

  // ── HUEY — Q2 (Apr–Jun 2026) ───────────────────────────────────
  // HUEY hits ~120% of Q2 target (target RM 180k) → 100% tier
  { name: 'Media Prima — Drama Title Seq.',  closedById: HUEY, estimatedValue: 78000, wonAt: new Date('2026-04-18T08:00:00Z'), accountIdx: 2, costs: [{ description: 'Composer fee', amount: 5000, costType: 'SUPPLIER' }] },
  { name: 'MBCS — Staff Training Video',     closedById: HUEY, estimatedValue: 45000, wonAt: new Date('2026-05-07T08:00:00Z'), accountIdx: 3, costs: [] },
  { name: 'LOKi — Motion Graphics Pack',     closedById: HUEY, estimatedValue: 92000, wonAt: new Date('2026-06-02T08:00:00Z'), accountIdx: 1, costs: [{ description: 'Freelance motion designer', amount: 11000, costType: 'WARM_POOL' }] },
];

// Quarterly targets
const TARGETS = [
  { personId: YJ,   year: 2026, quarter: 1, targetAmount: 200000 },
  { personId: YJ,   year: 2026, quarter: 2, targetAmount: 220000 },
  { personId: HUEY, year: 2026, quarter: 1, targetAmount: 150000 },
  { personId: HUEY, year: 2026, quarter: 2, targetAmount: 180000 },
];

async function main() {
  console.log('Seeding sales performance demo data…');

  // Upsert targets
  for (const t of TARGETS) {
    await prisma.salesTarget.upsert({
      where:  { personId_year_quarter: { personId: t.personId, year: t.year, quarter: t.quarter } },
      create: t,
      update: { targetAmount: t.targetAmount },
    });
    const person = t.personId === YJ ? 'YJ' : 'Huey';
    console.log(`  Target set: ${person} Q${t.quarter} ${t.year} = RM ${t.targetAmount.toLocaleString()}`);
  }

  // Create leads and project costs
  for (const deal of DEALS) {
    const accountId = ACCOUNTS[deal.accountIdx];

    // Create the lead as WON with wonAt set
    const lead = await prisma.lead.create({
      data: {
        name:           deal.name,
        accountId,
        closedById:     deal.closedById,
        status:         'WON',
        wonAt:          deal.wonAt,
        estimatedValue: deal.estimatedValue,
        priority:       'HIGH',
        company:        deal.closedById === YJ ? 'LPS' : 'PXL',
      },
    });

    // Convert lead to project so we can attach costs
    const project = await prisma.project.create({
      data: {
        name:           deal.name,
        accountId,
        quadrant:       'GOLD',
        priority:       'P2',
        status:         'DELIVERED',
        estimatedValue: deal.estimatedValue,
        company:        deal.closedById === YJ ? 'LPS' : 'PXL',
      },
    });

    // Link lead to project
    await prisma.lead.update({ where: { id: lead.id }, data: { projectId: project.id } });

    // Add project costs
    for (const cost of deal.costs) {
      await prisma.projectCost.create({ data: { projectId: project.id, ...cost } });
    }

    const person = deal.closedById === YJ ? 'YJ' : 'Huey';
    const q      = deal.wonAt.getMonth() < 3 ? 'Q1' : 'Q2';
    console.log(`  Lead created: [${person} ${q}] ${deal.name} — RM ${deal.estimatedValue.toLocaleString()}`);
  }

  console.log('\nDone. Open Sales > Performance to see the dashboard.');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
