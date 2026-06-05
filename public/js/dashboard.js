// ══════════════════════════════════════════════════════════════
// DASHBOARD — command centre
// Depends on: $, esc, matchesFilter, coBadge  (index.html)
//             QUADRANT_CLS, QUADRANT_LABEL, STATUS_LABEL, PRI_CLS  (projects.js)
// ══════════════════════════════════════════════════════════════

function fmtShortDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

function daysOverdue(deadline) {
  if (!deadline) return 0;
  const diff = Date.now() - new Date(deadline).getTime();
  return Math.floor(diff / 86_400_000);
}

// Map priority to a short label with colour class.
function priChip(p) {
  const cls = (typeof PRI_CLS !== 'undefined' ? PRI_CLS : {})[p] || 'text-muted';
  return `<span class="text-xs ${cls}">${p}</span>`;
}

function quadBadge(q) {
  const cls   = (typeof QUADRANT_CLS   !== 'undefined' ? QUADRANT_CLS   : {})[q] || 'bg-panel2 text-muted';
  const label = (typeof QUADRANT_LABEL !== 'undefined' ? QUADRANT_LABEL : {})[q] || q;
  return `<span class="badge ${cls}">${label}</span>`;
}

function statBadge(s) {
  const label = (typeof STATUS_LABEL !== 'undefined' ? STATUS_LABEL : {})[s] || s;
  const cls   = s === 'IN_PROGRESS'     ? 'text-accent'
              : s === 'INTERNAL_REVIEW' ? 'text-yellow-400'
              : s === 'ON_HOLD'         ? 'text-warm'
              : 'text-muted';
  return `<span class="text-xs ${cls}">${label}</span>`;
}

// ── capacity mini-bar ─────────────────────────────────────────

function capBar(pct) {
  const capped = Math.min(pct, 100);
  const cls    = pct > 100 ? 'bg-warm' : pct >= 80 ? 'bg-accent' : 'bg-muted/50';
  return `<div class="w-14 h-1.5 bg-line rounded-full overflow-hidden inline-block align-middle">
    <div class="h-full ${cls} rounded-full" style="width:${capped}%"></div>
  </div>`;
}

// ── main render ───────────────────────────────────────────────

async function loadDashboard() {
  const data = await fetch('/api/dashboard').then(r => r.json()).catch(() => null);
  if (!data) {
    $('dash-active').innerHTML = $('dash-week').innerHTML = $('dash-overdue').innerHTML =
      '<div class="text-center text-muted text-sm py-8">Could not load data.</div>';
    return;
  }
  renderDashboard(data);
}

