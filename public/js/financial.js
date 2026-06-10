// ══════════════════════════════════════════════════════════════
// FINANCIAL ENGINE + FINANCE DASHBOARD
// Depends on: $, esc, matchesFilter, coBadge  (index.html)
//             fmtValue, QUADRANT_CLS, QUADRANT_LABEL  (projects.js)
// ══════════════════════════════════════════════════════════════

function fmtMYR(n) {
  if (n == null) return '<span class="text-muted">—</span>';
  return 'RM ' + Math.round(n).toLocaleString('en-MY');
}

function fmtMYRPlain(n) {
  if (n == null || n === 0) return 'RM 0';
  return 'RM ' + Math.round(n).toLocaleString('en-MY');
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

// ── load ──────────────────────────────────────────────────────

async function loadFinancial() {
  const role  = (JSON.parse(localStorage.getItem('pop-os-user') || '{}')).role;
  const isPM  = role === 'PM';

  // PM sees project cost breakdown only — not the AR / Finance Dashboard panels
  if (isPM) {
    ['fin-kpi','fin-alerts-row','fin-pipeline-row','fin-recent-row'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });
  }

  const [overview, projects, dashboard] = await Promise.all([
    fetch('/api/financial/overview').then(r => r.json()).catch(() => null),
    fetch('/api/financial/projects').then(r => r.json()).catch(() => null),
    isPM ? Promise.resolve(null) : fetch('/api/financial/dashboard').then(r => r.json()).catch(() => null),
  ]);

  if (overview)   renderFinancialOverview(overview);
  if (projects)   renderFinancialProjects(projects);
  if (dashboard)  renderFinanceDashboard(dashboard);
}

// ── stats strip ───────────────────────────────────────────────

function renderFinancialOverview(o) {
  $('fin-stats').innerHTML =
    `<span class="text-ink font-semibold">${fmtMYRPlain(o.weekCost)}</span><span class="text-muted"> studio cost this week</span>` +
    ` <span class="text-line mx-2">·</span> ` +
    `<span class="text-ink font-semibold">${fmtMYRPlain(o.totalPipelineValue)}</span><span class="text-muted"> pipeline value</span>` +
    (o.avgTargetMargin != null
      ? ` <span class="text-line mx-2">·</span> <span class="text-ink font-semibold">${o.avgTargetMargin}%</span><span class="text-muted"> avg target margin</span>`
      : '') +
    ` <span class="text-line mx-2">·</span> ` +
    `<span class="text-ink font-semibold">${o.activeProjects}</span><span class="text-muted"> active projects</span>`;
}

// ── finance dashboard ─────────────────────────────────────────

