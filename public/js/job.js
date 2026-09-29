// ══════════════════════════════════════════════════════════════
// JOB PAGE — one deal, start to finish (Sept 2026 restructure)
//
// A "Job" is a Lead once it's a real piece of work. It's the root that
// holds everything money-related: value, margin target, client tier,
// costs, Autocount quotations/invoices, invoiced/paid %. The linked
// Project holds production info only (dates, team, skills, capacity)
// and has an "Open job" link back here.
//
// Opened from the Jobs tab (jobs.html), a Sales card, or a project page:
//   /job.html?id=<leadId>   or   /job.html?project=<projectId>
// Depends on: $, msg, esc, coBadge, LEAD_STATUS_LABEL, LEAD_STATUS_CLS,
//             CLIENT_TIER_LABEL, STATUS_LABEL, PRI_CLS  (shared.js)
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

  // /api/jobs/:id = the lead + its full project (team, dates, this week's
  // bookings) + costs + Autocount docs. Edits still PATCH /api/leads.
  const res = await fetch('/api/jobs/' + id);
  if (res.status === 403) { $('job-content').innerHTML = '<p class="text-sm text-muted">Jobs aren\'t available for your role.</p>'; return; }
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

  const val = (v) => `<p class="text-xs text-ink">${v}</p>`;
  const sectionHead = (title, link = '') =>
    `<div class="flex items-center justify-between mb-3">
       <p class="text-[11px] font-semibold uppercase tracking-widest text-muted">${title}</p>${link}
     </div>`;
  const p = j.project;

  // ── Production side (read-only here — the project page is where it's edited,
  //    so there's one place to change each thing). No project yet → offer one.
  let production;
  if (p) {
    const booked = p.capacityEntries || [];
    production = `
      ${sectionHead('Production',
        `<a href="/projects.html?open=${p.id}" class="text-[11px] text-accent hover:underline">Edit on project page →</a>`)}
      <div class="grid grid-cols-2 sm:grid-cols-3 gap-4">
        ${lbl('Project status', val(STATUS_LABEL[p.status] || p.status))}
        ${lbl('Priority',       `<p class="text-xs ${PRI_CLS[p.priority] || 'text-ink'}">${p.priority}</p>`)}
        ${lbl('Start → Deadline', val(`${fmtDate(p.startDate)} → ${fmtDate(p.deadline)}`))}
        ${lbl('Producer',       val(p.producer ? esc(p.producer.name) : '—'))}
        ${lbl('PM',             val(p.pm ? esc(p.pm.name) : '—'))}
        ${lbl('Timeline',       p.timelineUrl
          ? `<a href="${esc(p.timelineUrl)}" target="_blank" rel="noopener" class="text-xs text-accent hover:underline">Open ↗</a>`
          : val('—'))}
      </div>
      <p class="text-[10px] text-muted font-medium uppercase tracking-wider mt-4 mb-1">Booked this week</p>
      ${booked.length
        ? `<div class="flex flex-wrap gap-1.5">${booked.map(b =>
            `<span class="badge bg-panel2 border border-line text-ink text-[11px]">${esc(b.person.name)} · ${Math.round(b.pctWeek)}%</span>`).join('')}</div>`
        : '<p class="text-xs text-muted">Nobody booked this week.</p>'}`;
  } else {
    production = `
      ${sectionHead('Production')}
      ${j.status === 'WON'
        ? `<button onclick="convertJob()"
             class="text-xs bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 px-3 py-1.5 rounded-lg
                    hover:bg-emerald-500/25 transition-colors cursor-pointer font-semibold">→ Create project</button>`
        : '<p class="text-xs text-muted">No project for this job.</p>'}`;
  }

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
      <div class="flex gap-1.5">
        <span class="badge border ${LEAD_STATUS_CLS[j.status] || ''}">${LEAD_STATUS_LABEL[j.status] || j.status}</span>
        ${p ? `<span class="badge bg-panel2 border border-line text-ink">${STATUS_LABEL[p.status] || p.status}</span>` : ''}
      </div>
    </div>

    <!-- Sales side — who won it, when, for whom. -->
    <div class="pb-5 border-b border-line">
      ${sectionHead('Sales', '<a href="/sales.html" class="text-[11px] text-accent hover:underline">Sales pipeline →</a>')}
      <div class="grid grid-cols-2 sm:grid-cols-3 gap-4">
        ${lbl('Stage',     `<span class="badge border ${LEAD_STATUS_CLS[j.status] || ''} text-[11px]">${LEAD_STATUS_LABEL[j.status] || j.status}</span>`)}
        ${lbl('Closed by', val(j.closedBy ? esc(j.closedBy.name) : '—'))}
        ${lbl('Won on',    val(fmtDate(j.wonAt)))}
        ${lbl('Client',    val(j.account ? esc(j.account.name) : '—'))}
        ${lbl('Contact',   val(j.contact ? esc(j.contact.name) + (j.contact.title ? ` <span class="text-muted">· ${esc(j.contact.title)}</span>` : '') : '—'))}
      </div>
      ${j.id.startsWith('job_') ? '<p class="text-[11px] text-muted/60 mt-2">No sale was logged for this job — it was created from its project.</p>' : ''}
    </div>

    <div class="py-5 border-b border-line">${production}</div>

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
  loadJob();   // refetch the full job (the lead PATCH reply has no project detail) → tiles refresh
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
