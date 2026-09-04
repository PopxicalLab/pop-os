// ══════════════════════════════════════════════════════════════
// PROJECTS
// Depends on: $, msg, esc  (index.html shared script)
//             PEOPLE       (people.js — populated before Projects tab is used)
// ══════════════════════════════════════════════════════════════

// ── display helpers ──────────────────────────────────────────

function complexityDots(n) {
  if (!n) return '<span class="text-muted">—</span>';
  let h = '<span class="inline-flex gap-0.5 items-center">';
  for (let i = 1; i <= 5; i++)
    h += `<span class="w-1.5 h-1.5 rounded-full ${i <= n ? 'bg-accent' : 'bg-line'}"></span>`;
  return h + `</span> <span class="text-xs text-muted ml-1">${n}</span>`;
}

function fmtValue(v) {
  if (v == null) return '<span class="text-muted">—</span>';
  return 'RM ' + Number(v).toLocaleString('en-MY', { maximumFractionDigits: 0 });
}

const CLIENT_TIER_LABEL = { NEW: 'New', RETURNING: 'Returning', KEY_ACCOUNT: 'Key acct' };

const QUADRANT_LABEL = {
  GOLD: 'Gold', STRATEGIC_BET: 'Strategic Bet',
  OPERATIONAL_FILLER: 'Op. Filler', DRAIN: 'Drain',
};
const QUADRANT_CLS = {
  GOLD:               'bg-yellow-500/15 text-yellow-400',
  STRATEGIC_BET:      'bg-emerald-500/15 text-emerald-400',
  OPERATIONAL_FILLER: 'bg-sky-500/15 text-sky-400',
  DRAIN:              'bg-warm/15 text-warm',
};
const STATUS_LABEL = {
  BRIEF: 'Brief', IN_PROGRESS: 'In progress', INTERNAL_REVIEW: 'Internal review',
  DELIVERED: 'Delivered', ON_HOLD: 'On hold', CANCELLED: 'Cancelled',
};
const PRI_CLS = {
  P1: 'font-bold text-warm',
  P2: 'font-semibold text-accent',
  P3: 'font-medium text-muted',
};

// ── column visibility ────────────────────────────────────────

const PROJ_COLS = [
  { id: 'client',     label: 'Client',      def: true  },
  { id: 'quadrant',   label: 'Quadrant',    def: true  },
  { id: 'priority',   label: 'Priority',    def: true  },
  { id: 'deadline',   label: 'Deadline',    def: true  },
  { id: 'producer',   label: 'Producer',    def: true  },
  { id: 'pm',         label: 'PM',          def: true  },
  { id: 'value',      label: 'Est. Value',  def: false },
  { id: 'duration',   label: 'Duration',    def: false },
  { id: 'complexity', label: 'Complexity',  def: false },
  { id: 'tier',       label: 'Client tier', def: false },
  { id: 'margin',     label: 'Margin',      def: false },
];

function getColVis() {
  const saved = JSON.parse(localStorage.getItem('pop-os-proj-cols') || 'null') || {};
  const vis = {};
  PROJ_COLS.forEach(c => { vis[c.id] = c.id in saved ? saved[c.id] : c.def; });
  return vis;
}

function applyColVisibility() {
  const vis = getColVis();
  PROJ_COLS.forEach(c => {
    document.querySelectorAll(`[data-col="${c.id}"]`).forEach(el => {
      el.classList.toggle('hidden', !vis[c.id]);
    });
  });
}

function toggleCol(id, visible) {
  const vis = getColVis();
  vis[id] = visible;
  localStorage.setItem('pop-os-proj-cols', JSON.stringify(vis));
  applyColVisibility();
}

function buildColPicker() {
  const vis = getColVis();
  $('col-picker').innerHTML = PROJ_COLS.map(c => `
    <label class="flex items-center gap-2.5 px-3 py-2 hover:bg-panel2/60 cursor-pointer">
      <input type="checkbox" ${vis[c.id] ? 'checked' : ''}
        onchange="toggleCol('${c.id}', this.checked)"
        class="accent-accent w-3.5 h-3.5 cursor-pointer" />
      <span class="text-xs text-ink">${c.label}</span>
    </label>`).join('');
}

function toggleColPicker() {
  const picker = $('col-picker');
  if (picker.classList.contains('hidden')) {
    buildColPicker();
    picker.classList.remove('hidden');
    setTimeout(() => document.addEventListener('click', function h(e) {
      if (!picker.contains(e.target) && !e.target.closest('button[onclick="toggleColPicker()"]')) {
        picker.classList.add('hidden');
        document.removeEventListener('click', h);
      }
    }), 0);
  } else {
    picker.classList.add('hidden');
  }
}

// ── PPM AI recommendation (k-NN, server-side) ───────────────

let _ppmAiTimer = null; // debounce handle

// Renders the AI result into the ppm-ai-{id} div.
function renderAiResult(id, data) {
  const el = document.getElementById(`ppm-ai-${id}`);
  if (!el) return;

  if (!data || data.source === 'insufficient') {
    const needed = Math.max(0, 3 - (data?.trainingSize ?? 0));
    el.innerHTML = `
      <p class="text-[11px] text-muted/70 italic">
        AI learning active — add ${needed} more project${needed !== 1 ? 's' : ''} with PPM data to unlock.
      </p>`;
    return;
  }

  const recCls   = QUADRANT_CLS[data.recommendedQuadrant]  || 'bg-panel2 text-muted';
  const recLabel = QUADRANT_LABEL[data.recommendedQuadrant] || '—';
  const priCls   = PRI_CLS[data.recommendedPriority]        || 'text-muted';
  const confCls  = { high: 'text-emerald-400', medium: 'text-yellow-400', low: 'text-warm' }[data.confidence] || 'text-muted';

  const neighbours = (data.neighbours || []).slice(0, 3)
    .map(n => `<span class="text-ink">${esc(n.name)}</span><span class="text-muted/70"> ${Math.round(n.similarity * 100)}%</span>`)
    .join(' · ');

  const quadEl = document.getElementById(`detail-quadrant-${id}`);
  const priEl  = document.getElementById(`detail-priority-${id}`);
  const alreadyApplied = data.recommendedQuadrant === quadEl?.value && data.recommendedPriority === priEl?.value;

  const applyBtn = alreadyApplied
    ? `<span class="text-xs text-accent font-semibold mt-1 block">✓ AI agrees with current settings</span>`
    : `<button onclick="applyPpmSuggestion('${id}', '${data.recommendedQuadrant}', '${data.recommendedPriority}')"
         class="mt-1.5 text-[11px] bg-accent/15 border border-accent/30 text-accent px-2.5 py-1 rounded-lg
                hover:bg-accent/25 transition-colors cursor-pointer font-semibold">
         Apply AI suggestion →
       </button>`;

  el.innerHTML = `
    <div class="mt-3 pt-3 border-t border-dashed border-line/60">
      <div class="flex items-center gap-2 mb-1.5 flex-wrap">
        <p class="text-[10px] font-semibold uppercase tracking-widest text-muted">AI recommendation</p>
        <span class="text-[10px] ${confCls} font-semibold uppercase">${data.confidence}</span>
        <span class="text-[10px] text-muted">· ${data.trainingSize} projects learned</span>
      </div>
      <div class="flex items-center gap-2 flex-wrap">
        <span class="text-xs text-muted">Quadrant:</span>
        <span class="badge ${recCls}">${recLabel}</span>
        <span class="text-line">·</span>
        <span class="text-xs text-muted">Priority:</span>
        <span class="text-xs font-bold ${priCls}">${data.recommendedPriority || '—'}</span>
      </div>
      ${neighbours ? `<p class="text-[11px] text-muted mt-1">Similar: ${neighbours}</p>` : ''}
      ${applyBtn}
    </div>`;
}

// Debounces a call to GET /api/ppm/ai and renders the result.
// Rule-based suggestion (refreshPpmSuggestion) still fires instantly on every keystroke.
function scheduleAiFetch(id) {
  clearTimeout(_ppmAiTimer);

  // Show a subtle loading hint while waiting.
  const aiEl = document.getElementById(`ppm-ai-${id}`);
  if (aiEl && aiEl.innerHTML) aiEl.innerHTML += '';

  _ppmAiTimer = setTimeout(async () => {
    const readNum = fId => { const el = document.getElementById(fId); return el && el.value !== '' ? el.value : null; };
    const readStr = fId => { const el = document.getElementById(fId); return el?.value || null; };

    const value      = readNum(`detail-est-value-${id}`);
    const complexity = readNum(`detail-complexity-${id}`);

    // Need at least one of these to make a meaningful AI call.
    if (!value && !complexity) { if (aiEl) aiEl.innerHTML = ''; return; }

    const tier   = readStr(`detail-tier-${id}`);
    const margin = readNum(`detail-margin-${id}`);

    const params = new URLSearchParams({ excludeId: id });
    if (value)      params.set('value',      value);
    if (complexity) params.set('complexity', complexity);
    if (tier)       params.set('tier',       tier);
    if (margin)     params.set('margin',     margin);

    const data = await fetch(`/api/ppm/ai?${params}`).then(r => r.json()).catch(() => null);
    renderAiResult(id, data);
  }, 700); // wait 700 ms after the user stops typing before hitting the server
}

// ── PPM client-side engine ───────────────────────────────────
// Mirrors ppm.service.ts exactly so we get live recommendations without
// a server round trip every time a PPM input changes.

const PPM_VALUE_MIDPOINT      = 50_000;
const PPM_COMPLEXITY_THRESHOLD = 3;

function computePpm({ estimatedValue, complexityScore, clientTier, marginTarget }) {
  const valueScore  = estimatedValue  != null ? Math.min((estimatedValue / PPM_VALUE_MIDPOINT) * 50, 100) : null;
  const effortScore = complexityScore != null ? ((6 - complexityScore) / 5) * 100 : null;
  const tierScore   = clientTier
    ? ({ NEW: 20, RETURNING: 60, KEY_ACCOUNT: 100 }[clientTier] ?? null)
    : null;
  const marginScore = marginTarget != null ? Math.min((marginTarget / 100) * 100, 100) : null;

  const components = [
    { score: valueScore,  w: 0.40 },
    { score: effortScore, w: 0.15 },
    { score: tierScore,   w: 0.25 },
    { score: marginScore, w: 0.20 },
  ];
  const available = components.filter(c => c.score != null);
  let score = null;
  if (available.length >= 2) {
    const totalW = available.reduce((s, c) => s + c.w, 0);
    score = Math.round(available.reduce((s, c) => s + c.score * c.w, 0) / totalW);
  }

  let recommendedQuadrant = null;
  if (estimatedValue != null && complexityScore != null) {
    const highValue = estimatedValue  >= PPM_VALUE_MIDPOINT;
    const lowEffort = complexityScore <= PPM_COMPLEXITY_THRESHOLD;
    if      ( highValue &&  lowEffort) recommendedQuadrant = 'GOLD';
    else if ( highValue && !lowEffort) recommendedQuadrant = 'STRATEGIC_BET';
    else if (!highValue &&  lowEffort) recommendedQuadrant = 'OPERATIONAL_FILLER';
    else                               recommendedQuadrant = 'DRAIN';
  }

  // Priority suggestion derived from the weighted score.
  const recommendedPriority = score != null
    ? (score >= 70 ? 'P1' : score >= 40 ? 'P2' : 'P3')
    : null;

  return { score, recommendedQuadrant, recommendedPriority };
}

