// ══════════════════════════════════════════════════════════════
// SALES PERFORMANCE — Commission tracker for producers
// Depends on: $, msg, esc, fmtRM (index.html shared utilities)
// ══════════════════════════════════════════════════════════════

let _spYear     = new Date().getFullYear();
let _spQuarter  = Math.ceil((new Date().getMonth() + 1) / 3); // 0 = YTD
let _spData     = null;
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

  const data = await fetch('/api/sales-performance?' + params).then(r => r.json());
  _spData = data;

  renderSPPeriodTabs();
  renderSPStats(data);
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
    btn.onclick = () => addProjectCost(btn.dataset.spAddCost, btn);
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

async function addProjectCost(projectId, btn) {
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
      <td class="py-2 px-3">
        <input data-tier-id="${t.id}" data-tier-field="threshold" type="number" step="0.05" min="0" max="10"
          value="${t.threshold}" class="w-20 bg-bg border border-line rounded px-2 py-1 text-xs text-ink focus:outline-none" />
      </td>
      <td class="py-2 px-3">
        <input data-tier-id="${t.id}" data-tier-field="rate" type="number" step="0.0001" min="0" max="1"
          value="${t.rate}" class="w-24 bg-bg border border-line rounded px-2 py-1 text-xs text-ink focus:outline-none" />
      </td>
      <td class="py-2 px-3">
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
  const producerOptions = _spPeople.filter(p => !p.warmPool)
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
          ${_spPeople.filter(p => !p.warmPool).map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('')}
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
              <th class="text-left pb-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-muted">Threshold</th>
              <th class="text-left pb-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-muted">Rate</th>
              <th class="text-left pb-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-muted">Label</th>
              <th class="pb-2 px-3"></th>
            </tr>
          </thead>
          <tbody>${tierRows}</tbody>
        </table>
      </div>
      <p class="text-[10px] text-muted/60 mt-2">Threshold = fraction of target (0.50 = 50%). Rate = commission fraction (0.025 = 2.5%). These are the defaults — override per-person above.</p>
    </div>

    <!-- Sales targets -->
    <div class="bg-panel border border-line rounded-xl p-4">
      <h3 class="text-[11px] font-semibold uppercase tracking-widest text-muted mb-3">Sales Targets</h3>
      <div class="space-y-2 mb-3">
        <select id="sp-t-person" class="w-full bg-bg border border-line rounded px-2 py-1.5 text-xs text-ink focus:outline-none cursor-pointer">
          <option value="">— select producer —</option>
          ${producerOptions}
        </select>
        <div class="grid grid-cols-2 gap-2">
          <select id="sp-t-year" class="bg-bg border border-line rounded px-2 py-1.5 text-xs text-ink focus:outline-none cursor-pointer">
            ${[thisYear, thisYear+1, thisYear-1].map(y => `<option value="${y}"${y===_spYear?' selected':''}>${y}</option>`).join('')}
          </select>
          <select id="sp-t-quarter" class="bg-bg border border-line rounded px-2 py-1.5 text-xs text-ink focus:outline-none cursor-pointer">
            <option value="1">Q1</option>
            <option value="2"${_spQuarter===2?' selected':''}>Q2</option>
            <option value="3"${_spQuarter===3?' selected':''}>Q3</option>
            <option value="4">Q4</option>
          </select>
        </div>
        <input id="sp-t-amount" type="number" min="0" step="1000" placeholder="Target amount (RM)"
          class="w-full bg-bg border border-line rounded px-2 py-1.5 text-xs text-ink focus:outline-none" />
        <button onclick="saveTarget()"
          class="w-full py-2 bg-accent text-bg text-xs font-semibold rounded-lg cursor-pointer hover:bg-accent/90">
          Set target
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
          <input id="sp-ptr-${personId}-${t.id}" type="number" min="0" max="100" step="0.01"
            value="${customVal}" placeholder="${globalPct}"
            class="w-24 bg-bg border ${hasCustom ? 'border-accent/60' : 'border-line'} rounded px-2 py-1 text-xs text-ink focus:outline-none" />
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

async function loadTargetsList() {
  const targets = await fetch(`/api/sales-targets?year=${_spYear}`).then(r => r.json());
  const el = $('sp-targets-list');
  if (!el) return;
  if (!targets.length) {
    el.innerHTML = '<p class="text-[11px] text-muted/60">No targets set for this year.</p>';
    return;
  }
  el.innerHTML = targets.map(t => `
    <div class="flex items-center justify-between py-1.5 border-b border-line/40">
      <div>
        <p class="text-xs text-ink">${esc(t.person.name)}</p>
        <p class="text-[10px] text-muted">Q${t.quarter} ${t.year}</p>
      </div>
      <div class="flex items-center gap-2">
        <span class="text-xs font-semibold text-accent">${fmtRM(t.targetAmount)}</span>
        <button onclick="removeTarget('${t.id}')"
          class="text-[10px] text-muted hover:text-rose-400 cursor-pointer">×</button>
      </div>
    </div>`).join('');
}

async function saveTarget() {
  const personId     = $('sp-t-person').value;
  const year         = parseInt($('sp-t-year').value);
  const quarter      = parseInt($('sp-t-quarter').value);
  const targetAmount = parseFloat($('sp-t-amount').value);
  const msgEl        = $('sp-t-msg');

  if (!personId || !targetAmount) {
    msg(msgEl, 'Select a producer and enter a target amount.', 'err'); return;
  }
  const res = await fetch('/api/sales-targets', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ personId, year, quarter, targetAmount }),
  });
  if (res.ok) {
    $('sp-t-amount').value = '';
    msg(msgEl, 'Target saved.', 'ok');
    loadTargetsList();
    loadSalesPerformance();
  } else {
    msg(msgEl, 'Failed to save target.', 'err');
  }
}

async function removeTarget(id) {
  if (!confirm('Remove this target?')) return;
  await fetch('/api/sales-targets/' + id, { method: 'DELETE' });
  loadTargetsList();
  loadSalesPerformance();
}

// ── shared helper ─────────────────────────────────────────────

function fmtRM(n) {
  if (!n && n !== 0) return '<span class="text-muted">—</span>';
  return 'RM ' + Number(n).toLocaleString('en-MY', { maximumFractionDigits: 0 });
}
