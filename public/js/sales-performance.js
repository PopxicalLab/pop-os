// ══════════════════════════════════════════════════════════════
// SALES PERFORMANCE — Commission tracker for producers
// Depends on: $, msg, esc, fmtRM (index.html shared utilities)
// ══════════════════════════════════════════════════════════════

let _spYear     = new Date().getFullYear();
let _spQuarter  = Math.ceil((new Date().getMonth() + 1) / 3); // 0 = YTD
let _spData     = null;
let _spYearData = null; // full-year Q1–Q4 breakdown from /api/sales-performance/yearly
let _spPeople   = [];

const COST_TYPE_LABEL = { WARM_POOL: 'Warm pool', SUPPLIER: 'Supplier', ADDITIONAL: 'Additional' };
const QUARTER_LABEL   = { 0: 'YTD', 1: 'Q1', 2: 'Q2', 3: 'Q3', 4: 'Q4' };

async function loadSalesPerformance() {
  // Load people for the target setter dropdown
  if (!_spPeople.length) {
    _spPeople = await fetch('/api/people').then(r => r.json());
  }

  const params = new URLSearchParams({ year: _spYear });
  if (_spQuarter > 0) params.set('quarter', _spQuarter);

  // Fetch per-period data AND the full-year summary in parallel.
  const [data, yearData] = await Promise.all([
    fetch('/api/sales-performance?' + params).then(r => r.json()),
    fetch('/api/sales-performance/yearly?year=' + _spYear).then(r => r.json()),
  ]);
  _spData     = data;
  _spYearData = yearData;

  renderSPPeriodTabs();
  renderSPStats(data);
  renderYearlySummary(yearData);
  renderSPLeaderboard(data);
  renderSPSettings(data);
}

// ── period selector ───────────────────────────────────────────

function renderSPPeriodTabs() {
  // Year select
  const yearSel = $('sp-year');
  if (yearSel && !yearSel.dataset.built) {
    const thisYear = new Date().getFullYear();
    yearSel.innerHTML = [thisYear, thisYear - 1, thisYear - 2]
      .map(y => `<option value="${y}"${y === _spYear ? ' selected' : ''}>${y}</option>`)
      .join('');
    yearSel.dataset.built = '1';
  }

  // Quarter tabs
  [0, 1, 2, 3, 4].forEach(q => {
    const btn = $('sp-q' + q);
    if (!btn) return;
    btn.classList.toggle('bg-accent',    q === _spQuarter);
    btn.classList.toggle('text-bg',      q === _spQuarter);
    btn.classList.toggle('text-muted',   q !== _spQuarter);
    btn.classList.toggle('border-line',  q !== _spQuarter);
  });
}

function spSetYear(y) { _spYear = +y; loadSalesPerformance(); }
function spSetQuarter(q) { _spQuarter = q; loadSalesPerformance(); }

// ── stats strip ───────────────────────────────────────────────

function renderSPStats(data) {
  const totalRevenue   = data.results.reduce((s, r) => s + r.revenue,   0);
  const totalCommission = data.results.reduce((s, r) => s + r.commission, 0);
  const onTarget       = data.results.filter(r => r.attainment >= 100).length;
  const total          = data.results.length;

  $('sp-stat-revenue').textContent    = fmtRM(totalRevenue);
  $('sp-stat-commission').textContent  = fmtRM(totalCommission);
  $('sp-stat-on-target').textContent   = `${onTarget} / ${total}`;
  $('sp-stat-period').textContent      =
    data.quarter ? `${QUARTER_LABEL[data.quarter]} ${data.year}` : `${data.year} YTD`;
}

// ── yearly overview panel ─────────────────────────────────────

