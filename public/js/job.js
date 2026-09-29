// ══════════════════════════════════════════════════════════════
// JOB PAGE — one deal, start to finish (Sept 2026 restructure)
//
// A "Job" is a Lead once it's a real piece of work. It's the root that
// holds everything money-related: value, margin target, client tier,
// costs, Autocount quotations/invoices, invoiced/paid %. The linked
// Project holds production info only (dates, team, skills, capacity)
// and has an "Open job" link back here.
//
// Opened as  /job.html?id=<leadId>   or   /job.html?project=<projectId>
// Depends on: $, msg, esc, coBadge, LEAD_STATUS_LABEL, LEAD_STATUS_CLS,
//             CLIENT_TIER_LABEL, STATUS_LABEL  (shared.js)
// ══════════════════════════════════════════════════════════════

const JOB_COST_LABEL = { WARM_POOL: 'Warm pool', SUPPLIER: 'Supplier', ADDITIONAL: 'Additional' };
const JOB_DOC_LABEL  = { QUOTATION: 'Quotation', SALES_INVOICE: 'Invoice', PURCHASE_INVOICE: 'PO Invoice' };
const JOB_DOC_STATUS_CLS = {
  ACTIVE: 'bg-sky-500/15 border-sky-500/30 text-sky-400',
  PAID:   'bg-emerald-500/15 border-emerald-500/30 text-emerald-400',
  VOID:   'bg-panel2 border-line text-muted',
};
// Same steps the lead card offers — these are % of the job value.
const INVOICED_STEPS = [0, 30, 50, 70, 100];
const PAID_STEPS     = [0, 20, 25, 30, 40, 50, 60, 70, 80, 100];

let _job     = null;   // the lead (job) currently shown
let _debtors = [];     // Autocount debtor list, fetched once when the push modal first opens

const rm = v => v == null ? '—' : 'RM ' + Math.round(v).toLocaleString('en-MY');
const fmtDate = d => d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

// ── load ──────────────────────────────────────────────────────

async function loadJob() {
  const params = new URLSearchParams(location.search);
  let id = params.get('id');

  // Coming from a project page: look up that project's job first.
  if (!id && params.get('project')) {
    const p = await fetch('/api/projects/' + params.get('project')).then(r => r.ok ? r.json() : null).catch(() => null);
    id = p?.jobId;
  }
  if (!id) { $('job-content').innerHTML = '<p class="text-sm text-muted">Job not found.</p>'; return; }

  const res = await fetch('/api/leads/' + id);
  if (!res.ok) { $('job-content').innerHTML = '<p class="text-sm text-muted">Job not found.</p>'; return; }
  _job = await res.json();
  document.title = 'Pop OS — ' + _job.name;
  renderJob();
}

// ── render ────────────────────────────────────────────────────

