/**
 * reset-for-production.js
 *
 * Wipes all demo/seed data from the production database and creates
 * the initial admin account. Run ONCE before go-live.
 *
 * After this script: log in as yeo@popxical.com and use the Financial tab
 * to run "Sync from Autocount" (imports clients + documents from Autocount).
 *
 * Usage:
 *   node prisma/reset-for-production.js
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  console.log('⚠  Production reset starting — this cannot be undone.\n');

  // ── 1. Delete all transactional data (FK order) ───────────────────

  // Committee activity attendees before activities
  const d1 = await prisma.committeeActivityAttendee.deleteMany();
  console.log(`  Deleted ${d1.count} committee activity attendees`);

  const d2 = await prisma.committeeActivity.deleteMany();
  console.log(`  Deleted ${d2.count} committee activities`);

  const d3 = await prisma.committeeMember.deleteMany();
  console.log(`  Deleted ${d3.count} committee members`);

  const d4 = await prisma.committee.deleteMany();
  console.log(`  Deleted ${d4.count} committees`);

  const d5 = await prisma.skillRatingChange.deleteMany();
  console.log(`  Deleted ${d5.count} skill rating changes`);

  const d6 = await prisma.personSkill.deleteMany();
  console.log(`  Deleted ${d6.count} person skills`);

  const d7 = await prisma.projectSkill.deleteMany();
  console.log(`  Deleted ${d7.count} project skills`);

  const d8 = await prisma.personTierRate.deleteMany();
  console.log(`  Deleted ${d8.count} person tier rates`);

  const d9 = await prisma.personEvent.deleteMany();
  console.log(`  Deleted ${d9.count} person events`);

  const d10 = await prisma.salaryHistory.deleteMany();
  console.log(`  Deleted ${d10.count} salary history entries`);

  const d11 = await prisma.changeRequest.deleteMany();
  console.log(`  Deleted ${d11.count} change requests`);

  const d12 = await prisma.projectCost.deleteMany();
  console.log(`  Deleted ${d12.count} project costs`);

  const d13 = await prisma.accountingDocument.deleteMany();
  console.log(`  Deleted ${d13.count} accounting documents`);

  const d14 = await prisma.asset.deleteMany();
  console.log(`  Deleted ${d14.count} assets`);

  const d15 = await prisma.capacity.deleteMany();
  console.log(`  Deleted ${d15.count} capacity entries`);

  const d16 = await prisma.salesTarget.deleteMany();
  console.log(`  Deleted ${d16.count} sales targets`);

  const d17 = await prisma.project.deleteMany();
  console.log(`  Deleted ${d17.count} projects`);

  // Contacts and leads before accounts
  const d18 = await prisma.contact.deleteMany();
  console.log(`  Deleted ${d18.count} contacts`);

  const d19 = await prisma.lead.deleteMany();
  console.log(`  Deleted ${d19.count} leads`);

  const d20 = await prisma.account.deleteMany();
  console.log(`  Deleted ${d20.count} accounts`);

  // Users before people (user.personId FK)
  const d21 = await prisma.user.deleteMany();
  console.log(`  Deleted ${d21.count} users`);

  const d22 = await prisma.person.deleteMany();
  console.log(`  Deleted ${d22.count} people`);

  // ── 2. Keep: Skills, Departments, JobTitles, CommissionTiers ─────
  console.log('\n  Keeping: skills, departments, job titles, commission tiers.\n');

  // ── 3. Create initial admin account ──────────────────────────────
  const hash = await bcrypt.hash('@wwg2511', 12);
  const admin = await prisma.user.create({
    data: {
      email:    'yeo@popxical.com',
      name:     'Yeo',
      password: hash,
      role:     'ADMIN',
      active:   true,
    },
  });

  console.log(`✓  Admin created: ${admin.email} (id: ${admin.id})`);
  console.log('\n✓  Reset complete.\n');
  console.log('Next steps:');
  console.log('  1. Log in at http://192.168.1.40:3000/login.html');
  console.log('     Email: yeo@popxical.com');
  console.log('     Password: @wwg2511');
  console.log('  2. Go to Financial tab → click "↓ Sync from Autocount"');
  console.log('     (imports all invoices + quotations + PAID status from Autocount)');
  console.log('  3. Financial tab also has a sync-debtors option — or call:');
  console.log('     curl -X POST http://localhost:3000/api/autocount/sync-debtors \\');
  console.log('       -H "Authorization: Bearer <your-token>"');
}

main()
  .catch(e => { console.error('Reset failed:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
