// Seed Q1 and Q2 2026 sales performance demo data.
// Generates WON leads, sales targets, and project costs for YJ and Huey.
// Safe to re-run — skips targets that already exist.
//
// IMPORTANT: Looks up person and account IDs by name at runtime, so this
// works correctly on any local DB (not tied to production CUIDs).

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Accounts to upsert by name (created if they don't exist).
const ACCOUNT_NAMES = [
  'Spectrum Films Asia',   // index 0
  'LOKi Digital Agency',   // index 1
  'Media Prima Omnia',     // index 2
  'MBCS Fastbridge',       // index 3
  'Jspace Development',    // index 4
];

// Deal data — uses name placeholders; IDs are resolved at runtime.
const DEALS = [
  // ── YJ — Q1 (Jan–Mar 2026) ─────────────────────────────────────
  // YJ hits ~108% of Q1 target (target RM 200k) → lands in 100% tier
  { name: 'Spectrum TVC — CNY Hero',         closedByName: 'YJ',   estimatedValue: 85000,  wonAt: new Date('2026-01-15T08:00:00Z'), accountIdx: 0, costs: [{ description: 'Warm pool director',  amount: 12000, costType: 'WARM_POOL' }] },
  { name: 'LOKi Digital — Brand Refresh',    closedByName: 'YJ',   estimatedValue: 72000,  wonAt: new Date('2026-02-08T08:00:00Z'), accountIdx: 1, costs: [{ description: 'Freelance animator',  amount: 8000,  costType: 'WARM_POOL' }] },
  { name: 'Jspace — Property Launch Film',   closedByName: 'YJ',   estimatedValue: 58000,  wonAt: new Date('2026-03-20T08:00:00Z'), accountIdx: 4, costs: [{ description: 'Drone supplier',     amount: 4500,  costType: 'SUPPLIER'  }] },

  // ── YJ — Q2 (Apr–Jun 2026) ─────────────────────────────────────
  // YJ hits ~73% of Q2 target (target RM 220k) → lands in 50% tier
  { name: 'Media Prima — Raya Campaign',     closedByName: 'YJ',   estimatedValue: 95000,  wonAt: new Date('2026-04-10T08:00:00Z'), accountIdx: 2, costs: [{ description: 'Warm pool colourist', amount: 6000,  costType: 'WARM_POOL' }, { description: 'Studio rental', amount: 3500, costType: 'ADDITIONAL' }] },
  { name: 'Spectrum — Product TVC Series',   closedByName: 'YJ',   estimatedValue: 65000,  wonAt: new Date('2026-05-22T08:00:00Z'), accountIdx: 0, costs: [{ description: 'Freelance VO talent', amount: 2000,  costType: 'WARM_POOL' }] },

  // ── HUEY — Q1 (Jan–Mar 2026) ───────────────────────────────────
  // HUEY hits ~155% of Q1 target (target RM 150k) → hits the 150% tier
  { name: 'MBCS — Corporate Identity Film',  closedByName: 'Huey', estimatedValue: 68000, wonAt: new Date('2026-01-22T08:00:00Z'), accountIdx: 3, costs: [{ description: 'Warm pool 3D generalist', amount: 9000, costType: 'WARM_POOL' }] },
  { name: 'LOKi — Social Content Pack x12',  closedByName: 'Huey', estimatedValue: 52000, wonAt: new Date('2026-02-14T08:00:00Z'), accountIdx: 1, costs: [] },
  { name: 'Jspace — CGI Walkthrough',        closedByName: 'Huey', estimatedValue: 48000, wonAt: new Date('2026-03-05T08:00:00Z'), accountIdx: 4, costs: [{ description: 'Arch-viz supplier', amount: 7500, costType: 'SUPPLIER' }] },
  { name: 'Spectrum — Event Highlight Reel', closedByName: 'Huey', estimatedValue: 65000, wonAt: new Date('2026-03-28T08:00:00Z'), accountIdx: 0, costs: [] },

  // ── HUEY — Q2 (Apr–Jun 2026) ───────────────────────────────────
  // HUEY hits ~120% of Q2 target (target RM 180k) → 100% tier
  { name: 'Media Prima — Drama Title Seq.',  closedByName: 'Huey', estimatedValue: 78000, wonAt: new Date('2026-04-18T08:00:00Z'), accountIdx: 2, costs: [{ description: 'Composer fee', amount: 5000, costType: 'SUPPLIER' }] },
  { name: 'MBCS — Staff Training Video',     closedByName: 'Huey', estimatedValue: 45000, wonAt: new Date('2026-05-07T08:00:00Z'), accountIdx: 3, costs: [] },
  { name: 'LOKi — Motion Graphics Pack',     closedByName: 'Huey', estimatedValue: 92000, wonAt: new Date('2026-06-02T08:00:00Z'), accountIdx: 1, costs: [{ description: 'Freelance motion designer', amount: 11000, costType: 'WARM_POOL' }] },
];

async function main() {
  console.log('Seeding sales performance demo data…\n');

  // ── Resolve person IDs by name ─────────────────────────────────
  const people = await prisma.person.findMany({ where: { name: { in: ['YJ', 'Huey'] } } });
  const YJ   = people.find(p => p.name === 'YJ')?.id;
  const HUEY = people.find(p => p.name === 'Huey')?.id;

  if (!YJ || !HUEY) {
    console.error(`Missing required people. Found: ${people.map(p => p.name).join(', ') || 'none'}`);
    console.error('Run the main seed first: node prisma/seed.js');
    process.exit(1);
  }
  console.log(`  Resolved: YJ  → ${YJ}`);
  console.log(`  Resolved: Huey → ${HUEY}\n`);

  // ── Upsert accounts by name ────────────────────────────────────
  const accounts = [];
  for (const name of ACCOUNT_NAMES) {
    const existing = await prisma.account.findFirst({ where: { name } });
    if (existing) {
      accounts.push(existing.id);
      console.log(`  Account (existing): ${name}`);
    } else {
      const created = await prisma.account.create({ data: { name } });
      accounts.push(created.id);
      console.log(`  Account (created):  ${name}`);
    }
  }
  console.log();

  // ── Build person-name → ID map for DEALS ──────────────────────
  const personIdFor = { YJ, Huey: HUEY };

  // ── Quarterly targets ──────────────────────────────────────────
  const TARGETS = [
    { personId: YJ,   year: 2026, quarter: 1, targetAmount: 200000 },
    { personId: YJ,   year: 2026, quarter: 2, targetAmount: 220000 },
    { personId: HUEY, year: 2026, quarter: 1, targetAmount: 150000 },
    { personId: HUEY, year: 2026, quarter: 2, targetAmount: 180000 },
  ];

  for (const t of TARGETS) {
    await prisma.salesTarget.upsert({
      where:  { personId_year_quarter: { personId: t.personId, year: t.year, quarter: t.quarter } },
      create: t,
      update: { targetAmount: t.targetAmount },
    });
    const name = t.personId === YJ ? 'YJ' : 'Huey';
    console.log(`  Target: ${name} Q${t.quarter} ${t.year} = RM ${t.targetAmount.toLocaleString()}`);
  }
  console.log();

  // ── Leads, projects, and costs ─────────────────────────────────
  for (const deal of DEALS) {
    const closedById = personIdFor[deal.closedByName];
    const accountId  = accounts[deal.accountIdx];
    const company    = deal.closedByName === 'YJ' ? 'LPS' : 'PXL';

    // Skip if a lead with this name already exists (safe to re-run).
    const existing = await prisma.lead.findFirst({ where: { name: deal.name } });
    if (existing) {
      console.log(`  skip  (exists): ${deal.name}`);
      continue;
    }

    const lead = await prisma.lead.create({
      data: {
        name:           deal.name,
        accountId,
        closedById,
        status:         'WON',
        wonAt:          deal.wonAt,
        estimatedValue: deal.estimatedValue,
        priority:       'HIGH',
        company,
      },
    });

    const project = await prisma.project.create({
      data: {
        name:           deal.name,
        accountId,
        quadrant:       'GOLD',
        priority:       'P2',
        status:         'DELIVERED',
        estimatedValue: deal.estimatedValue,
        company,
      },
    });

    await prisma.lead.update({ where: { id: lead.id }, data: { projectId: project.id } });

    for (const cost of deal.costs) {
      await prisma.projectCost.create({ data: { projectId: project.id, ...cost } });
    }

    const q = deal.wonAt.getMonth() < 3 ? 'Q1' : 'Q2';
    console.log(`  + [${deal.closedByName} ${q}] ${deal.name} — RM ${deal.estimatedValue.toLocaleString()}`);
  }

  console.log('\nDone. Open Sales > Performance to see the dashboard.');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