function renderJob() {
  const j = _job;
  const costTotal = (j.costs || []).reduce((s, c) => s + c.amount, 0);
  const net       = j.estimatedValue != null ? j.estimatedValue - costTotal : null;
  const netPct    = j.estimatedValue ? Math.round((net / j.estimatedValue) * 100) : null;

  const lbl = (label, content) =>
    `<div><p class="text-[10px] text-muted font-medium uppercase tracking-wider mb-0.5">${label}</p>${content}</div>`;
  const inputCls = 'bg-panel2 border border-line text-ink text-xs px-2 py-1 rounded-md w-full focus:outline-none focus:border-accent/60';
  const opts = (list, cur, fmt = v => v) =>
    list.map(v => `<option value="${v}"${String(cur ?? '') === String(v) ? ' selected' : ''}>${fmt(v)}</option>`).join('');

  // Production side: link to the project, or offer to create one once won.
  const projectBlock = j.project
    ? `<a href="/projects.html?open=${j.project.id}"
          class="inline-flex items-center gap-1.5 text-xs bg-emerald-500/15 border border-emerald-500/30 text-emerald-400
                 px-3 py-1.5 rounded-lg hover:bg-emerald-500/25 transition-colors">
         Open project → ${esc(j.project.name)}
         <span class="text-emerald-400/70">(${STATUS_LABEL[j.project.status] || j.project.status})</span>
       </a>`
    : j.status === 'WON'
      ? `<button onclick="convertJob()"
            class="text-xs bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 px-3 py-1.5 rounded-lg
                   hover:bg-emerald-500/25 transition-colors cursor-pointer font-semibold">→ Create project</button>`
      : `<span class="text-xs text-muted">No project yet — one is created once the deal is won.</span>`;

  $('job-content').innerHTML = `
    <div class="flex flex-wrap items-start justify-between gap-3 mb-5">
      <div>
        <p class="text-[11px] font-semibold uppercase tracking-widest text-muted mb-1">Job</p>
        <h1 class="text-xl font-bold text-ink">${esc(j.name)}</h1>
        <p class="text-sm text-muted mt-1">
          ${j.account ? esc(j.account.name) : 'No client account'}
          ${j.company ? ' · ' + coBadge(j.company) : ''}
        </p>
      </div>
      <div class="text-right space-y-1">
        <span class="badge border ${LEAD_STATUS_CLS[j.status] || ''}">${LEAD_STATUS_LABEL[j.status] || j.status}</span>
        <p class="text-[11px] text-muted">
          ${j.closedBy ? 'Closed by ' + esc(j.closedBy.name) : 'No closer'}${j.wonAt ? ' · won ' + fmtDate(j.wonAt) : ''}
        </p>
      </div>
    </div>

    <div class="pb-5 border-b border-line">${projectBlock}</div>

    <!-- Money summary — the numbers commission and Financial read. -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 py-5 border-b border-line">
      ${[
        ['Value',        rm(j.estimatedValue), 'text-ink'],
        ['Costs',        rm(costTotal),        'text-ink'],
        ['Net',          rm(net),              net != null && net < 0 ? 'text-warm' : 'text-emerald-400'],
        ['Net margin',   netPct != null ? netPct + '%' : '—',
                         netPct != null && j.marginTarget != null && netPct < j.marginTarget ? 'text-warm' : 'text-ink'],
      ].map(([k, v, cls]) => `
        <div class="bg-panel2 border border-line rounded-xl px-3 py-2.5">
          <p class="text-[10px] text-muted uppercase tracking-wider">${k}</p>
          <p class="text-lg font-bold ${cls}">${v}</p>
        </div>`).join('')}
    </div>

    <div class="py-5 border-b border-line">
      <p class="text-[11px] font-semibold uppercase tracking-widest text-muted mb-3">Money</p>
      <div class="grid grid-cols-2 sm:grid-cols-3 gap-4">
        ${lbl('Value (RM)',        `<input id="job-value"  type="number" min="0" value="${j.estimatedValue ?? ''}" class="${inputCls}" />`)}
        ${lbl('Margin target (%)', `<input id="job-margin" type="number" min="0" max="100" value="${j.marginTarget ?? ''}" class="${inputCls}" />`)}
        ${lbl('Client tier',       `<select id="job-tier" class="${inputCls} cursor-pointer">
                                      <option value="">— none —</option>
                                      ${opts(['NEW', 'RETURNING', 'KEY_ACCOUNT'], j.clientTier, v => CLIENT_TIER_LABEL[v])}
                                    </select>`)}
        ${lbl('Invoiced',          `<select id="job-invoiced" class="${inputCls} cursor-pointer">${opts(INVOICED_STEPS, j.invoicedPct, v => v + '%')}</select>`)}
        ${lbl('Paid',              `<select id="job-paid" class="${inputCls} cursor-pointer">${opts(PAID_STEPS, j.paidPct, v => v + '%')}</select>`)}
        ${lbl('Payment date',      `<input id="job-paydate" type="date" value="${j.paymentDate ? new Date(j.paymentDate).toISOString().split('T')[0] : ''}" class="${inputCls} cursor-pointer" />`)}
      </div>
      <p class="text-[11px] text-muted/60 mt-2">Value, margin target and client tier also feed the project's PPM recommendation.</p>
    </div>

    <div class="py-5 border-b border-line">
      <p class="text-[11px] font-semibold uppercase tracking-widest text-muted mb-3">Costs</p>
      <div id="job-costs"></div>
      ${j.projectId ? `
      <form class="mt-3 flex flex-wrap gap-2 items-end" onsubmit="addJobCost(event)">
        <div class="flex flex-col gap-1">
          <label class="text-[10px] text-muted uppercase tracking-wider">Description</label>
          <input id="jc-desc" type="text" placeholder="e.g. Warm pool animator" required
            class="bg-panel2 border border-line text-ink text-xs px-2 py-1.5 rounded-md w-48 focus:outline-none focus:border-accent/60" />
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-[10px] text-muted uppercase tracking-wider">Amount (RM)</label>
          <input id="jc-amount" type="number" min="0" step="0.01" placeholder="0.00" required
            class="bg-panel2 border border-line text-ink text-xs px-2 py-1.5 rounded-md w-28 focus:outline-none focus:border-accent/60" />
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-[10px] text-muted uppercase tracking-wider">Type</label>
          <select id="jc-type" class="bg-panel2 border border-line text-ink text-xs px-2 py-1.5 rounded-md focus:outline-none focus:border-accent/60 cursor-pointer">
            ${Object.entries(JOB_COST_LABEL).map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}
          </select>
        </div>
        <button type="submit"
          class="text-[11px] bg-accent/15 border border-accent/30 text-accent px-3 py-1.5 rounded-lg hover:bg-accent/25 transition-colors cursor-pointer self-end">
          + Add cost
        </button>
      </form>` : `<p class="text-[11px] text-muted/60 mt-2">Costs can be added once the job has a project.</p>`}
    </div>

    <div class="pt-5">
      <div class="flex flex-wrap items-center justify-between gap-2 mb-2">
        <p class="text-[11px] font-semibold uppercase tracking-widest text-muted">Quotations &amp; invoices</p>
        <div class="flex gap-2">
          <button onclick="openPushModal('QUOTATION')"
            class="text-[11px] bg-sky-500/15 border border-sky-500/30 text-sky-400 px-2 py-0.5 rounded-lg hover:bg-sky-500/25 transition-colors cursor-pointer">
            ↑ Push quotation
          </button>
          ${j.projectId ? `
          <button onclick="openPushModal('SALES_INVOICE')"
            class="text-[11px] bg-sky-500/15 border border-sky-500/30 text-sky-400 px-2 py-0.5 rounded-lg hover:bg-sky-500/25 transition-colors cursor-pointer">
            ↑ Push invoice
          </button>` : ''}
        </div>
      </div>
      <div id="job-docs"></div>
    </div>`;

  renderCosts();
  renderDocs();
  wireMoneyInputs();
}

