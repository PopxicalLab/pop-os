// ══════════════════════════════════════════════════════════════
// SALES — "Leads over time" chart (the Chart sub-tab of the Sales page)
// A stacked bar per month / quarter, bucketed on the lead's created date
// (Lead has no closed/lost date to bucket by), one segment per stage.
//
// What you can do with it:
//   • Tap / click a bar   → a panel opens under the chart listing that
//                           period's leads, each linking to its Job page.
//   • Tap a legend stage  → switch that stage on / off (the scale adjusts).
//   • Count | RM value    → bar height = number of leads, or their value.
//   • Hover / keyboard focus a bar → the others dim and a tooltip lists
//                           every stage for that period.
// Bars grow in when the chart draws (skipped if the device asks for
// reduced motion). Table view = the same numbers as plain rows.
//
// Depends on: $, esc, fmtMoney (shared.js);
//             PIPELINE_STAGES, SALES_CHART_COLOR, LEAD_STATUS_LABEL (sales.js / shared.js)
// ══════════════════════════════════════════════════════════════

// 'month' (default) or 'quarter' — which period the chart buckets by.
let _salesChartPeriod  = localStorage.getItem('pop-os-sales-chart-period') === 'quarter' ? 'quarter' : 'month';
// 'count' (default) or 'value' — what a bar's height measures. Every role that
// can open the Sales page already sees lead values (TAB_ACCESS 'sales' is
// money roles only, and /api/leads is locked to them), so no extra check here.
let _salesChartMeasure = localStorage.getItem('pop-os-sales-chart-measure') === 'value' ? 'value' : 'count';
let _salesChartTable   = false;      // false = bar chart, true = data table
let _salesChartLeads   = [];         // last filtered lead set, so toggles can re-render without a refetch
let _salesChartHidden  = new Set();  // stages switched off in the legend
let _salesChartOpenKey = null;       // period whose leads panel is open (e.g. '2026-06')
let _salesChartBuckets = {};         // last render's buckets — read by the leads panel + tooltip

function setSalesChartPeriod(mode) {
  _salesChartPeriod = mode;
  _salesChartOpenKey = null;         // a month key means nothing in quarter view
  localStorage.setItem('pop-os-sales-chart-period', mode);
  renderSalesChart(_salesChartLeads);
}

function setSalesChartView(view) {
  _salesChartTable = view === 'table';
  renderSalesChart(_salesChartLeads);
}

function setSalesChartMeasure(m) {
  _salesChartMeasure = m;
  localStorage.setItem('pop-os-sales-chart-measure', m);
  renderSalesChart(_salesChartLeads);
}

// Legend click: hide / show one stage. Never hide the last one — an empty
// chart looks broken rather than filtered.
function toggleSalesChartStage(stage) {
  if (_salesChartHidden.has(stage)) _salesChartHidden.delete(stage);
  else if (_salesChartHidden.size < PIPELINE_STAGES.length - 1) _salesChartHidden.add(stage);
  renderSalesChart(_salesChartLeads);
}

// Buckets a date into the current chart period — 'YYYY-MM' / 'Jan '26' for
// month, 'YYYY-Q#' / "Q1 '26" for quarter. Keys sort correctly as plain
// strings (both formats are zero-padded / single-digit in year-major order),
// so callers can just Object.keys(...).sort() instead of parsing them back.
function salesChartBucket(dateStr, mode) {
  const d = new Date(dateStr);
  const y = d.getFullYear();
  if (mode === 'quarter') {
    const q = Math.floor(d.getMonth() / 3) + 1;
    return { key: `${y}-Q${q}`, label: `Q${q} '${String(y).slice(2)}` };
  }
  const m = d.getMonth();
  const key = `${y}-${String(m + 1).padStart(2, '0')}`;
  const label = d.toLocaleDateString('en-GB', { month: 'short' }) + ` '${String(y).slice(2)}`;
  return { key, label };
}

// Short money for labels inside a bar, where "RM 125,000" won't fit:
// 950 → "950", 12,500 → "12.5k", 1,250,000 → "1.25M". Tooltips and the
// leads panel still show the exact amount via fmtMoney.
function fmtShortRM(n) {
  const v = Number(n) || 0;
  if (v >= 1e6) return +(v / 1e6).toFixed(2) + 'M';
  if (v >= 1e3) return +(v / 1e3).toFixed(1) + 'k';
  return String(Math.round(v));
}

