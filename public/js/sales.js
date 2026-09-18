// ══════════════════════════════════════════════════════════════
// SALES HUB — pipeline board + add lead
// Depends on: $, msg, esc, matchesFilter, LEAD_STATUS_LABEL, LEAD_STATUS_CLS  (shared.js)
// ══════════════════════════════════════════════════════════════

const LEAD_PRI_CLS = {
  VERY_HIGH: 'text-warm font-bold',
  HIGH:      'text-yellow-400 font-semibold',
  MEDIUM:    'text-accent',
  LOW:       'text-muted',
};
const PIPELINE_STAGES = ['QUALIFICATION', 'PROPOSAL', 'NEGOTIATION', 'WON', 'COMPLETED', 'LOST'];

// Solid fills for the "Leads over time" chart's stacked bars — distinct from
// LEAD_STATUS_CLS (which is translucent badge backgrounds tuned for text
// contrast). LOST reuses the app's own "warm" theme token since that color
// already means "negative outcome" everywhere else in the app; the other five
// are fixed hexes chosen to pass the dataviz skill's categorical-palette
// checks (lightness band, chroma floor, CVD + normal-vision separation)
// against both the dark and light chart surface.
const SALES_CHART_COLOR = {
  QUALIFICATION: { cls: 'bg-sky-600',     hex: '#0284c7' },
  PROPOSAL:      { cls: 'bg-amber-600',   hex: '#d97706' },
  NEGOTIATION:   { cls: 'bg-purple-500',  hex: '#a855f7' },
  WON:           { cls: 'bg-emerald-600', hex: '#059669' },
  COMPLETED:     { cls: 'bg-indigo-600',  hex: '#4f46e5' },
  LOST:          { cls: 'bg-warm',        hex: null },
};

let _salesAccounts = [];
let _salesPeople   = [];
let _autocountDebtors = [];
let _allLeads = []; // full cache — search filters client-side
let _dragGhost = null; // placeholder bar shown at the drop position while dragging a lead card

// 'chart' (default) or 'board' — which sub-tab of the right-hand panel is showing.
let _salesSubTab = localStorage.getItem('pop-os-sales-subtab') === 'board' ? 'board' : 'chart';

function setSalesSubTab(tab) {
  _salesSubTab = tab;
  localStorage.setItem('pop-os-sales-subtab', tab);
  applySalesSubTab();
}

function applySalesSubTab() {
  const on = 'bg-accent text-bg font-semibold', off = 'text-muted hover:text-ink';
  $('sales-subtab-chart').className = 'px-2.5 py-1 rounded-md cursor-pointer transition-colors ' + (_salesSubTab === 'chart' ? on : off);
  $('sales-subtab-board').className = 'px-2.5 py-1 rounded-md cursor-pointer transition-colors ' + (_salesSubTab === 'board' ? on : off);
  $('sales-pane-chart').classList.toggle('hidden', _salesSubTab !== 'chart');
  $('sales-pane-board').classList.toggle('hidden', _salesSubTab !== 'board');
}

// 'month' (default) or 'quarter' — which period the "Leads over time" chart buckets by.
let _salesChartPeriod = localStorage.getItem('pop-os-sales-chart-period') === 'quarter' ? 'quarter' : 'month';
let _salesChartTable  = false; // false = bar chart, true = accessible data table
let _salesChartLeads  = [];    // last filtered lead set, cached so the toggles above can re-render without a refetch

function setSalesChartPeriod(mode) {
  _salesChartPeriod = mode;
  localStorage.setItem('pop-os-sales-chart-period', mode);
  renderSalesChart(_salesChartLeads);
}

