// ── seed-users.js ────────────────────────────────────────────────────────────
// Creates the default login accounts (no person links).
// For a full demo with person-linked accounts, run seed.js instead.
// Safe to re-run — skips if any users already exist.
// ─────────────────────────────────────────────────────────────────────────────
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const prisma = new PrismaClient();

async function main() {
  const count = await prisma.user.count();
  if (count > 0) {
    console.log('Users already exist (' + count + ') — skipping.');
    return;
  }

  const users = [
    { email: 'admin@pop.studio',    name: 'Admin',    role: 'ADMIN',     password: 'popOS@admin1' },
    { email: 'producer@pop.studio', name: 'Producer', role: 'PRODUCER',  password: 'popOS@1234'   },
    { email: 'sales@pop.studio',    name: 'Sales',    role: 'SALES',     password: 'popOS@1234'   },
    { email: 'finance@pop.studio',  name: 'Finance',  role: 'FINANCE',   password: 'popOS@1234'   },
    { email: 'pm@pop.studio',       name: 'PM',       role: 'PM',        password: 'popOS@1234'   },
    { email: 'lead@pop.studio',     name: 'TeamLead', role: 'TEAM_LEAD', password: 'popOS@1234'   },
  ];

  for (const u of users) {
    await prisma.user.create({ data: { ...u, password: await bcrypt.hash(u.password, 12) } });
    console.log('  Created: ' + u.email + ' (' + u.role + ')');
  }

  console.log('\nDefault logins:');
  console.log('  admin@pop.studio    / popOS@admin1  (ADMIN)');
  console.log('  producer@pop.studio / popOS@1234    (PRODUCER)');
  console.log('  sales@pop.studio    / popOS@1234    (SALES)');
  console.log('  finance@pop.studio  / popOS@1234    (FINANCE)');
  console.log('  pm@pop.studio       / popOS@1234    (PM)');
  console.log('  lead@pop.studio     / popOS@1234    (TEAM_LEAD)');
  console.log('\n  Note: these accounts have no Person link.');
  console.log('  For the full demo with My Work data, run seed.js instead.');
}

main().catch(console.error).finally(function() { prisma.$disconnect(); });
