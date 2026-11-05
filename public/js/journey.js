// ══════════════════════════════════════════════════════════════
// MY JOURNEY — a person's whole time at the studio on one page.
//   /journey.html             → the logged-in user's own journey
//   /journey.html?person=<id> → someone else's (ADMIN / PRODUCER / PM;
//                               the API returns 403 for anyone else)
//
// Everything comes from one call: GET /api/me/journey[/:personId]
// (src/me/me.service.ts → getJourney). Nothing is stored for this page —
// projects, capacity, deals and badges are all worked out from existing data.
// Money is decided by the API: if `value` / `rewardValue` aren't in the
// response, this viewer isn't allowed to see them, so we just don't show them.
// Depends on: $, esc, fmtMoney, coBadge (shared.js)
// ══════════════════════════════════════════════════════════════

const JR_STATUS_LABEL = {
  BRIEF: 'Brief', IN_PROGRESS: 'In progress', INTERNAL_REVIEW: 'Internal review',
  DELIVERED: 'Delivered', ON_HOLD: 'On hold', CANCELLED: 'Cancelled',
};
const JR_STATUS_CLS = {
  BRIEF:           'bg-sky-500/15 text-sky-400',
  IN_PROGRESS:     'bg-accent/15 text-accent',
  INTERNAL_REVIEW: 'bg-purple-500/15 text-purple-400',
  DELIVERED:       'bg-emerald-500/15 text-emerald-400',
  ON_HOLD:         'bg-zinc-500/15 text-zinc-400',
};

// Timeline entry look, by kind. JOINED / COMMITTEE / DEAL are built by the
// API; the rest are PersonEvent types added on the People profile.
const JR_KIND = {
  JOINED:            { icon: '🎉', cls: 'bg-accent/15 text-accent' },
  ACHIEVEMENT:       { icon: '🎖️', cls: 'bg-emerald-500/15 text-emerald-400' },
  PROMOTION:         { icon: '🏆', cls: 'bg-yellow-500/15 text-yellow-400' },
  ROLE_CHANGE:       { icon: '🔄', cls: 'bg-sky-500/15 text-sky-400' },
  DEPARTMENT_CHANGE: { icon: '🏢', cls: 'bg-purple-500/15 text-purple-400' },
  NOTE:              { icon: '📝', cls: 'bg-zinc-500/15 text-zinc-400' },
  COMMITTEE:         { icon: '🏛️', cls: 'bg-indigo-500/15 text-indigo-400' },
  DEAL:              { icon: '🤝', cls: 'bg-emerald-500/15 text-emerald-400' },
};

function jrDate(iso, withDay = true) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', withDay
    ? { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }
    : { month: 'short', year: 'numeric', timeZone: 'UTC' });
}
function jrTenure(days) {
  if (days < 30)  return `${days} day${days === 1 ? '' : 's'}`;
  if (days < 365) return `${Math.floor(days / 30)} mo`;
  const yr = Math.floor(days / 365), mo = Math.floor((days % 365) / 30);
  return mo ? `${yr} yr ${mo} mo` : `${yr} yr`;
}
// "2.5 weeks" — capacity added up as person-weeks (100% for a week = 1).
function jrWeeks(n) { return `${n % 1 ? n.toFixed(1) : n} wk${n === 1 ? '' : 's'}`; }

function jrCard(title, body, extra = '') {
  return `
    <section class="bg-panel border border-line rounded-xl p-5 mb-5 ${extra}">
      <h2 class="text-[11px] font-semibold uppercase tracking-widest text-muted mb-4">${title}</h2>
      ${body}
    </section>`;
}
function jrStat(label, value, sub = '') {
  return `
    <div class="bg-panel2/60 border border-line rounded-xl px-4 py-3">
      <div class="text-[11px] text-muted">${label}</div>
      <div class="text-xl font-bold text-ink mt-0.5">${value}</div>
      ${sub ? `<div class="text-[11px] text-muted mt-0.5">${sub}</div>` : ''}
    </div>`;
}
// Project names link to the project page — but only for roles that can open
// the Projects tab (SALES can't, and would just be bounced to My Work).
function jrProjLink(p, cls) {
  return canAccessTab('projects')
    ? `<a href="/projects.html?open=${encodeURIComponent(p.id)}" class="${cls} hover:text-accent">${esc(p.name)}</a>`
    : `<span class="${cls}">${esc(p.name)}</span>`;
}
function jrEmpty(text) { return `<p class="text-xs text-muted">${text}</p>`; }

