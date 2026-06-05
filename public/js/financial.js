// ══════════════════════════════════════════════════════════════
// FINANCIAL ENGINE
// Depends on: $, esc, matchesFilter, coBadge  (index.html)
//             fmtValue, QUADRANT_CLS, QUADRANT_LABEL  (projects.js)
// ══════════════════════════════════════════════════════════════

function fmtGBP(n) {
  if (n == null) return '<span class="text-muted">—</span>';
  return '£' + Math.round(n).toLocaleString('en-GB');
}

function healthBadge(health) {
  if (health === 'green')   return '<span class="inline-block w-2 h-2 rounded-full bg-emerald-400 mr-1"></span>';
  if (health === 'amber')   return '<span class="inline-block w-2 h-2 rounded-full bg-yellow-400 mr-1"></span>';
  if (health === 'red')     return '<span class="inline-block w-2 h-2 rounded-full bg-warm mr-1"></span>';
  return '<span class="inline-block w-2 h-2 rounded-full bg-muted/40 mr-1"></span>';
}

function marginColour(margin) {
  if (margin == null) return 'text-muted';
  if (margin < 0)    return 'text-warm font-bold';
  if (margin < 20)   return 'text-warm font-semibold';
  if (margin < 35)   return 'text-yellow-400';
  return 'text-emerald-400';
}

async function loadFinancial() {
  const [overview, projects] = await Promise.all([
    fetch('/api/financial/overview').then(r => r.json()).catch(() => null),
    fetch('/api/financial/projects').then(r => r.json()).catch(() => null),
  ]);

  if (!overview || !projects) {
    $('fin-content').innerHTML = '<div class="text-center text-muted text-sm py-10">Could not load financial data.</div>';
    return;
  }

  renderFinancialOverview(overview);
  renderFinancialProjects(projects);
}

function renderFinancialOverview(o) {
  $('fin-stats').innerHTML =
    `<span class="text-ink font-semibold">${fmtGBP(o.weekCost)}</span><span class="text-muted"> studio cost this week</span>` +
    ` <span class="text-line mx-2">·</span> ` +
    `<span class="text-ink font-semibold">${fmtGBP(o.totalPipelineValue)}</span><span class="text-muted"> pipeline value</span>` +
    (o.avgTargetMargin != null
      ? ` <span class="text-line mx-2">·</span> <span class="text-ink font-semibold">${o.avgTargetMargin}%</span><span class="text-muted"> avg target margin</span>`
      : '') +
    ` <span class="text-line mx-2">·</span> ` +
    `<span class="text-ink font-semibold">${o.activeProjects}</span><span class="text-muted"> active projects</span>`;
}

function renderFinancialProjects(rows) {
  const filtered = rows.filter(r => matchesFilter(r.project.company));

  if (!filtered.length) {
    $('fin-table-body').innerHTML =
      `<tr><td colspan="8" class="py-10 text-center text-muted text-sm">No active projects.</td></tr>`;
    return;
  }

  // Sort: worst health first (red → amber → green → unknown).
  const order = { red: 0, amber: 1, green: 2, unknown: 3 };
  filtered.sort((a, b) => (order[a.health] ?? 3) - (order[b.health] ?? 3));

  $('fin-table-body').innerHTML = filtered.map(r => {
    const p        = r.project;
    const qCls     = (typeof QUADRANT_CLS   !== 'undefined' ? QUADRANT_CLS   : {})[p.quadrant] || 'bg-panel2 text-muted';
    const qLabel   = (typeof QUADRANT_LABEL !== 'undefined' ? QUADRANT_LABEL : {})[p.quadrant] || p.quadrant;
    const remaining = r.estimatedValue != null ? r.estimatedValue - r.costToDate : null;
    const marginDiff = (r.grossMargin != null && r.targetMargin != null)
      ? Math.round((r.grossMargin - r.targetMargin) * 10) / 10
      : null;

    const missingNote = r.missingSalary
      ? '<span class="text-[10px] text-warm ml-1" title="Some team members have no salary set">⚠ partial</span>'
      : '';

    return `<tr class="border-b border-line/60 hover:bg-panel2/40 transition-colors">
      <td class="py-3 px-3">
        <p class="text-sm font-medium text-ink">${esc(p.name)}</p>
        <div class="flex items-center gap-1 mt-0.5">
          <span class="badge ${qCls} text-[10px]">${qLabel}</span>
          ${coBadge(p.company)}
        </div>
      </td>
      <td class="py-3 px-3 text-xs text-muted">${p.producer ? esc(p.producer.name) : '—'}</td>
      <td class="py-3 px-3 text-sm text-right">${fmtGBP(r.estimatedValue)}</td>
      <td class="py-3 px-3 text-sm text-right">
        ${fmtGBP(r.costToDate)}${missingNote}
        <p class="text-[10px] text-muted">${r.totalManDays}d · ${r.weeksTracked}w</p>
      </td>
      <td class="py-3 px-3 text-sm text-right ${remaining != null && remaining < 0 ? 'text-warm font-semibold' : 'text-muted'}">
        ${remaining != null ? fmtGBP(remaining) : '—'}
      </td>
      <td class="py-3 px-3 text-sm text-right">
        <span class="${marginColour(r.grossMargin)}">${r.grossMargin != null ? r.grossMargin + '%' : '—'}</span>
        ${r.targetMargin != null ? `<p class="text-[10px] text-muted">target ${r.targetMargin}%</p>` : ''}
      </td>
      <td class="py-3 px-3 text-sm text-right">
        ${marginDiff != null
          ? `<span class="${marginDiff >= 0 ? 'text-emerald-400' : 'text-warm font-semibold'}">${marginDiff >= 0 ? '+' : ''}${marginDiff}%</span>`
          : '<span class="text-muted">—</span>'}
      </td>
      <td class="py-3 px-3 text-center">
        ${healthBadge(r.health)}
      </td>
    </tr>`;
  }).join('');
}