function renderCosts() {
  const el = $('job-costs');
  const costs = _job.costs || [];
  if (!costs.length) { el.innerHTML = '<p class="text-xs text-muted">No costs recorded yet.</p>'; return; }
  const total = costs.reduce((s, c) => s + c.amount, 0);
  el.innerHTML = `
    <table class="w-full text-[11px]">
      <thead><tr class="text-muted border-b border-line">
        <th class="text-left pb-1.5 font-medium">Description</th>
        <th class="text-left pb-1.5 font-medium">Type</th>
        <th class="text-right pb-1.5 font-medium">Amount</th>
        <th class="pb-1.5"></th>
      </tr></thead>
      <tbody>
        ${costs.map(c => `
          <tr class="border-b border-line/40 last:border-0">
            <td class="py-1.5 pr-2 text-ink">${esc(c.description)}</td>
            <td class="py-1.5 pr-2"><span class="badge bg-panel2 border border-line text-muted text-[10px]">${JOB_COST_LABEL[c.costType] || c.costType}</span></td>
            <td class="py-1.5 text-right text-ink pr-2">${rm(c.amount)}</td>
            <td class="py-1.5 pl-1"><button class="text-[10px] text-warm hover:underline cursor-pointer" onclick="removeJobCost('${c.id}')">Remove</button></td>
          </tr>`).join('')}
      </tbody>
      <tfoot><tr>
        <td colspan="2" class="pt-2 text-[10px] font-semibold uppercase tracking-wider text-muted">Total costs</td>
        <td class="pt-2 text-right font-semibold text-ink pr-2">${rm(total)}</td>
        <td></td>
      </tr></tfoot>
    </table>`;
}

function renderDocs() {
  const el   = $('job-docs');
  const docs = _job.accountingDocuments || [];
  if (!docs.length) { el.innerHTML = '<p class="text-xs text-muted">No Autocount documents yet.</p>'; return; }
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
        const overdue = d.dueDate && d.status === 'ACTIVE' && new Date(d.dueDate) < new Date();
        return `<tr class="border-b border-line/40 last:border-0">
          <td class="py-1.5 pr-2">${JOB_DOC_LABEL[d.docType] || d.docType}</td>
          <td class="py-1.5 pr-2 font-mono text-ink">${esc(d.docNo)}</td>
          <td class="py-1.5 pr-2">${fmtDate(d.docDate)}</td>
          <td class="py-1.5 pr-2 ${overdue ? 'text-warm font-semibold' : ''}">${fmtDate(d.dueDate)}${overdue ? ' ⚠' : ''}</td>
          <td class="py-1.5 text-right text-ink pr-2">${rm(d.amount)}</td>
          <td class="py-1.5 pl-2"><span class="badge border ${JOB_DOC_STATUS_CLS[d.status] || ''} text-[10px]">${d.status}</span></td>
          <td class="py-1.5 pl-1">
            ${d.status === 'ACTIVE' ? `
              <select onchange="updateJobDocStatus('${d.id}', this.value)"
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

// ── edits ─────────────────────────────────────────────────────

// PATCH the job; on failure show the error and reload so the form matches the DB.
async function patchJob(data) {
  const res = await fetch('/api/leads/' + _job.id, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    msg($('job-msg'), [].concat(e.message || 'Save failed').join(', '), 'err');
    return loadJob();
  }
  msg($('job-msg'), '', '');
  _job = { ..._job, ...(await res.json()) };
  renderJob();   // refresh the Value / Net / Net margin tiles
}

function wireMoneyInputs() {
  const num = v => v === '' ? null : parseFloat(v);
  $('job-value').onchange    = e => patchJob({ estimatedValue: num(e.target.value) });
  $('job-margin').onchange   = e => patchJob({ marginTarget:   num(e.target.value) });
  $('job-tier').onchange     = e => patchJob({ clientTier:     e.target.value || null });
  $('job-invoiced').onchange = e => patchJob({ invoicedPct:    Number(e.target.value) });
  $('job-paid').onchange     = e => patchJob({ paidPct:        Number(e.target.value) });
  $('job-paydate').onchange  = e => { if (e.target.value) patchJob({ paymentDate: e.target.value }); };
}

async function addJobCost(e) {
  e.preventDefault();
  const description = $('jc-desc').value.trim();
  const amount      = parseFloat($('jc-amount').value);
  if (!description || isNaN(amount)) return;
  const res = await fetch('/api/project-costs', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ leadId: _job.id, description, amount, costType: $('jc-type').value }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    msg($('job-msg'), [].concat(err.message || 'Could not add cost').join(', '), 'err');
    return;
  }
  loadJob();
}

