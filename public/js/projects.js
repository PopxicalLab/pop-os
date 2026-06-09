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

// ── project detail view ──────────────────────────────────────

function showProjectList() {
  $('p-detail-view').classList.add('hidden');
  $('p-list-view').classList.remove('hidden');
}

async function showProjectDetail(id) {
  const p = await (await fetch('/api/projects/' + id)).json();
  $('p-list-view').classList.add('hidden');
  $('p-detail-view').classList.remove('hidden');

  const field = (label, value) => value
    ? `<div><p class="text-[10px] text-muted font-medium uppercase tracking-wider mb-0.5">${label}</p>
           <p class="text-sm text-ink">${value}</p></div>`
    : `<div><p class="text-[10px] text-muted font-medium uppercase tracking-wider mb-0.5">${label}</p>
           <p class="text-sm text-muted">—</p></div>`;

  const deadline = p.deadline
    ? new Date(p.deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : null;

  $('p-detail-content').innerHTML = `
    <div class="mb-6">
      <div class="flex items-start gap-3 flex-wrap">
        <span class="badge ${QUADRANT_CLS[p.quadrant] || ''} text-xs">${QUADRANT_LABEL[p.quadrant] || p.quadrant}</span>
        <span class="text-xs ${PRI_CLS[p.priority] || ''}">${p.priority}</span>
      </div>
      <h2 class="text-xl font-bold text-ink mt-2">${esc(p.name)}</h2>
      ${p.client ? `<p class="text-sm text-muted mt-1">${esc(p.client)}</p>` : ''}
    </div>

    <div class="grid grid-cols-2 sm:grid-cols-3 gap-4 pb-5 border-b border-line">
      ${field('Status',   STATUS_LABEL[p.status] || p.status)}
      ${field('Deadline', deadline)}
      ${field('Producer', p.producer?.name)}
      ${field('PM',       p.pm?.name)}
      ${p.quadrant === 'DRAIN' ? field('Drain gate', `Exec: ${p.drainApprovedByExec ? '✓' : '✗'} · Producer: ${p.drainApprovedByProducer ? '✓' : '✗'}`) : ''}
    </div>

    <div class="mt-5 pb-5 border-b border-line">
      <p class="text-[11px] font-semibold uppercase tracking-widest text-muted mb-3">PPM inputs</p>
      <div class="grid grid-cols-2 sm:grid-cols-3 gap-4">
        ${field('Est. value',    p.estimatedValue    != null ? fmtValue(p.estimatedValue) : null)}
        ${field('Duration',      p.estimatedDuration != null ? p.estimatedDuration + ' weeks' : null)}
        ${field('Complexity',    p.complexityScore   != null ? p.complexityScore + ' / 5' : null)}
        ${field('Client tier',   p.clientTier ? CLIENT_TIER_LABEL[p.clientTier] : null)}
        ${field('Margin target', p.marginTarget      != null ? p.marginTarget + '%' : null)}
      </div>
      <div class="mt-3 pt-3 border-t border-line/60">
        <p class="text-[10px] font-semibold uppercase tracking-widest text-muted mb-1.5">PPM recommendation</p>
        <div id="ppm-rec-${p.id}" class="text-xs text-muted">Calculating…</div>
      </div>
    </div>

    <div class="mt-5 pb-5 border-b border-line">
      <div class="flex items-center justify-between mb-2">
        <p class="text-[11px] font-semibold uppercase tracking-widest text-muted">Assets</p>
        <button onclick="switchTab('assets')"
          class="text-[11px] text-accent hover:underline cursor-pointer">Manage in Assets tab →</button>
      </div>
      <div id="proj-assets-${p.id}" class="text-xs text-muted">Loading…</div>
    </div>

    <div class="mt-5 pb-5 border-b border-line">
      <p class="text-[11px] font-semibold uppercase tracking-widest text-muted mb-2">Capacity</p>
      <p class="text-xs text-muted">Coming soon — team allocations by week will appear here.</p>
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

  // Load PPM score, assets, and accounting docs asynchronously.
  loadPpmBadge(id);
  loadProjectAssets(id);
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

async function loadProjects() {
  const all     = await (await fetch('/api/projects')).json();
  const projects = all.filter(p => matchesFilter(p.company));
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
      <td class="py-3 px-2 whitespace-nowrap"><button class="btn-del" data-proj-del="${p.id}">Remove</button></td>`;
    rows.appendChild(tr);
  }
  rows.querySelectorAll('[data-field="status"]').forEach(sel => {
    sel.onchange = async () => {
      await fetch(`/api/projects/${sel.dataset.proj}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: sel.value }),
      });
    };
  });
  rows.querySelectorAll('[data-proj-del]').forEach(b => b.onclick = () => removeProject(b.dataset.projDel));
  rows.querySelectorAll('[data-proj-detail]').forEach(b => b.onclick = () => showProjectDetail(b.dataset.projDetail));
  applyColVisibility();
}

async function addProject() {
  const quad = $('p-quadrant').value;
  const body = {
    name:       $('p-name').value.trim(),
    client:     $('p-client').value.trim() || undefined,
    company:    $('p-company').value || undefined,
    quadrant:   quad,
    priority:   $('p-priority').value,
    status:     $('p-status').value,
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
    ['p-name','p-client','p-deadline','p-est-value','p-est-duration','p-margin'].forEach(id => $(id).value = '');
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