// The number a bar measures for one stage in one period.
function salesChartAmount(b, stage) {
  return _salesChartMeasure === 'value' ? (b.value[stage] || 0) : (b.counts[stage] || 0);
}
function salesChartFmt(n) {
  return _salesChartMeasure === 'value' ? fmtMoney(n) : String(n);
}
const salesChartVisible = () => PIPELINE_STAGES.filter(s => !_salesChartHidden.has(s));

// ── tooltip ─────────────────────────────────────────────────────
// One tooltip per bar listing every visible stage for that period — the
// pointer never has to land on a thin segment to get its number. Values
// lead (bold), stage names follow. Positioned inside #sales-pane-chart.
function showSalesChartTooltip(key, x, y) {
  const tip = $('sales-chart-tooltip');
  const b = _salesChartBuckets[key];
  if (!tip || !b) return;
  const rows = salesChartVisible().filter(s => salesChartAmount(b, s) > 0);
  const total = rows.reduce((t, s) => t + salesChartAmount(b, s), 0);
  tip.innerHTML = `<div class="font-semibold text-ink mb-1">${esc(b.label)}</div>`
    + (rows.length
      ? rows.map(s => `<div class="flex items-center gap-2">
          <span class="inline-block w-3 h-0.5 rounded ${SALES_CHART_COLOR[s].cls}"></span>
          <span class="font-semibold text-ink">${salesChartFmt(salesChartAmount(b, s))}</span>
          <span class="text-muted">${LEAD_STATUS_LABEL[s]}</span></div>`).join('')
        + `<div class="border-t border-line mt-1 pt-1 text-muted">Total <span class="font-semibold text-ink">${salesChartFmt(total)}</span></div>`
      : '<div class="text-muted">No leads</div>');
  tip.classList.remove('hidden');
  // Keep it inside the pane: flip to the left of the pointer near the right edge.
  const pane = $('sales-pane-chart').getBoundingClientRect();
  let left = x - pane.left + 14;
  if (left + tip.offsetWidth > pane.width) left = x - pane.left - tip.offsetWidth - 14;
  tip.style.left = Math.max(0, left) + 'px';
  tip.style.top  = Math.max(0, y - pane.top - tip.offsetHeight / 2) + 'px';
}

function hideSalesChartTooltip() {
  $('sales-chart-tooltip')?.classList.add('hidden');
}

// Dim every bar except `key` (null = undim all). The open period stays lit.
function highlightSalesChartBar(key) {
  document.querySelectorAll('#sales-chart [data-chart-col]').forEach(col => {
    const k = col.dataset.chartCol;
    const lit = !key || k === key || k === _salesChartOpenKey;
    col.style.opacity = lit ? '1' : '0.4';
  });
}