function setSalesChartView(view) {
  _salesChartTable = view === 'table';
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

function showSalesChartTooltip(e, html) {
  const tip = $('sales-chart-tooltip');
  if (!tip) return;
  tip.innerHTML = html;
  tip.classList.remove('hidden');
  const wrap = tip.parentElement.getBoundingClientRect();
  tip.style.left = (e.clientX - wrap.left + 12) + 'px';
  tip.style.top  = (e.clientY - wrap.top - 8) + 'px';
}

function hideSalesChartTooltip() {
  $('sales-chart-tooltip')?.classList.add('hidden');
}

// Renders the "Leads over time" panel — a stacked bar per month/quarter,
// bucketed on the lead's createdAt (Lead has no closed/lost date to bucket
// by instead), one segment per pipeline status. Table view is the same data
// as plain rows, for anyone who'd rather read numbers than bar heights.
function renderSalesChart(leads) {
  _salesChartLeads = leads;
  const legendEl = $('sales-chart-legend');
  const chartEl  = $('sales-chart');
  if (!legendEl || !chartEl) return;

  const monthBtn = $('sales-chart-month'), quarterBtn = $('sales-chart-quarter');
  const on = 'bg-accent text-bg font-semibold', off = 'text-muted hover:text-ink';
  if (monthBtn && quarterBtn) {
    monthBtn.className   = 'px-2.5 py-1 rounded-md cursor-pointer transition-colors ' + (_salesChartPeriod === 'month'   ? on : off);
    quarterBtn.className = 'px-2.5 py-1 rounded-md cursor-pointer transition-colors ' + (_salesChartPeriod === 'quarter' ? on : off);
  }
  const chartViewBtn = $('sales-chart-view-chart'), tableViewBtn = $('sales-chart-view-table');
  if (chartViewBtn && tableViewBtn) {
    chartViewBtn.className = 'px-2.5 py-1 rounded-md cursor-pointer transition-colors ' + (!_salesChartTable ? on : off);
    tableViewBtn.className = 'px-2.5 py-1 rounded-md cursor-pointer transition-colors ' + (_salesChartTable  ? on : off);
  }

  legendEl.innerHTML = PIPELINE_STAGES.map(s => `
    <span class="flex items-center gap-1.5 text-muted">
      <span class="w-2.5 h-2.5 rounded-sm shrink-0 ${SALES_CHART_COLOR[s].cls}"></span>
      ${LEAD_STATUS_LABEL[s]}
    </span>`).join('');

  if (!leads.length) {
    chartEl.innerHTML = '<p class="text-xs text-muted text-center py-10">No leads yet.</p>';
    return;
  }

  // Bucket every lead by created date, count per status.
  const buckets = {}; // key -> { label, counts: { STATUS: n } }
  for (const l of leads) {
    if (!l.createdAt) continue;
    const { key, label } = salesChartBucket(l.createdAt, _salesChartPeriod);
    if (!buckets[key]) buckets[key] = { label, counts: {} };
    buckets[key].counts[l.status] = (buckets[key].counts[l.status] || 0) + 1;
  }

  let keys;
  if (_salesChartPeriod === 'quarter') {
    // Fixed Q1–Q4 of the current year, always — a quarter with no leads still
    // gets its column (an empty bar under its label) instead of vanishing and
    // making the axis jump straight to whichever quarter has data next.
    const y = new Date().getFullYear();
    keys = [1, 2, 3, 4].map(q => `${y}-Q${q}`);
    keys.forEach((k, i) => {
      if (!buckets[k]) buckets[k] = { label: `Q${i + 1} '${String(y).slice(2)}`, counts: {} };
    });
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
      if (!buckets[key]) {
        const label = d.toLocaleDateString('en-GB', { month: 'short' }) + ` '${String(y).slice(2)}`;
        buckets[key] = { label, counts: {} };
      }
    }
  }

  if (!keys.length) {
    chartEl.innerHTML = '<p class="text-xs text-muted text-center py-10">No leads yet.</p>';
    return;
  }

  if (_salesChartTable) {
    chartEl.innerHTML = `<div class="overflow-x-auto">
      <table class="w-full text-xs">
        <thead><tr class="border-b border-line text-muted">
          <th class="text-left py-1.5 pr-3 font-semibold">Period</th>
          ${PIPELINE_STAGES.map(s => `<th class="text-right py-1.5 px-2 font-semibold">${LEAD_STATUS_LABEL[s]}</th>`).join('')}
          <th class="text-right py-1.5 pl-2 font-semibold">Total</th>
        </tr></thead>
        <tbody>
          ${keys.map(k => {
            const b = buckets[k];
            const total = PIPELINE_STAGES.reduce((s, st) => s + (b.counts[st] || 0), 0);
            return `<tr class="border-b border-line/50 text-ink">
              <td class="py-1.5 pr-3 text-muted">${b.label}</td>
              ${PIPELINE_STAGES.map(s => `<td class="text-right py-1.5 px-2">${b.counts[s] || ''}</td>`).join('')}
              <td class="text-right py-1.5 pl-2 font-semibold">${total}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`;
    return;
  }

  const maxTotal = Math.max(1, ...keys.map(k =>
    PIPELINE_STAGES.reduce((s, st) => s + (buckets[k].counts[st] || 0), 0)));
  const PLOT_H   = 160; // px — the bars' shared baseline height
  const HEADROOM = 20;  // px reserved at the top so the tallest bar doesn't crowd the legend above it
  const SCALE_H  = PLOT_H - HEADROOM;

  // Faint 25/50/75% gridlines — recessive, just enough to read relative height by eye.
  const gridlines = [25, 50, 75].map(pct =>
    `<div class="absolute left-0 right-0 border-t border-line/40" style="bottom:${Math.round(pct / 100 * SCALE_H)}px"></div>`
  ).join('');

  chartEl.innerHTML = `<div class="relative flex items-end gap-3" style="height:${PLOT_H}px">
    ${gridlines}
    ${keys.map(k => {
      const b = buckets[k];
      const total = PIPELINE_STAGES.reduce((s, st) => s + (b.counts[st] || 0), 0);
      const segs = PIPELINE_STAGES.filter(s => b.counts[s] > 0).map(s => {
        const n = b.counts[s];
        const h = Math.max(3, Math.round((n / maxTotal) * SCALE_H)); // 3px floor keeps a "1" visible/hoverable
        const showLabel = h >= 16;
        return `<div class="${SALES_CHART_COLOR[s].cls} w-full flex items-center justify-center"
                     style="height:${h}px" data-chart-seg="${s}" data-chart-period="${k}"
                     title="${LEAD_STATUS_LABEL[s]}: ${n}">
                  ${showLabel ? `<span class="text-[10px] font-semibold text-white/90">${n}</span>` : ''}
                </div>`;
      }).join('<div class="h-0.5 bg-panel"></div>'); // 2px surface gap between stacked segments
      return `<div class="relative flex-1 min-w-[28px] flex flex-col items-center gap-2">
        <div class="w-full flex flex-col-reverse justify-start rounded-t-[4px] overflow-hidden bg-panel2/40" style="height:${PLOT_H}px" data-chart-bar="${k}">
          ${segs || ''}
        </div>
        <span class="text-[10px] text-muted whitespace-nowrap">${b.label}</span>
      </div>`;
    }).join('')}
  </div>`;

  chartEl.querySelectorAll('[data-chart-seg]').forEach(seg => {
    const status = seg.dataset.chartSeg, key = seg.dataset.chartPeriod;
    const n = buckets[key].counts[status] || 0;
    seg.addEventListener('mousemove', (e) => showSalesChartTooltip(e,
      `<span class="font-semibold">${buckets[key].label}</span> — ${LEAD_STATUS_LABEL[status]}: <span class="font-semibold">${n}</span>`));
    seg.addEventListener('mouseleave', hideSalesChartTooltip);
  });
}

// Finds which card the dragged one should land before, based on cursor Y vs.
// each card's vertical midpoint. Returns null when it belongs at the end.
function dragAfterElement(column, y) {
  const cards = [...column.querySelectorAll('[data-lead-card]:not(.dragging)')];
  return cards.reduce((closest, card) => {
    const box = card.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    if (offset < 0 && offset > closest.offset) return { offset, element: card };
    return closest;
  }, { offset: -Infinity, element: null }).element;
}

async function initSalesTab() {
  [_salesAccounts, _salesPeople, _autocountDebtors] = await Promise.all([
    fetch('/api/accounts').then(r => r.json()).catch(() => []),
    fetch('/api/people').then(r => r.json()).catch(() => []),
    fetch('/api/autocount/debtors').then(r => r.json()).catch(() => []),
  ]);

  const accSel = $('lead-account');
  if (accSel) {
    accSel.innerHTML = '<option value="">— no account —</option>' +
      _salesAccounts.sort((a, b) => a.name.localeCompare(b.name))
        .map(a => `<option value="${a.id}">${esc(a.name)}</option>`).join('');
  }

  const picSel = $('lead-closed-by');
  if (picSel) {
    picSel.innerHTML = '<option value="">— unassigned —</option>' +
      _salesPeople.filter(p => p.status === 'ACTIVE')
        .map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('');
  }
}

async function loadSales() {
  _allLeads = await fetch('/api/leads').then(r => r.json()).catch(() => []);
  renderSalesPipeline();
}

function renderSalesPipeline() {
  const search = ($('sales-search')?.value || '').toLowerCase();
  const leads  = _allLeads.filter(l => {
    if (!matchesFilter(l.company)) return false;
    if (!search) return true;
    const hay = ((l.name || '') + ' ' + (l.account?.name || '')).toLowerCase();
    return hay.includes(search);
  });
  const filtered = leads;

  // Stats strip
  const active = filtered.filter(l => !['WON','COMPLETED','LOST'].includes(l.status));
  const won    = filtered.filter(l => l.status === 'WON');
  const completed = filtered.filter(l => l.status === 'COMPLETED');
  const pipeline = active.reduce((s, l) => s + (l.estimatedValue || 0), 0);
  const wonValue  = won.reduce((s, l) => s + (l.estimatedValue || 0), 0);

  $('sales-stats').innerHTML =
    `<span class="text-ink font-semibold">${active.length}</span><span class="text-muted"> active leads</span>` +
    ` <span class="text-line mx-2">·</span> ` +
    `<span class="text-ink font-semibold">RM ${pipeline.toLocaleString('en-MY')}</span><span class="text-muted"> pipeline value</span>` +
    ` <span class="text-line mx-2">·</span> ` +
    `<span class="text-emerald-400 font-semibold">${won.length} won</span>` +
    ` <span class="text-line mx-2">·</span> ` +
    `<span class="text-emerald-400 font-semibold">RM ${wonValue.toLocaleString('en-MY')}</span><span class="text-muted"> closed</span>` +
    ` <span class="text-line mx-2">·</span> ` +
    `<span class="text-slate-400 font-semibold">${completed.length}</span><span class="text-muted"> completed</span>`;

  renderSalesChart(filtered);

  // Pipeline columns
  const byStage = {};
  for (const s of PIPELINE_STAGES) byStage[s] = [];
  for (const l of filtered) { if (byStage[l.status]) byStage[l.status].push(l); }

  $('sales-board').innerHTML =
    `<div class="grid grid-cols-1 sm:grid-cols-3 xl:grid-cols-6 gap-3">` +
    PIPELINE_STAGES.map(stage => {
      const cls   = LEAD_STATUS_CLS[stage];
      const items = byStage[stage];
      const total = items.reduce((s, l) => s + (l.estimatedValue || 0), 0);

      return `<div class="flex flex-col gap-2 rounded-xl transition-colors" data-stage-drop="${stage}">
        <div class="flex items-center justify-between mb-1">
          <span class="badge border ${cls} text-[11px]">${LEAD_STATUS_LABEL[stage]}</span>
          <span class="text-[11px] text-muted">${items.length}</span>
        </div>
        ${total > 0 ? `<p class="text-[11px] text-muted -mt-1 mb-1">RM ${total.toLocaleString('en-MY')}</p>` : ''}
        ${items.length ? items.map(l => renderLeadCard(l)).join('') : '<p class="text-xs text-muted text-center py-4">—</p>'}
      </div>`;
    }).join('') +
    `</div>`;

  // Wire up inline status dropdowns and convert buttons.
  $('sales-board').querySelectorAll('[data-lead-status]').forEach(sel => {
    sel.onchange = async () => {
      const id     = sel.dataset.leadStatus;
      const status = sel.value;
      await fetch(`/api/leads/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      loadSales();
    };
  });

  $('sales-board').querySelectorAll('[data-lead-closed-by]').forEach(sel => {
    sel.onchange = async () => {
      await fetch(`/api/leads/${sel.dataset.leadClosedBy}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ closedById: sel.value || null }),
      });
      loadSales();
    };
  });


  // Drag-and-drop: dragging a card into a different column changes its status
  // (same PATCH the status dropdown uses). Dragging within a column just
  // repositions the card visually — there's no persisted order field, so
  // that position resets next time the board reloads.
  $('sales-board').querySelectorAll('[data-lead-card]').forEach(card => {
    card.ondragstart = (e) => {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', card.dataset.leadCard);
      card.classList.add('dragging', 'opacity-40');
      _dragGhost = document.createElement('div');
      _dragGhost.className = 'h-1.5 rounded-full bg-accent/60 mx-1';
    };
    card.ondragend = () => {
      card.classList.remove('dragging', 'opacity-40');
      _dragGhost?.remove();
      _dragGhost = null;
    };
  });

  $('sales-board').querySelectorAll('[data-stage-drop]').forEach(col => {
    col.ondragover = (e) => {
      e.preventDefault();
      col.classList.add('bg-accent/5', 'ring-1', 'ring-accent/40');
      if (!_dragGhost) return;
      const after = dragAfterElement(col, e.clientY);
      after ? col.insertBefore(_dragGhost, after) : col.appendChild(_dragGhost);
    };
    col.ondragleave = (e) => {
      if (!col.contains(e.relatedTarget)) col.classList.remove('bg-accent/5', 'ring-1', 'ring-accent/40');
    };
    col.ondrop = async (e) => {
      e.preventDefault();
      col.classList.remove('bg-accent/5', 'ring-1', 'ring-accent/40');
      _dragGhost?.remove();

      const id     = e.dataTransfer.getData('text/plain');
      const status = col.dataset.stageDrop;
      const lead   = _allLeads.find(l => l.id === id);
      if (!lead) return;

      // Read the drop position from the DOM *before* re-rendering wipes it,
      // then reorder the in-memory list to match and re-render locally —
      // this is what makes the card land exactly where the ghost showed,
      // instead of wherever a server refetch would re-sort it to.
      const after     = dragAfterElement(col, e.clientY);
      const afterId   = after?.dataset.leadCard || null;
      const wasStatus = lead.status;

      _allLeads.splice(_allLeads.indexOf(lead), 1);
      lead.status = status;
      const insertAt = afterId ? _allLeads.findIndex(l => l.id === afterId) : -1;
      insertAt === -1 ? _allLeads.push(lead) : _allLeads.splice(insertAt, 0, lead);
      renderSalesPipeline();

      if (wasStatus !== status) {
        await fetch(`/api/leads/${id}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status }),
        });
      }
    };
  });

  // Inline-editable title — contenteditable <p>, save on blur. Enter blurs
  // instead of adding a newline (title is one field, not a text block).
  $('sales-board').querySelectorAll('[data-lead-name]').forEach(el => {
    el.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); el.blur(); } };
    el.onblur = async () => {
      const id  = el.dataset.leadName;
      const lead = _allLeads.find(l => l.id === id);
      const name = el.textContent.trim();
      if (!name) { el.textContent = lead.name; return; }
      if (name === lead.name) return;
      lead.name = name;
      el.textContent = name;
      el.title = name;
      await fetch(`/api/leads/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
    };
  });

  // Inline-editable estimated amount — PATCH on blur/enter, every change lands
  // in AuditLog (resource: Lead, action: UPDATE) via the controller.
  $('sales-board').querySelectorAll('[data-lead-value]').forEach(inp => {
    inp.onchange = async () => {
      const id  = inp.dataset.leadValue;
      const raw = inp.value.trim();

      if (raw !== '' && isNaN(Number(raw))) {
        inp.value = _allLeads.find(l => l.id === id)?.estimatedValue ?? '';
        msg($('sales-msg'), 'Estimated amount must be a number.', 'err');
        return;
      }

      await fetch(`/api/leads/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estimatedValue: raw === '' ? null : Number(raw) }),
      });
      loadSales();
    };
  });

  $('sales-board').querySelectorAll('[data-lead-convert]').forEach(b => {
    b.onclick = () => convertLead(b.dataset.leadConvert);
  });

  $('sales-board').querySelectorAll('[data-lead-del]').forEach(b => {
    b.onclick = () => deleteLead(b.dataset.leadDel);
  });

  $('sales-board').querySelectorAll('[data-lead-quote]').forEach(b => {
    b.onclick = () => openQuoteModal(b.dataset.leadQuote, b.dataset.leadName, b.dataset.debtor);
  });
}