// ── load ──────────────────────────────────────────────────────

async function loadJourney() {
  const el = $('jr-content');
  const otherId = new URLSearchParams(location.search).get('person');
  const url = otherId ? `/api/me/journey/${encodeURIComponent(otherId)}` : '/api/me/journey';

  const res  = await fetch(url).catch(() => null);
  const data = res ? await res.json().catch(() => null) : null;

  if (!res || !res.ok || !data) {
    el.innerHTML = `<div class="text-center text-muted text-sm py-16">
      ${res && res.status === 403 ? 'You can only view your own journey.' : 'Could not load this journey.'}</div>`;
    return;
  }
  if (!data.linked) {
    el.innerHTML = `<div class="bg-yellow-500/10 border border-yellow-500/30 rounded-xl px-5 py-4 text-xs text-yellow-400">
      Your account isn't linked to a staff record yet. Ask an admin to link your login to your
      Person record on the People tab — then your journey will appear here.</div>`;
    return;
  }
  document.title = data.viewer.isSelf ? 'Pop OS — My Journey' : `Pop OS — ${data.person.name}'s Journey`;
  el.innerHTML = renderJourney(data);
}

// ── render ────────────────────────────────────────────────────

function renderJourney(d) {
  return [
    jrHero(d),
    jrBadges(d.badges),
    `<div class="grid grid-cols-1 lg:grid-cols-5 gap-5">
       <div class="lg:col-span-3">${jrThisYear(d)}</div>
       <div class="lg:col-span-2">${jrComingUp(d.comingUp)}${jrAwards(d)}</div>
     </div>`,
    jrYears(d),
    jrTimeline(d),
  ].join('');
}

function jrHero(d) {
  const p = d.person, l = d.lifetime;
  const back = d.viewer.isSelf ? '' : `
    <a href="/people.html" class="text-xs text-muted hover:text-ink transition-colors">← People</a>`;
  return `
    <div class="flex items-center justify-between mb-4">${back}<span></span></div>
    <div class="flex items-start gap-5 mb-5">
      <div class="w-16 h-16 rounded-2xl bg-panel2 border border-line flex items-center justify-center
                  text-2xl font-bold text-accent shrink-0">${esc(p.name.charAt(0).toUpperCase())}</div>
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 flex-wrap">
          <h1 class="text-xl font-bold text-ink">${d.viewer.isSelf ? 'My journey' : esc(p.name)}</h1>
          ${coBadge(p.company)}
        </div>
        <p class="text-sm text-muted mt-0.5">${d.viewer.isSelf ? esc(p.name) + ' · ' : ''}${esc(p.role)} · ${esc(p.department)}</p>
        <p class="text-xs text-muted mt-1.5">
          Joined ${jrDate(p.startDate)} · <span class="text-accent font-semibold">${jrTenure(l.tenureDays)} with the studio</span>
        </p>
      </div>
    </div>
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
      ${jrStat('Projects, all time', l.projectCount)}
      ${jrStat('Weeks booked, all time', jrWeeks(l.weeksBooked), 'on the capacity board')}
      ${jrStat('Deals closed', l.dealCount)}
      ${jrStat('Awards &amp; rewards', l.awardCount)}
    </div>`;
}