function renderYearlySummary(yearData) {
  const el = $('sp-yearly');
  if (!el) return;

  const { year, quarters, yearly } = yearData;

  // Color helpers for attainment
  const attCls = pct =>
    pct >= 100 ? 'text-emerald-400'
    : pct >= 75 ? 'text-yellow-400'
    : pct >= 50 ? 'text-orange-400'
    : 'text-rose-400';

  const barCls = pct =>
    pct >= 100 ? 'bg-emerald-400'
    : pct >= 75 ? 'bg-yellow-400'
    : pct >= 50 ? 'bg-orange-400'
    : 'bg-rose-400';

  // Build one column per quarter + one for the full year
  const cols = [
    ...quarters.map(q => ({
      label: `Q${q.quarter}`,
      revenue:    q.revenue,
      target:     q.target,
      costs:      q.costs,
      netProfit:  q.netProfit,
      attainment: q.attainment,
      isYear:     false,
    })),
    {
      label:      `${year} Total`,
      revenue:    yearly.revenue,
      target:     yearly.target,
      costs:      yearly.costs,
      netProfit:  yearly.netProfit,
      attainment: yearly.attainment,
      wonDeals:   yearly.wonDeals,
      isYear:     true,
    },
  ];

  const colsHtml = cols.map(c => {
    const barPct = Math.min((c.attainment / 100) * 100, 100).toFixed(1);
    const noData = !c.revenue && !c.target;
    return `<div class="bg-panel2 rounded-xl p-3.5 ${c.isYear ? 'border border-accent/30' : 'border border-line'}">
      <p class="text-[10px] font-bold uppercase tracking-widest ${c.isYear ? 'text-accent' : 'text-muted'} mb-2">${c.label}</p>

      ${noData ? `<p class="text-[11px] text-muted/50 mt-4 mb-4">No data</p>` : `
      <!-- Attainment bar -->
      <div class="mb-2">
        <div class="flex items-end justify-between mb-1">
          <span class="text-[10px] text-muted">Attainment</span>
          <span class="text-xs font-bold ${attCls(c.attainment)}">${c.attainment.toFixed(1)}%</span>
        </div>
        <div class="h-1.5 bg-panel rounded-full overflow-hidden">
          <div class="h-full ${barCls(c.attainment)} rounded-full transition-all" style="width:${barPct}%"></div>
        </div>
      </div>

      <!-- Revenue / Target -->
      <div class="space-y-1 text-[11px]">
        <div class="flex justify-between">
          <span class="text-muted">Revenue</span>
          <span class="font-semibold text-ink">${fmtRM(c.revenue)}</span>
        </div>
        ${c.target ? `<div class="flex justify-between">
          <span class="text-muted">Target</span>
          <span class="text-muted">${fmtRM(c.target)}</span>
        </div>` : ''}
        <div class="flex justify-between">
          <span class="text-muted">Net Profit</span>
          <span class="${c.netProfit >= 0 ? 'text-accent' : 'text-warm'} font-semibold">${fmtRM(c.netProfit)}</span>
        </div>
        ${c.wonDeals !== undefined ? `<div class="flex justify-between">
          <span class="text-muted">Deals won</span>
          <span class="text-ink">${c.wonDeals}</span>
        </div>` : ''}
      </div>`}
    </div>`;
  }).join('');

  el.innerHTML = `
    <div class="bg-panel border border-line rounded-xl p-5">
      <div class="flex items-center justify-between mb-4">
        <div>
          <h2 class="text-sm font-bold text-ink">${year} Year Overview</h2>
          <p class="text-[11px] text-muted">All producers combined · quarterly breakdown</p>
        </div>
        ${yearly.revenue > 0 ? `<div class="text-right">
          <p class="text-[10px] text-muted uppercase tracking-wider">Total Revenue</p>
          <p class="text-xl font-bold text-ink">${fmtRM(yearly.revenue)}</p>
          ${yearly.target ? `<p class="text-[11px] ${attCls(yearly.attainment)}">${yearly.attainment.toFixed(1)}% of target</p>` : ''}
        </div>` : ''}
      </div>
      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">${colsHtml}</div>
    </div>`;
}

// ── leaderboard ───────────────────────────────────────────────