// ── main render ─────────────────────────────────────────────────
function renderSalesChart(leads) {
  _salesChartLeads = leads;
  const legendEl = $('sales-chart-legend');
  const chartEl  = $('sales-chart');
  if (!legendEl || !chartEl) return;
  hideSalesChartTooltip();

  // Toolbar buttons — highlight the active choice in each segmented control.
  const on = 'bg-accent text-bg font-semibold', off = 'text-muted hover:text-ink';
  const seg = (id, active) => { const b = $(id); if (b) b.className = 'px-2.5 py-1 rounded-md cursor-pointer transition-colors ' + (active ? on : off); };
  seg('sales-chart-month',      _salesChartPeriod === 'month');
  seg('sales-chart-quarter',    _salesChartPeriod === 'quarter');
  seg('sales-chart-count',      _salesChartMeasure === 'count');
  seg('sales-chart-value',      _salesChartMeasure === 'value');
  seg('sales-chart-view-chart', !_salesChartTable);
  seg('sales-chart-view-table', _salesChartTable);

  // Legend = stage filter. A switched-off stage keeps its place, shown as an
  // empty outline + faded label, so it's obvious how to bring it back.
  legendEl.innerHTML = PIPELINE_STAGES.map(s => {
    const off = _salesChartHidden.has(s);
    return `<button type="button" onclick="toggleSalesChartStage('${s}')" aria-pressed="${!off}"
        title="${off ? 'Show' : 'Hide'} ${LEAD_STATUS_LABEL[s]}"
        class="flex items-center gap-1.5 px-1.5 py-0.5 -mx-1.5 rounded-md cursor-pointer hover:bg-panel2 transition-opacity ${off ? 'opacity-50' : ''}">
      <span class="w-2.5 h-2.5 rounded-sm shrink-0 ${off ? 'border border-muted' : SALES_CHART_COLOR[s].cls}"></span>
      <span class="${off ? 'text-muted line-through' : 'text-muted'}">${LEAD_STATUS_LABEL[s]}</span>
    </button>`;
  }).join('')
    + (_salesChartHidden.size ? `<button type="button" onclick="_salesChartHidden.clear(); renderSalesChart(_salesChartLeads)"
        class="text-accent hover:underline cursor-pointer">Show all</button>` : '');

  if (!leads.length) {
    chartEl.innerHTML = '<p class="text-xs text-muted text-center py-10">No leads yet.</p>';
    renderSalesChartLeads();
    return;
  }

  // Bucket every lead by created date: count, value and the leads themselves
  // (the leads list feeds the panel that opens on click).
  const buckets = {}; // key -> { label, counts: {STAGE:n}, value: {STAGE:RM}, leads: [] }
  const blank = label => ({ label, counts: {}, value: {}, leads: [] });
  for (const l of leads) {
    if (!l.createdAt) continue;
    const { key, label } = salesChartBucket(l.createdAt, _salesChartPeriod);
    if (!buckets[key]) buckets[key] = blank(label);
    const b = buckets[key];
    b.counts[l.status] = (b.counts[l.status] || 0) + 1;
    b.value[l.status]  = (b.value[l.status]  || 0) + (l.estimatedValue || 0);
    b.leads.push(l);
  }

  let keys;
  if (_salesChartPeriod === 'quarter') {
    // Fixed Q1–Q4 of the current year, always — a quarter with no leads still
    // gets its column (an empty bar under its label) instead of vanishing and
    // making the axis jump straight to whichever quarter has data next.
    const y = new Date().getFullYear();
    keys = [1, 2, 3, 4].map(q => `${y}-Q${q}`);
    keys.forEach((k, i) => { if (!buckets[k]) buckets[k] = blank(`Q${i + 1} '${String(y).slice(2)}`); });
  } else {
    // Fixed trailing 12 months ending this month, always — same reasoning as
    // quarter view: an empty month still gets its column instead of vanishing.
    const now = new Date();
    keys = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const y = d.getFullYear();
      const key = `${y}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      keys.push(key);
      if (!buckets[key]) buckets[key] = blank(d.toLocaleDateString('en-GB', { month: 'short' }) + ` '${String(y).slice(2)}`);
    }
  }
  _salesChartBuckets = buckets;
  if (_salesChartOpenKey && !keys.includes(_salesChartOpenKey)) _salesChartOpenKey = null;

  const vis = salesChartVisible();
  const totalOf = k => vis.reduce((t, s) => t + salesChartAmount(buckets[k], s), 0);

  if (_salesChartTable) {
    chartEl.innerHTML = `<div class="overflow-x-auto">
      <table class="w-full text-xs">
        <thead><tr class="border-b border-line text-muted">
          <th class="text-left py-1.5 pr-3 font-semibold">Period</th>
          ${vis.map(s => `<th class="text-right py-1.5 px-2 font-semibold whitespace-nowrap">${LEAD_STATUS_LABEL[s]}</th>`).join('')}
          <th class="text-right py-1.5 pl-2 font-semibold">Total</th>
        </tr></thead>
        <tbody>
          ${keys.map(k => {
            const b = buckets[k];
            return `<tr class="border-b border-line/50 text-ink">
              <td class="py-1.5 pr-3 text-muted whitespace-nowrap">${b.label}</td>
              ${vis.map(s => { const n = salesChartAmount(b, s); return `<td class="text-right py-1.5 px-2 whitespace-nowrap">${n ? salesChartFmt(n) : ''}</td>`; }).join('')}
              <td class="text-right py-1.5 pl-2 font-semibold whitespace-nowrap">${salesChartFmt(totalOf(k))}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`;
    renderSalesChartLeads();
    return;
  }

  const maxTotal = Math.max(1, ...keys.map(totalOf));
  const PLOT_H   = 160; // px — the bars' shared baseline height
  const HEADROOM = 20;  // px kept above the tallest bar for its total label
  const SCALE_H  = PLOT_H - HEADROOM;
  // Month label row under the bars: 14px label + 8px gap (gap-2). The chart
  // box includes it — a scrolling box clips anything outside itself.
  const LABEL_H  = 22;

  // Faint 25/50/75% gridlines — recessive, just enough to read relative height by eye.
  // Measured from the bars' baseline, which sits LABEL_H above the box bottom.
  const gridlines = [25, 50, 75].map(pct =>
    `<div class="absolute left-0 right-0 border-t border-line/40 pointer-events-none" style="bottom:${LABEL_H + Math.round(pct / 100 * SCALE_H)}px"></div>`
  ).join('');

  // Each period is one <button> column: the whole column (bar + empty space
  // above it + label) is the hit target, far bigger than a thin segment, and
  // keyboard users can Tab through the periods.
  const cols = keys.map(k => {
    const b = buckets[k];
    const total = totalOf(k);
    const barH  = total ? Math.max(3, Math.round((total / maxTotal) * SCALE_H)) : 0;
    const segs = vis.filter(s => salesChartAmount(b, s) > 0).map(s => {
      const n = salesChartAmount(b, s);
      // Share of the bar, as a % — the bar's own height animates, the
      // segments just divide it. 3px floor keeps a "1" visible.
      const pct = (n / total) * 100;
      const segPx = barH * pct / 100;
      const label = _salesChartMeasure === 'value' ? fmtShortRM(n) : String(n);
      return `<div class="${SALES_CHART_COLOR[s].cls} w-full flex items-center justify-center shrink-0"
                   style="height:max(3px, calc(${pct}% - 2px))">
                ${segPx >= 18 ? `<span class="text-[10px] font-semibold text-white/90 leading-none">${label}</span>` : ''}
              </div>`;
    }).join('<div class="h-0.5 shrink-0"></div>'); // 2px gap between stacked segments (shows the surface)
    const open = k === _salesChartOpenKey;
    const aria = `${b.label}: ${salesChartFmt(total)}${total ? '' : ' (no leads)'}. Show leads.`;
    return `<button type="button" data-chart-col="${k}" aria-label="${esc(aria)}" aria-expanded="${open}"
        class="relative flex-1 min-w-[28px] h-full flex flex-col items-center justify-end gap-2 cursor-pointer
               rounded-md transition-opacity duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/60">
      <span class="text-[10px] leading-none ${open ? 'text-ink font-semibold' : 'text-muted'} whitespace-nowrap">${total ? (_salesChartMeasure === 'value' ? fmtShortRM(total) : total) : ''}</span>
      <div class="w-full flex flex-col-reverse rounded-t-[4px] overflow-hidden transition-[height] duration-500 ease-out
                  ${open ? 'ring-2 ring-accent ring-offset-2 ring-offset-panel' : ''}"
           style="height:${barH}px" data-bar-h="${barH}">
        ${segs}
      </div>
      <span class="text-[10px] leading-[14px] h-[14px] ${open ? 'text-accent font-semibold' : 'text-muted'} whitespace-nowrap">${b.label}</span>
    </button>`;
  }).join('');

  // Outer box scrolls sideways; the inner row is at least as wide as its
  // bars need (min-w-max) and fills the box when there's room (w-full).
  // On a phone, many months don't fit — swipe instead of spilling off screen.
  chartEl.innerHTML = `<div id="sales-chart-scroll" class="overflow-x-auto overscroll-x-contain pb-1">
    <div class="relative flex items-end gap-1.5 sm:gap-3 min-w-max w-full" style="height:${PLOT_H + LABEL_H}px">
      ${gridlines}
      ${cols}
    </div>
  </div>`;

  // Grow-in: start every bar at 0 and let the CSS height transition run to
  // its real height on the next frame. Skipped for reduced-motion users.
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!reduce) {
    const bars = chartEl.querySelectorAll('[data-bar-h]');
    bars.forEach(bar => { bar.style.height = '0px'; });
    requestAnimationFrame(() => requestAnimationFrame(() =>
      bars.forEach(bar => { bar.style.height = bar.dataset.barH + 'px'; })));
  }

  // Start scrolled to the newest months (right end) — what people look at first —
  // unless a period is open, then keep that one in view.
  const scroller = $('sales-chart-scroll');
  if (scroller) {
    const openCol = _salesChartOpenKey && scroller.querySelector(`[data-chart-col="${_salesChartOpenKey}"]`);
    if (openCol) openCol.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    else scroller.scrollLeft = scroller.scrollWidth;
  }

  // Hover (mouse) and focus (keyboard): dim the others + tooltip.
  // Touch has no hover — a tap opens the leads panel, which shows the same
  // numbers and more, so touch skips the tooltip.
  chartEl.querySelectorAll('[data-chart-col]').forEach(col => {
    const k = col.dataset.chartCol;
    col.addEventListener('pointermove', e => {
      if (e.pointerType !== 'mouse') return;
      highlightSalesChartBar(k);
      showSalesChartTooltip(k, e.clientX, e.clientY);
    });
    col.addEventListener('pointerleave', () => { highlightSalesChartBar(null); hideSalesChartTooltip(); });
    col.addEventListener('focus', () => {
      // A mouse click or tap also focuses the button — only keyboard focus
      // (Tab) gets the tooltip, otherwise it would stick after a tap.
      if (!col.matches(':focus-visible')) return;
      highlightSalesChartBar(k);
      const r = col.getBoundingClientRect();
      showSalesChartTooltip(k, r.right, r.top + r.height / 2);
    });
    col.addEventListener('blur', () => { highlightSalesChartBar(null); hideSalesChartTooltip(); });
    col.addEventListener('click', () => openSalesChartPeriod(k));
  });
  highlightSalesChartBar(null);
  renderSalesChartLeads();
}

// Click a bar: open its leads panel; click the same bar again to close it.
// Only the highlight + panel change — the bars aren't redrawn, so they don't
// replay the grow-in animation.
function openSalesChartPeriod(key) {
  _salesChartOpenKey = _salesChartOpenKey === key ? null : key;
  document.querySelectorAll('#sales-chart [data-chart-col]').forEach(col => {
    const open = col.dataset.chartCol === _salesChartOpenKey;
    col.setAttribute('aria-expanded', open);
    col.querySelector('[data-bar-h]').classList.toggle('ring-2', open);
    col.querySelector('[data-bar-h]').classList.toggle('ring-accent', open);
    col.querySelector('[data-bar-h]').classList.toggle('ring-offset-2', open);
    col.querySelector('[data-bar-h]').classList.toggle('ring-offset-panel', open);
    const label = col.lastElementChild;
    label.classList.toggle('text-accent', open);
    label.classList.toggle('font-semibold', open);
    label.classList.toggle('text-muted', !open);
  });
  highlightSalesChartBar(null);
  renderSalesChartLeads();
  if (_salesChartOpenKey) $('sales-chart-leads')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// The panel under the chart: the open period's leads (visible stages only),
// grouped in pipeline order, biggest value first. Each row opens its Job page.
function renderSalesChartLeads() {
  const el = $('sales-chart-leads');
  if (!el) return;
  const b = _salesChartOpenKey && _salesChartBuckets[_salesChartOpenKey];
  if (!b) { el.innerHTML = ''; el.classList.add('hidden'); return; }

  const vis = salesChartVisible();
  const rows = b.leads
    .filter(l => vis.includes(l.status))
    .sort((x, y) => PIPELINE_STAGES.indexOf(x.status) - PIPELINE_STAGES.indexOf(y.status)
                 || (y.estimatedValue || 0) - (x.estimatedValue || 0));
  const total = rows.reduce((t, l) => t + (l.estimatedValue || 0), 0);

  el.classList.remove('hidden');
  el.innerHTML = `
    <div class="flex items-center justify-between gap-2 mb-2">
      <p class="text-xs text-ink"><span class="font-semibold">${esc(b.label)}</span>
        <span class="text-muted">· ${rows.length} lead${rows.length === 1 ? '' : 's'} · ${fmtMoney(total)}</span></p>
      <button type="button" onclick="openSalesChartPeriod('${_salesChartOpenKey}')" aria-label="Close"
        class="text-muted hover:text-ink text-sm leading-none px-1 cursor-pointer">×</button>
    </div>
    ${rows.length ? `<div class="divide-y divide-line/50">
      ${rows.map(l => `
        <a href="/job.html?id=${encodeURIComponent(l.id)}"
           class="flex items-center gap-2 py-1.5 px-1 -mx-1 rounded-md hover:bg-panel2 text-xs min-w-0">
          <span class="w-2 h-2 rounded-sm shrink-0 ${SALES_CHART_COLOR[l.status].cls}" title="${LEAD_STATUS_LABEL[l.status]}"></span>
          <span class="text-ink truncate">${esc(l.name)}</span>
          <span class="text-muted truncate hidden sm:inline">${l.account ? esc(l.account.name) : ''}</span>
          <span class="ml-auto text-ink whitespace-nowrap">${l.estimatedValue != null ? fmtMoney(l.estimatedValue) : '<span class="text-muted">—</span>'}</span>
        </a>`).join('')}
    </div>` : '<p class="text-xs text-muted">No leads in the stages shown.</p>'}`;
}