function renderLeadCard(l) {
  const priCls  = LEAD_PRI_CLS[l.priority]  || 'text-muted';
  const accName = l.account?.name ? esc(l.account.name) : '<span class="text-muted">No account</span>';

  const payBadge = (l.invoicedPct || l.paidPct)
    ? `<p class="text-[11px] mt-1">
        ${l.invoicedPct ? `<span class="text-yellow-400">Inv ${l.invoicedPct}%</span>` : ''}
        ${l.paidPct     ? `<span class="text-emerald-400 ml-1">Paid ${l.paidPct}%</span>` : ''}
       </p>`
    : '';

  const convertBtn = l.status === 'WON' && !l.projectId
    ? `<button class="mt-2 w-full text-[11px] bg-emerald-500/15 border border-emerald-500/30 text-emerald-400
                      px-2 py-1 rounded-lg hover:bg-emerald-500/25 transition-colors cursor-pointer font-semibold"
              data-lead-convert="${l.id}">→ Create project</button>`
    : (l.projectId
        ? `<a href="/projects.html?open=${l.projectId}" class="block text-[11px] text-emerald-400 mt-1.5 hover:underline cursor-pointer">✓ ${esc(l.project?.name || 'Project created')}</a>`
        : '');

  // Show existing document badges (quotations + invoices — a lead can carry
  // several of each, e.g. milestone billing) + always allow pushing another quote.
  const docs = l.accountingDocuments || [];
  const docBadges = docs.map(d => {
    const statusCls = d.status === 'VOID' ? 'text-muted line-through' : d.status === 'PAID' ? 'text-emerald-400' : 'text-sky-400';
    const icon = d.docType === 'SALES_INVOICE' ? '🧾' : '📄';
    const due = d.dueDate ? ` · due ${new Date(d.dueDate).toLocaleDateString('en-GB',{day:'numeric',month:'short'})}` : '';
    return `<span class="${statusCls} text-[11px]">${icon} ${esc(d.docNo)}${due}</span>`;
  }).join('<br>');

  const quotationBtn = ['PROPOSAL', 'NEGOTIATION', 'WON', 'COMPLETED'].includes(l.status)
    ? `<div class="mt-1 space-y-0.5">
         ${docBadges}
         <button class="w-full text-[11px] bg-sky-500/15 border border-sky-500/30 text-sky-400
                        px-2 py-1 rounded-lg hover:bg-sky-500/25 transition-colors cursor-pointer mt-1"
                 data-lead-quote="${l.id}" data-lead-name="${esc(l.name)}" data-debtor="${esc(l.account?.autocountDebtorCode || '')}">
           ↑ Push quotation
         </button>
       </div>`
    : '';

  const statusSel = PIPELINE_STAGES.map(s =>
    `<option value="${s}"${l.status === s ? ' selected' : ''}>${LEAD_STATUS_LABEL[s]}</option>`
  ).join('');

  const closedBySel = '<option value="">— unassigned —</option>' +
    _salesPeople.filter(p => p.status === 'ACTIVE')
      .map(p => `<option value="${p.id}"${l.closedById === p.id ? ' selected' : ''}>${esc(p.name)}</option>`).join('');

  return `<div class="bg-panel2 border border-line rounded-xl p-3 space-y-1.5 cursor-grab active:cursor-grabbing"
    draggable="true" data-lead-card="${l.id}">
    <div class="flex items-start justify-between gap-1">
      <p class="text-xs font-semibold text-ink leading-snug flex-1 break-words outline-none
                line-clamp-2 focus:line-clamp-none
                focus:ring-1 focus:ring-accent/50 rounded px-0.5 -mx-0.5 cursor-text"
         contenteditable="true" spellcheck="false" title="${esc(l.name)}"
         data-lead-name="${l.id}">${esc(l.name)}</p>
      <button class="btn-del shrink-0 text-[11px]" data-lead-del="${l.id}">×</button>
    </div>
    <p class="text-[11px] text-muted">${accName}</p>
    <div class="flex items-center gap-1.5">
      <span class="text-xs text-muted shrink-0">RM</span>
      <input type="text" inputmode="decimal" data-lead-value="${l.id}" value="${l.estimatedValue ?? ''}"
        placeholder="—" title="Estimated amount"
        class="min-w-0 flex-1 bg-transparent border-b border-transparent hover:border-line focus:border-accent/70
               text-xs text-ink font-semibold focus:outline-none px-0.5" />
    </div>
    <div class="flex items-center gap-1.5">
      <span class="text-xs ${priCls}">${l.priority.replace('_', ' ')}</span>
    </div>
    ${payBadge}
    <select data-lead-status="${l.id}"
      class="w-full mt-1 bg-panel border border-line text-ink px-2 py-1 rounded-md text-xs
             focus:outline-none focus:border-accent/70 cursor-pointer">
      ${statusSel}
    </select>
    <select data-lead-closed-by="${l.id}"
      class="w-full bg-panel border border-line text-muted px-2 py-1 rounded-md text-xs
             focus:outline-none focus:border-accent/70 cursor-pointer">
      ${closedBySel}
    </select>
    ${convertBtn}
    ${quotationBtn}
  </div>`;
}

