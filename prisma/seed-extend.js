// ── seed-extend.js ───────────────────────────────────────────────────────────
// Adds demo data ON TOP of an existing DB (does not wipe anything).
// Run once after the main seed has been applied:
//   node prisma/seed-extend.js
//
// Adds:
//   • User accounts for PM / TEAM_LEAD roles with Person links (My Work tab)
//   • assignedToId on existing assets (so "Assigned to Me" populates)
//   • Next-week capacity entries (so "My Capacity" shows future weeks)
//   • AccountingDocuments (Finance dashboard, payment alerts)
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
function weeksAhead(n) { const d = thisMonday(); d.setUTCDate(d.getUTCDate() + n * 7); return d; }
function daysAgo(n)    { return new Date(Date.now() - n * 86_400_000); }
function daysAhead(n)  { return new Date(Date.now() + n * 86_400_000); }

async function main() {
  // ── Resolve people by name (works regardless of IDs) ────────────────────
  const everyone = await prisma.person.findMany({ where: { warmPool: false } });
  const P = Object.fromEntries(everyone.map(p => [p.name, p]));

  const required = ['YJ','Huey','Emily','Calvin','Tom','Maya','Kai','Priya','Lucas','Mei'];
  const missing  = required.filter(n => !P[n]);
  if (missing.length) {
    console.error(`Missing people: ${missing.join(', ')}. Run the main seed first.`);
    process.exit(1);
  }

  // ── Resolve projects by name ─────────────────────────────────────────────
  const allProjects = await prisma.project.findMany();
  const Q = Object.fromEntries(allProjects.map(p => [p.name, p]));

  // ── 1. USER ACCOUNTS (skip if email already exists) ─────────────────────
  console.log('Adding user accounts…');
  const PW = await bcrypt.hash('popOS@1234', 12);

  const newUsers = [
    { email: 'emily@pop.studio',  name: 'Emily', role: 'PM',        personName: 'Emily'  },
    { email: 'calvin@pop.studio', name: 'Calvin',role: 'TEAM_LEAD', personName: 'Calvin' },
    { email: 'tom@pop.studio',    name: 'Tom',   role: 'TEAM_LEAD', personName: 'Tom'    },
    { email: 'huey@pop.studio',   name: 'Huey',  role: 'PRODUCER',  personName: 'Huey'   },
    { email: 'maya@pop.studio',   name: 'Maya',  role: 'PRODUCER',  personName: 'Maya'   },
    { email: 'priya@pop.studio',  name: 'Priya', role: 'PRODUCER',  personName: 'Priya'  },
    { email: 'kai@pop.studio',    name: 'Kai',   role: 'PRODUCER',  personName: 'Kai'    },
  ];

  let usersAdded = 0;
  for (const u of newUsers) {
    const exists = await prisma.user.findUnique({ where: { email: u.email } });
    if (exists) { console.log(`  skip  ${u.email} (exists)`); continue; }
    // Check person not already linked to another user
    const person = P[u.personName];
    const alreadyLinked = await prisma.user.findUnique({ where: { personId: person.id } }).catch(() => null);
    await prisma.user.create({
      data: {
        email: u.email, name: u.name, role: u.role, password: PW, active: true,
        ...(alreadyLinked ? {} : { personId: person.id }),
      },
    });
    console.log(`  + ${u.email} (${u.role}${alreadyLinked ? ', no person link — already taken' : ' → ' + u.personName})`);
    usersAdded++;
  }
  console.log(`  ${usersAdded} new accounts\n`);

  // ── 2. ASSIGN ASSETS to people ───────────────────────────────────────────
  // Uses name-matching so it's safe to re-run (update is idempotent).
  console.log('Assigning assets to people…');
  const assignments = [
    // Nike
    ['Hero Shot Render',       'Maya'],
    ['Product Turntable',      'Maya'],
    ['Social Cut 15s',         'Priya'],
    ['Key Art Still',          'Lucas'],
    // Uniqlo
    ['Brand Film Draft v1',    'Tom'],
    ['VFX Breakdown Sequence', 'Kai'],
    ['Title Sequence',         'Lucas'],
    // H&M
    ['Instagram Story Set',    'Priya'],
    ['Product Showcase Loop',  'Priya'],
    // Shopee
    ['Main KV Animation',      'Priya'],
    ['Product Grid Banner',    'Kai'],
    // Digi
    ['Brand Identity Reel',    'Kai'],
    ['Icon Animation Set',     'Kai'],
    ['Campaign Launch Film',   'Tom'],
    // Astro
    ['CNY Hero Film 30s',      'Mei'],
    ['Social Cutdown 15s',     'Priya'],
  ];

  let assigned = 0;
  for (const [assetName, personName] of assignments) {
    const asset = await prisma.asset.findFirst({ where: { name: assetName } });
    if (!asset) { console.log(`  skip  asset not found: ${assetName}`); continue; }
    if (asset.assignedToId) { console.log(`  skip  ${assetName} (already assigned)`); continue; }
    await prisma.asset.update({
      where: { id: asset.id },
      data:  { assignedToId: P[personName].id },
    });
    console.log(`  + ${assetName} → ${personName}`);
    assigned++;
  }
  console.log(`  ${assigned} assets assigned\n`);

  // ── 3. NEXT-WEEK CAPACITY (so My Work shows future allocation) ───────────
  console.log('Adding next-week capacity…');
  const nextWeek = weeksAhead(1);

  const nextWeekAllocs = [
    // Nike — Maya + Priya + Calvin still on it
    { personId: P.Maya.id,   projectId: Q['Nike AW25 Hero Campaign']?.id,  role: 'MAIN',    pctWeek: 70 },
    { personId: P.Priya.id,  projectId: Q['Nike AW25 Hero Campaign']?.id,  role: 'SUPPORT', pctWeek: 30 },
    { personId: P.Calvin.id, projectId: Q['Nike AW25 Hero Campaign']?.id,  role: 'SUPPORT', pctWeek: 20 },
    // Uniqlo — Tom + Kai + Lucas continue
    { personId: P.Tom.id,    projectId: Q['Uniqlo Brand Film 2025']?.id,   role: 'MAIN',    pctWeek: 70 },
    { personId: P.Kai.id,    projectId: Q['Uniqlo Brand Film 2025']?.id,   role: 'MAIN',    pctWeek: 70 },
    { personId: P.Lucas.id,  projectId: Q['Uniqlo Brand Film 2025']?.id,   role: 'SUPPORT', pctWeek: 40 },
    // H&M — Priya main
    { personId: P.Priya.id,  projectId: Q['H&M Social Asset Pack']?.id,    role: 'MAIN',    pctWeek: 40 },
  ].filter(a => a.projectId);

  let capAdded = 0;
  for (const a of nextWeekAllocs) {
    const exists = await prisma.capacity.findFirst({
      where: { personId: a.personId, projectId: a.projectId, weekStart: nextWeek },
    });
    if (exists) continue;
    await prisma.capacity.create({ data: { ...a, weekStart: nextWeek } });
    capAdded++;
  }
  console.log(`  ${capAdded} next-week allocations\n`);

  // ── 4. ACCOUNTING DOCUMENTS ──────────────────────────────────────────────
  console.log('Adding accounting documents…');
  const existingDocs = await prisma.accountingDocument.count();
  if (existingDocs > 0) {
    console.log(`  skip — ${existingDocs} documents already exist\n`);
  } else {
    const nikeProj   = Q['Nike AW25 Hero Campaign'];
    const uniqloProj = Q['Uniqlo Brand Film 2025'];
    const shopeeProj = Q['Shopee 12.12 Campaign'];
    const digiProj   = Q['Digi-Celcom Brand Refresh'];
    const hmProj     = Q['H&M Social Asset Pack'];
    const astroProj  = allProjects.find(p => p.name.includes('Astro'));

    const docs = [
      // Nike — due in 5 days (payment alert)
      {
        projectId: nikeProj?.id, docType: 'SALES_INVOICE', docNo: 'INV_0626-001',
        status: 'ACTIVE', docDate: daysAgo(25), dueDate: daysAhead(5),
        amount: 48000, debtorCode: '300-N001', debtorName: 'Nike SEA', creditTerm: 'NET 30',
      },
      // Uniqlo — due in 12 days (alert)
      {
        projectId: uniqloProj?.id, docType: 'SALES_INVOICE', docNo: 'INV_0626-002',
        status: 'ACTIVE', docDate: daysAgo(18), dueDate: daysAhead(12),
        amount: 32500, debtorCode: '300-U001', debtorName: 'Uniqlo Malaysia', creditTerm: 'NET 30',
        notes: '50% milestone payment',
      },
      // Shopee — OVERDUE by 3 days (red)
      {
        projectId: shopeeProj?.id, docType: 'SALES_INVOICE', docNo: 'INV_0625-009',
        status: 'ACTIVE', docDate: daysAgo(33), dueDate: daysAgo(3),
        amount: 14000, debtorCode: '300-S001', debtorName: 'Shopee Malaysia', creditTerm: 'NET 30',
      },
      // H&M — due in 20 days (outside alert window — shows in list, not alerts)
      {
        projectId: hmProj?.id, docType: 'SALES_INVOICE', docNo: 'INV_0626-003',
        status: 'ACTIVE', docDate: daysAgo(10), dueDate: daysAhead(20),
        amount: 16000, debtorCode: '300-H001', debtorName: 'H&M Malaysia', creditTerm: 'NET 30',
      },
      // Digi — PAID (shows in history)
      {
        projectId: digiProj?.id, docType: 'SALES_INVOICE', docNo: 'INV_0624-011',
        status: 'PAID', docDate: daysAgo(60), dueDate: daysAgo(30),
        amount: 28000, debtorCode: '300-C001', debtorName: 'Celcom Enterprise', creditTerm: 'NET 30',
      },
      // Astro — PAID
      ...(astroProj ? [{
        projectId: astroProj.id, docType: 'SALES_INVOICE', docNo: 'INV_0625-007',
        status: 'PAID', docDate: daysAgo(45), dueDate: daysAgo(15),
        amount: 12000, debtorCode: '300-A001', debtorName: 'Astro Malaysia', creditTerm: 'NET 30',
      }] : []),
    ].filter(d => d.projectId);

    for (const d of docs) {
      await prisma.accountingDocument.create({ data: d });
      console.log(`  + ${d.docNo} — ${d.debtorName} (${d.status})`);
    }
    console.log(`  ${docs.length} documents created\n`);
  }

  // ── DONE ─────────────────────────────────────────────────────────────────
  console.log('═══════════════════════════════════════════════════════');
  console.log('  Demo data extended!\n');
  console.log('  Named logins (My Work tab shows live data):');
  console.log('    emily@pop.studio  / popOS@1234  (PM → Emily)');
  console.log('    calvin@pop.studio / popOS@1234  (TEAM_LEAD → Calvin)');
  console.log('    tom@pop.studio    / popOS@1234  (TEAM_LEAD → Tom)');
  console.log('    maya@pop.studio   / popOS@1234  (PRODUCER → Maya)');
  console.log('    priya@pop.studio  / popOS@1234  (PRODUCER → Priya)');
  console.log('    huey@pop.studio   / popOS@1234  (PRODUCER → Huey)');
  console.log('═══════════════════════════════════════════════════════');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
