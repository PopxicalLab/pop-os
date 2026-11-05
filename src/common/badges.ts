// ── Auto badges ──────────────────────────────────────────────────────
// Milestone badges are CALCULATED, never stored: every time a profile or
// journey page loads, we count what the person has done and tick off the
// milestones they've reached. That means no table to keep in sync, and a
// badge appears the moment the data behind it exists (e.g. a deal is marked
// WON → "First Deal" lights up on the next page load).
//
// Hand-given awards / rewards are different — those are PersonEvent rows of
// type ACHIEVEMENT, added by an admin on the person profile.
//
// Used by both the People profile (people.service.ts) and the journey page
// (me.service.ts) so the two always show the same list.

export interface BadgeInput {
  startDate:      Date | string;
  skillRatings:   number[];  // current rating of every skill the person has
  projectCount:   number;    // distinct projects ever worked on
  dealCount:      number;    // deals they closed as WON / COMPLETED
  committeeCount: number;    // committees ever served on
  awardCount:     number;    // hand-given ACHIEVEMENT events
}

export interface Badge {
  id:     string;
  group:  'Tenure' | 'Projects' | 'Sales' | 'Skills' | 'Community';
  label:  string;
  icon:   string;
  earned: boolean;
  hint:   string | null;   // for a locked badge: how far to go, e.g. "3 more projects"
}

export function computeBadges(i: BadgeInput): Badge[] {
  const badges: Badge[] = [];
  const tenureDays = Math.floor((Date.now() - new Date(i.startDate).getTime()) / 86_400_000);

  // `have` = what they've got now, `need` = the milestone, `unit` = for the hint.
  // A badge is earned once have >= need; otherwise the hint says how many to go.
  const add = (id: string, group: Badge['group'], label: string, icon: string,
               have: number, need: number, unit: string) => {
    const earned = have >= need;
    const left   = need - have;
    badges.push({
      id, group, label, icon, earned,
      hint: earned ? null : `${left} more ${unit}${left === 1 || unit.endsWith('s') ? '' : 's'}`,
    });
  };
  // Tenure hints read better in months than "275 more days".
  const addTenure = (id: string, label: string, icon: string, days: number) => {
    const earned = tenureDays >= days;
    const monthsLeft = Math.max(1, Math.ceil((days - tenureDays) / 30));
    badges.push({
      id, group: 'Tenure', label, icon, earned,
      hint: earned ? null : `in about ${monthsLeft} month${monthsLeft === 1 ? '' : 's'}`,
    });
  };

  // Tenure
  addTenure('tenure-90',   '3 Months', '🌱', 90);
  addTenure('tenure-180',  '6 Months', '🌿', 180);
  addTenure('tenure-365',  '1 Year',   '⭐', 365);
  addTenure('tenure-1095', '3 Years',  '🏅', 1095);
  addTenure('tenure-1825', '5 Years',  '🏆', 1825);
  addTenure('tenure-3650', '10 Years', '👑', 3650);

  // Projects
  add('proj-first', 'Projects', 'First Project', '🚀', i.projectCount, 1,  'project');
  add('proj-five',  'Projects', '5 Projects',    '📦', i.projectCount, 5,  'project');
  add('proj-ten',   'Projects', '10 Projects',   '🎬', i.projectCount, 10, 'project');
  add('proj-25',    'Projects', '25 Projects',   '🎞️', i.projectCount, 25, 'project');
  add('proj-50',    'Projects', '50 Projects',   '🌟', i.projectCount, 50, 'project');

  // Sales — only shown to people who have closed at least one deal, so a
  // 3D artist's shelf isn't full of sales badges they'll never chase.
  if (i.dealCount > 0) {
    add('deal-first', 'Sales', 'First Deal', '🤝', i.dealCount, 1,  'deal');
    add('deal-five',  'Sales', '5 Deals',    '💼', i.dealCount, 5,  'deal');
    add('deal-ten',   'Sales', '10 Deals',   '🎯', i.dealCount, 10, 'deal');
    add('deal-25',    'Sales', '25 Deals',   '🏹', i.dealCount, 25, 'deal');
  }

  // Skills
  const skillCount = i.skillRatings.length;
  const maxRating  = Math.max(0, ...i.skillRatings);
  add('skill-first',  'Skills', 'First Skill', '🧩', skillCount, 1,  'skill');
  add('skill-five',   'Skills', '5 Skills',    '🧠', skillCount, 5,  'skill');
  add('skill-ten',    'Skills', '10 Skills',   '💡', skillCount, 10, 'skill');
  badges.push({
    id: 'skill-master', group: 'Skills', label: 'Skill Master', icon: '⚡',
    earned: maxRating === 5,
    hint: maxRating === 5 ? null : 'reach 5/5 in any skill',
  });

  // Community
  add('committee', 'Community', 'Committee Member', '🏛️', i.committeeCount, 1, 'committee');
  add('award',     'Community', 'Recognised',       '🎖️', i.awardCount,     1, 'award');

  return badges;
}