// ── add lead ─────────────────────────────────────────────────

async function addLead() {
  const name = $('lead-name').value.trim();
  const msgEl = $('sales-msg');
  if (!name) { msg(msgEl, 'Lead name is required.', 'err'); return; }

  const val = parseFloat($('lead-value').value);
  const res = await fetch('/api/leads', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name,
      accountId:  $('lead-account').value   || undefined,
      status:     $('lead-status').value,
      priority:   $('lead-priority').value,
      estimatedValue: isNaN(val) ? undefined : val,
      closedById: $('lead-closed-by').value || undefined,
      company:    $('lead-company').value   || undefined,
    }),
  });

  if (res.ok) {
    $('lead-name').value = ''; $('lead-value').value = '';
    msg(msgEl, 'Lead added.', 'ok');
    loadSales();
  } else {
    const e = await res.json().catch(() => ({}));
    msg(msgEl, [].concat(e.message || 'Failed').join(', '), 'err');
  }
}

async function convertLead(id) {
  if (!confirm('Convert this won lead into a project? A new project will be created in BRIEF status.')) return;
  const res = await fetch(`/api/leads/${id}/convert`, { method: 'POST' });
  if (res.ok) {
    const project = await res.json();
    location.href = '/projects.html?open=' + project.id; // jump straight to the new project's detail view
  } else {
    const e = await res.json().catch(() => ({}));
    msg($('sales-msg'), [].concat(e.message || 'Failed').join(', '), 'err');
  }
}

