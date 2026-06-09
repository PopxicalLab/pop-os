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
    { email: 'admin@pop.studio',    name: 'Admin',    role: 'ADMIN',    password: 'popOS@admin1' },
    { email: 'producer@pop.studio', name: 'Producer', role: 'PRODUCER', password: 'popOS@1234'   },
    { email: 'sales@pop.studio',    name: 'Sales',    role: 'SALES',    password: 'popOS@1234'   },
    { email: 'finance@pop.studio',  name: 'Finance',  role: 'FINANCE',  password: 'popOS@1234'   },
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
  console.log('\n  Change passwords after first login!');
}

main().catch(console.error).finally(function() { prisma.$disconnect(); });