function renderDashboard(data) {
  const { stats, activeProjects, overdueProjects, thisWeek } = data;

  // Apply company filter.
  const filtered   = activeProjects.filter(p => matchesFilter(p.company));
  const overdueFil = overdueProjects.filter(p => matchesFilter(p.company));
  const allocFil   = thisWeek.allocations.filter(a => matchesFilter(a.project.company));
  const freeFil    = thisWeek.unallocatedPeople.filter(p => matchesFilter(p.company));

  // ── stats strip ─────────────────────────────────────────────
  $('dash-stats').innerHTML =
    `<span class="text-ink font-semibold">${stats.activePeople}</span><span class="text-muted"> active</span>` +
    ` <span class="text-line mx-2">·</span> ` +
    `<span class="text-ink font-semibold">${stats.warmPool}</span><span class="text-muted"> warm pool</span>` +
    ` <span class="text-line mx-2">·</span> ` +
    `<span class="text-ink font-semibold">${filtered.length}</span><span class="text-muted"> active projects</span>` +
    (overdueFil.length
      ? ` <span class="text-line mx-2">·</span> <span class="text-warm font-semibold">${overdueFil.length} overdue</span>`
      : '') +
    ` <span class="text-line mx-2">·</span> ` +
    `<span class="text-ink font-semibold">${allocFil.length ? new Set(allocFil.map(a => a.personId)).size : 0}</span><span class="text-muted"> allocated this week</span>` +
    (freeFil.length
      ? ` <span class="text-line mx-2">·</span> <span class="text-muted">${freeFil.length} unallocated</span>`
      : '');

  // ── panel: active projects ───────────────────────────────────
  if (!filtered.length) {
    $('dash-active').innerHTML = '<div class="text-center text-muted text-sm py-8">No active projects.</div>';
  } else {
    $('dash-active').innerHTML = filtered.map(p => {
      const dl = p.deadline ? fmtShortDate(p.deadline) : null;
      const overdue = p.deadline && new Date(p.deadline) < new Date();
      return `<div class="flex items-start gap-2 py-2.5 border-b border-line/60 last:border-0">
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-1.5 flex-wrap">
            ${priChip(p.priority)}
            ${quadBadge(p.quadrant)}
            ${coBadge(p.company)}
          </div>
          <p class="text-sm font-medium text-ink mt-0.5 truncate">${esc(p.name)}</p>
          <div class="flex items-center gap-2 mt-0.5">
            ${statBadge(p.status)}
            ${dl ? `<span class="text-xs ${overdue ? 'text-warm font-semibold' : 'text-muted'}">${dl}${overdue ? ' ⚠' : ''}</span>` : ''}
          </div>
        </div>
      </div>`;
    }).join('');
  }

  // ── panel: this week's capacity ──────────────────────────────
  // Group by person.
  const byPerson = {};
  for (const a of allocFil) {
    if (!byPerson[a.personId]) byPerson[a.personId] = { person: a.person, entries: [], total: 0 };
    byPerson[a.personId].entries.push(a);
    byPerson[a.personId].total += a.pctWeek;
  }
  const groups = Object.values(byPerson);

  let weekHtml = '';
  if (!groups.length) {
    weekHtml = '<div class="text-center text-muted text-sm py-8">No allocations this week.</div>';
  } else {
    weekHtml = groups.map(g => {
      const totalCls = g.total > 100 ? 'text-warm font-bold'
                     : g.total >= 80  ? 'text-accent font-semibold'
                     : 'text-muted';
      const projectList = g.entries.map(e =>
        `<span class="text-xs text-muted">${esc(e.project.name)} <span class="text-muted/60">${e.pctWeek}%</span></span>`
      ).join('<span class="text-line mx-1">·</span>');
      return `<div class="py-2.5 border-b border-line/60 last:border-0">
        <div class="flex items-center justify-between gap-2">
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium text-ink truncate">${esc(g.person.name)}</p>
            <div class="flex flex-wrap gap-x-1 mt-0.5">${projectList}</div>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            ${capBar(g.total)}
            <span class="text-xs ${totalCls} w-10 text-right">${g.total}%</span>
          </div>
        </div>
      </div>`;
    }).join('');
  }

  // Append unallocated people if any.
  if (freeFil.length) {
    weekHtml += `<div class="mt-3 pt-3 border-t border-line">
      <p class="text-[10px] font-semibold uppercase tracking-widest text-muted mb-2">Unallocated this week</p>
      <div class="flex flex-wrap gap-1.5">
        ${freeFil.map(p => `<span class="badge bg-panel2 border border-line text-muted">${esc(p.name)}</span>`).join('')}
      </div>
    </div>`;
  }
  $('dash-week').innerHTML = weekHtml;

  // ── panel: overdue / alerts ──────────────────────────────────
  if (!overdueFil.length) {
    $('dash-overdue').innerHTML = '<div class="text-center text-muted text-sm py-8">Nothing overdue — all good.</div>';
  } else {
    $('dash-overdue').innerHTML = overdueFil.map(p => {
      const days = daysOverdue(p.deadline);
      return `<div class="flex items-start gap-2 py-2.5 border-b border-line/60 last:border-0">
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-1.5 flex-wrap">
            ${priChip(p.priority)} ${quadBadge(p.quadrant)} ${coBadge(p.company)}
          </div>
          <p class="text-sm font-medium text-ink mt-0.5 truncate">${esc(p.name)}</p>
          <div class="flex items-center gap-2 mt-0.5">
            ${statBadge(p.status)}
            <span class="text-xs text-warm font-semibold">${days}d overdue</span>
          </div>
          ${p.producer ? `<p class="text-xs text-muted mt-0.5">Producer: ${esc(p.producer.name)}</p>` : ''}
        </div>
      </div>`;
    }).join('');
  }
}