// Called after any PPM input changes — reads live form values and renders
// a suggestion callout into the ppm-rec-{id} div.
function refreshPpmSuggestion(id) {
  const readNum = fId => { const el = document.getElementById(fId); return el && el.value !== '' ? parseFloat(el.value) : null; };
  const readStr = fId => { const el = document.getElementById(fId); return el?.value || null; };

  const { score, recommendedQuadrant, recommendedPriority } = computePpm({
    estimatedValue:  readNum(`detail-est-value-${id}`),
    complexityScore: readNum(`detail-complexity-${id}`),
    clientTier:      readStr(`detail-tier-${id}`),
    marginTarget:    readNum(`detail-margin-${id}`),
  });

  const recEl = document.getElementById(`ppm-rec-${id}`);
  if (!recEl) return;

  if (!recommendedQuadrant && score == null) {
    recEl.innerHTML = `<p class="text-xs text-muted">Add est. value and complexity to unlock recommendation.</p>`;
    return;
  }

  const quadEl = document.getElementById(`detail-quadrant-${id}`);
  const priEl  = document.getElementById(`detail-priority-${id}`);
  const curQuad = quadEl?.value;
  const curPri  = priEl?.value;
  const bothMatch = recommendedQuadrant === curQuad && recommendedPriority === curPri;

  const recCls   = QUADRANT_CLS[recommendedQuadrant]  || 'bg-panel2 text-muted';
  const recLabel = QUADRANT_LABEL[recommendedQuadrant] || '—';
  const priCls   = PRI_CLS[recommendedPriority]        || 'text-muted';

  const scoreBar = score != null ? `
    <div class="flex items-center gap-2 mt-2">
      <div class="flex-1 h-1.5 bg-line rounded-full overflow-hidden">
        <div class="h-full bg-accent rounded-full" style="width:${score}%"></div>
      </div>
      <span class="text-xs text-muted w-14 text-right">score ${score}/100</span>
    </div>` : '';

  const action = bothMatch
    ? `<span class="text-xs text-accent font-semibold mt-1.5 block">✓ Quadrant and priority already match</span>`
    : `<button onclick="applyPpmSuggestion('${id}', '${recommendedQuadrant}', '${recommendedPriority}')"
         class="mt-1.5 text-[11px] bg-accent/15 border border-accent/30 text-accent px-2.5 py-1 rounded-lg
                hover:bg-accent/25 transition-colors cursor-pointer font-semibold">
         Apply suggestion →
       </button>`;

  recEl.innerHTML = `
    <div class="flex items-center gap-2 flex-wrap">
      <span class="text-xs text-muted">Quadrant:</span>
      <span class="badge ${recCls}">${recLabel}</span>
      <span class="text-line">·</span>
      <span class="text-xs text-muted">Priority:</span>
      <span class="text-xs font-bold ${priCls}">${recommendedPriority || '—'}</span>
    </div>
    ${scoreBar}
    ${action}`;
}

