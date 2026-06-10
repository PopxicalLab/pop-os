// ── Pop OS Demo Seed ─────────────────────────────────────────────────────────
// Run on a FRESH database after migrations:
//   docker compose down -v && docker compose up -d
//   npx prisma migrate deploy
//   node prisma/seed.js
//
// Covers: People, Skills, Projects, Capacity, Assets (with assignments),
//         Accounts, Contacts, Leads, AccountingDocuments, Users (all 6 roles)
//         with User ↔ Person links so the My Work tab shows live data.
// ─────────────────────────────────────────────────────────────────────────────
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const prisma = new PrismaClient();

function thisMonday() {
  const d = new Date();
  const day = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() + (day === 0 ? -6 : 1 - day));
  d.setUTCHours(0, 0, 0, 0);
  return new Date(d);
}
function weeksAgo(n)   { const d = thisMonday(); d.setUTCDate(d.getUTCDate() - n * 7); return d; }
function weeksAhead(n) { const d = thisMonday(); d.setUTCDate(d.getUTCDate() + n * 7); return d; }
function daysAgo(n)    { return new Date(Date.now() - n * 86_400_000); }
function daysAhead(n)  { return new Date(Date.now() + n * 86_400_000); }

async function main() {
  const existing = await prisma.person.count();
  if (existing > 0) {
    console.log(`Seed skipped — ${existing} people already exist.`);
    console.log('Wipe the DB first:  docker compose down -v && docker compose up -d');
    console.log('Then re-run:        npx prisma migrate deploy && node prisma/seed.js');
    return;
  }

  console.log('Seeding Pop OS demo data…\n');

  // ── 1. SKILLS ────────────────────────────────────────────────────────────────
  const skillNames = [
    '3D Modeling', 'Rigging', 'Animation', 'VFX', 'Motion Design',
    'Concept Art', 'Compositing', 'Lighting', 'Texturing', 'Rendering',
  ];
  const skills = {};
  for (const name of skillNames) {
    skills[name] = await prisma.skill.create({ data: { name } });
  }
  console.log(`✓ ${skillNames.length} skills`);

  // ── 2. PEOPLE ────────────────────────────────────────────────────────────────
  const ppl = [
    { name: 'YJ',     role: 'Producer',          department: 'Production', type: 'FULL_TIME',  co: 'LPS', salary:  9000, start: '2019-03-01' },
    { name: 'Huey',   role: 'Producer',          department: 'Production', type: 'FULL_TIME',  co: 'PXL', salary:  9000, start: '2020-06-15' },
    { name: 'Emily',  role: 'Project Manager',   department: 'Production', type: 'FULL_TIME',  co: 'LPS', salary:  6500, start: '2021-01-10' },
    { name: 'Calvin', role: 'Creative Director', department: 'Creative',   type: 'FULL_TIME',  co: 'LPS', salary: 13000, start: '2018-07-01' },
    { name: 'Tom',    role: '3D Director',       department: '3D',         type: 'FULL_TIME',  co: 'PXL', salary: 12000, start: '2019-09-01' },
    { name: 'Maya',   role: '3D Artist',         department: '3D',         type: 'FULL_TIME',  co: 'LPS', salary:  5500, start: '2022-02-14' },
    { name: 'Kai',    role: '3D Artist',         department: '3D',         type: 'FULL_TIME',  co: 'PXL', salary:  5000, start: '2022-08-01' },
    { name: 'Priya',  role: 'Motion Designer',   department: 'Motion',     type: 'FULL_TIME',  co: 'LPS', salary:  6000, start: '2023-03-06' },
    { name: 'Lucas',  role: 'Concept Artist',    department: 'Creative',   type: 'CONTRACT',   co: 'PXL', salary:  7500, start: '2024-01-15' },
    { name: 'Mei',    role: 'Animator',          department: '3D',         type: 'FREELANCE',  co: null,  salary:  6500, start: '2024-06-01' },
    { name: 'Ravi',   role: '3D Generalist',     department: '3D',         type: 'FULL_TIME',  co: 'LPS', salary:  null, start: '2020-01-01', warmPool: true },
  ];

  const P = {};
  for (const d of ppl) {
    P[d.name] = await prisma.person.create({
      data: {
        name: d.name, role: d.role, department: d.department,
        employmentType: d.type, company: d.co ?? null, salary: d.salary ?? null,
        startDate: new Date(d.start), warmPool: d.warmPool ?? false,
      },
    });
  }
  console.log(`✓ ${Object.keys(P).length} people`);

  // ── 3. SKILL RATINGS ─────────────────────────────────────────────────────────
  const ratings = [
    ['Maya',  '3D Modeling', 4], ['Maya',  'Rendering',    4], ['Maya',  'Lighting',   4], ['Maya',  'Texturing',    3],
    ['Kai',   '3D Modeling', 4], ['Kai',   'Animation',    5], ['Kai',   'Rigging',    3], ['Kai',   'VFX',          3],
    ['Priya', 'Motion Design', 5], ['Priya', 'Compositing', 4], ['Priya', 'Animation', 3],
    ['Calvin','Concept Art', 5], ['Calvin','3D Modeling',  3],
    ['Tom',   '3D Modeling', 5], ['Tom',   'Rigging',      5], ['Tom',   'VFX',        4], ['Tom',   'Animation',   5], ['Tom', 'Lighting', 4],
    ['Lucas', 'Concept Art', 4], ['Lucas', 'Motion Design',3],
    ['Mei',   'Animation',   5], ['Mei',   'Rigging',      4],
  ];
  for (const [person, skill, r] of ratings) {
    const ps = await prisma.personSkill.create({
      data: { personId: P[person].id, skillId: skills[skill].id, rating: r },
    });
    await prisma.skillRatingChange.create({
      data: { personSkillId: ps.id, oldRating: null, newRating: r, source: 'INTERVIEW', changedBy: 'Seed' },
    });
  }
  console.log(`✓ ${ratings.length} skill ratings`);

  // ── 4. ACCOUNTS (client companies) ───────────────────────────────────────────
  const accounts = {
    petronas: await prisma.account.create({ data: {
      name: 'Petronas Marketing', industry: 'Oil & Gas / Marketing', size: '501-1,000',
      company: 'LPS', autocountDebtorCode: '300-P001',
    }}),
    nike: await prisma.account.create({ data: {
      name: 'Nike SEA', industry: 'Sportswear', size: '51-100',
      company: 'LPS', autocountDebtorCode: '300-N001',
    }}),
    uniqlo: await prisma.account.create({ data: {
      name: 'Uniqlo Malaysia', industry: 'Fashion Retail', size: '51-100',
      company: 'PXL', autocountDebtorCode: '300-U001',
    }}),
    shopee: await prisma.account.create({ data: {
      name: 'Shopee Malaysia', industry: 'E-Commerce', size: '501-1,000',
      company: 'LPS', autocountDebtorCode: '300-S001',
    }}),
    celcom: await prisma.account.create({ data: {
      name: 'Celcom Enterprise', industry: 'Telecommunications', size: '501-1,000',
      company: 'PXL', autocountDebtorCode: '300-C001',
    }}),
    astro: await prisma.account.create({ data: {
      name: 'Astro Malaysia', industry: 'Media & Entertainment', size: '501-1,000',
      company: 'LPS', autocountDebtorCode: '300-A001',
    }}),
  };
  console.log(`✓ ${Object.keys(accounts).length} accounts`);

  // ── 5. CONTACTS ───────────────────────────────────────────────────────────────
  await prisma.contact.createMany({ data: [
    { name: 'Sarah Lim',    accountId: accounts.petronas.id, email: 'sarah.lim@petronas.com.my',    title: 'Head of Brand',           vip: true  },
    { name: 'Azri Malik',   accountId: accounts.petronas.id, email: 'azri.malik@petronas.com.my',   title: 'Marketing Manager',       vip: false },
    { name: 'Jane Tan',     accountId: accounts.nike.id,     email: 'jane.tan@nike.com',             title: 'Brand Director SEA',      vip: true  },
    { name: 'Alex Ng',      accountId: accounts.uniqlo.id,   email: 'alex.ng@uniqlo.com',            title: 'Regional Creative Lead',  vip: true  },
    { name: 'Nora Yusof',   accountId: accounts.shopee.id,   email: 'nora.y@shopee.com',             title: 'Campaign Manager',        vip: false },
    { name: 'David Chew',   accountId: accounts.celcom.id,   email: 'd.chew@celcom.com.my',          title: 'VP Marketing',            vip: true  },
    { name: 'Rachel Wong',  accountId: accounts.astro.id,    email: 'rachel.wong@astro.com.my',      title: 'Content Partnerships',    vip: false },
  ]});
  console.log('✓ 7 contacts');

  // ── 6. PROJECTS ───────────────────────────────────────────────────────────────
  const proj = {
    nike: await prisma.project.create({ data: {
      name: 'Nike AW25 Hero Campaign', client: 'Nike SEA', company: 'LPS',
      quadrant: 'GOLD', priority: 'P1', status: 'IN_PROGRESS',
      deadline: weeksAhead(3), producerId: P.YJ.id, pmId: P.Emily.id,
      accountId: accounts.nike.id,
      estimatedValue: 48000, estimatedDuration: 8, complexityScore: 3,
      clientTier: 'KEY_ACCOUNT', marginTarget: 42,
    }}),
    uniqlo: await prisma.project.create({ data: {
      name: 'Uniqlo Brand Film 2025', client: 'Uniqlo Malaysia', company: 'PXL',
      quadrant: 'STRATEGIC_BET', priority: 'P1', status: 'IN_PROGRESS',
      deadline: weeksAhead(6), producerId: P.Huey.id, pmId: P.Emily.id,
      accountId: accounts.uniqlo.id,
      estimatedValue: 65000, estimatedDuration: 12, complexityScore: 4,
      clientTier: 'RETURNING', marginTarget: 35,
    }}),
    hm: await prisma.project.create({ data: {
      name: 'H&M Social Asset Pack', client: 'H&M', company: 'LPS',
      quadrant: 'OPERATIONAL_FILLER', priority: 'P2', status: 'IN_PROGRESS',
      deadline: weeksAhead(2), producerId: P.YJ.id, pmId: P.Emily.id,
      estimatedValue: 16000, estimatedDuration: 4, complexityScore: 2,
      clientTier: 'RETURNING', marginTarget: 30,
    }}),
    zara: await prisma.project.create({ data: {
      name: 'Zara Product Launch Viz', client: 'Zara', company: 'PXL',
      quadrant: 'GOLD', priority: 'P2', status: 'BRIEF',
      deadline: weeksAhead(7), producerId: P.Huey.id, pmId: null,
      estimatedValue: 38000, estimatedDuration: 6, complexityScore: 2,
      clientTier: 'KEY_ACCOUNT', marginTarget: 45,
    }}),
    drain: await prisma.project.create({ data: {
      name: 'Indie Artist Collab — VFX', client: 'Self-initiated', company: 'LPS',
      quadrant: 'DRAIN', priority: 'P3', status: 'ON_HOLD',
      deadline: weeksAhead(4), producerId: P.YJ.id, pmId: P.Emily.id,
      estimatedValue: 8000, estimatedDuration: 8, complexityScore: 5,
      clientTier: 'NEW', marginTarget: 10,
      drainApprovedByExec: true, drainApprovedByProducer: true,
    }}),
    reel: await prisma.project.create({ data: {
      name: 'Pop Group Annual Reel 2025', client: null, company: null,
      quadrant: 'OPERATIONAL_FILLER', priority: 'P3', status: 'BRIEF',
      deadline: weeksAhead(10), producerId: P.YJ.id, pmId: null,
      estimatedValue: 0, estimatedDuration: 3, complexityScore: 2,
      marginTarget: null,
    }}),
    shopee: await prisma.project.create({ data: {
      name: 'Shopee 12.12 Campaign', client: 'Shopee Malaysia', company: 'LPS',
      quadrant: 'OPERATIONAL_FILLER', priority: 'P2', status: 'IN_PROGRESS',
      deadline: weeksAhead(1), producerId: P.YJ.id, pmId: P.Emily.id,
      accountId: accounts.shopee.id,
      estimatedValue: 14000, estimatedDuration: 3, complexityScore: 2,
      clientTier: 'RETURNING', marginTarget: 25,
    }}),
    digi: await prisma.project.create({ data: {
      name: 'Digi-Celcom Brand Refresh', client: 'Celcom Enterprise', company: 'PXL',
      quadrant: 'STRATEGIC_BET', priority: 'P1', status: 'INTERNAL_REVIEW',
      deadline: weeksAhead(2), producerId: P.Huey.id, pmId: P.Emily.id,
      accountId: accounts.celcom.id,
      estimatedValue: 28000, estimatedDuration: 8, complexityScore: 4,
      clientTier: 'KEY_ACCOUNT', marginTarget: 30,
    }}),
    astro: await prisma.project.create({ data: {
      name: 'Astro CNY 2025', client: 'Astro Malaysia', company: 'LPS',
      quadrant: 'GOLD', priority: 'P2', status: 'IN_PROGRESS',
      deadline: weeksAgo(1), producerId: P.YJ.id, pmId: P.Emily.id,
      accountId: accounts.astro.id,
      estimatedValue: 12000, estimatedDuration: 3, complexityScore: 3,
      clientTier: 'RETURNING', marginTarget: 30,
    }}),
    petronas: await prisma.project.create({ data: {
      name: 'Petronas Raya 2026 Campaign', client: 'Petronas Marketing', company: 'LPS',
      quadrant: 'GOLD', priority: 'P1', status: 'BRIEF',
      deadline: weeksAhead(14), producerId: P.YJ.id, pmId: P.Emily.id,
      accountId: accounts.petronas.id,
      estimatedValue: 85000, estimatedDuration: 16, complexityScore: 4,
      clientTier: 'KEY_ACCOUNT', marginTarget: 40,
    }}),
  };
  console.log(`✓ ${Object.keys(proj).length} projects`);

  // ── 7. CAPACITY ───────────────────────────────────────────────────────────────
  // History: weeks 3–11 ago (over-budget projects)
  // Recent:  weeks 2 ago → current → next week (main active projects)
  const capData = [
    // ── Shopee — weeks 3–5 ago
    ...[3,4,5].flatMap(w => [
      { personId: P.Priya.id, projectId: proj.shopee.id, weekStart: weeksAgo(w), role: 'MAIN',    pctWeek: 80 },
      { personId: P.Lucas.id, projectId: proj.shopee.id, weekStart: weeksAgo(w), role: 'MAIN',    pctWeek: 80 },
      { personId: P.Mei.id,   projectId: proj.shopee.id, weekStart: weeksAgo(w), role: 'SUPPORT', pctWeek: 80 },
      { personId: P.Kai.id,   projectId: proj.shopee.id, weekStart: weeksAgo(w), role: 'SUPPORT', pctWeek: 80 },
    ]),
    // ── Digi — weeks 7–11 ago
    ...[7,8,9,10,11].flatMap(w => [
      { personId: P.Calvin.id, projectId: proj.digi.id, weekStart: weeksAgo(w), role: 'MAIN',    pctWeek: 70 },
      { personId: P.Tom.id,    projectId: proj.digi.id, weekStart: weeksAgo(w), role: 'MAIN',    pctWeek: 80 },
      { personId: P.Kai.id,    projectId: proj.digi.id, weekStart: weeksAgo(w), role: 'SUPPORT', pctWeek: 80 },
      { personId: P.Maya.id,   projectId: proj.digi.id, weekStart: weeksAgo(w), role: 'SUPPORT', pctWeek: 80 },
    ]),
    // ── Astro — weeks 6–8 ago
    ...[6,7,8].flatMap(w => [
      { personId: P.Huey.id,  projectId: proj.astro.id, weekStart: weeksAgo(w), role: 'SUPPORT', pctWeek: 50 },
      { personId: P.Priya.id, projectId: proj.astro.id, weekStart: weeksAgo(w), role: 'MAIN',    pctWeek: 70 },
      { personId: P.Mei.id,   projectId: proj.astro.id, weekStart: weeksAgo(w), role: 'MAIN',    pctWeek: 80 },
      { personId: P.Lucas.id, projectId: proj.astro.id, weekStart: weeksAgo(w), role: 'SUPPORT', pctWeek: 50 },
    ]),
    // ── Nike (2 weeks ago → now → next week)
    ...[2,1,0,-1].flatMap(w => {
      const ws = w >= 0 ? weeksAgo(w) : weeksAhead(-w);
      return [
        { personId: P.Maya.id,   projectId: proj.nike.id, weekStart: ws, role: 'MAIN',    pctWeek: 70 },
        { personId: P.Priya.id,  projectId: proj.nike.id, weekStart: ws, role: 'SUPPORT', pctWeek: 20 },
        { personId: P.Calvin.id, projectId: proj.nike.id, weekStart: ws, role: 'SUPPORT', pctWeek: w <= 0 ? 20 : 15 },
        ...(w === 0 ? [{ personId: P.YJ.id, projectId: proj.nike.id, weekStart: ws, role: 'SUPPORT', pctWeek: 10 }] : []),
      ];
    }),
    // ── Uniqlo (2 weeks ago → now → next week)
    ...[2,1,0,-1].flatMap(w => {
      const ws = w >= 0 ? weeksAgo(w) : weeksAhead(-w);
      return [
        { personId: P.Tom.id,   projectId: proj.uniqlo.id, weekStart: ws, role: 'MAIN',    pctWeek: 70 },
        { personId: P.Kai.id,   projectId: proj.uniqlo.id, weekStart: ws, role: 'MAIN',    pctWeek: 80 },
        { personId: P.Lucas.id, projectId: proj.uniqlo.id, weekStart: ws, role: 'SUPPORT', pctWeek: 40 },
        ...(w === 0 ? [{ personId: P.Huey.id, projectId: proj.uniqlo.id, weekStart: ws, role: 'SUPPORT', pctWeek: 20 }] : []),
      ];
    }),
    // ── H&M (current + next week)
    ...[0,-1].flatMap(w => {
      const ws = w >= 0 ? weeksAgo(w) : weeksAhead(-w);
      return [
        { personId: P.Priya.id, projectId: proj.hm.id, weekStart: ws, role: 'MAIN',    pctWeek: 60 },
        { personId: P.Maya.id,  projectId: proj.hm.id, weekStart: ws, role: 'SUPPORT', pctWeek: 30 },
        ...(w === 0 ? [{ personId: P.Emily.id, projectId: proj.hm.id, weekStart: ws, role: 'SUPPORT', pctWeek: 10 }] : []),
      ];
    }),
    // ── Shopee (current week only — approaching deadline)
    { personId: P.Priya.id, projectId: proj.shopee.id, weekStart: weeksAgo(0), role: 'MAIN',    pctWeek: 60 },
    { personId: P.Kai.id,   projectId: proj.shopee.id, weekStart: weeksAgo(0), role: 'SUPPORT', pctWeek: 40 },
  ];

  for (const c of capData) {
    await prisma.capacity.create({ data: c });
  }
  console.log(`✓ ${capData.length} capacity allocations`);

  // ── 8. ASSETS (with assignments) ──────────────────────────────────────────────
  // assignedToId drives the "Assigned to Me" section on the My Work tab.
  const assetData = [
    // Nike — Maya owns rendering; Priya owns motion cuts; Lucas owns key art
    { name: 'Hero Shot Render',       projectId: proj.nike.id,   stage: 'INTERNAL_REVIEW', cdSignedOff: true,  assignedToId: P.Maya.id,  description: 'Final render — CD approved' },
    { name: 'Product Turntable',      projectId: proj.nike.id,   stage: 'WIP',             cdSignedOff: false, assignedToId: P.Maya.id },
    { name: 'Social Cut 15s',         projectId: proj.nike.id,   stage: 'REVISION',        cdSignedOff: false, assignedToId: P.Priya.id, description: 'Client requested tighter edit' },
    { name: 'Key Art Still',          projectId: proj.nike.id,   stage: 'INTERNAL_REVIEW', cdSignedOff: false, assignedToId: P.Lucas.id, description: 'Awaiting Calvin sign-off before client delivery' },
    // Uniqlo — Tom + Kai + Lucas
    { name: 'Brand Film Draft v1',    projectId: proj.uniqlo.id, stage: 'INTERNAL_REVIEW', cdSignedOff: false, assignedToId: P.Tom.id,   description: 'First assembly — needs director review' },
    { name: 'VFX Breakdown Sequence', projectId: proj.uniqlo.id, stage: 'WIP',             cdSignedOff: false, assignedToId: P.Kai.id },
    { name: 'Title Sequence',         projectId: proj.uniqlo.id, stage: 'BRIEF',           cdSignedOff: false, assignedToId: P.Lucas.id },
    // H&M — Priya owns all motion
    { name: 'Instagram Story Set',    projectId: proj.hm.id,     stage: 'WIP',             cdSignedOff: false, assignedToId: P.Priya.id },
    { name: 'Product Showcase Loop',  projectId: proj.hm.id,     stage: 'REVISION',        cdSignedOff: false, assignedToId: P.Priya.id, description: 'Client requested longer loop duration' },
    // Shopee
    { name: 'Main KV Animation',      projectId: proj.shopee.id, stage: 'REVISION',        cdSignedOff: false, assignedToId: P.Priya.id, description: 'Client requested 3rd revision round' },
    { name: 'Product Grid Banner',    projectId: proj.shopee.id, stage: 'WIP',             cdSignedOff: false, assignedToId: P.Kai.id },
    // Digi — needs sign-off (appears in Calvin + Tom queue)
    { name: 'Brand Identity Reel',    projectId: proj.digi.id,   stage: 'INTERNAL_REVIEW', cdSignedOff: false, assignedToId: P.Kai.id,   description: 'Awaiting CD sign-off — 2nd review round' },
    { name: 'Icon Animation Set',     projectId: proj.digi.id,   stage: 'WIP',             cdSignedOff: false, assignedToId: P.Kai.id },
    { name: 'Campaign Launch Film',   projectId: proj.digi.id,   stage: 'REVISION',        cdSignedOff: false, assignedToId: P.Tom.id,   description: 'Scope expanded — now includes 3 cutdowns' },
    // Astro — delivered
    { name: 'CNY Hero Film 30s',      projectId: proj.astro.id,  stage: 'FINAL_DELIVERY',  cdSignedOff: true,  assignedToId: P.Mei.id },
    { name: 'Social Cutdown 15s',     projectId: proj.astro.id,  stage: 'FINAL_DELIVERY',  cdSignedOff: true,  assignedToId: P.Priya.id },
  ];

  for (const a of assetData) {
    await prisma.asset.create({ data: a });
  }
  console.log(`✓ ${assetData.length} assets`);

  // ── 9. LEADS ──────────────────────────────────────────────────────────────────
  // A mix of stages to populate the Sales pipeline board.
  const leads = {
    raya: await prisma.lead.create({ data: {
      name: 'Petronas Raya 2026 Campaign',
      accountId: accounts.petronas.id, status: 'NEGOTIATION',
      priority: 'VERY_HIGH', estimatedValue: 85000, company: 'LPS',
      notes: 'Director-level buy-in confirmed. Final T&Cs being reviewed by legal.',
      projectId: proj.petronas.id,
    }}),
    celcomQ1: await prisma.lead.create({ data: {
      name: 'Celcom Q1 Brand Refresh',
      accountId: accounts.celcom.id, status: 'PROPOSAL',
      priority: 'HIGH', estimatedValue: 42000, company: 'PXL',
      notes: 'Deck submitted 3 days ago. Follow up due Wednesday.',
    }}),
    nikeCny: await prisma.lead.create({ data: {
      name: 'Nike CNY 2026 Campaign',
      accountId: accounts.nike.id, status: 'QUALIFICATION',
      priority: 'HIGH', estimatedValue: 55000, company: 'LPS',
      notes: 'Intro call done. Waiting for brief from Jane Tan.',
    }}),
    shopee66: await prisma.lead.create({ data: {
      name: 'Shopee 6.6 Mid-Year Sale',
      accountId: accounts.shopee.id, status: 'QUALIFICATION',
      priority: 'MEDIUM', estimatedValue: 18000, company: 'LPS',
      notes: 'Referred by Nora. Budget not confirmed.',
    }}),
    uniqloSummer: await prisma.lead.create({ data: {
      name: 'Uniqlo Summer 2026 Collection',
      accountId: accounts.uniqlo.id, status: 'WON',
      priority: 'HIGH', estimatedValue: 70000, company: 'PXL',
      notes: 'Signed! PO received. Handoff to production next week.',
      completed: false,
    }}),
    zaraLost: await prisma.lead.create({ data: {
      name: 'Zara AW25 Campaign (lost)',
      accountId: null, status: 'LOST',
      priority: 'MEDIUM', estimatedValue: 25000, company: 'LPS',
      notes: 'Lost to local competitor on price.',
    }}),
  };
  console.log(`✓ ${Object.keys(leads).length} leads`);

  // ── 10. ACCOUNTING DOCUMENTS ─────────────────────────────────────────────────
  // Spread across active, overdue, and paid to populate the Finance dashboard.
  const docData = [
    // Quotation from Petronas lead (status: ACTIVE — submitted)
    {
      projectId: proj.petronas.id, leadId: leads.raya.id,
      docType: 'QUOTATION', docNo: 'QT_0626-001', status: 'ACTIVE',
      docDate: daysAgo(5), dueDate: null,
      amount: 85000, debtorCode: '300-P001', debtorName: 'Petronas Marketing',
      creditTerm: 'C.O.D.',
    },
    // Nike invoice — due in 5 days (triggers payment alert)
    {
      projectId: proj.nike.id, leadId: null,
      docType: 'SALES_INVOICE', docNo: 'INV_0626-001', status: 'ACTIVE',
      docDate: daysAgo(25), dueDate: daysAhead(5),
      amount: 48000, debtorCode: '300-N001', debtorName: 'Nike SEA',
      creditTerm: 'NET 30',
    },
    // Uniqlo invoice — due in 12 days
    {
      projectId: proj.uniqlo.id, leadId: null,
      docType: 'SALES_INVOICE', docNo: 'INV_0626-002', status: 'ACTIVE',
      docDate: daysAgo(18), dueDate: daysAhead(12),
      amount: 32500, debtorCode: '300-U001', debtorName: 'Uniqlo Malaysia',
      creditTerm: 'NET 30', notes: '50% milestone payment',
    },
    // Shopee invoice — overdue by 3 days (red alert)
    {
      projectId: proj.shopee.id, leadId: null,
      docType: 'SALES_INVOICE', docNo: 'INV_0625-009', status: 'ACTIVE',
      docDate: daysAgo(33), dueDate: daysAgo(3),
      amount: 14000, debtorCode: '300-S001', debtorName: 'Shopee Malaysia',
      creditTerm: 'NET 30',
    },
    // Digi invoice — PAID (shows in history, not alerts)
    {
      projectId: proj.digi.id, leadId: null,
      docType: 'SALES_INVOICE', docNo: 'INV_0624-011', status: 'PAID',
      docDate: daysAgo(60), dueDate: daysAgo(30),
      amount: 28000, debtorCode: '300-C001', debtorName: 'Celcom Enterprise',
      creditTerm: 'NET 30',
    },
    // H&M invoice — due in 20 days (outside the 14-day alert window)
    {
      projectId: proj.hm.id, leadId: null,
      docType: 'SALES_INVOICE', docNo: 'INV_0626-003', status: 'ACTIVE',
      docDate: daysAgo(10), dueDate: daysAhead(20),
      amount: 16000, debtorCode: '300-H001', debtorName: 'H&M Malaysia',
      creditTerm: 'NET 30',
    },
    // Astro invoice — PAID
    {
      projectId: proj.astro.id, leadId: null,
      docType: 'SALES_INVOICE', docNo: 'INV_0625-007', status: 'PAID',
      docDate: daysAgo(45), dueDate: daysAgo(15),
      amount: 12000, debtorCode: '300-A001', debtorName: 'Astro Malaysia',
      creditTerm: 'NET 30',
    },
  ];

  for (const d of docData) {
    await prisma.accountingDocument.create({ data: d });
  }
  console.log(`✓ ${docData.length} accounting documents`);

  // ── 11. USERS (all 6 roles, with person links where appropriate) ──────────────
  // Password for everyone except admin: popOS@1234
  const PW_STAFF = await bcrypt.hash('popOS@1234', 12);
  const PW_ADMIN = await bcrypt.hash('popOS@admin1', 12);

  const userDefs = [
    // Generic role accounts (no person link — useful for broad tab testing)
    { email: 'admin@pop.studio',    name: 'Admin',           role: 'ADMIN',     password: PW_ADMIN, personId: null       },
    { email: 'sales@pop.studio',    name: 'Sales',           role: 'SALES',     password: PW_STAFF, personId: null       },
    { email: 'finance@pop.studio',  name: 'Finance',         role: 'FINANCE',   password: PW_STAFF, personId: null       },
    // Named accounts linked to real People — these power the My Work tab
    { email: 'yj@pop.studio',       name: 'YJ',              role: 'PRODUCER',  password: PW_STAFF, personId: P.YJ.id    },
    { email: 'huey@pop.studio',     name: 'Huey',            role: 'PRODUCER',  password: PW_STAFF, personId: P.Huey.id  },
    { email: 'emily@pop.studio',    name: 'Emily',           role: 'PM',        password: PW_STAFF, personId: P.Emily.id },
    { email: 'calvin@pop.studio',   name: 'Calvin',          role: 'TEAM_LEAD', password: PW_STAFF, personId: P.Calvin.id},
    { email: 'tom@pop.studio',      name: 'Tom',             role: 'TEAM_LEAD', password: PW_STAFF, personId: P.Tom.id   },
    { email: 'maya@pop.studio',     name: 'Maya',            role: 'PRODUCER',  password: PW_STAFF, personId: P.Maya.id  },
    { email: 'priya@pop.studio',    name: 'Priya',           role: 'PRODUCER',  password: PW_STAFF, personId: P.Priya.id },
  ];

  for (const u of userDefs) {
    await prisma.user.create({
      data: {
        email: u.email, name: u.name, role: u.role,
        password: u.password, active: true,
        ...(u.personId ? { personId: u.personId } : {}),
      },
    });
  }
  console.log(`✓ ${userDefs.length} user accounts\n`);

  // ── SUMMARY ──────────────────────────────────────────────────────────────────
  console.log('═══════════════════════════════════════════════════════');
  console.log('  Pop OS demo seed complete!');
  console.log('  http://localhost:3000\n');
  console.log('  Generic logins:');
  console.log('    admin@pop.studio    / popOS@admin1   (ADMIN)');
  console.log('    sales@pop.studio    / popOS@1234     (SALES)');
  console.log('    finance@pop.studio  / popOS@1234     (FINANCE)\n');
  console.log('  Named logins (My Work tab shows live data):');
  console.log('    emily@pop.studio    / popOS@1234     (PM → Emily)');
  console.log('    calvin@pop.studio   / popOS@1234     (TEAM_LEAD → Calvin)');
  console.log('    tom@pop.studio      / popOS@1234     (TEAM_LEAD → Tom)');
  console.log('    yj@pop.studio       / popOS@1234     (PRODUCER → YJ)');
  console.log('    maya@pop.studio     / popOS@1234     (PRODUCER → Maya)');
  console.log('    priya@pop.studio    / popOS@1234     (PRODUCER → Priya)');
  console.log('  ⚠  Change passwords after first login!');
  console.log('═══════════════════════════════════════════════════════');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
