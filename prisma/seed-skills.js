// ── Pop OS — Skill Seeder ─────────────────────────────────────────────────────
// Categories align with docs/Skillset.md. Safe to run on an existing database —
// upserts so existing skills get their category updated, new ones created.
//   node prisma/seed-skills.js
// ─────────────────────────────────────────────────────────────────────────────
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const SKILLS = [
  // ── General Management ─────────────────────────────────────────
  { name: 'Project Management',        category: 'General Management' },
  { name: 'Conflict Management',       category: 'General Management' },

  // ── Studio Project Management ──────────────────────────────────
  { name: 'Production Management',     category: 'Studio Project Management' },
  { name: 'Client Servicing',          category: 'Studio Project Management' },
  { name: 'Creative Translation',      category: 'Studio Project Management' },
  { name: 'Scope & Budget Management', category: 'Studio Project Management' },
  { name: 'Project Scheduling',        category: 'Studio Project Management' },
  { name: 'Risk Mitigation',           category: 'Studio Project Management' },
  { name: 'Resource Allocation',       category: 'Studio Project Management' },

  // ── Creative Technology ────────────────────────────────────────
  { name: 'Creative Coding',           category: 'Creative Technology' },
  { name: 'Real-time / Unreal',        category: 'Creative Technology' },
  { name: 'AR / VR',                   category: 'Creative Technology' },
  { name: 'Generative Art',            category: 'Creative Technology' },
  { name: 'Projection Mapping',        category: 'Creative Technology' },
  { name: 'Technical Direction',       category: 'Creative Technology' },
  { name: 'AI Fluency',                category: 'Creative Technology' },
  { name: 'Physical Computing',        category: 'Creative Technology' },
  { name: 'Web Frontend',              category: 'Creative Technology' },
  { name: 'Web Backend',               category: 'Creative Technology' },
  { name: 'UI/UX Design',              category: 'Creative Technology' },
  { name: 'Mobile Development',        category: 'Creative Technology' },
  { name: 'Data Visualisation',        category: 'Creative Technology' },

  // ── Digital Content & Animation ────────────────────────────────
  { name: '3D Modeling',               category: 'Digital Content & Animation' },
  { name: 'Rigging',                   category: 'Digital Content & Animation' },
  { name: 'Animation',                 category: 'Digital Content & Animation' },
  { name: 'Lighting',                  category: 'Digital Content & Animation' },
  { name: 'Texturing',                 category: 'Digital Content & Animation' },
  { name: 'Rendering',                 category: 'Digital Content & Animation' },
  { name: 'Character Design',          category: 'Digital Content & Animation' },
  { name: 'Environment Design',        category: 'Digital Content & Animation' },
  { name: 'VFX',                       category: 'Digital Content & Animation' },
  { name: 'Compositing',               category: 'Digital Content & Animation' },
  { name: 'Video Editing',             category: 'Digital Content & Animation' },
  { name: 'Color Grading',             category: 'Digital Content & Animation' },
  { name: 'Motion Design',             category: 'Digital Content & Animation' },
  { name: 'Concept Art',               category: 'Digital Content & Animation' },
  { name: 'Storyboarding',             category: 'Digital Content & Animation' },
  { name: 'Illustration',              category: 'Digital Content & Animation' },
  { name: 'Art Direction',             category: 'Digital Content & Animation' },
  { name: 'Graphic Design',            category: 'Digital Content & Animation' },

  // ── Marketing & Growth ─────────────────────────────────────────
  { name: 'Brand Strategy',            category: 'Marketing & Growth' },
  { name: 'Content Marketing',         category: 'Marketing & Growth' },
  { name: 'Social Media Strategy',     category: 'Marketing & Growth' },
  { name: 'Campaign Management',       category: 'Marketing & Growth' },
  { name: 'Performance Marketing',     category: 'Marketing & Growth' },
  { name: 'Email Marketing',           category: 'Marketing & Growth' },
  { name: 'Copywriting / Scriptwriting', category: 'Marketing & Growth' },
];

async function main() {
  console.log(`Seeding ${SKILLS.length} skills (categories from Skillset.md)…\n`);
  let created = 0;
  let updated = 0;

  for (const skill of SKILLS) {
    const existing = await prisma.skill.findUnique({ where: { name: skill.name } });
    if (existing) {
      await prisma.skill.update({ where: { name: skill.name }, data: { category: skill.category } });
      updated++;
    } else {
      await prisma.skill.create({ data: skill });
      created++;
    }
  }

  console.log(`✓ ${created} skills created, ${updated} skills updated`);
  console.log('\nCategories:');
  const cats = [...new Set(SKILLS.map(s => s.category))];
  for (const cat of cats) {
    const count = SKILLS.filter(s => s.category === cat).length;
    console.log(`  ${cat}: ${count} skills`);
  }
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