// Applies the PPM suggestion to both the quadrant and priority selects,
// saves to the server, then re-renders the detail view if quadrant changed
// (so the Drain gate row appears / disappears as needed).
async function applyPpmSuggestion(id, quadrant, priority) {
  const quadEl = document.getElementById(`detail-quadrant-${id}`);
  const priEl  = document.getElementById(`detail-priority-${id}`);
  const prevQuad = quadEl?.value;

  // Update UI immediately for instant feedback before the server responds.
  if (quadEl) quadEl.value = quadrant;
  if (priEl)  priEl.value  = priority;

  await fetch(`/api/projects/${id}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ quadrant, priority }),
  });

  if (quadrant !== prevQuad) {
    // Quadrant changed — full re-render so Drain gate row shows/hides correctly.
    showProjectDetail(id);
  } else {
    refreshPpmSuggestion(id);
  }
}

// ── project detail view ──────────────────────────────────────

let _prevProjView = 'list'; // remembers which view to return to after closing detail

function showProjectList() {
  $('p-detail-view').classList.add('hidden');
  // Return to whichever view the user came from
  const returnTo = _prevProjView;
  switchProjView(returnTo);
}

async function showProjectDetail(id) {
  const p = await (await fetch('/api/projects/' + id)).json();
  // Hide all project views before showing detail
  ['list', 'kanban', 'timeline'].forEach(v =>
    document.getElementById(`p-${v}-view`)?.classList.add('hidden')
  );
  $('p-detail-view').classList.remove('hidden');
  msg($('p-detail-msg'), '', '');
  const backLabels = { list: 'All projects', kanban: 'Kanban board', timeline: 'Timeline' };
  const backEl = $('p-back-label');
  if (backEl) backEl.textContent = backLabels[_prevProjView] || 'All projects';

  // Shared helper for section labels.
  const lbl = (label, content) =>
    `<div><p class="text-[10px] text-muted font-medium uppercase tracking-wider mb-0.5">${label}</p>${content}</div>`;

  // Reusable inline input builders — ids are prefixed with "detail-" + field + "-" + project id
  // so they can be wired up via getElementById after the HTML is injected.
  const selEl = (fId, opts, cur) =>
    `<select id="${fId}" class="bg-panel2 border border-line text-ink text-xs px-2 py-1 rounded-md
      w-full cursor-pointer focus:outline-none focus:border-accent/60">
      ${opts.map(([v, l]) => `<option value="${v}"${cur === v ? ' selected' : ''}>${l}</option>`).join('')}
    </select>`;

  const dateEl = (fId, val) => {
    const iso = val ? new Date(val).toISOString().split('T')[0] : '';
    return `<input id="${fId}" type="date" value="${iso}"
      class="bg-panel2 border border-line text-ink text-xs px-2 py-1 rounded-md w-full cursor-pointer
             focus:outline-none focus:border-accent/60" />`;
  };

  const numEl = (fId, val, extra = '') =>
    `<input id="${fId}" type="number" value="${val ?? ''}" ${extra}
      class="bg-panel2 border border-line text-ink text-xs px-2 py-1 rounded-md w-full
             focus:outline-none focus:border-accent/60" />`;

  const peopleOpts = (selected) =>
    `<option value="">— none —</option>` +
    (typeof PEOPLE !== 'undefined' ? PEOPLE : [])
      .map(pe => `<option value="${pe.id}"${pe.id === selected ? ' selected' : ''}>${esc(pe.name)}</option>`)
      .join('');

  $('p-detail-content').innerHTML = `
    <div class="mb-6">
      <input id="detail-name-${p.id}" type="text" value="${esc(p.name)}"
        class="text-xl font-bold text-ink bg-transparent border-b border-transparent
               hover:border-line focus:border-accent/60 focus:outline-none w-full pb-0.5 transition-colors" />
      <input id="detail-client-${p.id}" type="text" value="${esc(p.client || '')}" placeholder="No client"
        class="text-sm text-muted bg-transparent border-b border-transparent
               hover:border-line focus:border-accent/60 focus:outline-none w-full mt-1.5 pb-0.5 transition-colors" />
    </div>

    <div class="grid grid-cols-2 sm:grid-cols-3 gap-4 pb-5 border-b border-line">
      ${lbl('Status',     selEl(`detail-status-${p.id}`,   Object.entries(STATUS_LABEL), p.status))}
      ${lbl('Quadrant',   selEl(`detail-quadrant-${p.id}`, Object.entries(QUADRANT_LABEL), p.quadrant))}
      ${lbl('Priority',   selEl(`detail-priority-${p.id}`, [['P1','P1 — High'],['P2','P2 — Med'],['P3','P3 — Low']], p.priority))}
      ${lbl('Company',    selEl(`detail-company-${p.id}`,  [['','— any —'],['LPS','LPS'],['PXL','PXL']], p.company || ''))}
      ${lbl('Start date', dateEl(`detail-start-${p.id}`,   p.startDate))}
      ${lbl('Deadline',   dateEl(`detail-deadline-${p.id}`, p.deadline))}
      <div>
        <p class="text-[10px] text-muted font-medium uppercase tracking-wider mb-0.5">Producer</p>
        <select id="detail-producer-${p.id}"
          class="bg-panel2 border border-line text-ink text-xs px-2 py-1 rounded-md w-full cursor-pointer focus:outline-none focus:border-accent/60">
          ${peopleOpts(p.producer?.id)}
        </select>
      </div>
      <div>
        <p class="text-[10px] text-muted font-medium uppercase tracking-wider mb-0.5">PM</p>
        <select id="detail-pm-${p.id}"
          class="bg-panel2 border border-line text-ink text-xs px-2 py-1 rounded-md w-full cursor-pointer focus:outline-none focus:border-accent/60">
          ${peopleOpts(p.pm?.id)}
        </select>
      </div>
      ${p.quadrant === 'DRAIN' ? `
        <div class="col-span-full pt-1">
          <p class="text-[10px] text-muted font-medium uppercase tracking-wider mb-1.5">Drain gate approvals</p>
          <div class="flex gap-5">
            <label class="flex items-center gap-1.5 text-xs text-ink cursor-pointer">
              <input id="detail-drain-exec-${p.id}" type="checkbox" ${p.drainApprovedByExec ? 'checked' : ''}
                class="accent-accent cursor-pointer" /> Exec approved
            </label>
            <label class="flex items-center gap-1.5 text-xs text-ink cursor-pointer">
              <input id="detail-drain-prod-${p.id}" type="checkbox" ${p.drainApprovedByProducer ? 'checked' : ''}
                class="accent-accent cursor-pointer" /> Producer approved
            </label>
          </div>
        </div>` : ''}
    </div>

    <div class="mt-5 pb-5 border-b border-line">
      <p class="text-[11px] font-semibold uppercase tracking-widest text-muted mb-3">PPM inputs</p>
      <div class="grid grid-cols-2 sm:grid-cols-3 gap-4">
        ${lbl('Est. value (RM)',   numEl(`detail-est-value-${p.id}`, p.estimatedValue, 'min="0"'))}
        ${lbl('Duration (weeks)',  numEl(`detail-est-dur-${p.id}`,   p.estimatedDuration, 'min="1"'))}
        ${lbl('Complexity (1–5)', numEl(`detail-complexity-${p.id}`, p.complexityScore, 'min="1" max="5"'))}
        ${lbl('Client tier', selEl(`detail-tier-${p.id}`,
          [['','— none —'],['NEW','New'],['RETURNING','Returning'],['KEY_ACCOUNT','Key account']],
          p.clientTier || ''))}
        ${lbl('Margin target (%)', numEl(`detail-margin-${p.id}`, p.marginTarget, 'min="0" max="100"'))}
      </div>
      <div class="mt-3 pt-3 border-t border-line/60">
        <p class="text-[10px] font-semibold uppercase tracking-widest text-muted mb-1.5">PPM recommendation</p>
        <div id="ppm-rec-${p.id}" class="text-xs text-muted">Calculating…</div>
        <div id="ppm-ai-${p.id}"></div>
      </div>
    </div>

    <div class="mt-5 pb-5 border-b border-line">
      <div class="flex items-center justify-between mb-2">
        <p class="text-[11px] font-semibold uppercase tracking-widest text-muted">Required Skills</p>
        <span class="text-[11px] text-muted/50">Tag skills this project needs → system suggests best-matched staff</span>
      </div>
      <div id="proj-skills-${p.id}">Loading…</div>
    </div>

    <div class="mt-5 pb-5 border-b border-line">
      <div class="flex items-center justify-between mb-2">
        <p class="text-[11px] font-semibold uppercase tracking-widest text-muted">Suggested Staff</p>
        <button onclick="loadStaffSuggestions('${p.id}')"
          class="text-[11px] text-accent hover:underline cursor-pointer">Refresh ↻</button>
      </div>
      <div id="proj-suggestions-${p.id}"
        data-proj-start="${p.startDate ? new Date(p.startDate).toISOString().split('T')[0] : ''}"
        data-proj-name="${esc(p.name)}"
        class="text-xs text-muted">Add required skills above to generate suggestions.</div>
    </div>

    <div class="mt-5 pb-5 border-b border-line">
      <div class="flex items-center justify-between mb-2">
        <p class="text-[11px] font-semibold uppercase tracking-widest text-muted">Assets</p>
        <button onclick="_assetPendingProjectId='${p.id}'; switchTab('assets');"
          class="text-[11px] text-accent hover:underline cursor-pointer">Manage in Assets tab →</button>
      </div>
      <div id="proj-assets-${p.id}" class="text-xs text-muted">Loading…</div>
    </div>

    <div class="mt-5 pb-5 border-b border-line">
      <div class="flex items-center justify-between mb-2">
        <p class="text-[11px] font-semibold uppercase tracking-widest text-muted">Capacity</p>
        <button onclick="_capPendingProjectName='${esc(p.name)}'; switchTab('capacity');"
          class="text-[11px] text-accent hover:underline cursor-pointer">Manage in Capacity tab →</button>
      </div>
      <div id="proj-capacity-${p.id}" class="text-xs text-muted">Loading…</div>
    </div>

    <div class="mt-5 pb-5 border-b border-line">
      <p class="text-[11px] font-semibold uppercase tracking-widest text-muted mb-3">Project Costs</p>
      <div id="proj-costs-${p.id}">Loading…</div>
      <form id="proj-cost-form-${p.id}" class="mt-3 flex flex-wrap gap-2 items-end" onsubmit="addProjectCost(event, '${p.id}')">
        <div class="flex flex-col gap-1">
          <label class="text-[10px] text-muted uppercase tracking-wider">Description</label>
          <input id="pc-desc-${p.id}" type="text" placeholder="e.g. Warm pool animator"
            class="bg-panel2 border border-line text-ink text-xs px-2 py-1.5 rounded-md w-48
                   focus:outline-none focus:border-accent/60" required />
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-[10px] text-muted uppercase tracking-wider">Amount (RM)</label>
          <input id="pc-amount-${p.id}" type="number" min="0" step="0.01" placeholder="0.00"
            class="bg-panel2 border border-line text-ink text-xs px-2 py-1.5 rounded-md w-28
                   focus:outline-none focus:border-accent/60" required />
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-[10px] text-muted uppercase tracking-wider">Type</label>
          <select id="pc-type-${p.id}"
            class="bg-panel2 border border-line text-ink text-xs px-2 py-1.5 rounded-md
                   focus:outline-none focus:border-accent/60 cursor-pointer">
            <option value="WARM_POOL">Warm pool</option>
            <option value="SUPPLIER">Supplier</option>
            <option value="ADDITIONAL">Additional</option>
          </select>
        </div>
        <button type="submit"
          class="text-[11px] bg-accent/15 border border-accent/30 text-accent px-3 py-1.5 rounded-lg
                 hover:bg-accent/25 transition-colors cursor-pointer self-end">
          + Add cost
        </button>
      </form>
    </div>

    <div class="mt-5">
      <div class="flex items-center justify-between mb-2">
        <p class="text-[11px] font-semibold uppercase tracking-widest text-muted">Accounting Documents</p>
        <button onclick="openInvoiceModal('${p.id}', '${esc(p.name)}', '${esc((p.account?.autocountDebtorCode) || '')}')"
          class="text-[11px] bg-sky-500/15 border border-sky-500/30 text-sky-400 px-2 py-0.5 rounded-lg
                 hover:bg-sky-500/25 transition-colors cursor-pointer">
          ↑ Push invoice
        </button>
      </div>
      <div id="proj-docs-${p.id}" class="text-xs text-muted">Loading…</div>
    </div>`;

  // Wire up all change/blur handlers — PATCH the project on every edit.
  const patch = async (data) => {
    const res = await fetch(`/api/projects/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      return [].concat(e.message || 'Save failed').join(', ');
    }
    return null; // null = success
  };

  // Select elements — patch immediately on change.
  const wireSel = (fId, field) => {
    const el = document.getElementById(fId);
    if (!el) return;
    let saved = el.value;
    el.onchange = async () => {
      const chosen = el.value;
      const err = await patch({ [field]: chosen || null });
      if (err) {
        el.value = saved; // revert on failure
        msg($('p-detail-msg'), err, 'err');
      } else {
        saved = chosen;
        msg($('p-detail-msg'), '', '');
      }
    };
  };

  // Status needs error handling — server rejects DELIVERED when assets are incomplete.
  const statusEl = document.getElementById(`detail-status-${id}`);
  if (statusEl) {
    statusEl.onchange = async () => {
      const chosen = statusEl.value;
      const err = await patch({ status: chosen });
      if (err) {
        statusEl.value = p.status; // revert dropdown
        msg($('p-detail-msg'), err, 'err');
      } else {
        p.status = chosen; // keep local copy in sync
        // Also sync the list/kanban/timeline in-memory cache — otherwise
        // going back shows the pre-edit status until the next full reload.
        const cached = _allProjects.find(x => x.id === id);
        if (cached) cached.status = chosen;
        msg($('p-detail-msg'), '', '');
      }
    };
  }
  wireSel(`detail-company-${id}`,  'company');
  wireSel(`detail-producer-${id}`, 'producerId');
  wireSel(`detail-pm-${id}`,       'pmId');
  wireSel(`detail-tier-${id}`,     'clientTier');
  wireSel(`detail-priority-${id}`, 'priority');

  // Quadrant is special — changing it may show/hide the Drain gate row,
  // so we re-render the whole detail panel after saving.
  const quadEl = document.getElementById(`detail-quadrant-${id}`);
  if (quadEl) quadEl.onchange = async () => {
    await patch({ quadrant: quadEl.value });
    showProjectDetail(id);
  };

  // Date inputs — patch on change.
  const wireDate = (fId, field) => {
    const el = document.getElementById(fId);
    if (!el) return;
    let saved = el.value;
    el.onchange = async () => {
      const chosen = el.value;
      const err = await patch({ [field]: chosen || null });
      if (err) {
        el.value = saved; // revert on failure
        msg($('p-detail-msg'), err, 'err');
      } else {
        saved = chosen;
        msg($('p-detail-msg'), '', '');
      }
    };
  };
  wireDate(`detail-start-${id}`,    'startDate');
  wireDate(`detail-deadline-${id}`, 'deadline');

  // Text inputs — patch on blur to avoid firing on every keystroke.
  const wireText = (fId, field, required = false) => {
    const el = document.getElementById(fId);
    if (!el) return;
    let saved = el.value;
    el.onblur = async () => {
      const v = el.value.trim();
      if (required && !v) { el.value = saved; return; } // revert blank name
      const err = await patch({ [field]: v || null });
      if (err) {
        el.value = saved; // revert on failure
        msg($('p-detail-msg'), err, 'err');
      } else {
        saved = el.value;
        msg($('p-detail-msg'), '', '');
      }
    };
  };
  wireText(`detail-name-${id}`,   'name',   true);
  wireText(`detail-client-${id}`, 'client', false);

  // Number inputs — patch on blur.
  const wireNum = (fId, field) => {
    const el = document.getElementById(fId);
    if (!el) return;
    el.onblur = () => {
      const v = el.value === '' ? null : parseFloat(el.value);
      patch({ [field]: v });
    };
  };
  wireNum(`detail-est-value-${id}`,  'estimatedValue');
  wireNum(`detail-est-dur-${id}`,    'estimatedDuration');
  wireNum(`detail-complexity-${id}`, 'complexityScore');
  wireNum(`detail-margin-${id}`,     'marginTarget');

  // Drain gate checkboxes (only present when quadrant === 'DRAIN').
  const drainExec = document.getElementById(`detail-drain-exec-${id}`);
  const drainProd = document.getElementById(`detail-drain-prod-${id}`);
  if (drainExec) drainExec.onchange = () => patch({ drainApprovedByExec:     drainExec.checked });
  if (drainProd) drainProd.onchange = () => patch({ drainApprovedByProducer: drainProd.checked });

  // Wire up live PPM suggestion (instant, rule-based) + debounced AI fetch on every PPM input change.
  [`detail-est-value-${id}`, `detail-complexity-${id}`, `detail-margin-${id}`].forEach(fId => {
    const el = document.getElementById(fId);
    if (el) el.addEventListener('input', () => { refreshPpmSuggestion(id); scheduleAiFetch(id); });
  });
  const tierEl = document.getElementById(`detail-tier-${id}`);
  if (tierEl) tierEl.addEventListener('change', () => { refreshPpmSuggestion(id); scheduleAiFetch(id); });

  // Initial render: rule-based is instant; AI fires after the 700 ms debounce.
  refreshPpmSuggestion(id);
  scheduleAiFetch(id);

  // Load async sections.
  loadProjectSkills(id);
  loadProjectCapacity(id);
  loadProjectAssets(id);
  loadProjectCosts(id);
  loadProjectDocs(id);
}

async function loadProjectAssets(projectId) {
  const assets = await fetch('/api/assets?projectId=' + projectId).then(r => r.json()).catch(() => null);
  const el = document.getElementById('proj-assets-' + projectId);
  if (!el) return;

  if (!assets || !assets.length) {
    el.innerHTML = '<span class="text-muted">No assets yet. Add them in the Assets tab.</span>';
    return;
  }

  el.innerHTML = assets.map(a => {
    const stageCls   = (typeof STAGE_CLS   !== 'undefined' ? STAGE_CLS   : {})[a.stage] || 'bg-panel2 border-line text-muted';
    const stageLabel = (typeof STAGE_LABEL !== 'undefined' ? STAGE_LABEL : {})[a.stage] || a.stage;
    const cdBadge    = a.stage === 'INTERNAL_REVIEW'
      ? (a.cdSignedOff
          ? '<span class="text-[10px] text-accent font-semibold ml-1.5">CD ✓</span>'
          : '<span class="text-[10px] text-warm font-semibold ml-1.5">CD pending</span>')
      : '';
    return `<div class="flex items-center gap-2 py-1.5 border-b border-line/40 last:border-0">
      <span class="badge border ${stageCls} text-[10px] shrink-0">${stageLabel}</span>
      <span class="text-xs text-ink flex-1">${esc(a.name)}</span>
      ${cdBadge}
    </div>`;
  }).join('');
}

async function loadProjectCapacity(projectId) {
  const el = document.getElementById('proj-capacity-' + projectId);
  if (!el) return;

  const entries = await fetch('/api/capacity?projectId=' + projectId).then(r => r.json()).catch(() => null);
  if (!entries || !entries.length) {
    el.innerHTML = '<span class="text-muted">No allocations yet — use Suggested Staff above or the Capacity tab to add people.</span>';
    return;
  }

  const fmt = iso => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  const ROLE_CLS = { MAIN: 'text-accent', SUPPORT: 'text-muted' };

  el.innerHTML = `<table class="w-full text-[11px]">
    <thead><tr class="text-muted border-b border-line">
      <th class="text-left pb-1.5 font-medium">Week</th>
      <th class="text-left pb-1.5 font-medium">Person</th>
      <th class="text-left pb-1.5 font-medium">Role</th>
      <th class="text-right pb-1.5 font-medium">%</th>
      <th class="pb-1.5"></th>
    </tr></thead>
    <tbody>
      ${entries.map(e => `
        <tr class="border-b border-line/40 last:border-0" id="cap-row-${e.id}">
          <td class="py-1.5 pr-3 text-muted">${fmt(e.weekStart)}</td>
          <td class="py-1.5 pr-3 text-ink font-medium">${esc(e.person.name)}</td>
          <td class="py-1.5 pr-3">
            <span class="text-[10px] font-semibold ${ROLE_CLS[e.role] || 'text-muted'}">${e.role}</span>
          </td>
          <td class="py-1.5 text-right font-semibold text-ink pr-3">${e.pctWeek}%</td>
          <td class="py-1.5">
            <button onclick="removeProjectCapacity('${e.id}','${projectId}')"
              class="text-[10px] text-warm hover:underline cursor-pointer">Remove</button>
          </td>
        </tr>`).join('')}
    </tbody>
  </table>`;
}

async function removeProjectCapacity(entryId, projectId) {
  if (!confirm('Remove this allocation?')) return;
  await fetch('/api/capacity/' + entryId, { method: 'DELETE' });
  loadProjectCapacity(projectId);
}

const PROJ_COST_LABEL = { WARM_POOL: 'Warm pool', SUPPLIER: 'Supplier', ADDITIONAL: 'Additional' };

async function loadProjectCosts(projectId) {
  const costs = await fetch('/api/project-costs?projectId=' + projectId).then(r => r.json()).catch(() => null);
  const el = document.getElementById('proj-costs-' + projectId);
  if (!el) return;

  if (!costs || !costs.length) {
    el.innerHTML = '<p class="text-xs text-muted">No costs recorded yet.</p>';
    return;
  }

  const total = costs.reduce((s, c) => s + c.amount, 0);
  el.innerHTML = `
    <table class="w-full text-[11px] mb-2">
      <thead><tr class="text-muted border-b border-line">
        <th class="text-left pb-1.5 font-medium">Description</th>
        <th class="text-left pb-1.5 font-medium">Type</th>
        <th class="text-right pb-1.5 font-medium">Amount</th>
        <th class="pb-1.5"></th>
      </tr></thead>
      <tbody>
        ${costs.map(c => `
          <tr class="border-b border-line/40 last:border-0" id="pc-row-${c.id}">
            <td class="py-1.5 pr-2 text-ink">${esc(c.description)}</td>
            <td class="py-1.5 pr-2">
              <span class="badge bg-panel2 border border-line text-muted text-[10px]">${PROJ_COST_LABEL[c.costType] || c.costType}</span>
            </td>
            <td class="py-1.5 text-right text-ink pr-2">RM ${c.amount.toLocaleString('en-MY', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</td>
            <td class="py-1.5 pl-1">
              <button class="text-[10px] text-warm hover:underline cursor-pointer" onclick="removeProjectCost('${c.id}', '${projectId}')">Remove</button>
            </td>
          </tr>`).join('')}
      </tbody>
      <tfoot><tr>
        <td colspan="2" class="pt-2 text-[10px] font-semibold uppercase tracking-wider text-muted">Total costs</td>
        <td class="pt-2 text-right font-semibold text-ink">RM ${total.toLocaleString('en-MY', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</td>
        <td></td>
      </tr></tfoot>
    </table>`;
}

async function addProjectCost(e, projectId) {
  e.preventDefault();
  const desc   = document.getElementById('pc-desc-' + projectId)?.value.trim();
  const amount = parseFloat(document.getElementById('pc-amount-' + projectId)?.value);
  const type   = document.getElementById('pc-type-' + projectId)?.value;
  if (!desc || isNaN(amount)) return;

  const res = await fetch('/api/project-costs', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectId, description: desc, amount, costType: type }),
  });
  if (res.ok) {
    document.getElementById('pc-desc-' + projectId).value   = '';
    document.getElementById('pc-amount-' + projectId).value = '';
    loadProjectCosts(projectId);
  }
}

async function removeProjectCost(costId, projectId) {
  if (!confirm('Remove this cost entry?')) return;
  await fetch('/api/project-costs/' + costId, { method: 'DELETE' });
  loadProjectCosts(projectId);
}

// ── Required skills + staffing suggestions ────────────────────────

let _allSkillsCache = null; // fetched once per session

async function loadProjectSkills(projectId) {
  const el = document.getElementById('proj-skills-' + projectId);
  if (!el) return;

  // Fetch required skills for this project and the master skills list in parallel.
  if (!_allSkillsCache) {
    _allSkillsCache = await fetch('/api/projects/all-skills').then(r => r.json()).catch(() => []);
  }
  const [required] = await Promise.all([
    fetch(`/api/projects/${projectId}/skills`).then(r => r.json()).catch(() => []),
  ]);

  const requiredIds = new Set(required.map(ps => ps.skillId));
  const available   = _allSkillsCache.filter(s => !requiredIds.has(s.id));

  // Skill chips (existing required skills)
  const chips = required.length
    ? required.map(ps => `
        <span class="inline-flex items-center gap-1.5 bg-accent/15 border border-accent/30 text-accent
                     text-[11px] px-2.5 py-1 rounded-full">
          ${esc(ps.skill.name)}
          <button onclick="removeProjectSkill('${projectId}','${ps.skillId}')"
            class="text-accent/60 hover:text-warm transition-colors leading-none cursor-pointer font-bold">×</button>
        </span>`).join('')
    : `<span class="text-[11px] text-muted/60 italic">No skills tagged yet.</span>`;

  // Add skill picker grouped by category (only shows skills not already tagged)
  let pickerOpts = '';
  if (available.length) {
    const byCat = {};
    for (const s of available) {
      const cat = s.category || 'Other';
      if (!byCat[cat]) byCat[cat] = [];
      byCat[cat].push(s);
    }
    pickerOpts = Object.entries(byCat)
      .map(([cat, list]) =>
        `<optgroup label="${esc(cat)}">${list.map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join('')}</optgroup>`)
      .join('');
  }

  el.innerHTML = `
    <div class="flex flex-wrap gap-1.5 mb-2">${chips}</div>
    ${available.length ? `
    <div class="flex items-center gap-2 mt-2">
      <select id="skill-pick-${projectId}"
        class="bg-panel2 border border-line text-ink text-xs px-2 py-1 rounded-md
               focus:outline-none focus:border-accent/60 cursor-pointer">
        <option value="">+ Add required skill…</option>
        ${pickerOpts}
      </select>
    </div>` : ''}`;

  const sel = document.getElementById('skill-pick-' + projectId);
  if (sel) {
    sel.onchange = async () => {
      const skillId = sel.value;
      if (!skillId) return;
      await fetch(`/api/projects/${projectId}/skills/${skillId}`, { method: 'POST' });
      sel.value = '';
      loadProjectSkills(projectId);      // re-render chips
      loadStaffSuggestions(projectId);   // refresh suggestions
    };
  }

  // Auto-load suggestions whenever skills change
  if (required.length) loadStaffSuggestions(projectId);
}

async function removeProjectSkill(projectId, skillId) {
  await fetch(`/api/projects/${projectId}/skills/${skillId}`, { method: 'DELETE' });
  loadProjectSkills(projectId);
  loadStaffSuggestions(projectId);
}

async function loadStaffSuggestions(projectId) {
  const el = document.getElementById('proj-suggestions-' + projectId);
  if (!el) return;
  el.innerHTML = '<span class="text-muted/60 italic text-[11px]">Calculating…</span>';

  const suggestions = await fetch(`/api/projects/${projectId}/staff-suggestions`)
    .then(r => r.json()).catch(() => null);

  if (!suggestions || !suggestions.length) {
    el.innerHTML = '<span class="text-muted">Add required skills above to generate suggestions.</span>';
    return;
  }

  // Default week = project start date (or next Monday if in the past / not set)
  const projStart = el.dataset.projStart || '';
  const defaultWeek = (() => {
    const candidate = projStart ? new Date(projStart) : new Date();
    const today     = new Date();
    const base      = candidate > today ? candidate : today;
    const day       = base.getDay();
    const diff      = day === 0 ? 1 : day === 1 ? 0 : 8 - day;
    base.setDate(base.getDate() + diff);
    return base.toISOString().split('T')[0];
  })();

  el.innerHTML = suggestions.map(sg => {
    const candidateRows = sg.candidates.length
      ? sg.candidates.map((c, i) => {
          const uid        = `${projectId}-${c.person.id}`;
          const ratingDots = Array.from({ length: 5 }, (_, di) =>
            `<span class="w-1.5 h-1.5 rounded-full inline-block ${di < c.skillRating ? 'bg-accent' : 'bg-line'}"></span>`
          ).join('');
          const capCls = c.freeCapacityPct >= 70 ? 'text-emerald-400'
                       : c.freeCapacityPct >= 40 ? 'text-yellow-400'
                       : 'text-warm';
          const rank = ['🥇','🥈','🥉','4.','5.'][i] || '';
          return `
            <div class="border-b border-line/40 last:border-0">
              <div class="flex items-center gap-3 py-1.5">
                <span class="text-[11px] w-5 shrink-0 text-center">${rank}</span>
                <div class="flex-1 min-w-0">
                  <p class="text-xs font-semibold text-ink truncate">${esc(c.person.name)}</p>
                  <p class="text-[11px] text-muted truncate">${esc(c.person.role)}${c.person.department ? ` · ${esc(c.person.department)}` : ''}</p>
                </div>
                <div class="flex items-center gap-1 shrink-0">${ratingDots}</div>
                <div class="text-right shrink-0 mr-1">
                  <p class="text-[11px] ${capCls} font-semibold">${c.freeCapacityPct}% free</p>
                  <p class="text-[10px] text-muted">score ${c.score}</p>
                </div>
                <button data-alloc-toggle="${uid}"
                  class="shrink-0 text-[11px] bg-accent/10 border border-accent/30 text-accent
                         px-2 py-0.5 rounded-lg hover:bg-accent/20 transition-colors cursor-pointer">
                  + Allocate
                </button>
              </div>
              <!-- Quick-allocate form (hidden until button clicked) -->
              <div id="alloc-form-${uid}" class="hidden bg-panel border border-accent/20 rounded-lg px-3 py-2.5 mb-2 ml-8">
                <p class="text-[10px] text-muted font-semibold uppercase tracking-wider mb-2">
                  Allocate ${esc(c.person.name)} → ${esc(sg.skill.name)}
                </p>
                <div class="flex flex-wrap gap-2 items-end">
                  <div class="flex flex-col gap-1">
                    <label class="text-[10px] text-muted uppercase tracking-wider">Week starting</label>
                    <input type="date" id="alloc-week-${uid}" value="${defaultWeek}"
                      class="bg-panel2 border border-line text-ink text-xs px-2 py-1 rounded-md
                             focus:outline-none focus:border-accent/60 cursor-pointer" />
                  </div>
                  <div class="flex flex-col gap-1">
                    <label class="text-[10px] text-muted uppercase tracking-wider">Role</label>
                    <select id="alloc-role-${uid}"
                      class="bg-panel2 border border-line text-ink text-xs px-2 py-1 rounded-md
                             focus:outline-none focus:border-accent/60 cursor-pointer">
                      <option value="MAIN">Main</option>
                      <option value="SUPPORT">Support</option>
                    </select>
                  </div>
                  <div class="flex flex-col gap-1">
                    <label class="text-[10px] text-muted uppercase tracking-wider">% of week</label>
                    <input type="number" id="alloc-pct-${uid}" value="100" min="1" max="140"
                      class="bg-panel2 border border-line text-ink text-xs px-2 py-1 rounded-md w-20
                             focus:outline-none focus:border-accent/60" />
                  </div>
                  <button data-alloc-submit="${uid}"
                    data-person-id="${c.person.id}" data-project-id="${projectId}"
                    class="text-[11px] bg-accent/15 border border-accent/30 text-accent px-3 py-1.5
                           rounded-lg hover:bg-accent/25 transition-colors cursor-pointer self-end font-semibold">
                    Confirm →
                  </button>
                </div>
                <div id="alloc-weekend-row-${uid}" class="hidden mt-2">
                  <label class="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" id="alloc-weekend-${uid}" class="accent-warm cursor-pointer" />
                    <span class="text-[11px] text-warm font-semibold">Weekend approved by producer</span>
                    <span class="text-[11px] text-muted">(required when % &gt; 100)</span>
                  </label>
                </div>
                <div id="alloc-msg-${uid}" class="mt-1.5 text-[11px]"></div>
              </div>
            </div>`;
        }).join('')
      : `<p class="text-xs text-muted py-2">No staff with this skill found in the system.</p>`;

    return `<div class="mb-4 last:mb-0">
      <div class="flex items-center gap-2 mb-1.5">
        <span class="badge bg-accent/15 border-accent/30 text-accent text-[11px]">${esc(sg.skill.name)}</span>
        <span class="text-[10px] text-muted">${sg.candidates.length} candidate${sg.candidates.length !== 1 ? 's' : ''}</span>
      </div>
      <div class="bg-panel2 border border-line rounded-lg px-3 py-1">
        ${candidateRows}
      </div>
    </div>`;
  }).join('');

  // Wire toggle buttons — show/hide the allocate form
  el.querySelectorAll('[data-alloc-toggle]').forEach(btn => {
    btn.addEventListener('click', () => {
      const form = document.getElementById('alloc-form-' + btn.dataset.allocToggle);
      if (!form) return;
      const isOpen = !form.classList.contains('hidden');
      // Close all other open forms first
      el.querySelectorAll('[id^="alloc-form-"]').forEach(f => f.classList.add('hidden'));
      el.querySelectorAll('[data-alloc-toggle]').forEach(b => b.textContent = '+ Allocate');
      if (!isOpen) {
        form.classList.remove('hidden');
        btn.textContent = '✕ Cancel';
      }
    });
  });

  // Wire % inputs — show weekend approval row when > 100
  el.querySelectorAll('[id^="alloc-pct-"]').forEach(pctEl => {
    const uid         = pctEl.id.replace('alloc-pct-', '');
    const weekendRow  = document.getElementById(`alloc-weekend-row-${uid}`);
    pctEl.addEventListener('input', () => {
      if (!weekendRow) return;
      const over = parseInt(pctEl.value || '0') > 100;
      weekendRow.classList.toggle('hidden', !over);
      if (!over) {
        const cb = document.getElementById(`alloc-weekend-${uid}`);
        if (cb) cb.checked = false;
      }
    });
  });

  // Wire confirm buttons
  el.querySelectorAll('[data-alloc-submit]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const uid            = btn.dataset.allocSubmit;
      const personId       = btn.dataset.personId;
      const projectId      = btn.dataset.projectId;
      const week           = document.getElementById(`alloc-week-${uid}`)?.value;
      const role           = document.getElementById(`alloc-role-${uid}`)?.value;
      const pct            = parseInt(document.getElementById(`alloc-pct-${uid}`)?.value || '0');
      const weekendApproved = document.getElementById(`alloc-weekend-${uid}`)?.checked ?? false;
      const msgEl          = document.getElementById(`alloc-msg-${uid}`);

      if (!week || !pct || pct < 1) {
        if (msgEl) { msgEl.textContent = 'Fill in all fields.'; msgEl.className = 'mt-1.5 text-[11px] text-warm'; }
        return;
      }
      if (pct > 100 && !weekendApproved) {
        if (msgEl) { msgEl.textContent = 'Check "Weekend approved by producer" — % exceeds 100.'; msgEl.className = 'mt-1.5 text-[11px] text-warm'; }
        return;
      }

      btn.disabled = true;
      btn.textContent = 'Saving…';

      const res = await fetch('/api/capacity', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personId, projectId, weekStart: week, role, pctWeek: pct, weekendApproved }),
      });

      btn.disabled = false;
      btn.textContent = 'Confirm →';

      if (res.ok) {
        if (msgEl) {
          const projName = el.dataset.projName || '';
          msgEl.innerHTML = `✓ Allocated — <button onclick="_capPendingProjectName=${JSON.stringify(projName)}; switchTab('capacity');" class="underline cursor-pointer hover:text-emerald-300 transition-colors">View in Capacity tab →</button>`;
          msgEl.className = 'mt-1.5 text-[11px] text-emerald-400 font-semibold';
        }
        loadProjectCapacity(projectId); // refresh capacity section immediately
        setTimeout(() => {
          const form = document.getElementById('alloc-form-' + uid);
          if (form) form.classList.add('hidden');
          const toggleBtn = el.querySelector(`[data-alloc-toggle="${uid}"]`);
          if (toggleBtn) toggleBtn.textContent = '+ Allocate';
          if (msgEl) msgEl.textContent = '';
        }, 4000);
      } else {
        const e = await res.json().catch(() => ({}));
        const errMsg = [].concat(e.message || 'Failed').join(', ');
        if (msgEl) { msgEl.textContent = errMsg; msgEl.className = 'mt-1.5 text-[11px] text-warm'; }
      }
    });
  });
}

async function loadProjectDocs(projectId) {
  const docs = await fetch('/api/autocount/projects/' + projectId + '/documents')
    .then(r => r.json()).catch(() => null);
  const el = document.getElementById('proj-docs-' + projectId);
  if (!el) return;

  if (!docs || !docs.length) {
    el.innerHTML = '<span class="text-muted">No accounting documents yet. Use ↑ Push invoice to create one in Autocount.</span>';
    return;
  }

  const DOC_TYPE_LABEL = { QUOTATION: 'Quotation', SALES_INVOICE: 'Invoice', PURCHASE_INVOICE: 'PO Invoice' };
  const STATUS_CLS = {
    ACTIVE: 'bg-sky-500/15 border-sky-500/30 text-sky-400',
    PAID:   'bg-emerald-500/15 border-emerald-500/30 text-emerald-400',
    VOID:   'bg-panel2 border-line text-muted',
  };

  el.innerHTML = `<table class="w-full text-[11px]">
    <thead><tr class="text-muted border-b border-line">
      <th class="text-left pb-1.5 font-medium">Type</th>
      <th class="text-left pb-1.5 font-medium">Doc No</th>
      <th class="text-left pb-1.5 font-medium">Date</th>
      <th class="text-left pb-1.5 font-medium">Due</th>
      <th class="text-right pb-1.5 font-medium">Amount</th>
      <th class="text-left pb-1.5 font-medium pl-2">Status</th>
      <th class="pb-1.5"></th>
    </tr></thead>
    <tbody>
      ${docs.map(d => {
        const date = new Date(d.docDate).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});
        const due  = d.dueDate ? new Date(d.dueDate).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}) : '—';
        const overdue = d.dueDate && d.status === 'ACTIVE' && new Date(d.dueDate) < new Date();
        const dueCls  = overdue ? 'text-warm font-semibold' : '';
        const amt     = d.amount != null ? 'RM ' + Math.round(d.amount).toLocaleString('en-MY') : '—';
        const stCls   = STATUS_CLS[d.status] || '';
        return `<tr class="border-b border-line/40 last:border-0">
          <td class="py-1.5 pr-2">${DOC_TYPE_LABEL[d.docType] || d.docType}</td>
          <td class="py-1.5 pr-2 font-mono text-ink">${esc(d.docNo)}</td>
          <td class="py-1.5 pr-2">${date}</td>
          <td class="py-1.5 pr-2 ${dueCls}">${due}${overdue ? ' ⚠' : ''}</td>
          <td class="py-1.5 text-right text-ink pr-2">${amt}</td>
          <td class="py-1.5 pl-2">
            <span class="badge border ${stCls} text-[10px]">${d.status}</span>
          </td>
          <td class="py-1.5 pl-1">
            ${d.status === 'ACTIVE' ? `
              <select onchange="updateDocStatus('${d.id}', this.value, '${projectId}')"
                class="bg-panel border border-line text-muted text-[10px] px-1 py-0.5 rounded cursor-pointer">
                <option value="">— mark —</option>
                <option value="PAID">Paid</option>
                <option value="VOID">Void</option>
              </select>` : ''}
          </td>
        </tr>`;
      }).join('')}
    </tbody>
  </table>`;
}

async function updateDocStatus(docId, status, projectId) {
  if (!status) return;
  if (!confirm(`Mark this document as ${status}?`)) return;
  const res = await fetch(`/api/autocount/documents/${docId}/status`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
  if (res.ok) loadProjectDocs(projectId);
}

// ── invoice push modal (mirrors quote modal in sales.js) ─────────

let _projDebtors    = [];
let _invoiceProject = null;

async function openInvoiceModal(projectId, projectName, preselectedDebtorCode) {
  if (!_projDebtors.length) {
    _projDebtors = await fetch('/api/autocount/debtors').then(r => r.json()).catch(() => []);
  }
  const options = _projDebtors.map(d =>
    `<option value="${esc(d.accNo)}" ${d.accNo === preselectedDebtorCode ? 'selected' : ''}>
       ${esc(d.companyName)} (${esc(d.accNo)})
     </option>`
  ).join('');

  _invoiceProject = projectId;
  $('invoice-modal-title').textContent = projectName;
  $('invoice-debtor-sel').innerHTML    = `<option value="">— select debtor —</option>${options}`;
  $('invoice-modal-msg').textContent   = '';
  $('invoice-modal').classList.remove('hidden');
}

function closeInvoiceModal() {
  $('invoice-modal').classList.add('hidden');
  _invoiceProject = null;
}

async function submitInvoice() {
  const debtorCode = $('invoice-debtor-sel').value;
  const msgEl      = $('invoice-modal-msg');
  if (!debtorCode) { msgEl.textContent = 'Please select a debtor.'; msgEl.className = 'text-xs text-warm'; return; }

  $('invoice-submit-btn').disabled = true;
  msgEl.textContent = 'Creating invoice…'; msgEl.className = 'text-xs text-muted';

  const res = await fetch(`/api/autocount/projects/${_invoiceProject}/invoice`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ debtorCode }),
  });

  $('invoice-submit-btn').disabled = false;

  if (res.ok) {
    const data = await res.json();
    msgEl.textContent = `Done! Invoice ${data.docNo} created in Autocount.`;
    msgEl.className   = 'text-xs text-emerald-400';
    setTimeout(() => { closeInvoiceModal(); loadProjectDocs(_invoiceProject); }, 1500);
  } else {
    const e = await res.json().catch(() => ({}));
    msgEl.textContent = e.message || 'Failed.';
    msgEl.className   = 'text-xs text-warm';
  }
}

async function loadPpmBadge(projectId) {
  const ppm = await fetch('/api/ppm/' + projectId).then(r => r.json()).catch(() => null);
  if (!ppm) return;

  const el = document.getElementById('ppm-rec-' + projectId);
  if (!el) return;

  if (!ppm.recommendedQuadrant) {
    el.innerHTML = `<p class="text-xs text-muted">Add estimated value and complexity to unlock recommendation.</p>`;
    return;
  }

  const recCls   = QUADRANT_CLS[ppm.recommendedQuadrant]   || 'bg-panel2 text-muted';
  const recLabel = QUADRANT_LABEL[ppm.recommendedQuadrant] || ppm.recommendedQuadrant;
  const curLabel = QUADRANT_LABEL[ppm.currentQuadrant]     || ppm.currentQuadrant;
  const matchHtml = ppm.match
    ? `<span class="text-xs text-accent font-semibold">✓ Matches current quadrant</span>`
    : `<span class="text-xs text-warm font-semibold">Currently set to ${curLabel}</span>`;

  const scoreBar = ppm.score != null ? `
    <div class="flex items-center gap-2 mt-2">
      <div class="flex-1 h-1.5 bg-line rounded-full overflow-hidden">
        <div class="h-full bg-accent rounded-full" style="width:${ppm.score}%"></div>
      </div>
      <span class="text-xs text-muted w-12 text-right">score ${ppm.score}/100</span>
    </div>` : '';

  const missing = ppm.missingFields.length
    ? `<p class="text-[11px] text-muted mt-1">Missing: ${ppm.missingFields.join(', ')}</p>`
    : '';

  el.innerHTML = `
    <div class="flex items-center gap-2 flex-wrap">
      <span class="text-xs text-muted">Recommended:</span>
      <span class="badge ${recCls}">${recLabel}</span>
      ${matchHtml}
    </div>
    ${scoreBar}${missing}`;
}

// ── project list ─────────────────────────────────────────────

let _allProjects = []; // full cache — filters apply client-side

async function loadProjects() {
  // STAFF are read-only — hide the add-project sidebar and Remove column
  const addSidebar = document.querySelector('#tab-projects > div > .space-y-4:first-child > .bg-panel:first-child');
  if (addSidebar) addSidebar.classList.toggle('hidden', isStaff());

  _allProjects = await (await fetch('/api/projects')).json();
  _tlProjects  = _allProjects; // timeline view cache

  // Populate the producer filter dropdown from the loaded data.
  const prodSel = $('p-filter-producer');
  if (prodSel) {
    const producers = [...new Map(
      _allProjects.filter(p => p.producer).map(p => [p.producerId, p.producer.name])
    ).entries()].sort((a, b) => a[1].localeCompare(b[1]));
    prodSel.innerHTML = '<option value="">All producers</option>' +
      producers.map(([id, name]) => `<option value="${id}">${esc(name)}</option>`).join('');
  }

  renderProjects();
}

function renderProjects() {
  const search   = ($('p-search')?.value   || '').toLowerCase();
  const status   = $('p-filter-status')?.value  || '';
  const producer = $('p-filter-producer')?.value || '';

  const projects = _allProjects.filter(p => {
    if (!matchesFilter(p.company)) return false;
    if (status   && p.status     !== status)   return false;
    if (producer && p.producerId !== producer) return false;
    if (search) {
      const hay = ((p.name || '') + ' ' + (p.client || '')).toLowerCase();
      if (!hay.includes(search)) return false;
    }
    return true;
  });

  const rows = $('p-rows'); rows.innerHTML = '';
  $('p-empty').classList.toggle('hidden', projects.length > 0);
  for (const p of projects) {
    const deadline  = p.deadline ? new Date(p.deadline).toLocaleDateString() : '—';
    const drainNote = p.quadrant === 'DRAIN'
      ? `<div class="text-[10px] text-warm mt-0.5">Exec: ${p.drainApprovedByExec ? '✓' : '✗'} · Producer: ${p.drainApprovedByProducer ? '✓' : '✗'}</div>`
      : '';
    const tr = document.createElement('tr');
    tr.className = 'border-b border-line hover:bg-panel2/40 transition-colors';
    tr.innerHTML = `
      <td class="py-3 px-2">
        <button class="font-medium text-sm text-left hover:text-accent transition-colors cursor-pointer" data-proj-detail="${p.id}">${esc(p.name)}</button>
        ${coBadge(p.company)}${drainNote}
      </td>
      <td data-col="client"     class="py-3 px-2 text-muted text-xs whitespace-nowrap">${p.client ? esc(p.client) : '—'}</td>
      <td data-col="quadrant"   class="py-3 px-2 whitespace-nowrap"><span class="badge ${QUADRANT_CLS[p.quadrant] || ''}">${QUADRANT_LABEL[p.quadrant] || p.quadrant}</span></td>
      <td data-col="priority"   class="py-3 px-2 whitespace-nowrap"><span class="text-xs ${PRI_CLS[p.priority] || ''}">${p.priority}</span></td>
      <td class="py-3 px-2">
        <select class="bg-panel2 border border-line text-ink px-2 py-1 rounded-md text-xs
                       focus:outline-none focus:border-accent/70 cursor-pointer"
                data-proj="${p.id}" data-field="status">
          ${Object.entries(STATUS_LABEL).map(([k,v]) =>
            `<option value="${k}"${p.status === k ? ' selected' : ''}>${v}</option>`
          ).join('')}
        </select>
      </td>
      <td data-col="deadline"   class="py-3 px-2 text-muted text-xs whitespace-nowrap">${deadline}</td>
      <td data-col="producer"   class="py-3 px-2 text-muted text-xs whitespace-nowrap">${p.producer ? esc(p.producer.name) : '—'}</td>
      <td data-col="pm"         class="py-3 px-2 text-muted text-xs whitespace-nowrap">${p.pm ? esc(p.pm.name) : '—'}</td>
      <td data-col="value"      class="py-3 px-2 text-xs whitespace-nowrap">${fmtValue(p.estimatedValue)}</td>
      <td data-col="duration"   class="py-3 px-2 text-xs whitespace-nowrap">${p.estimatedDuration != null ? `<span class="text-ink">${p.estimatedDuration}</span><span class="text-muted">w</span>` : '<span class="text-muted">—</span>'}</td>
      <td data-col="complexity" class="py-3 px-2 whitespace-nowrap">${complexityDots(p.complexityScore)}</td>
      <td data-col="tier"       class="py-3 px-2 text-xs whitespace-nowrap">${p.clientTier ? `<span class="badge bg-panel2 border border-line text-muted">${CLIENT_TIER_LABEL[p.clientTier]}</span>` : '<span class="text-muted">—</span>'}</td>
      <td data-col="margin"     class="py-3 px-2 text-xs whitespace-nowrap">${p.marginTarget != null ? `<span class="text-ink">${p.marginTarget}</span><span class="text-muted">%</span>` : '<span class="text-muted">—</span>'}</td>
      ${isStaff() ? '' : `<td class="py-3 px-2 whitespace-nowrap"><button class="btn-del" data-proj-del="${p.id}">Remove</button></td>`}`;
    rows.appendChild(tr);
  }
  rows.querySelectorAll('[data-field="status"]').forEach(sel => {
    const saved = sel.value;
    sel.onchange = async () => {
      const chosen = sel.value;
      const res = await fetch(`/api/projects/${sel.dataset.proj}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: chosen }),
      });
      if (!res.ok) {
        sel.value = saved; // revert on failure
        const e = await res.json().catch(() => ({}));
        alert([].concat(e.message || 'Save failed').join(', '));
        return;
      }
      // Keep the in-memory cache in sync so Kanban/Timeline reflect this
      // change without needing a full reload.
      const proj = _allProjects.find(p => p.id === sel.dataset.proj);
      if (proj) proj.status = chosen;
    };
  });
  rows.querySelectorAll('[data-proj-del]').forEach(b => b.onclick = () => removeProject(b.dataset.projDel));
  rows.querySelectorAll('[data-proj-detail]').forEach(b => b.onclick = () => showProjectDetail(b.dataset.projDetail));
  applyColVisibility();
}

