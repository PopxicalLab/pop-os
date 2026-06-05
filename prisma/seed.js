// ── Demo seed for Pop OS ─────────────────────────────────────────────────────
// Run AFTER migration:  node prisma/seed.js
// Safe to re-run — skips if people already exist.
// ─────────────────────────────────────────────────────────────────────────────
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Helper: Monday of the current ISO week at UTC midnight.
function thisMonday() {
  const d   = new Date();
  const day = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() + (day === 0 ? -6 : 1 - day));
  d.setUTCHours(0, 0, 0, 0);
  return d;
}
function weeksAgo(n) {
  const d = thisMonday();
  d.setUTCDate(d.getUTCDate() - n * 7);
  return d;
}
function weeksAhead(n) {
  const d = thisMonday();
  d.setUTCDate(d.getUTCDate() + n * 7);
  return d;
}

async function main() {
  const existing = await prisma.person.count();
  if (existing > 0) {
    console.log(`Seed skipped — ${existing} people already exist. Wipe the DB first if you want a fresh seed.`);
    return;
  }

  console.log('Seeding demo data…');

  // ── Skills ───────────────────────────────────────────────────────────────
  const skillNames = ['3D Modeling', 'Rigging', 'Animation', 'VFX', 'Motion Design',
                      'Concept Art', 'Compositing', 'Lighting', 'Texturing', 'Rendering'];
  const skills = {};
  for (const name of skillNames) {
    skills[name] = await prisma.skill.create({ data: { name } });
  }
  console.log(`  ✓ ${skillNames.length} skills`);

  // ── People ───────────────────────────────────────────────────────────────
  const peopleData = [
    { name: 'YJ',    role: 'Producer',          department: 'Production', employmentType: 'FULL_TIME',  company: 'LPS', salary:  9000, startDate: '2019-03-01' },
    { name: 'Huey',  role: 'Producer',          department: 'Production', employmentType: 'FULL_TIME',  company: 'PXL', salary:  9000, startDate: '2020-06-15' },
    { name: 'Emily', role: 'Project Manager',   department: 'Production', employmentType: 'FULL_TIME',  company: 'LPS', salary:  6500, startDate: '2021-01-10' },
    { name: 'Calvin',role: 'Creative Director', department: 'Creative',   employmentType: 'FULL_TIME',  company: 'LPS', salary: 13000, startDate: '2018-07-01' },
    { name: 'Tom',   role: '3D Director',       department: '3D',         employmentType: 'FULL_TIME',  company: 'PXL', salary: 12000, startDate: '2019-09-01' },
    { name: 'Maya',  role: '3D Artist',         department: '3D',         employmentType: 'FULL_TIME',  company: 'LPS', salary:  5500, startDate: '2022-02-14' },
    { name: 'Kai',   role: '3D Artist',         department: '3D',         employmentType: 'FULL_TIME',  company: 'PXL', salary:  5000, startDate: '2022-08-01' },
    { name: 'Priya', role: 'Motion Designer',   department: 'Motion',     employmentType: 'FULL_TIME',  company: 'LPS', salary:  6000, startDate: '2023-03-06' },
    { name: 'Lucas', role: 'Concept Artist',    department: 'Creative',   employmentType: 'CONTRACT',   company: 'PXL', salary:  7500, startDate: '2024-01-15' },
    { name: 'Mei',   role: 'Animator',          department: '3D',         employmentType: 'FREELANCE',  company: null,  salary:  6500, startDate: '2024-06-01', warmPool: false },
  ];

  const people = {};
  for (const d of peopleData) {
    people[d.name] = await prisma.person.create({
      data: {
        name: d.name, role: d.role, department: d.department,
        employmentType: d.employmentType, company: d.company ?? null,
        salary: d.salary, startDate: new Date(d.startDate),
        warmPool: d.warmPool ?? false,
      },
    });
  }
  // Warm pool alumni
  people['Ravi'] = await prisma.person.create({
    data: { name: 'Ravi', role: '3D Generalist', department: '3D', employmentType: 'FULL_TIME',
            company: 'LPS', salary: null, startDate: new Date('2020-01-01'), warmPool: true },
  });
  console.log(`  ✓ ${Object.keys(people).length} people`);

  // ── Skill ratings ────────────────────────────────────────────────────────
  const ratings = [
    { person: 'Maya',  skill: '3D Modeling', r: 4 }, { person: 'Maya',  skill: 'Rendering', r: 4 },
    { person: 'Maya',  skill: 'Lighting',    r: 4 }, { person: 'Maya',  skill: 'Texturing', r: 3 },
    { person: 'Kai',   skill: '3D Modeling', r: 4 }, { person: 'Kai',   skill: 'Animation', r: 5 },
    { person: 'Kai',   skill: 'Rigging',     r: 3 }, { person: 'Kai',   skill: 'VFX',       r: 3 },
    { person: 'Priya', skill: 'Motion Design', r: 5 }, { person: 'Priya', skill: 'Compositing', r: 4 },
    { person: 'Priya', skill: 'Animation',   r: 3 },
    { person: 'Calvin',skill: 'Concept Art', r: 5 }, { person: 'Calvin',skill: '3D Modeling', r: 3 },
    { person: 'Tom',   skill: '3D Modeling', r: 5 }, { person: 'Tom',   skill: 'Rigging',  r: 5 },
    { person: 'Tom',   skill: 'VFX',         r: 4 }, { person: 'Tom',   skill: 'Animation', r: 5 },
    { person: 'Tom',   skill: 'Lighting',    r: 4 },
    { person: 'Lucas', skill: 'Concept Art', r: 4 }, { person: 'Lucas', skill: 'Motion Design', r: 3 },
    { person: 'Mei',   skill: 'Animation',   r: 5 }, { person: 'Mei',   skill: 'Rigging',  r: 4 },
  ];
  for (const { person, skill, r } of ratings) {
    const ps = await prisma.personSkill.create({
      data: { personId: people[person].id, skillId: skills[skill].id, rating: r },
    });
    await prisma.skillRatingChange.create({
      data: { personSkillId: ps.id, oldRating: null, newRating: r, source: 'INTERVIEW', changedBy: 'Seed' },
    });
  }
  console.log(`  ✓ ${ratings.length} skill ratings`);

  // ── Projects ─────────────────────────────────────────────────────────────
  const projectsData = [
    {
      name: 'Nike AW25 Hero Campaign', client: 'Nike', company: 'LPS',
      quadrant: 'GOLD', priority: 'P1', status: 'IN_PROGRESS',
      deadline: weeksAhead(3), producerId: people['YJ'].id, pmId: people['Emily'].id,
      estimatedValue: 48000, estimatedDuration: 8, complexityScore: 3,
      clientTier: 'KEY_ACCOUNT', marginTarget: 42,
    },
    {
      name: 'Uniqlo Brand Film 2025', client: 'Uniqlo', company: 'PXL',
      quadrant: 'STRATEGIC_BET', priority: 'P1', status: 'IN_PROGRESS',
      deadline: weeksAhead(6), producerId: people['Huey'].id, pmId: people['Emily'].id,
      estimatedValue: 65000, estimatedDuration: 12, complexityScore: 4,
      clientTier: 'RETURNING', marginTarget: 35,
    },
    {
      name: 'H&M Social Asset Pack', client: 'H&M', company: 'LPS',
      quadrant: 'OPERATIONAL_FILLER', priority: 'P2', status: 'IN_PROGRESS',
      deadline: weeksAhead(2), producerId: people['YJ'].id, pmId: people['Emily'].id,
      estimatedValue: 16000, estimatedDuration: 4, complexityScore: 2,
      clientTier: 'RETURNING', marginTarget: 30,
    },
    {
      name: 'Zara Product Launch Viz', client: 'Zara', company: 'PXL',
      quadrant: 'GOLD', priority: 'P2', status: 'BRIEF',
      deadline: weeksAhead(7), producerId: people['Huey'].id, pmId: null,
      estimatedValue: 38000, estimatedDuration: 6, complexityScore: 2,
      clientTier: 'KEY_ACCOUNT', marginTarget: 45,
    },
    {
      name: 'Indie Artist Collab — VFX', client: 'Self-initiated', company: 'LPS',
      quadrant: 'DRAIN', priority: 'P3', status: 'ON_HOLD',
      deadline: weeksAhead(4), producerId: people['YJ'].id, pmId: people['Emily'].id,
      estimatedValue: 8000, estimatedDuration: 8, complexityScore: 5,
      clientTier: 'NEW', marginTarget: 10,
      drainApprovedByExec: true, drainApprovedByProducer: true,
    },
    {
      name: 'Pop Group Annual Reel 2025', client: null, company: null,
      quadrant: 'OPERATIONAL_FILLER', priority: 'P3', status: 'BRIEF',
      deadline: weeksAhead(10), producerId: people['YJ'].id, pmId: null,
      estimatedValue: 0, estimatedDuration: 3, complexityScore: 2,
      clientTier: null, marginTarget: null,
    },
  ];

  const projects = {};
  for (const d of projectsData) {
    projects[d.name] = await prisma.project.create({
      data: {
        name: d.name, client: d.client, company: d.company,
        quadrant: d.quadrant, priority: d.priority, status: d.status,
        deadline: d.deadline, producerId: d.producerId, pmId: d.pmId,
        drainApprovedByExec:     d.drainApprovedByExec     ?? false,
        drainApprovedByProducer: d.drainApprovedByProducer ?? false,
        estimatedValue: d.estimatedValue, estimatedDuration: d.estimatedDuration,
        complexityScore: d.complexityScore, clientTier: d.clientTier,
        marginTarget: d.marginTarget,
      },
    });
  }
  console.log(`  ✓ ${Object.keys(projects).length} projects`);

  // ── Capacity — 3 weeks of history + current week ─────────────────────────
  const nikePrj   = projects['Nike AW25 Hero Campaign'];
  const uniqPrj   = projects['Uniqlo Brand Film 2025'];
  const hMPrj     = projects['H&M Social Asset Pack'];

  const allocations = [
    // ── 2 weeks ago ─────────────────────────────────────────────────────────
    { personId: people['Maya'].id,  projectId: nikePrj.id,  weekStart: weeksAgo(2), role: 'MAIN',    pctWeek: 70 },
    { personId: people['Priya'].id, projectId: nikePrj.id,  weekStart: weeksAgo(2), role: 'SUPPORT', pctWeek: 20 },
    { personId: people['Calvin'].id,projectId: nikePrj.id,  weekStart: weeksAgo(2), role: 'SUPPORT', pctWeek: 15 },
    { personId: people['Tom'].id,   projectId: uniqPrj.id,  weekStart: weeksAgo(2), role: 'MAIN',    pctWeek: 70 },
    { personId: people['Kai'].id,   projectId: uniqPrj.id,  weekStart: weeksAgo(2), role: 'MAIN',    pctWeek: 80 },
    { personId: people['Lucas'].id, projectId: uniqPrj.id,  weekStart: weeksAgo(2), role: 'SUPPORT', pctWeek: 40 },
    { personId: people['Priya'].id, projectId: hMPrj.id,    weekStart: weeksAgo(2), role: 'MAIN',    pctWeek: 60 },
    { personId: people['Maya'].id,  projectId: hMPrj.id,    weekStart: weeksAgo(2), role: 'SUPPORT', pctWeek: 30 },
    // ── 1 week ago ──────────────────────────────────────────────────────────
    { personId: people['Maya'].id,  projectId: nikePrj.id,  weekStart: weeksAgo(1), role: 'MAIN',    pctWeek: 70 },
    { personId: people['Priya'].id, projectId: nikePrj.id,  weekStart: weeksAgo(1), role: 'SUPPORT', pctWeek: 20 },
    { personId: people['Calvin'].id,projectId: nikePrj.id,  weekStart: weeksAgo(1), role: 'SUPPORT', pctWeek: 20 },
    { personId: people['Tom'].id,   projectId: uniqPrj.id,  weekStart: weeksAgo(1), role: 'MAIN',    pctWeek: 70 },
    { personId: people['Kai'].id,   projectId: uniqPrj.id,  weekStart: weeksAgo(1), role: 'MAIN',    pctWeek: 80 },
    { personId: people['Lucas'].id, projectId: uniqPrj.id,  weekStart: weeksAgo(1), role: 'SUPPORT', pctWeek: 40 },
    { personId: people['Priya'].id, projectId: hMPrj.id,    weekStart: weeksAgo(1), role: 'MAIN',    pctWeek: 60 },
    { personId: people['Maya'].id,  projectId: hMPrj.id,    weekStart: weeksAgo(1), role: 'SUPPORT', pctWeek: 30 },
    // ── current week ────────────────────────────────────────────────────────
    { personId: people['Maya'].id,  projectId: nikePrj.id,  weekStart: thisMonday(), role: 'MAIN',    pctWeek: 70 },
    { personId: people['Priya'].id, projectId: nikePrj.id,  weekStart: thisMonday(), role: 'SUPPORT', pctWeek: 20 },
    { personId: people['Calvin'].id,projectId: nikePrj.id,  weekStart: thisMonday(), role: 'SUPPORT', pctWeek: 20 },
    { personId: people['YJ'].id,    projectId: nikePrj.id,  weekStart: thisMonday(), role: 'SUPPORT', pctWeek: 10 },
    { personId: people['Tom'].id,   projectId: uniqPrj.id,  weekStart: thisMonday(), role: 'MAIN',    pctWeek: 70 },
    { personId: people['Kai'].id,   projectId: uniqPrj.id,  weekStart: thisMonday(), role: 'MAIN',    pctWeek: 80 },
    { personId: people['Lucas'].id, projectId: uniqPrj.id,  weekStart: thisMonday(), role: 'SUPPORT', pctWeek: 40 },
    { personId: people['Huey'].id,  projectId: uniqPrj.id,  weekStart: thisMonday(), role: 'SUPPORT', pctWeek: 20 },
    { personId: people['Priya'].id, projectId: hMPrj.id,    weekStart: thisMonday(), role: 'MAIN',    pctWeek: 60 },
    { personId: people['Maya'].id,  projectId: hMPrj.id,    weekStart: thisMonday(), role: 'SUPPORT', pctWeek: 30 },
    { personId: people['Emily'].id, projectId: hMPrj.id,    weekStart: thisMonday(), role: 'SUPPORT', pctWeek: 10 },
  ];

  for (const a of allocations) {
    await prisma.capacity.create({ data: a });
  }
  console.log(`  ✓ ${allocations.length} capacity allocations (3 weeks)`);

  // ── Assets ───────────────────────────────────────────────────────────────
  const assetData = [
    // Nike
    { name: 'Hero Shot Render',       projectId: nikePrj.id, stage: 'INTERNAL_REVIEW', cdSignedOff: true  },
    { name: 'Product Turntable',      projectId: nikePrj.id, stage: 'WIP',             cdSignedOff: false },
    { name: 'Social Cut 15s',         projectId: nikePrj.id, stage: 'REVISION',        cdSignedOff: false },
    { name: 'Key Art Still',          projectId: nikePrj.id, stage: 'INTERNAL_REVIEW', cdSignedOff: false,
      description: 'Awaiting Calvin sign-off before client delivery' },
    // Uniqlo
    { name: 'Brand Film Draft v1',    projectId: uniqPrj.id, stage: 'INTERNAL_REVIEW', cdSignedOff: false,
      description: 'First assembly — needs director review' },
    { name: 'VFX Breakdown Sequence', projectId: uniqPrj.id, stage: 'WIP',             cdSignedOff: false },
    { name: 'Title Sequence',         projectId: uniqPrj.id, stage: 'BRIEF',           cdSignedOff: false },
    // H&M
    { name: 'Instagram Story Set',    projectId: hMPrj.id,   stage: 'WIP',             cdSignedOff: false },
    { name: 'Product Showcase Loop',  projectId: hMPrj.id,   stage: 'REVISION',        cdSignedOff: false,
      description: 'Client requested longer loop duration' },
  ];

  for (const a of assetData) {
    await prisma.asset.create({ data: a });
  }
  console.log(`  ✓ ${assetData.length} assets`);

  console.log('\n✅ Seed complete. Open http://localhost:3000 to explore.');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
