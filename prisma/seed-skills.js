// ── Pop OS — Skill Seeder ─────────────────────────────────────────────────────
// Safe to run on an existing database. Uses upsert so existing skills are
// updated with their category; new skills are created. Run after migration:
//   node prisma/seed-skills.js
// ─────────────────────────────────────────────────────────────────────────────
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const SKILLS = [
  // 3D Production
  { name: '3D Modeling',         category: '3D Production' },
  { name: 'Rigging',             category: '3D Production' },
  { name: 'Animation',           category: '3D Production' },
  { name: 'Lighting',            category: '3D Production' },
  { name: 'Texturing',           category: '3D Production' },
  { name: 'Rendering',           category: '3D Production' },
  { name: 'Character Design',    category: '3D Production' },
  { name: 'Environment Design',  category: '3D Production' },

  // VFX & Post
  { name: 'VFX',                 category: 'VFX & Post' },
  { name: 'Compositing',         category: 'VFX & Post' },
  { name: 'Video Editing',       category: 'VFX & Post' },
  { name: 'Color Grading',       category: 'VFX & Post' },

  // Motion & Design
  { name: 'Motion Design',       category: 'Motion & Design' },
  { name: 'Concept Art',         category: 'Motion & Design' },
  { name: 'Storyboarding',       category: 'Motion & Design' },
  { name: 'Illustration',        category: 'Motion & Design' },
  { name: 'Art Direction',       category: 'Motion & Design' },
  { name: 'Graphic Design',      category: 'Motion & Design' },

  // Creative Tech
  { name: 'Creative Coding',     category: 'Creative Tech' },
  { name: 'Real-time / Unreal',  category: 'Creative Tech' },
  { name: 'AR / VR',             category: 'Creative Tech' },
  { name: 'Generative Art',      category: 'Creative Tech' },
  { name: 'Projection Mapping',  category: 'Creative Tech' },
  { name: 'Technical Direction', category: 'Creative Tech' },

  // Development
  { name: 'Web Frontend',        category: 'Development' },
  { name: 'Web Backend',         category: 'Development' },
  { name: 'UI/UX Design',        category: 'Development' },
  { name: 'Mobile Development',  category: 'Development' },
  { name: 'Data Visualisation',  category: 'Development' },

  // Production
  { name: 'Production Management',      category: 'Production' },
  { name: 'Client Servicing',           category: 'Production' },
  { name: 'Copywriting / Scriptwriting', category: 'Production' },
];

async function main() {
  console.log(`Seeding ${SKILLS.length} skills with categories…\n`);
  let created = 0;
  let updated = 0;

  for (const skill of SKILLS) {
    const result = await prisma.skill.upsert({
      where:  { name: skill.name },
      update: { category: skill.category },
      create: { name: skill.name, category: skill.category },
    });
    // Check if it was created or updated by comparing createdAt vs updatedAt
    const isNew = Math.abs(result.createdAt - result.updatedAt) < 100;
    if (isNew) created++; else updated++;
  }

  console.log(`✓ ${created} skills created, ${updated} skills updated with category`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