// Wire up list-view filter inputs — re-render without re-fetching.
['p-search', 'p-filter-status', 'p-filter-producer'].forEach(id => {
  const el = $(id);
  if (el) el.addEventListener('input', renderProjects);
});

async function addProject() {
  const quad = $('p-quadrant').value;
  const body = {
    name:       $('p-name').value.trim(),
    client:     $('p-client').value.trim() || undefined,
    company:    $('p-company').value || undefined,
    quadrant:   quad,
    priority:   $('p-priority').value,
    status:     $('p-status').value,
    startDate:  $('p-start-date').value || undefined,
    deadline:   $('p-deadline').value || undefined,
    producerId: $('p-producer').value || undefined,
    pmId:       $('p-pm').value || undefined,
  };
  if (quad === 'DRAIN') {
    body.drainApprovedByExec     = $('p-exec').checked;
    body.drainApprovedByProducer = $('p-prod-approval').checked;
  }
  const estVal  = parseFloat($('p-est-value').value);
  const estDur  = parseInt($('p-est-duration').value);
  const complex = parseInt($('p-complexity').value);
  const margin  = parseFloat($('p-margin').value);
  if (!isNaN(estVal))  body.estimatedValue    = estVal;
  if (!isNaN(estDur))  body.estimatedDuration = estDur;
  if (!isNaN(complex)) body.complexityScore   = complex;
  if ($('p-client-tier').value) body.clientTier = $('p-client-tier').value;
  if (!isNaN(margin))  body.marginTarget      = margin;

  if (!body.name) { msg($('pmsg'), 'Project name is required.', 'err'); return; }
  const res = await fetch('/api/projects', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  if (res.ok) {
    ['p-name','p-client','p-start-date','p-deadline','p-est-value','p-est-duration','p-margin'].forEach(id => $(id).value = '');
    $('p-quadrant').value = 'GOLD'; $('p-complexity').value = ''; $('p-client-tier').value = '';
    $('p-drain-gate').classList.add('hidden');
    $('p-exec').checked = false; $('p-prod-approval').checked = false;
    msg($('pmsg'), 'Project added.', 'ok');
    loadProjects();
  } else {
    const e = await res.json().catch(() => ({}));
    msg($('pmsg'), [].concat(e.message || 'Failed').join(', '), 'err');
  }
}

async function removeProject(id) {
  if (!confirm('Remove this project?')) return;
  await fetch('/api/projects/' + id, { method: 'DELETE' });
  loadProjects();
}

$('p-quadrant').addEventListener('change', () => {
  $('p-drain-gate').classList.toggle('hidden', $('p-quadrant').value !== 'DRAIN');
});

$('p-add').addEventListener('click', addProject);

// ── Timeline (Gantt) view ─────────────────────────────────────

let _tlProjects = [];   // cached from last loadProjects call
let _tlOffset   = -4;   // weeks offset from today's Monday (show from 4 weeks ago)
const TL_WEEKS  = 16;   // number of weeks visible at once
const TL_NAME_W = 180;  // px width of project name column
const TL_WEEK_W = 38;   // px width per week column

// Returns the Monday of the current week (UTC midnight)
function _tlMonday(offset = 0) {
  const d = new Date();
  const day = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() + (day === 0 ? -6 : 1 - day) + offset * 7);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function switchProjView(view) {
  _prevProjView = view;
  $('p-detail-view')?.classList.add('hidden');
  const views = ['list', 'kanban', 'timeline'];
  views.forEach(v => {
    document.getElementById(`p-${v}-view`)?.classList.toggle('hidden', v !== view);
    const btn = document.getElementById(`proj-view-${v}`);
    if (btn) {
      btn.classList.toggle('bg-panel',  v === view);
      btn.classList.toggle('text-ink',  v === view);
      btn.classList.toggle('text-muted', v !== view);
    }
  });
  if (view === 'kanban')   renderKanban();
  if (view === 'timeline') renderTimeline();
}

// ── Kanban view ──────────────────────────────────────────────
const KANBAN_COLS = [
  { status: 'BRIEF',           label: 'Brief',           cls: 'border-muted/40',       dot: 'bg-muted'        },
  { status: 'IN_PROGRESS',     label: 'In Progress',     cls: 'border-accent/50',      dot: 'bg-accent'       },
  { status: 'INTERNAL_REVIEW', label: 'Internal Review', cls: 'border-yellow-500/50',  dot: 'bg-yellow-400'   },
  { status: 'ON_HOLD',         label: 'On Hold',         cls: 'border-orange-500/50',  dot: 'bg-orange-400'   },
  { status: 'DELIVERED',       label: 'Delivered',       cls: 'border-emerald-500/50', dot: 'bg-emerald-400'  },
  { status: 'CANCELLED',       label: 'Cancelled',       cls: 'border-warm/40',        dot: 'bg-warm'         },
];

// Kanban-local filter state — persists while the view is open
let _kbSearch   = '';
let _kbProducer = '';
let _kbPriority = '';

function renderKanban() {
  const board = document.getElementById('kanban-board');
  if (!board) return;

  // Build unique producer list from current project cache
  const producers = [...new Map(
    _allProjects.filter(p => p.producer).map(p => [p.producerId, p.producer.name])
  ).entries()].sort((a, b) => a[1].localeCompare(b[1]));

  // Filter bar HTML (rendered fresh each time so values stick via _kb* vars)
  const filterBar = `
    <div class="flex flex-wrap gap-2 mb-4">
      <input id="kb-search" type="text" placeholder="Search name or client…" value="${esc(_kbSearch)}"
        class="bg-panel2 border border-line text-ink text-xs px-3 py-1.5 rounded-lg w-48
               focus:outline-none focus:border-accent/60" />
      <select id="kb-filter-priority"
        class="bg-panel2 border border-line text-ink text-xs px-2 py-1.5 rounded-lg cursor-pointer
               focus:outline-none focus:border-accent/60">
        <option value="">All priorities</option>
        <option value="P1"${_kbPriority==='P1'?' selected':''}>P1 — High</option>
        <option value="P2"${_kbPriority==='P2'?' selected':''}>P2 — Medium</option>
        <option value="P3"${_kbPriority==='P3'?' selected':''}>P3 — Low</option>
      </select>
      <select id="kb-filter-producer"
        class="bg-panel2 border border-line text-ink text-xs px-2 py-1.5 rounded-lg cursor-pointer
               focus:outline-none focus:border-accent/60">
        <option value="">All producers</option>
        ${producers.map(([id, name]) => `<option value="${id}"${_kbProducer===id?' selected':''}>${esc(name)}</option>`).join('')}
      </select>
    </div>`;

  // Apply filters + company filter
  const projects = _allProjects.filter(p => {
    if (!matchesFilter(p.company)) return false;
    if (_kbSearch   && !((p.name || '') + ' ' + (p.client || '')).toLowerCase().includes(_kbSearch)) return false;
    if (_kbProducer && p.producerId !== _kbProducer) return false;
    if (_kbPriority && p.priority   !== _kbPriority) return false;
    return true;
  });

  const byStatus = {};
  KANBAN_COLS.forEach(c => { byStatus[c.status] = []; });
  projects.forEach(p => { if (byStatus[p.status]) byStatus[p.status].push(p); });

  const columns =
    `<div class="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 items-start">` +
    KANBAN_COLS.map(col => {
      const items = byStatus[col.status];
      return `
        <div class="flex flex-col gap-2 rounded-xl transition-colors" data-stage-drop="${col.status}">
          <div class="flex items-center gap-2 px-1 mb-1">
            <span class="w-2 h-2 rounded-full ${col.dot} shrink-0"></span>
            <span class="text-[11px] font-semibold text-muted uppercase tracking-wide">${col.label}</span>
            <span class="text-[11px] text-muted/60 ml-auto">${items.length}</span>
          </div>
          ${items.length
            ? items.map(p => renderKanbanCard(p, col)).join('')
            : '<p class="text-xs text-muted text-center py-4">—</p>'
          }
        </div>`;
    }).join('') +
    `</div>`;

  board.innerHTML = filterBar + columns;

  // Wire filter inputs — save state then re-render
  const kbSearch = document.getElementById('kb-search');
  if (kbSearch) {
    kbSearch.focus(); // restore focus so typing isn't interrupted
    kbSearch.setSelectionRange(kbSearch.value.length, kbSearch.value.length);
    kbSearch.addEventListener('input', () => { _kbSearch = kbSearch.value.toLowerCase(); renderKanban(); });
  }
  document.getElementById('kb-filter-producer')?.addEventListener('change', e => { _kbProducer = e.target.value; renderKanban(); });
  document.getElementById('kb-filter-priority')?.addEventListener('change', e => { _kbPriority = e.target.value; renderKanban(); });

  // Wire status dropdowns on cards — PATCH then update local cache and re-render
  board.querySelectorAll('[data-kb-status]').forEach(sel => {
    sel.addEventListener('change', () => setKanbanStatus(sel.dataset.kbStatus, sel.value));
  });

  // Wire card click → detail view (click on card body, not the dropdown)
  board.querySelectorAll('[data-kanban-id]').forEach(card => {
    card.addEventListener('click', e => {
      if (e.target.closest('select')) return; // don't open detail when using the dropdown
      showProjectDetail(card.dataset.kanbanId);
    });
  });

  wireKanbanDragDrop(board);
}

// PATCHes a project's status and keeps the in-memory cache + board in sync.
// Server can reject (e.g. DELIVERED with incomplete assets) — on failure we
// re-render so the card snaps back to its real status instead of drifting
// out of sync with what's actually saved.
async function setKanbanStatus(id, newStatus) {
  const res = await fetch(`/api/projects/${id}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: newStatus }),
  });
  const proj = _allProjects.find(p => p.id === id);
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    alert([].concat(e.message || 'Could not change status.').join(', '));
    renderKanban();
    return;
  }
  if (proj) proj.status = newStatus;
  renderKanban();
}

// Drag-and-drop, same pattern as the Sales pipeline board: dragging a card
// into a different column changes its status via the same PATCH the status
// dropdown uses. Named distinctly from sales.js's dragGhost/dragAfterElement
// since both files share the page's global scope.
let _kbDragGhost = null;

function kanbanDragAfterElement(column, y) {
  const cards = [...column.querySelectorAll('[data-kanban-id]:not(.dragging)')];
  return cards.reduce((closest, card) => {
    const box = card.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    if (offset < 0 && offset > closest.offset) return { offset, element: card };
    return closest;
  }, { offset: -Infinity, element: null }).element;
}

function wireKanbanDragDrop(board) {
  board.querySelectorAll('[data-kanban-id]').forEach(card => {
    card.draggable = true;
    card.ondragstart = (e) => {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', card.dataset.kanbanId);
      card.classList.add('dragging', 'opacity-40');
      _kbDragGhost = document.createElement('div');
      _kbDragGhost.className = 'h-1.5 rounded-full bg-accent/60 mx-1';
    };
    card.ondragend = () => {
      card.classList.remove('dragging', 'opacity-40');
      _kbDragGhost?.remove();
      _kbDragGhost = null;
    };
  });

  board.querySelectorAll('[data-stage-drop]').forEach(col => {
    col.ondragover = (e) => {
      e.preventDefault();
      col.classList.add('bg-accent/5', 'ring-1', 'ring-accent/40');
      if (!_kbDragGhost) return;
      const after = kanbanDragAfterElement(col, e.clientY);
      after ? col.insertBefore(_kbDragGhost, after) : col.appendChild(_kbDragGhost);
    };
    col.ondragleave = (e) => {
      if (!col.contains(e.relatedTarget)) col.classList.remove('bg-accent/5', 'ring-1', 'ring-accent/40');
    };
    col.ondrop = (e) => {
      e.preventDefault();
      col.classList.remove('bg-accent/5', 'ring-1', 'ring-accent/40');
      _kbDragGhost?.remove();

      const id     = e.dataTransfer.getData('text/plain');
      const status = col.dataset.stageDrop;
      const proj   = _allProjects.find(p => p.id === id);
      if (!proj || proj.status === status) return;

      setKanbanStatus(id, status);
    };
  });
}

function renderKanbanCard(p, col) {
  const priCls     = PRI_CLS[p.priority] || 'text-muted';
  const quadCls    = QUADRANT_CLS[p.quadrant] || 'bg-panel2 text-muted';
  const deadline   = p.deadline ? new Date(p.deadline) : null;
  const now        = new Date();
  const overdue    = deadline && deadline < now && !['DELIVERED','CANCELLED'].includes(p.status);
  const dueSoon    = deadline && !overdue && (deadline - now) < 7 * 86_400_000;
  const deadlineTxt = deadline
    ? deadline.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
    : null;

  const statusOpts = KANBAN_COLS.map(c =>
    `<option value="${c.status}"${p.status === c.status ? ' selected' : ''}>${c.label}</option>`
  ).join('');

  return `
    <div data-kanban-id="${p.id}"
      class="bg-panel border ${col.cls} rounded-xl p-3 space-y-2 cursor-pointer
             hover:border-accent/40 hover:bg-panel2 transition-colors group">
      <p class="text-xs font-semibold text-ink leading-snug group-hover:text-accent transition-colors">
        ${esc(p.name)}
      </p>
      ${p.client ? `<p class="text-[11px] text-muted truncate">${esc(p.client)}</p>` : ''}
      <div class="flex items-center gap-1.5 flex-wrap">
        <span class="text-[10px] font-bold px-1.5 py-0.5 rounded ${quadCls}">
          ${QUADRANT_LABEL[p.quadrant] || p.quadrant}
        </span>
        <span class="text-[11px] ${priCls}">${p.priority}</span>
      </div>
      ${deadlineTxt ? `
        <p class="text-[11px] ${overdue ? 'text-warm font-semibold' : dueSoon ? 'text-yellow-400' : 'text-muted'}">
          ${overdue ? '⚠ ' : ''}${deadlineTxt}
        </p>` : ''}
      ${p.producer ? `<p class="text-[11px] text-muted/70">${esc(p.producer.name)}</p>` : ''}
      <select data-kb-status="${p.id}"
        class="w-full mt-1 bg-panel border border-line text-ink px-2 py-1 rounded-md text-[11px]
               focus:outline-none focus:border-accent/70 cursor-pointer">
        ${statusOpts}
      </select>
    </div>`;
}

function shiftTimeline(dir) {
  _tlOffset += dir * 4;
  renderTimeline();
}

function renderTimeline() {
  const canvas = document.getElementById('tl-canvas');
  const label  = document.getElementById('tl-label');
  if (!canvas) return;

  try {
    renderTimelineInner(canvas, label);
  } catch (err) {
    // Whatever broke, don't leave the canvas silently blank — the header
    // and legend around it are static HTML so they'd still look fine,
    // making a failed render invisible otherwise.
    console.error('renderTimeline failed:', err);
    canvas.innerHTML = '<p class="text-center text-warm text-sm py-8">Couldn\'t render the timeline — check the browser console for details.</p>';
  }
}

function renderTimelineInner(canvas, label) {
  const startMonday = _tlMonday(_tlOffset);
  const endMonday   = _tlMonday(_tlOffset + TL_WEEKS);

  // Update header label
  const fmt = d => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  if (label) label.textContent = `${fmt(startMonday)} – ${fmt(endMonday)}`;

  const activeProjects = _tlProjects.filter(p =>
    !['DELIVERED', 'CANCELLED'].includes(p.status) ||
    (p.deadline && new Date(p.deadline) >= startMonday)
  );

  if (!activeProjects.length) {
    canvas.innerHTML = '<p class="text-center text-muted text-sm py-8">No projects to display.</p>';
    return;
  }

  const totalW = TL_NAME_W + TL_WEEKS * TL_WEEK_W;
  const rowH   = 32;
  const headH  = 28;
  const totalH = headH + activeProjects.length * rowH;

  // Week header labels
  const weekHeaders = Array.from({ length: TL_WEEKS }, (_, i) => {
    const d = _tlMonday(_tlOffset + i);
    const x = TL_NAME_W + i * TL_WEEK_W;
    const isToday = i === -_tlOffset; // the current week
    const monthLabel = d.getUTCDate() <= 7
      ? d.toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' })
      : '';
    return `
      <rect x="${x}" y="0" width="${TL_WEEK_W}" height="${headH}"
        fill="${isToday ? 'rgba(99,179,162,0.08)' : 'transparent'}"/>
      <text x="${x + TL_WEEK_W / 2}" y="11" text-anchor="middle"
        font-size="9" fill="${isToday ? '#63b3a2' : '#6b7280'}">${d.getUTCDate()}</text>
      ${monthLabel ? `<text x="${x + TL_WEEK_W / 2}" y="22" text-anchor="middle" font-size="8" fill="#4b5563">${monthLabel}</text>` : ''}`;
  }).join('');

  // Grid lines
  const gridLines = Array.from({ length: TL_WEEKS + 1 }, (_, i) => {
    const x = TL_NAME_W + i * TL_WEEK_W;
    return `<line x1="${x}" y1="${headH}" x2="${x}" y2="${totalH}" stroke="#2d3748" stroke-width="1"/>`;
  }).join('');

  // "Today" highlight column
  const todayX = TL_NAME_W + (-_tlOffset) * TL_WEEK_W;
  const todayCol = `<rect x="${todayX}" y="${headH}" width="${TL_WEEK_W}" height="${totalH - headH}"
    fill="rgba(99,179,162,0.05)"/>`;

  // Project rows
  const STATUS_COLOR = {
    BRIEF:           '#4b5563',
    IN_PROGRESS:     '#63b3a2',
    INTERNAL_REVIEW: '#ecc94b',
    DELIVERED:       '#48bb78',
    ON_HOLD:         '#f6ad55',
    CANCELLED:       '#fc8181',
  };

  const rows = activeProjects.map((p, i) => {
    const y     = headH + i * rowH;
    const rowBg = i % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent';

    // Project bar: startDate → deadline
    const pStart = p.startDate ? new Date(p.startDate) : new Date(p.createdAt);
    const pEnd   = p.deadline  ? new Date(p.deadline)  : null;

    const barColor = STATUS_COLOR[p.status] || '#4b5563';

    let barSvg = '';
    if (pEnd) {
      // Convert dates to week-column offsets
      const startOff = Math.round((pStart.getTime() - startMonday.getTime()) / (7 * 86_400_000));
      const endOff   = Math.round((pEnd.getTime()   - startMonday.getTime()) / (7 * 86_400_000));

      const clampedStart = Math.max(0, startOff);
      const clampedEnd   = Math.min(TL_WEEKS, endOff);

      if (clampedEnd > clampedStart) {
        const bx = TL_NAME_W + clampedStart * TL_WEEK_W + 2;
        const bw = (clampedEnd - clampedStart) * TL_WEEK_W - 4;
        barSvg = `<rect x="${bx}" y="${y + 8}" width="${bw}" height="${rowH - 16}"
          rx="3" fill="${barColor}" opacity="0.75"/>`;
      }
    } else {
      // No deadline — show a thin line from start extending to the right edge
      const startOff = Math.round((pStart.getTime() - startMonday.getTime()) / (7 * 86_400_000));
      const clamped  = Math.max(0, Math.min(TL_WEEKS, startOff));
      const bx = TL_NAME_W + clamped * TL_WEEK_W + 2;
      const bw = (TL_NAME_W + TL_WEEKS * TL_WEEK_W) - bx - 2;
      barSvg = `<rect x="${bx}" y="${y + 12}" width="${bw}" height="${rowH - 24}"
        rx="3" fill="${barColor}" opacity="0.4" stroke-dasharray="4 2"/>`;
    }

    return `
      <rect x="0" y="${y}" width="${totalW}" height="${rowH}" fill="${rowBg}"/>
      <text x="6" y="${y + rowH / 2 + 4}" font-size="11" fill="#e2e8f0">${esc(p.name.length > 22 ? p.name.slice(0, 21) + '…' : p.name)}</text>
      ${barSvg}
      <rect data-tl-id="${p.id}" x="0" y="${y}" width="${totalW}" height="${rowH}"
        fill="transparent" class="cursor-pointer" style="cursor:pointer"/>`;
  }).join('');

  canvas.innerHTML = `
    <svg width="${totalW}" height="${totalH}" xmlns="http://www.w3.org/2000/svg"
      style="font-family:ui-monospace,monospace;display:block;">
      <!-- Background -->
      <rect width="${totalW}" height="${totalH}" fill="transparent"/>
      <!-- Name column -->
      <rect x="0" y="0" width="${TL_NAME_W}" height="${totalH}" fill="rgba(0,0,0,0.15)"/>
      <line x1="${TL_NAME_W}" y1="0" x2="${TL_NAME_W}" y2="${totalH}" stroke="#2d3748" stroke-width="1"/>
      <!-- Header -->
      <rect x="0" y="0" width="${totalW}" height="${headH}" fill="rgba(0,0,0,0.2)"/>
      <line x1="0" y1="${headH}" x2="${totalW}" y2="${headH}" stroke="#2d3748" stroke-width="1"/>
      ${weekHeaders}
      <!-- Today highlight -->
      ${_tlOffset <= 0 && -_tlOffset < TL_WEEKS ? todayCol : ''}
      <!-- Grid -->
      ${gridLines}
      <!-- Rows -->
      ${rows}
    </svg>`;

  // Wire row clicks — transparent overlay rects sit on top so they catch the event
  canvas.querySelectorAll('[data-tl-id]').forEach(el => {
    el.addEventListener('click', () => showProjectDetail(el.dataset.tlId));
  });
}