function renderSPLeaderboard(data) {
  const el = $('sp-leaderboard');
  if (!data.results.length) {
    el.innerHTML = `<div class="bg-panel border border-line rounded-xl p-8 text-center text-muted text-sm">
      No WON leads or targets set for this period.</div>`;
    return;
  }

  const cards = data.results.map(r => producerCard(r, data.tiers)).join('');
  el.innerHTML = cards;

  // Wire deal toggle buttons
  el.querySelectorAll('[data-sp-toggle]').forEach(btn => {
    btn.onclick = () => {
      const panel = document.getElementById('sp-deals-' + btn.dataset.spToggle);
      if (panel) panel.classList.toggle('hidden');
    };
  });

  // Wire cost add forms inside deal rows
  el.querySelectorAll('[data-sp-cost-form]').forEach(btn => {
    btn.onclick = () => {
      document.getElementById('sp-cost-panel-' + btn.dataset.spCostForm)?.classList.toggle('hidden');
    };
  });
  el.querySelectorAll('[data-sp-add-cost]').forEach(btn => {
    btn.onclick = () => addSPProjectCost(btn.dataset.spAddCost, btn);
  });
}

function producerCard(r, tiers) {
  // Show "Custom" badge if any tier has a per-person override for this person.
  const hasCustom   = r.customTierRates && Object.keys(r.customTierRates).length > 0;
  const tierBadge   = hasCustom
    ? `<span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-400 border border-sky-500/30">Custom rates</span>`
    : r.tier
      ? `<span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">${esc(r.tier.label)}</span>`
      : `<span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-line/50 text-muted border border-line">No tier</span>`;

  const attPct  = Math.min(r.attainment, 150); // cap bar at 150%
  const barPct  = Math.min((attPct / 150) * 100, 100).toFixed(1);
  const barColor = r.attainment >= 150 ? 'bg-purple-400'
                 : r.attainment >= 100 ? 'bg-emerald-400'
                 : r.attainment >= 75  ? 'bg-yellow-400'
                 : r.attainment >= 50  ? 'bg-orange-400'
                 : 'bg-rose-400';

  // Tier markers on the bar (at 50%, 75%, 100%, 150% of 150% scale)
  const markers = tiers.map(t => {
    const left = ((t.threshold * 100) / 150 * 100).toFixed(2);
    return `<div class="absolute top-0 bottom-0 w-px bg-bg/60" style="left:${left}%"></div>`;
  }).join('');

  const deals = r.deals.length
    ? r.deals.map(d => `
        <tr class="border-b border-line/40">
          <td class="py-2 px-3 text-xs text-ink">${esc(d.name)}</td>
          <td class="py-2 px-3 text-xs text-right">${fmtRM(d.value)}</td>
          <td class="py-2 px-3 text-xs text-right text-warm">${fmtRM(d.costs)}</td>
          <td class="py-2 px-3 text-xs text-right text-accent">${fmtRM(d.value - d.costs)}</td>
          <td class="py-2 px-3 text-right">
            ${d.project
              ? `<button data-sp-cost-form="${d.project.id}"
                   class="text-[10px] text-muted hover:text-ink border border-line rounded px-1.5 py-0.5 cursor-pointer">
                   + cost
                 </button>
                 <div id="sp-cost-panel-${d.project.id}" class="hidden mt-1.5 space-y-1">
                   <input id="sp-cost-desc-${d.project.id}" type="text" placeholder="Description"
                     class="w-full bg-bg border border-line rounded px-2 py-1 text-xs text-ink focus:outline-none" />
                   <div class="flex gap-1">
                     <input id="sp-cost-amt-${d.project.id}" type="number" min="0" placeholder="Amount"
                       class="flex-1 bg-bg border border-line rounded px-2 py-1 text-xs text-ink focus:outline-none" />
                     <select id="sp-cost-type-${d.project.id}"
                       class="bg-bg border border-line rounded px-1 py-1 text-xs text-ink focus:outline-none cursor-pointer">
                       <option value="WARM_POOL">Warm pool</option>
                       <option value="SUPPLIER">Supplier</option>
                       <option value="ADDITIONAL" selected>Additional</option>
                     </select>
                     <button data-sp-add-cost="${d.project.id}"
                       class="px-2 py-1 bg-accent text-bg text-xs rounded font-semibold cursor-pointer">
                       Add
                     </button>
                   </div>
                 </div>`
              : '<span class="text-[10px] text-muted/50">No project</span>'}
          </td>
        </tr>`).join('')
    : `<tr><td colspan="5" class="py-3 px-3 text-xs text-muted text-center">No deals won this period</td></tr>`;

  return `<div class="bg-panel border border-line rounded-xl p-5 mb-4">
    <div class="flex items-start justify-between gap-3 mb-3">
      <div>
        <p class="text-sm font-semibold text-ink">${esc(r.person.name)}</p>
        <div class="flex items-center gap-2 mt-1">${tierBadge}
          <span class="text-[11px] text-muted">${r.leadCount} deal${r.leadCount !== 1 ? 's' : ''} won</span>
        </div>
      </div>
      <div class="text-right shrink-0">
        <p class="text-xs text-muted">Commission</p>
        <p class="text-lg font-bold text-accent">${fmtRM(r.commission)}</p>
        <p class="text-[10px] text-muted">${r.commissionRate.toFixed(2)}% of net profit</p>
      </div>
    </div>

    <!-- Attainment bar -->
    <div class="mb-3">
      <div class="flex justify-between text-[11px] text-muted mb-1">
        <span>Attainment: <span class="font-semibold text-ink">${r.attainment.toFixed(1)}%</span></span>
        <span>Target: ${fmtRM(r.target)}</span>
      </div>
      <div class="relative h-2.5 bg-panel2 rounded-full overflow-hidden">
        <div class="${barColor} h-full rounded-full transition-all" style="width:${barPct}%"></div>
        ${markers}
      </div>
      <div class="flex justify-between text-[10px] text-muted/60 mt-0.5">
        <span>50%</span><span>75%</span><span>100%</span><span>150%</span>
      </div>
    </div>

    <!-- Revenue / Costs / Net -->
    <div class="grid grid-cols-3 gap-3 mb-3 text-center">
      <div class="bg-panel2 rounded-lg p-2">
        <p class="text-[10px] text-muted uppercase tracking-wider">Revenue</p>
        <p class="text-sm font-semibold text-ink">${fmtRM(r.revenue)}</p>
      </div>
      <div class="bg-panel2 rounded-lg p-2">
        <p class="text-[10px] text-muted uppercase tracking-wider">Costs</p>
        <p class="text-sm font-semibold text-warm">${fmtRM(r.costs)}</p>
      </div>
      <div class="bg-panel2 rounded-lg p-2">
        <p class="text-[10px] text-muted uppercase tracking-wider">Net Profit</p>
        <p class="text-sm font-semibold text-accent">${fmtRM(r.netProfit)}</p>
      </div>
    </div>

    <!-- Deal breakdown toggle -->
    <button data-sp-toggle="${r.person.id}"
      class="text-[11px] text-muted hover:text-ink transition cursor-pointer">
      ▾ Show deal breakdown
    </button>
    <div id="sp-deals-${r.person.id}" class="hidden mt-2 overflow-x-auto">
      <table class="w-full min-w-[480px] text-sm">
        <thead>
          <tr class="border-b border-line">
            <th class="text-left pb-1.5 px-3 text-[10px] font-semibold uppercase tracking-wider text-muted">Deal</th>
            <th class="text-right pb-1.5 px-3 text-[10px] font-semibold uppercase tracking-wider text-muted">Value</th>
            <th class="text-right pb-1.5 px-3 text-[10px] font-semibold uppercase tracking-wider text-muted">Costs</th>
            <th class="text-right pb-1.5 px-3 text-[10px] font-semibold uppercase tracking-wider text-muted">Net</th>
            <th class="pb-1.5 px-3"></th>
          </tr>
        </thead>
        <tbody>${deals}</tbody>
      </table>
    </div>
  </div>`;
}