async function removeJobCost(costId) {
  if (!confirm('Remove this cost entry?')) return;
  await fetch('/api/project-costs/' + costId, { method: 'DELETE' });
  loadJob();
}

async function updateJobDocStatus(docId, status) {
  if (!status) return;
  if (!confirm(`Mark this document as ${status}?`)) { renderDocs(); return; }
  const res = await fetch(`/api/autocount/documents/${docId}/status`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
  if (res.ok) loadJob();
}

async function convertJob() {
  if (!confirm('Create a project for this job? It starts in BRIEF status.')) return;
  const res = await fetch(`/api/leads/${_job.id}/convert`, { method: 'POST' });
  if (res.ok) {
    const project = await res.json();
    location.href = '/projects.html?open=' + project.id;
  } else {
    const e = await res.json().catch(() => ({}));
    msg($('job-msg'), [].concat(e.message || 'Failed').join(', '), 'err');
  }
}

// ── Autocount push modal — one modal for quotations and invoices ──
// Quotations push from the job (lead); invoices push from its project,
// but both land on this job's document list.

let _pushType = null;

async function openPushModal(type) {
  _pushType = type;
  if (!_debtors.length) {
    _debtors = await fetch('/api/autocount/debtors').then(r => r.json()).catch(() => []);
  }
  const pre = _job.account?.autocountDebtorCode || '';
  $('push-modal-heading').textContent = type === 'QUOTATION' ? 'Push Quotation to Autocount' : 'Push Invoice to Autocount';
  $('push-modal-title').textContent   = _job.name;
  $('push-submit-btn').textContent    = type === 'QUOTATION' ? 'Create Quotation' : 'Create Invoice';
  $('push-debtor-sel').innerHTML = '<option value="">— select debtor —</option>' +
    _debtors.map(d => `<option value="${esc(d.accNo)}"${d.accNo === pre ? ' selected' : ''}>${esc(d.companyName)} (${esc(d.accNo)})</option>`).join('');
  $('push-modal-msg').textContent = '';
  $('push-modal').classList.remove('hidden');
}

function closePushModal() {
  $('push-modal').classList.add('hidden');
  _pushType = null;
}

async function submitPush() {
  const debtorCode = $('push-debtor-sel').value;
  const msgEl      = $('push-modal-msg');
  if (!debtorCode) { msgEl.textContent = 'Please select a debtor.'; msgEl.className = 'text-xs text-warm'; return; }

  const url = _pushType === 'QUOTATION'
    ? `/api/autocount/leads/${_job.id}/quotation`
    : `/api/autocount/projects/${_job.projectId}/invoice`;

  $('push-submit-btn').disabled = true;
  msgEl.textContent = 'Creating in Autocount…'; msgEl.className = 'text-xs text-muted';
  const res = await fetch(url, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ debtorCode }),
  });
  $('push-submit-btn').disabled = false;

  if (res.ok) {
    const data = await res.json();
    msgEl.textContent = `Done! ${data.docNo} created in Autocount.`;
    msgEl.className   = 'text-xs text-emerald-400';
    setTimeout(() => { closePushModal(); loadJob(); }, 1500);
  } else {
    const e = await res.json().catch(() => ({}));
    msgEl.textContent = e.message || 'Failed.';
    msgEl.className   = 'text-xs text-warm';
  }
}