function renderFinanceDashboard(d) {
  const { ar, overdueInvoices, dueSoonInvoices, pipelineByStage, health, recentDocs, activeQuotations } = d;

  // KPI cards
  const kpiCard = (label, value, valueCls, sub) =>
    `<div class="bg-panel2 border border-line rounded-xl p-5 flex flex-col gap-1">
       <p class="text-[11px] font-semibold uppercase tracking-widest text-muted">${label}</p>
       <p class="text-2xl font-bold ${valueCls}">${value}</p>
       ${sub ? `<p class="text-xs text-muted">${sub}</p>` : ''}
     </div>`;

  const overdueFlag = ar.overdueAmount > 0;
  $('fin-kpi').innerHTML =
    kpiCard('Outstanding AR',  fmtMYRPlain(ar.outstanding),   'text-ink',
            `${overdueFlag ? `<span class="text-warm">${overdueInvoices.length} overdue</span>` : 'All within terms'}`) +
    kpiCard('Overdue',         fmtMYRPlain(ar.overdueAmount),  overdueFlag ? 'text-warm' : 'text-emerald-400',
            overdueFlag ? `${overdueInvoices.length} invoice${overdueInvoices.length > 1 ? 's' : ''} past due` : 'Nothing overdue') +
    kpiCard('Total Invoiced',  fmtMYRPlain(ar.totalInvoiced),  'text-ink',
            `${activeQuotations} active quotation${activeQuotations !== 1 ? 's' : ''} in flight`) +
    kpiCard('Collected',       fmtMYRPlain(ar.totalPaid),      'text-emerald-400',
            ar.totalInvoiced > 0
              ? `${Math.round(ar.totalPaid / ar.totalInvoiced * 100)}% of invoiced`
              : 'No invoices yet');

  // Overdue invoices panel
  $('fin-overdue').innerHTML = overdueInvoices.length
    ? overdueInvoices.map(doc => renderDocRow(doc, true)).join('')
    : '<p class="text-sm text-emerald-400 py-4 text-center">Nothing overdue — all clear.</p>';

  // Due-soon panel
  $('fin-due-soon').innerHTML = dueSoonInvoices.length
    ? dueSoonInvoices.map(doc => renderDocRow(doc, false)).join('')
    : '<p class="text-sm text-muted py-4 text-center">No invoices due in the next 10 days.</p>';

  // Pipeline by stage — vivid solid colours + stacked proportion bar
  const STAGE_ORDER = ['QUALIFICATION','PROPOSAL','NEGOTIATION','WON'];
  const STAGE_LABEL = { QUALIFICATION:'Qualification', PROPOSAL:'Proposal', NEGOTIATION:'Negotiation', WON:'Won' };
  const STAGE_COLOR = { QUALIFICATION:'#38bdf8', PROPOSAL:'#facc15', NEGOTIATION:'#c084fc', WON:'#34d399' };
  const STAGE_TEXT  = { QUALIFICATION:'text-sky-400', PROPOSAL:'text-yellow-400', NEGOTIATION:'text-purple-400', WON:'text-emerald-400' };
  const totalPipeline = STAGE_ORDER.reduce((s, k) => s + (pipelineByStage[k] ?? 0), 0);

  if (totalPipeline === 0) {
    $('fin-pipeline').innerHTML = '<p class="text-sm text-muted py-4 text-center">No active leads with values.</p>';
  } else {
    const stackedBar = STAGE_ORDER.map(stage => {
      const val = pipelineByStage[stage] ?? 0;
      if (!val) return '';
      const pct = (val / totalPipeline * 100).toFixed(1);
      return `<div class="h-full transition-all" style="width:${pct}%;background:${STAGE_COLOR[stage]}" title="${STAGE_LABEL[stage]}: ${fmtMYRPlain(val)}"></div>`;
    }).join('');

    const stageRows = STAGE_ORDER.map(stage => {
      const val = pipelineByStage[stage] ?? 0;
      if (!val) return '';
      const pct = Math.round(val / totalPipeline * 100);
      return `<div class="flex items-center gap-2.5">
        <div class="w-2.5 h-2.5 rounded-full shrink-0" style="background:${STAGE_COLOR[stage]}"></div>
        <span class="text-xs text-muted w-24 shrink-0">${STAGE_LABEL[stage]}</span>
        <div class="flex-1 h-3 bg-panel2 rounded-full overflow-hidden">
          <div class="h-full rounded-full" style="width:${pct}%;background:${STAGE_COLOR[stage]}"></div>
        </div>
        <span class="text-xs font-semibold ${STAGE_TEXT[stage]} w-7 text-right shrink-0">${pct}%</span>
        <span class="text-xs font-semibold text-ink w-28 text-right shrink-0">${fmtMYRPlain(val)}</span>
      </div>`;
    }).join('');

    $('fin-pipeline').innerHTML =
      `<div class="h-4 rounded-lg overflow-hidden flex gap-px mb-4">${stackedBar}</div>
       <div class="space-y-3">${stageRows}</div>
       <p class="text-xs text-muted mt-4 pt-3 border-t border-line">
         Total pipeline: <span class="text-ink font-semibold">${fmtMYRPlain(totalPipeline)}</span>
       </p>`;
  }

  // Project health breakdown — donut chart + legend
  const HEALTH_SEGS = [
    { value: health.green,   color: '#34d399', label: 'On track',     cls: 'text-emerald-400' },
    { value: health.amber,   color: '#facc15', label: 'At risk',      cls: 'text-yellow-400'  },
    { value: health.red,     color: '#c05535', label: 'Over budget',  cls: 'text-warm'        },
    { value: health.unknown, color: '#857f73', label: 'No value set', cls: 'text-muted'       },
  ];
  const totalProjects = HEALTH_SEGS.reduce((s, seg) => s + (seg.value || 0), 0);

  if (totalProjects === 0) {
    $('fin-health').innerHTML = '<p class="text-sm text-muted py-4 text-center">No active projects.</p>';
  } else {
    const legendRows = HEALTH_SEGS.filter(s => s.value > 0).map(seg => {
      const pct = Math.round(seg.value / totalProjects * 100);
      return `<div class="flex items-center gap-2">
        <div class="w-2.5 h-2.5 rounded-full shrink-0" style="background:${seg.color}"></div>
        <span class="text-xs text-muted flex-1">${seg.label}</span>
        <span class="text-sm font-bold ${seg.cls} w-5 text-right">${seg.value}</span>
        <div class="w-16 h-2 bg-panel2 rounded-full overflow-hidden ml-1">
          <div class="h-full rounded-full" style="width:${pct}%;background:${seg.color}"></div>
        </div>
      </div>`;
    }).join('');

    $('fin-health').innerHTML =
      `<div class="flex items-center gap-5">
         ${svgDonut(HEALTH_SEGS, 110)}
         <div class="flex-1 space-y-3">${legendRows}</div>
       </div>
       <p class="text-xs text-muted mt-4 pt-3 border-t border-line">${totalProjects} active project${totalProjects !== 1 ? 's' : ''} tracked</p>`;
  }

  // Recent documents
  const DOC_LABEL = { QUOTATION: 'Quote', SALES_INVOICE: 'Invoice', PURCHASE_INVOICE: 'PO Invoice' };
  const DOC_CLS   = {
    QUOTATION:        'bg-sky-500/15 border-sky-500/30 text-sky-400',
    SALES_INVOICE:    'bg-accent/15 border-accent/30 text-accent',
    PURCHASE_INVOICE: 'bg-purple-500/15 border-purple-500/30 text-purple-400',
  };
  const STATUS_CLS = { ACTIVE: 'text-ink', PAID: 'text-emerald-400', VOID: 'text-muted line-through' };

  $('fin-recent-docs').innerHTML = !recentDocs || !recentDocs.length
    ? '<p class="text-sm text-muted py-4 text-center">No documents pushed to Autocount yet.</p>'
    : `<div class="overflow-x-auto">
        <table class="w-full text-xs">
          <thead><tr class="text-muted border-b border-line">
            <th class="text-left pb-2 font-medium">Type</th>
            <th class="text-left pb-2 font-medium">Doc No</th>
            <th class="text-left pb-2 font-medium">Project / Lead</th>
            <th class="text-left pb-2 font-medium">Date</th>
            <th class="text-right pb-2 font-medium">Amount</th>
            <th class="text-left pb-2 font-medium pl-2">Status</th>
          </tr></thead>
          <tbody>
            ${recentDocs.map(doc => {
              const name = doc.project?.name || doc.lead?.name || '—';
              const date = new Date(doc.docDate).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});
              return `<tr class="border-b border-line/40 last:border-0 hover:bg-panel2/40">
                <td class="py-2 pr-2"><span class="badge border ${DOC_CLS[doc.docType] || ''} text-[10px]">${DOC_LABEL[doc.docType] || doc.docType}</span></td>
                <td class="py-2 pr-2 font-mono ${STATUS_CLS[doc.status] || ''}">${esc(doc.docNo)}</td>
                <td class="py-2 pr-2 text-ink truncate max-w-[180px]">${esc(name)}</td>
                <td class="py-2 pr-2 text-muted">${date}</td>
                <td class="py-2 text-right text-ink pr-2">${doc.amount != null ? fmtMYRPlain(doc.amount) : '—'}</td>
                <td class="py-2 pl-2"><span class="text-[10px] ${STATUS_CLS[doc.status] || ''}">${doc.status}</span></td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>`;
}

// Builds an SVG donut chart from segments [{value, color}].
// Total project count is shown in the centre.
function svgDonut(segments, size = 110) {
  const total = segments.reduce((s, seg) => s + (seg.value || 0), 0);
  if (!total) return '';
  const cx = size / 2, cy = size / 2;
  const r  = size * 0.33;
  const C  = 2 * Math.PI * r;
  const sw = size * 0.19;
  let drawn = 0;
  const circles = segments.filter(s => s.value > 0).map(seg => {
    const len = (seg.value / total) * C;
    const gap = C - len;
    const dashOffset = C - drawn;
    drawn += len;
    return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none"
      stroke="${seg.color}" stroke-width="${sw}"
      stroke-dasharray="${len.toFixed(2)} ${gap.toFixed(2)}"
      stroke-dashoffset="${dashOffset.toFixed(2)}"
      transform="rotate(-90,${cx},${cy})"/>`;
  });
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" class="shrink-0">
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#2c2920" stroke-width="${sw}"/>
    ${circles.join('')}
    <text x="${cx}" y="${cy - 4}" text-anchor="middle" fill="#e4e0d4"
      font-size="${size * 0.2}" font-weight="700" font-family="system-ui,sans-serif">${total}</text>
    <text x="${cx}" y="${cy + size * 0.14}" text-anchor="middle" fill="#857f73"
      font-size="${size * 0.11}" font-family="system-ui,sans-serif">projects</text>
  </svg>`;
}

function renderDocRow(doc, isOverdue) {
  const now      = new Date();
  const due      = doc.dueDate ? new Date(doc.dueDate) : null;
  const daysLeft = due ? Math.ceil((due - now) / 86400000) : null;
  const label    = daysLeft === null ? '' : daysLeft < 0 ? `${Math.abs(daysLeft)}d overdue` : `due in ${daysLeft}d`;
  const urgCls   = isOverdue ? 'text-warm font-bold' : daysLeft <= 3 ? 'text-warm font-semibold' : 'text-yellow-400 font-semibold';
  const projName = doc.project?.name || doc.lead?.name || '—';
  const producer = doc.project?.producer?.name;

  return `<div class="py-3 border-b border-line/60 last:border-0">
    <div class="flex items-start justify-between gap-2">
      <div class="flex-1 min-w-0">
        <p class="text-sm font-medium text-ink truncate">${esc(projName)}</p>
        <p class="text-xs font-mono text-muted mt-0.5">${esc(doc.docNo)}${doc.amount != null ? ' · ' + fmtMYRPlain(doc.amount) : ''}</p>
        ${producer ? `<p class="text-xs text-muted mt-0.5">Producer: ${esc(producer)}</p>` : ''}
      </div>
      <span class="text-xs ${urgCls} shrink-0 text-right">${label}</span>
    </div>
  </div>`;
}

// ── project cost table (unchanged) ───────────────────────────

function renderFinancialProjects(rows) {
  const filtered = rows.filter(r => matchesFilter(r.project.company));

  if (!filtered.length) {
    $('fin-table-body').innerHTML =
      `<tr><td colspan="8" class="py-10 text-center text-muted text-sm">No active projects.</td></tr>`;
    return;
  }

  const order = { red: 0, amber: 1, green: 2, unknown: 3 };
  filtered.sort((a, b) => (order[a.health] ?? 3) - (order[b.health] ?? 3));

  $('fin-table-body').innerHTML = filtered.map(r => {
    const p          = r.project;
    const qCls       = (typeof QUADRANT_CLS   !== 'undefined' ? QUADRANT_CLS   : {})[p.quadrant] || 'bg-panel2 text-muted';
    const qLabel     = (typeof QUADRANT_LABEL !== 'undefined' ? QUADRANT_LABEL : {})[p.quadrant] || p.quadrant;
    const remaining  = r.estimatedValue != null ? r.estimatedValue - r.costToDate : null;
    const marginDiff = (r.grossMargin != null && r.targetMargin != null)
      ? Math.round((r.grossMargin - r.targetMargin) * 10) / 10 : null;
    const missingNote = r.missingSalary
      ? '<span class="text-[10px] text-warm ml-1" title="Some team members have no salary set">⚠ partial</span>' : '';

    return `<tr class="border-b border-line/60 hover:bg-panel2/40 transition-colors">
      <td class="py-3 px-3">
        <p class="text-sm font-medium text-ink">${esc(p.name)}</p>
        <div class="flex items-center gap-1 mt-0.5">
          <span class="badge ${qCls} text-[10px]">${qLabel}</span>
          ${coBadge(p.company)}
        </div>
      </td>
      <td class="py-3 px-3 text-xs text-muted">${p.producer ? esc(p.producer.name) : '—'}</td>
      <td class="py-3 px-3 text-sm text-right">${fmtMYR(r.estimatedValue)}</td>
      <td class="py-3 px-3 text-sm text-right">
        ${fmtMYR(r.costToDate)}${missingNote}
        <p class="text-[10px] text-muted">${r.totalManDays}d · ${r.weeksTracked}w</p>
      </td>
      <td class="py-3 px-3 text-sm text-right ${remaining != null && remaining < 0 ? 'text-warm font-semibold' : 'text-muted'}">
        ${remaining != null ? fmtMYR(remaining) : '—'}
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