async function addSPProjectCost(projectId, btn) {
  const desc = document.getElementById('sp-cost-desc-' + projectId)?.value.trim();
  const amt  = parseFloat(document.getElementById('sp-cost-amt-'  + projectId)?.value);
  const type = document.getElementById('sp-cost-type-' + projectId)?.value;
  if (!desc || !amt) return;

  btn.disabled = true; btn.textContent = '…';
  const res = await fetch('/api/project-costs', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectId, description: desc, amount: amt, costType: type }),
  });
  if (res.ok) loadSalesPerformance();
  else { btn.disabled = false; btn.textContent = 'Add'; }
}

// ── settings panel (admin only) ───────────────────────────────

function renderSPSettings(data) {
  const el = $('sp-settings');

  // Commission tiers table (global rates, editable)
  const tierRows = data.tiers.map(t => `
    <tr class="border-b border-line/60">
      <td class="py-2 px-3 whitespace-nowrap">
        <input data-tier-id="${t.id}" data-tier-field="threshold" type="text"
          value="${t.threshold}" class="w-10 bg-bg border border-line rounded px-1 py-0.5 text-xs text-ink focus:outline-none" />
      </td>
      <td class="py-2 px-3 whitespace-nowrap">
        <input data-tier-id="${t.id}" data-tier-field="rate" type="text"
          value="${t.rate}" class="w-16 bg-bg border border-line rounded px-1 py-0.5 text-xs text-ink focus:outline-none" />
      </td>
      <td class="py-2 px-3 w-full">
        <input data-tier-id="${t.id}" data-tier-field="label" type="text"
          value="${esc(t.label)}" class="w-full bg-bg border border-line rounded px-2 py-1 text-xs text-ink focus:outline-none" />
      </td>
      <td class="py-2 px-3">
        <button data-save-tier="${t.id}"
          class="text-[10px] bg-accent/15 text-accent border border-accent/30 px-2 py-0.5 rounded cursor-pointer hover:bg-accent/25">
          Save
        </button>
      </td>
    </tr>`).join('');

  const thisYear = new Date().getFullYear();
  const producerOptions = _spPeople.filter(p => p.status === 'ACTIVE')
    .map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('');

  el.innerHTML = `
    <!-- Per-person tier rates -->
    <div class="bg-panel border border-line rounded-xl p-4 mb-4">
      <h3 class="text-[11px] font-semibold uppercase tracking-widest text-muted mb-1">Per-person Commission Rates</h3>
      <p class="text-[11px] text-muted/70 mb-3">
        Set a custom rate for a specific producer at each tier threshold.
        Leave blank to use the global rate shown in the tier table below.
      </p>
      <div class="flex gap-2 mb-3">
        <select id="sp-ptr-person"
          class="bg-bg border border-line rounded px-2 py-1.5 text-xs text-ink focus:outline-none cursor-pointer flex-1"
          onchange="renderPersonTierRates(this.value)">
          <option value="">— select producer —</option>
          ${_spPeople.filter(p => p.status === 'ACTIVE').map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('')}
        </select>
      </div>
      <div id="sp-ptr-rows"></div>
    </div>

    <!-- Global commission tiers -->
    <div class="bg-panel border border-line rounded-xl p-4 mb-4">
      <h3 class="text-[11px] font-semibold uppercase tracking-widest text-muted mb-3">Commission Tiers (Global Defaults)</h3>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-line">
              <th class="text-left pb-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-muted whitespace-nowrap">Tier</th>
              <th class="text-left pb-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-muted whitespace-nowrap">Rate</th>
              <th class="text-left pb-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-muted w-full">Label</th>
              <th class="pb-2 px-3"></th>
            </tr>
          </thead>
          <tbody>${tierRows}</tbody>
        </table>
      </div>
      <p class="text-[10px] text-muted/60 mt-2">Threshold = fraction of target (0.50 = 50%). Rate = commission fraction (0.025 = 2.5%). These are the defaults — override per-person above.</p>
    </div>

    <!-- Sales targets — 4-quarter grid per producer -->
    <div class="bg-panel border border-line rounded-xl p-4">
      <h3 class="text-[11px] font-semibold uppercase tracking-widest text-muted mb-1">Sales Targets</h3>
      <p class="text-[11px] text-muted/70 mb-3">Set all four quarters at once for a producer.</p>
      <div class="space-y-2 mb-4">
        <div class="flex gap-2">
          <select id="sp-t-person" onchange="loadTargetInputs()"
            class="flex-1 bg-bg border border-line rounded px-2 py-1.5 text-xs text-ink focus:outline-none cursor-pointer">
            <option value="">— select producer —</option>
            ${producerOptions}
          </select>
          <select id="sp-t-year" onchange="loadTargetInputs()"
            class="bg-bg border border-line rounded px-2 py-1.5 text-xs text-ink focus:outline-none cursor-pointer">
            ${[thisYear, thisYear+1, thisYear-1].map(y => `<option value="${y}"${y===_spYear?' selected':''}>${y}</option>`).join('')}
          </select>
        </div>
        <!-- Q1–Q4 inputs, populated by loadTargetInputs() -->
        <div id="sp-t-quarter-grid" class="grid grid-cols-4 gap-1.5 hidden">
          ${[1,2,3,4].map(q => `
            <div class="flex flex-col gap-1">
              <label class="text-[10px] font-semibold text-muted uppercase tracking-wider text-center">Q${q}</label>
              <input id="sp-t-q${q}" type="text" placeholder="—"
                class="w-full bg-bg border border-line rounded px-1 py-0.5 text-xs text-ink text-center focus:outline-none focus:border-accent/60" />
            </div>`).join('')}
        </div>
        <p id="sp-t-hint" class="text-[11px] text-muted/50">Select a producer to configure targets.</p>
        <button onclick="saveAllTargets()"
          class="w-full py-2 bg-accent text-bg text-xs font-semibold rounded-lg cursor-pointer hover:bg-accent/90 hidden"
          id="sp-t-save-btn">
          Save all quarterly targets
        </button>
        <p id="sp-t-msg" class="text-[11px] hidden"></p>
      </div>
      <div id="sp-targets-list"></div>
    </div>`;

  // Wire tier save buttons
  el.querySelectorAll('[data-save-tier]').forEach(btn => {
    btn.onclick = async () => {
      const id        = btn.dataset.saveTier;
      const threshold = parseFloat(el.querySelector(`[data-tier-id="${id}"][data-tier-field="threshold"]`).value);
      const rate      = parseFloat(el.querySelector(`[data-tier-id="${id}"][data-tier-field="rate"]`).value);
      const label     = el.querySelector(`[data-tier-id="${id}"][data-tier-field="label"]`).value.trim();
      btn.disabled = true; btn.textContent = '…';
      const res = await fetch(`/api/commission-tiers/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threshold, rate, label }),
      });
      if (res.ok) loadSalesPerformance();
      else { btn.disabled = false; btn.textContent = 'Save'; }
    };
  });

  loadTargetsList();
}

// Render the per-person tier rate table for the selected producer.
// _spData.tiers contains global tiers; result.customTierRates has any overrides.
function renderPersonTierRates(personId) {
  const el = $('sp-ptr-rows');
  if (!el) return;
  if (!personId) { el.innerHTML = ''; return; }

  const result = _spData?.results.find(r => r.person.id === personId);
  // customTierRates is a map of tierId → rate from the server
  const customRates = result?.customTierRates ?? {};
  const tiers = _spData?.tiers ?? [];

  if (!tiers.length) {
    el.innerHTML = '<p class="text-[11px] text-muted/60">No tiers configured.</p>';
    return;
  }

  const rows = tiers.map(t => {
    const hasCustom  = t.id in customRates;
    const customVal  = hasCustom ? (customRates[t.id] * 100).toFixed(4) : '';
    const globalPct  = (t.rate * 100).toFixed(4);
    return `<tr class="border-b border-line/40">
      <td class="py-2 pr-3 text-xs text-ink whitespace-nowrap">${esc(t.label)}</td>
      <td class="py-2 pr-3 text-[10px] text-muted whitespace-nowrap">≥ ${(t.threshold * 100).toFixed(0)}% of target</td>
      <td class="py-2 pr-3 text-[10px] text-muted whitespace-nowrap">Default: ${globalPct}%</td>
      <td class="py-2 pr-2">
        <div class="flex items-center gap-1">
          <input id="sp-ptr-${personId}-${t.id}" type="text"
            value="${customVal}" placeholder="${globalPct}"
            class="w-16 bg-bg border ${hasCustom ? 'border-accent/60' : 'border-line'} rounded px-1 py-0.5 text-xs text-ink focus:outline-none" />
          <span class="text-[10px] text-muted">%</span>
        </div>
      </td>
      <td class="py-2">
        <div class="flex gap-1">
          <button data-ptr-save="${t.id}"
            class="text-[10px] bg-accent/15 text-accent border border-accent/30 px-2 py-0.5 rounded cursor-pointer hover:bg-accent/25">
            Save
          </button>
          ${hasCustom ? `<button data-ptr-clear="${t.id}"
            class="text-[10px] text-muted hover:text-warm border border-line px-2 py-0.5 rounded cursor-pointer">
            Clear
          </button>` : ''}
        </div>
      </td>
    </tr>`;
  }).join('');

  el.innerHTML = `
    <table class="w-full text-sm">
      <thead>
        <tr class="border-b border-line">
          <th class="text-left pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted">Tier</th>
          <th class="text-left pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted">Attainment</th>
          <th class="text-left pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted">Global rate</th>
          <th class="text-left pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted">Custom rate %</th>
          <th class="pb-1.5"></th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <p class="text-[10px] text-muted/60 mt-2">
      Enter a custom % to override the global rate for this person at that threshold.
      Leave blank (or click Clear) to revert to the global rate.
    </p>`;

  // Wire save buttons
  el.querySelectorAll('[data-ptr-save]').forEach(btn => {
    btn.onclick = async () => {
      const tierId  = btn.dataset.ptrSave;
      const input   = document.getElementById(`sp-ptr-${personId}-${tierId}`);
      const rateStr = input?.value.trim();
      if (!rateStr) return; // empty = nothing to save
      const rate = parseFloat(rateStr) / 100;
      if (isNaN(rate) || rate < 0) return;
      btn.disabled = true; btn.textContent = '…';
      const res = await fetch('/api/sales-performance/person-tier-rates', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personId, tierId, rate }),
      });
      if (res.ok) loadSalesPerformance().then(() => renderPersonTierRates(personId));
      else { btn.disabled = false; btn.textContent = 'Save'; }
    };
  });

  // Wire clear buttons
  el.querySelectorAll('[data-ptr-clear]').forEach(btn => {
    btn.onclick = async () => {
      const tierId = btn.dataset.ptrClear;
      btn.disabled = true;
      const res = await fetch(`/api/sales-performance/person-tier-rates/${personId}/${tierId}`, {
        method: 'DELETE',
      });
      if (res.ok) loadSalesPerformance().then(() => renderPersonTierRates(personId));
      else btn.disabled = false;
    };
  });
}

// Populate the Q1–Q4 inputs for the selected producer + year from existing targets.
async function loadTargetInputs() {
  const personId = $('sp-t-person')?.value;
  const year     = parseInt($('sp-t-year')?.value);
  const grid     = $('sp-t-quarter-grid');
  const hint     = $('sp-t-hint');
  const saveBtn  = $('sp-t-save-btn');

  if (!personId) {
    grid?.classList.add('hidden');
    hint?.classList.remove('hidden');
    saveBtn?.classList.add('hidden');
    return;
  }

  grid?.classList.remove('hidden');
  hint?.classList.add('hidden');
  saveBtn?.classList.remove('hidden');

  // Load existing targets for this person + year and pre-fill the inputs.
  const targets = await fetch(`/api/sales-targets?year=${year}`).then(r => r.json());
  const byQ = {};
  for (const t of targets) {
    if (t.personId === personId) byQ[t.quarter] = t.targetAmount;
  }
  [1, 2, 3, 4].forEach(q => {
    const inp = $('sp-t-q' + q);
    if (inp) inp.value = byQ[q] != null ? byQ[q] : '';
  });

  loadTargetsList();
}

async function loadTargetsList() {
  const year = parseInt($('sp-t-year')?.value) || _spYear;
  const targets = await fetch(`/api/sales-targets?year=${year}`).then(r => r.json());
  const el = $('sp-targets-list');
  if (!el) return;
  if (!targets.length) {
    el.innerHTML = '<p class="text-[11px] text-muted/60 mt-2">No targets set for this year.</p>';
    return;
  }

  // Group by person for a compact view
  const byPerson = {};
  for (const t of targets) {
    if (!byPerson[t.personId]) byPerson[t.personId] = { name: t.person.name, qs: {} };
    byPerson[t.personId].qs[t.quarter] = { id: t.id, amount: t.targetAmount };
  }

  el.innerHTML = `<div class="mt-3 space-y-2 text-[11px]">` +
    Object.values(byPerson).sort((a, b) => a.name.localeCompare(b.name)).map(p => {
      const qCells = [1,2,3,4].map(q => {
        const entry = p.qs[q];
        return entry
          ? `<span class="text-accent font-semibold">Q${q}: ${fmtRM(entry.amount)}</span>
             <button onclick="removeTarget('${entry.id}')"
               class="ml-0.5 text-muted/50 hover:text-rose-400 cursor-pointer">×</button>`
          : `<span class="text-muted/40">Q${q}: —</span>`;
      });
      return `<div class="border-b border-line/40 pb-1.5">
        <p class="text-ink font-semibold mb-0.5">${esc(p.name)}</p>
        <div class="flex flex-wrap gap-2">${qCells.join('')}</div>
      </div>`;
    }).join('') +
    `</div>`;
}

// Save all four quarterly targets at once for the selected producer.
async function saveAllTargets() {
  const personId = $('sp-t-person')?.value;
  const year     = parseInt($('sp-t-year')?.value);
  const msgEl    = $('sp-t-msg');

  if (!personId) { msg(msgEl, 'Select a producer first.', 'err'); return; }

  const saves = [];
  for (const q of [1, 2, 3, 4]) {
    const val = parseFloat($('sp-t-q' + q)?.value);
    if (!isNaN(val) && val >= 0) {
      saves.push(
        fetch('/api/sales-targets', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ personId, year, quarter: q, targetAmount: val }),
        })
      );
    }
  }

  if (!saves.length) { msg(msgEl, 'Enter at least one quarter target.', 'err'); return; }

  const results = await Promise.all(saves);
  if (results.every(r => r.ok)) {
    msg(msgEl, 'Targets saved.', 'ok');
    loadTargetsList();
    loadSalesPerformance();
  } else {
    msg(msgEl, 'Some targets failed to save.', 'err');
  }
}

async function removeTarget(id) {
  if (!confirm('Remove this target?')) return;
  await fetch('/api/sales-targets/' + id, { method: 'DELETE' });
  loadTargetInputs(); // re-fills the Q grid + list
  loadSalesPerformance();
}

// ── shared helper ─────────────────────────────────────────────

function fmtRM(n) {
  if (!n && n !== 0) return '<span class="text-muted">—</span>';
  return 'RM ' + Number(n).toLocaleString('en-MY', { maximumFractionDigits: 0 });
}
