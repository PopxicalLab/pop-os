// ── Pop OS — Skill Seeder ─────────────────────────────────────────────────────
// Category names and skill list follow docs/Skillset.md exactly.
// Safe to run on an existing database — renames typo variants, upserts the rest.
//   node prisma/seed-skills.js
// ─────────────────────────────────────────────────────────────────────────────
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Skills whose names in the DB diverged from the document name.
// Processed first so the upsert step doesn't create duplicates.
const RENAMES = [
  // Creative Studio Project Manager Skills
  { from: 'Resource Allocation',          to: 'Resource Allocation for Creatives',   cat: 'Creative Studio Project Manager Skills' },
  { from: 'Project Scheduling',           to: 'Project Scheduling & Phasing',         cat: 'Creative Studio Project Manager Skills' },
  { from: 'Production Management',        to: 'Production Management',                cat: 'Creative Studio Project Manager Skills' },
  { from: 'Client Servicing',             to: 'Client Servicing',                     cat: 'Creative Studio Project Manager Skills' },
  // Creative Technologist Skills
  { from: 'Creative Coding',              to: 'Creative Coding & Real-Time Graphics', cat: 'Creative Technologist Skills' },
  { from: 'AR / VR',                      to: 'Immersive & Spatial Computing',        cat: 'Creative Technologist Skills' },
  { from: 'AI Fluency',                   to: 'Artificial Intelligence (AI) Fluency', cat: 'Creative Technologist Skills' },
  { from: 'Real-time / Unreal',           to: 'Real-time / Unreal',                   cat: 'Creative Technologist Skills' },
  { from: 'Generative Art',               to: 'Generative Art',                       cat: 'Creative Technologist Skills' },
  { from: 'Projection Mapping',           to: 'Projection Mapping',                   cat: 'Creative Technologist Skills' },
  { from: 'Technical Direction',          to: 'Technical Direction',                  cat: 'Creative Technologist Skills' },
  { from: 'Web Frontend',                 to: 'Web Frontend',                         cat: 'Creative Technologist Skills' },
  { from: 'Web Backend',                  to: 'Web Backend',                          cat: 'Creative Technologist Skills' },
  { from: 'UI/UX Design',                 to: 'UI/UX Design',                         cat: 'Creative Technologist Skills' },
  { from: 'Mobile Development',           to: 'Mobile Development',                   cat: 'Creative Technologist Skills' },
  { from: 'Data Visualisation',           to: 'Data Visualisation',                   cat: 'Creative Technologist Skills' },
  // Digital Content Creation & Animation Skills
  { from: 'VFX',                          to: 'VFX (Visual Effects)',                 cat: 'Digital Content Creation & Animation Skills' },
  { from: 'Character Design',             to: 'Character Design',                     cat: 'Digital Content Creation & Animation Skills' },
  { from: 'Environment Design',           to: 'Environment Design',                   cat: 'Digital Content Creation & Animation Skills' },
  { from: 'Video Editing',               to: 'Video Editing',                         cat: 'Digital Content Creation & Animation Skills' },
  { from: 'Color Grading',               to: 'Color Grading',                         cat: 'Digital Content Creation & Animation Skills' },
  { from: 'Storyboarding',               to: 'Storyboarding',                         cat: 'Digital Content Creation & Animation Skills' },
  { from: 'Illustration',                to: 'Illustration',                          cat: 'Digital Content Creation & Animation Skills' },
  { from: 'Art Direction',               to: 'Art Direction',                         cat: 'Digital Content Creation & Animation Skills' },
  { from: 'Graphic Design',              to: 'Graphic Design',                        cat: 'Digital Content Creation & Animation Skills' },
  // Marketing & Growth Skills
  { from: 'Copywriting / Scriptwriting', to: 'Copywriting / Scriptwriting',           cat: 'Marketing & Growth Skills' },
];