async function deleteLead(id) {
  if (!confirm('Remove this lead?')) return;
  await fetch('/api/leads/' + id, { method: 'DELETE' });
  loadSales();
}

$('lead-add').addEventListener('click', addLead);

// ── Autocount quotation modal ──────────────────────────────────

function openQuoteModal(leadId, leadName, preselectedDebtorCode) {
  const options = _autocountDebtors.map(d =>
    `<option value="${esc(d.accNo)}" data-credit="${esc(d.creditTerm)}"${d.accNo === preselectedDebtorCode ? ' selected' : ''}>
       ${esc(d.companyName)} (${esc(d.accNo)})
     </option>`
  ).join('');

  $('quote-modal-title').textContent  = leadName;
  $('quote-debtor-sel').innerHTML     = `<option value="">— select debtor —</option>${options}`;
  $('quote-modal-lead-id').value      = leadId;
  $('quote-modal-msg').textContent    = '';
  $('quote-modal').classList.remove('hidden');
}

function closeQuoteModal() {
  $('quote-modal').classList.add('hidden');
}

async function submitQuote() {
  const leadId     = $('quote-modal-lead-id').value;
  const debtorCode = $('quote-debtor-sel').value;
  const msgEl      = $('quote-modal-msg');

  if (!debtorCode) { msgEl.textContent = 'Please select a debtor.'; msgEl.className = 'text-xs text-warm'; return; }

  $('quote-submit-btn').disabled = true;
  msgEl.textContent = 'Creating quotation…'; msgEl.className = 'text-xs text-muted';

  const res = await fetch(`/api/autocount/leads/${leadId}/quotation`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ debtorCode }),
  });

  $('quote-submit-btn').disabled = false;

  if (res.ok) {
    const data = await res.json();
    msgEl.textContent = `Done! Quotation ${data.docNo} created in Autocount.`;
    msgEl.className   = 'text-xs text-emerald-400';
    setTimeout(() => { closeQuoteModal(); loadSales(); }, 1500);
  } else {
    const e = await res.json().catch(() => ({}));
    msgEl.textContent = e.message || 'Failed to create quotation.';
    msgEl.className   = 'text-xs text-warm';
  }
}

// Wire up the sales search — re-render from cache without re-fetching.
const _salesSearchEl = $('sales-search');
if (_salesSearchEl) _salesSearchEl.addEventListener('input', renderSalesPipeline);
