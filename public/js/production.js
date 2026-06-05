// ══════════════════════════════════════════════════════════════
// PRODUCTION ENGINE — lane board
// Depends on: $, esc, matchesFilter, coBadge  (index.html)
//             STATUS_LABEL, PRI_CLS  (projects.js)
// ══════════════════════════════════════════════════════════════

const LANE_CLS = {
  gold:    { header: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400',  card: 'border-yellow-500/20' },
  emerald: { header: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400', card: 'border-emerald-500/20' },
  sky:     { header: 'bg-sky-500/10 border-sky-500/30 text-sky-400',          card: 'border-sky-500/20' },
  warm:    { header: 'bg-warm/10 border-warm/30 text-warm',                   card: 'border-warm/20' },
};

async function loadProductionLanes() {
  const lanes = await fetch('/api/production/lanes').then(r => r.json()).catch(() => null);
  if (!lanes) {
    $('prod-board').innerHTML = '<div class="text-center text-muted text-sm py-10">Could not load lanes.</div>';
    return;
  }
  renderProductionBoard(lanes);
}

function renderProductionBoard(lanes) {
  // Stats strip
  const total = lanes.reduce((s, l) => s + l.projects.length, 0);
  $('prod-stats').innerHTML = lanes
    .map(l => `<span class="text-ink font-semibold">${l.projects.length}</span><span class="text-muted"> ${l.name}</span>`)
    .join(' <span class="text-line mx-1.5">·</span> ') +
    ` <span class="text-line mx-1.5">·</span> <span class="text-ink font-semibold">${total}</span><span class="text-muted"> total active</span>`;

  $('prod-board').innerHTML =
    `<div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">` +
    lanes.map(lane => {
      const cls = LANE_CLS[lane.colorKey] || LANE_CLS.sky;
      const filtered = lane.projects.filter(p => matchesFilter(p.company));

      const guidanceHtml = lane.guidance
        .map(g => `<li class="text-[11px] text-muted leading-snug">${esc(g)}</li>`)
        .join('');

      const cards = filtered.length
        ? filtered.map(p => renderLaneCard(p, cls.card)).join('')
        : `<p class="text-xs text-muted text-center py-4">No active projects</p>`;

      return `<div class="flex flex-col gap-3">
        <!-- Lane header -->
        <div class="border rounded-xl p-4 ${cls.header}">
          <p class="text-sm font-bold mb-0.5">${esc(lane.name)}</p>
          <p class="text-[11px] opacity-80 leading-snug mb-2">${esc(lane.description)}</p>
          <ul class="list-disc list-inside space-y-0.5">${guidanceHtml}</ul>
        </div>
        <!-- Project cards -->
        <div class="space-y-2">${cards}</div>
      </div>`;
    }).join('') +
    `</div>`;
}

function renderLaneCard(p, borderCls) {
  const deadline = p.deadline
    ? new Date(p.deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })
    : null;
  const overdue  = p.deadline && new Date(p.deadline) < new Date();
  const priCls   = (typeof PRI_CLS     !== 'undefined' ? PRI_CLS     : {})[p.priority] || 'text-muted';
  const statLbl  = (typeof STATUS_LABEL !== 'undefined' ? STATUS_LABEL : {})[p.status]  || p.status;

  // Asset progress summary
  const assetSummary = p.assets && p.assets.length
    ? `<p class="text-[11px] text-muted mt-1">${p.assets.length} asset${p.assets.length > 1 ? 's' : ''} · ${p.assets.filter(a => a.stage === 'FINAL_DELIVERY').length} delivered</p>`
    : '';

  return `<div class="bg-panel2 border ${borderCls} rounded-xl p-3">
    <div class="flex items-start justify-between gap-1 mb-1">
      <p class="text-xs font-semibold text-ink leading-snug flex-1">${esc(p.name)}</p>
      <span class="text-xs ${priCls} shrink-0">${p.priority}</span>
    </div>
    <div class="flex items-center gap-1.5 flex-wrap">
      ${coBadge(p.company)}
      <span class="text-[11px] text-muted">${statLbl}</span>
      ${deadline ? `<span class="text-[11px] ${overdue ? 'text-warm font-semibold' : 'text-muted'}">${deadline}${overdue ? ' ⚠' : ''}</span>` : ''}
    </div>
    ${p.producer ? `<p class="text-[11px] text-muted mt-1">Producer: ${esc(p.producer.name)}</p>` : ''}
    ${assetSummary}
    ${p.quadrant === 'DRAIN' ? `<div class="mt-1.5 text-[10px] font-semibold text-warm">Gate: Exec ${p.drainApprovedByExec ? '✓' : '✗'} · Producer ${p.drainApprovedByProducer ? '✓' : '✗'}</div>` : ''}
  </div>`;
}