// Full skill list — exact names and categories from docs/Skillset.md.
// Skills not in the doc are kept under the closest matching category.
const SKILLS = [
  // ── 1. General Management Core Skills ─────────────────────────
  { name: 'Project Management',                    category: 'General Management Core Skills' },
  { name: 'Conflict Management',                   category: 'General Management Core Skills' },

  // ── 2. Creative Studio Project Manager Skills ─────────────────
  { name: 'Creative Translation',                  category: 'Creative Studio Project Manager Skills' },
  { name: 'Subjective Feedback Management',        category: 'Creative Studio Project Manager Skills' },
  { name: 'Workflow Empathy',                      category: 'Creative Studio Project Manager Skills' },
  { name: 'Resource Allocation for Creatives',     category: 'Creative Studio Project Manager Skills' },
  { name: 'Scope & Budget Management',             category: 'Creative Studio Project Manager Skills' },
  { name: 'Project Scheduling & Phasing',          category: 'Creative Studio Project Manager Skills' },
  { name: 'Risk Mitigation',                       category: 'Creative Studio Project Manager Skills' },
  { name: 'Tool Proficiency',                      category: 'Creative Studio Project Manager Skills' },
  { name: 'Shielding the Team',                    category: 'Creative Studio Project Manager Skills' },
  { name: 'Cheerleading & Morale Building',        category: 'Creative Studio Project Manager Skills' },
  // extras not in doc — closest category
  { name: 'Production Management',                 category: 'Creative Studio Project Manager Skills' },
  { name: 'Client Servicing',                      category: 'Creative Studio Project Manager Skills' },

  // ── 3. Creative Technologist Skills ───────────────────────────
  { name: 'Immersive & Spatial Computing',         category: 'Creative Technologist Skills' },
  { name: 'Creative Coding & Real-Time Graphics',  category: 'Creative Technologist Skills' },
  { name: 'Artificial Intelligence (AI) Fluency',  category: 'Creative Technologist Skills' },
  { name: 'Physical Computing',                    category: 'Creative Technologist Skills' },
  { name: 'Web & App Development',                 category: 'Creative Technologist Skills' },
  { name: 'Rapid Prototyping',                     category: 'Creative Technologist Skills' },
  { name: 'Design Fluency & Storytelling',         category: 'Creative Technologist Skills' },
  { name: 'Translation & Communication',           category: 'Creative Technologist Skills' },
  { name: 'Innovation Management',                 category: 'Creative Technologist Skills' },
  // extras not in doc — closest category
  { name: 'Real-time / Unreal',                    category: 'Creative Technologist Skills' },
  { name: 'Generative Art',                        category: 'Creative Technologist Skills' },
  { name: 'Projection Mapping',                    category: 'Creative Technologist Skills' },
  { name: 'Technical Direction',                   category: 'Creative Technologist Skills' },
  { name: 'Web Frontend',                          category: 'Creative Technologist Skills' },
  { name: 'Web Backend',                           category: 'Creative Technologist Skills' },
  { name: 'UI/UX Design',                          category: 'Creative Technologist Skills' },
  { name: 'Mobile Development',                    category: 'Creative Technologist Skills' },
  { name: 'Data Visualisation',                    category: 'Creative Technologist Skills' },

  // ── 4. Digital Content Creation & Animation Skills ────────────
  { name: '3D Modeling',                           category: 'Digital Content Creation & Animation Skills' },
  { name: 'Rigging',                               category: 'Digital Content Creation & Animation Skills' },
  { name: 'Animation',                             category: 'Digital Content Creation & Animation Skills' },
  { name: 'VFX (Visual Effects)',                  category: 'Digital Content Creation & Animation Skills' },
  { name: 'Motion Design',                         category: 'Digital Content Creation & Animation Skills' },
  { name: 'Concept Art',                           category: 'Digital Content Creation & Animation Skills' },
  { name: 'Compositing',                           category: 'Digital Content Creation & Animation Skills' },
  { name: 'Lighting',                              category: 'Digital Content Creation & Animation Skills' },
  { name: 'Texturing',                             category: 'Digital Content Creation & Animation Skills' },
  { name: 'Rendering',                             category: 'Digital Content Creation & Animation Skills' },
  // extras not in doc — closest category
  { name: 'Character Design',                      category: 'Digital Content Creation & Animation Skills' },
  { name: 'Environment Design',                    category: 'Digital Content Creation & Animation Skills' },
  { name: 'Video Editing',                         category: 'Digital Content Creation & Animation Skills' },
  { name: 'Color Grading',                         category: 'Digital Content Creation & Animation Skills' },
  { name: 'Storyboarding',                         category: 'Digital Content Creation & Animation Skills' },
  { name: 'Illustration',                          category: 'Digital Content Creation & Animation Skills' },
  { name: 'Art Direction',                         category: 'Digital Content Creation & Animation Skills' },
  { name: 'Graphic Design',                        category: 'Digital Content Creation & Animation Skills' },

  // ── 5. Marketing & Growth Skills ──────────────────────────────
  { name: 'Brand Strategy',                        category: 'Marketing & Growth Skills' },
  { name: 'Content Marketing',                     category: 'Marketing & Growth Skills' },
  { name: 'SEO & SEM',                             category: 'Marketing & Growth Skills' },
  { name: 'Social Media Strategy',                 category: 'Marketing & Growth Skills' },
  { name: 'Data Analytics & Reporting',            category: 'Marketing & Growth Skills' },
  { name: 'Campaign Management',                   category: 'Marketing & Growth Skills' },
  { name: 'Performance Marketing',                 category: 'Marketing & Growth Skills' },
  { name: 'Email Marketing',                       category: 'Marketing & Growth Skills' },
  // extras not in doc — closest category
  { name: 'Copywriting / Scriptwriting',           category: 'Marketing & Growth Skills' },
];

async function main() {
  console.log('Processing renames…');
  for (const r of RENAMES) {
    const existing = await prisma.skill.findUnique({ where: { name: r.from } });
    if (!existing) continue;
    const targetExists = await prisma.skill.findUnique({ where: { name: r.to } });
    if (targetExists) {
      // Target name already exists (prev run created it) — just update category on target, delete old
      await prisma.skill.update({ where: { name: r.to }, data: { category: r.cat } });
      if (r.from !== r.to) await prisma.skill.delete({ where: { name: r.from } });
    } else {
      await prisma.skill.update({ where: { name: r.from }, data: { name: r.to, category: r.cat } });
    }
    if (r.from !== r.to) console.log(`  renamed: "${r.from}" → "${r.to}"`);
  }

  console.log(`\nUpserting ${SKILLS.length} skills…`);
  let created = 0, updated = 0;
  for (const s of SKILLS) {
    const existing = await prisma.skill.findUnique({ where: { name: s.name } });
    if (existing) {
      await prisma.skill.update({ where: { name: s.name }, data: { category: s.category } });
      updated++;
    } else {
      await prisma.skill.create({ data: s });
      created++;
    }
  }

  console.log(`✓ ${created} created, ${updated} updated\n`);
  console.log('Final breakdown:');
  const cats = [...new Set(SKILLS.map(s => s.category))];
  for (const cat of cats) {
    const count = SKILLS.filter(s => s.category === cat).length;
    console.log(`  ${cat}: ${count}`);
  }
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