// Badge shelf — earned in colour, locked greyed with "how far to go".
function jrBadges(badges) {
  const earned = badges.filter(b => b.earned).length;
  const groups = [...new Set(badges.map(b => b.group))];
  const body = groups.map(g => `
    <div class="mb-3 last:mb-0">
      <p class="text-[11px] text-muted mb-1.5">${g}</p>
      <div class="flex flex-wrap gap-2">
        ${badges.filter(b => b.group === g).map(b => b.earned
          ? `<span class="inline-flex items-center gap-1.5 bg-accent/10 border border-accent/30 text-accent
                          px-3 py-1.5 rounded-full text-xs font-medium">${b.icon} ${esc(b.label)}</span>`
          : `<span title="${esc(b.hint || '')}" class="inline-flex items-center gap-1.5 bg-panel2/50 border border-line
                          text-muted/70 px-3 py-1.5 rounded-full text-xs">
               <span class="grayscale opacity-50">${b.icon}</span> ${esc(b.label)}
               ${b.hint ? `<span class="text-[10px] text-muted/60">· ${esc(b.hint)}</span>` : ''}
             </span>`).join('')}
      </div>
    </div>`).join('');
  return jrCard(`Badges <span class="text-accent ml-1">${earned}/${badges.length}</span>`, body);
}

function jrThisYear(d) {
  const t = d.thisYear;
  const stats = `
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
      ${jrStat('Projects', t.projects.length)}
      ${jrStat('Weeks booked', jrWeeks(t.weeksBooked))}
      ${jrStat('Avg weekly load', t.avgLoadPct != null ? t.avgLoadPct + '%' : '—', 'in booked weeks')}
      ${jrStat('Deals closed', t.deals.length, t.dealValue != null && t.deals.length ? fmtMoney(t.dealValue) : '')}
    </div>`;

  const projects = t.projects.length ? `
    <div class="divide-y divide-line/60">
      ${t.projects.map(p => `
        <div class="flex items-center gap-3 py-2">
          ${jrProjLink(p, 'text-sm text-ink truncate flex-1 min-w-0')}
          <span class="text-[11px] text-muted shrink-0">${p.involvement.map(esc).join(' · ')}</span>
          <span class="badge text-[10px] ${JR_STATUS_CLS[p.status] || ''} shrink-0">${JR_STATUS_LABEL[p.status] || p.status}</span>
          <span class="text-xs text-ink font-semibold w-16 text-right shrink-0">${p.weeks ? jrWeeks(p.weeks) : '—'}</span>
        </div>`).join('')}
    </div>` : jrEmpty('No projects yet this year.');

  const deals = t.deals.length ? `
    <p class="text-[11px] font-semibold uppercase tracking-widest text-muted mt-5 mb-2">Deals closed</p>
    <div class="divide-y divide-line/60">
      ${t.deals.map(x => `
        <div class="flex items-center gap-3 py-2">
          <span class="text-sm text-ink truncate flex-1 min-w-0">${esc(x.name)}
            ${x.client ? `<span class="text-muted text-xs">· ${esc(x.client)}</span>` : ''}</span>
          <span class="text-[11px] text-muted shrink-0">${jrDate(x.wonAt)}</span>
          ${'value' in x ? `<span class="text-xs text-ink font-semibold w-24 text-right shrink-0">${x.value != null ? fmtMoney(x.value) : '—'}</span>` : ''}
        </div>`).join('')}
    </div>` : '';

  return jrCard(`This year · ${d.year}`, stats + projects + deals);
}

function jrComingUp(c) {
  const weeks = c.weeks.length ? c.weeks.map(w => {
    const pct = w.totalPct, bar = Math.min(100, pct);
    const barCls = pct > 100 ? 'bg-warm' : pct >= 80 ? 'bg-accent' : 'bg-accent/50';
    return `
      <div class="mb-2.5" title="${w.entries.map(e => `${esc(e.projectName)} ${e.pct}%`).join('\n')}">
        <div class="flex items-center justify-between text-[11px] mb-1">
          <span class="text-muted">w/c ${jrDate(w.weekStart)}</span>
          <span class="text-ink font-semibold">${pct}%</span>
        </div>
        <div class="h-1.5 bg-panel2 rounded-full overflow-hidden"><div class="h-full ${barCls}" style="width:${bar}%"></div></div>
        <p class="text-[10px] text-muted mt-1 truncate">${w.entries.map(e => esc(e.projectName)).join(', ')}</p>
      </div>`;
  }).join('') : jrEmpty('Nothing booked for the next 8 weeks.');

  const projects = c.projects.length ? `
    <p class="text-[11px] font-semibold uppercase tracking-widest text-muted mt-4 mb-2">Projects in progress</p>
    ${c.projects.map(p => `
      <div class="flex items-center gap-2 py-1.5">
        ${jrProjLink(p, 'text-xs text-ink truncate flex-1 min-w-0')}
        <span class="text-[11px] text-muted shrink-0">${p.deadline ? 'due ' + jrDate(p.deadline) : 'no deadline'}</span>
      </div>`).join('')}` : '';

  return jrCard('Coming up', weeks + projects);
}

function jrAwards(d) {
  const body = d.awards.length ? d.awards.map(a => `
    <div class="flex items-start gap-3 py-2 border-b border-line/60 last:border-0">
      <span class="text-lg leading-none mt-0.5">🎖️</span>
      <div class="flex-1 min-w-0">
        <p class="text-sm text-ink font-medium">${esc(a.title)}</p>
        ${a.note ? `<p class="text-[11px] text-muted mt-0.5">${esc(a.note)}</p>` : ''}
        <p class="text-[11px] text-muted mt-0.5">${jrDate(a.eventDate)}</p>
      </div>
      ${a.rewardValue != null ? `<span class="text-xs text-emerald-400 font-semibold shrink-0">${fmtMoney(a.rewardValue)}</span>` : ''}
    </div>`).join('')
    : jrEmpty('No awards yet. Awards and rewards are added by an admin on the People profile.');
  return jrCard('Awards &amp; rewards', body);
}

// One row per calendar year since joining — click to see that year's projects.
function jrYears(d) {
  const body = d.years.map(y => `
    <details class="group border-b border-line/60 last:border-0" ${y.year === d.year ? 'open' : ''}>
      <summary class="flex items-center gap-4 py-3 cursor-pointer list-none">
        <span class="text-sm font-bold text-ink w-12">${y.year}</span>
        <span class="text-xs text-muted flex-1 flex flex-wrap gap-x-4 gap-y-1">
          <span><span class="text-ink font-semibold">${y.projectCount}</span> project${y.projectCount === 1 ? '' : 's'}</span>
          <span><span class="text-ink font-semibold">${jrWeeks(y.weeksBooked)}</span> booked</span>
          ${y.dealCount ? `<span><span class="text-ink font-semibold">${y.dealCount}</span> deal${y.dealCount === 1 ? '' : 's'}${y.dealValue != null ? ' · ' + fmtMoney(y.dealValue) : ''}</span>` : ''}
          ${y.awardCount ? `<span>🎖️ <span class="text-ink font-semibold">${y.awardCount}</span></span>` : ''}
        </span>
        <span class="text-muted text-xs group-open:rotate-90 transition-transform">›</span>
      </summary>
      <div class="pb-3 pl-16">
        ${y.projects.length ? y.projects.map(p => `
          <div class="flex items-center gap-3 py-1">
            ${jrProjLink(p, 'text-xs text-ink truncate flex-1 min-w-0')}
            <span class="text-[11px] text-muted shrink-0">${p.involvement.map(esc).join(' · ')}</span>
            <span class="text-[11px] text-ink w-14 text-right shrink-0">${p.weeks ? jrWeeks(p.weeks) : '—'}</span>
          </div>`).join('') : jrEmpty('No projects recorded this year.')}
      </div>
    </details>`).join('');
  return jrCard('Year by year', body);
}

// Lifetime timeline, newest first, with a year heading whenever the year changes.
function jrTimeline(d) {
  let lastYear = null;
  const rows = d.timeline.map(e => {
    const y = new Date(e.date).getUTCFullYear();
    const head = y !== lastYear ? `<p class="text-xs font-bold text-accent mt-4 first:mt-0 mb-2">${y}</p>` : '';
    lastYear = y;
    const k = JR_KIND[e.kind] || JR_KIND.NOTE;
    const money = e.rewardValue != null ? fmtMoney(e.rewardValue) : e.value != null ? fmtMoney(e.value) : '';
    return head + `
      <div class="flex gap-3 pb-3">
        <div class="w-7 h-7 rounded-full ${k.cls} flex items-center justify-center text-sm shrink-0">${k.icon}</div>
        <div class="flex-1 min-w-0 pt-0.5">
          <div class="flex items-start justify-between gap-2">
            <p class="text-xs font-semibold text-ink">${esc(e.title)}</p>
            <span class="text-[11px] text-muted whitespace-nowrap">${jrDate(e.date)}</span>
          </div>
          ${e.note || money ? `<p class="text-[11px] text-muted mt-0.5">${e.note ? esc(e.note) : ''}${e.note && money ? ' · ' : ''}${money ? `<span class="text-emerald-400">${money}</span>` : ''}</p>` : ''}
        </div>
      </div>`;
  }).join('');
  return jrCard('Timeline', rows || jrEmpty('Nothing yet.'));
}
