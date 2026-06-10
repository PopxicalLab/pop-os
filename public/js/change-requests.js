// ══════════════════════════════════════════════════════════════
// CHANGE REQUESTS
// Formal record of client-requested scope changes on live projects.
// Roles: ADMIN / PRODUCER / PM  → full CRUD + approve/reject
//        TEAM_LEAD / FINANCE    → read-only
// Depends on: $, msg, esc  (index.html globals)
// ══════════════════════════════════════════════════════════════

const CR_STATUS_LABEL = {
  PENDING:  'Pending',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
};

const CR_STATUS_CLS = {
  PENDING:  'bg-yellow-500/15 border-yellow-500/30 text-yellow-400',
  APPROVED: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400',
  REJECTED: 'bg-rose-500/15 border-rose-500/30 text-rose-400',
};

let _crAll      = [];   // full unfiltered list from last fetch
let _crProjects = [];   // {id, name} list for selectors
let _crStatusFilter = 'ALL';  // tab filter: ALL | PENDING | APPROVED | REJECTED
let _crProjFilter   = '';     // project ID filter ('' = all)
let _crRole         = null;   // current user's role

// ── Entry point ──────────────────────────────────────────────
async function loadCR() {
  _crRole = (window._me?.role) || null;

  // Load projects for selectors (once)
  if (!_crProjects.length) {
    const res = await fetch('/api/projects');
    if (res.ok) _crProjects = await res.json();
    _crPopulateProjectSelectors();
  }

  // Show/hide form based on role
  const canWrite = ['ADMIN', 'PRODUCER', 'PM'].includes(_crRole);
  const formCol = document.getElementById('cr-form-col');
  if (formCol) formCol.style.display = canWrite ? '' : 'none';

  await _crFetch();
}

function _crPopulateProjectSelectors() {
  const active = _crProjects
    .filter(p => !['DELIVERED', 'CANCELLED'].includes(p.status))
    .sort((a, b) => a.name.localeCompare(b.name));

  const addSel = document.getElementById('cr-proj');
  if (addSel) {
    addSel.innerHTML = '<option value="">— select project —</option>' +
      active.map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('');
  }

  const filterSel = document.getElementById('cr-filter-proj');
  if (filterSel) {
    filterSel.innerHTML = '<option value="">All projects</option>' +
      _crProjects.sort((a, b) => a.name.localeCompare(b.name))
        .map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('');
  }
}

async function _crFetch() {
  // Fetch all CRs; apply status + project filter client-side for snappy switching
  const params = _crProjFilter ? '?projectId=' + _crProjFilter : '';
  const res = await fetch('/api/change-requests' + params);
  if (!res.ok) return;
  _crAll = await res.json();
  _crRenderStats();
  _crRenderList();
}

// ── Stats strip ──────────────────────────────────────────────
function _crRenderStats() {
  const total    = _crAll.length;
  const pending  = _crAll.filter(c => c.status === 'PENDING').length;
  const approved = _crAll.filter(c => c.status === 'APPROVED').length;
  const rejected = _crAll.filter(c => c.status === 'REJECTED').length;
  const impact   = _crAll
    .filter(c => c.status === 'APPROVED')
    .reduce((sum, c) => sum + (c.budgetImpact || 0), 0);

  const el = document.getElementById('cr-stats');
  if (!el) return;
  el.innerHTML = `
    <div class="flex flex-wrap gap-x-6 gap-y-1 text-xs">
      <span class="text-ink font-semibold">${total} change request${total !== 1 ? 's' : ''}</span>
      <span class="text-yellow-400">${pending} pending</span>
      <span class="text-emerald-400">${approved} approved</span>
      <span class="text-rose-400">${rejected} rejected</span>
      ${impact > 0 ? `<span class="text-muted ml-auto">Approved budget impact: <span class="text-ink font-semibold">RM ${impact.toLocaleString()}</span></span>` : ''}
    </div>`;
}

// ── List rendering ───────────────────────────────────────────
function _crRenderList() {
  const filtered = _crAll.filter(c =>
    (_crStatusFilter === 'ALL' || c.status === _crStatusFilter)
  );

  const el = document.getElementById('cr-list');
  if (!el) return;

  if (!filtered.length) {
    el.innerHTML = `<div class="text-center text-muted text-sm py-10">
      ${_crStatusFilter === 'ALL' ? 'No change requests yet.' : `No ${CR_STATUS_LABEL[_crStatusFilter].toLowerCase()} change requests.`}
    </div>`;
    return;
  }

  el.innerHTML = filtered.map(c => _crCard(c)).join('');

  // Wire approve / reject buttons
  el.querySelectorAll('[data-cr-action]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id     = btn.dataset.crAction;
      const action = btn.dataset.action; // 'approve' | 'reject'
      _crShowDecisionForm(id, action);
    });
  });

  // Wire delete buttons
  el.querySelectorAll('[data-cr-delete]').forEach(btn => {
    btn.addEventListener('click', () => _crDelete(btn.dataset.crDelete));
  });
}

function _crCard(c) {
  const canWrite = ['ADMIN', 'PRODUCER', 'PM'].includes(_crRole);
  const isPending = c.status === 'PENDING';
  const date = new Date(c.createdAt).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' });

  const actions = canWrite && isPending ? `
    <div class="flex gap-2 mt-3">
      <button data-cr-action="${c.id}" data-action="approve"
        class="px-3 py-1 rounded-lg text-xs font-semibold bg-emerald-500/15 text-emerald-400
               border border-emerald-500/30 hover:bg-emerald-500/25 transition cursor-pointer">
        Approve
      </button>
      <button data-cr-action="${c.id}" data-action="reject"
        class="px-3 py-1 rounded-lg text-xs font-semibold bg-rose-500/15 text-rose-400
               border border-rose-500/30 hover:bg-rose-500/25 transition cursor-pointer">
        Reject
      </button>
    </div>` : '';

  const deleteBtn = canWrite ? `
    <button data-cr-delete="${c.id}"
      class="text-muted hover:text-rose-400 transition text-xs ml-3 cursor-pointer"
      title="Delete">✕</button>` : '';

  const noteHtml = c.note ? `
    <p class="text-xs text-muted italic mt-1 border-l-2 border-line pl-2">${esc(c.note)}</p>` : '';

  const budgetHtml = c.budgetImpact > 0
    ? `<span class="badge bg-warm/15 text-warm border border-warm/30">+RM ${c.budgetImpact.toLocaleString()}</span>`
    : `<span class="badge bg-panel2 border-line text-muted">No cost impact</span>`;

  return `
    <div class="bg-panel border border-line rounded-xl p-4" id="cr-card-${c.id}">
      <div class="flex items-start justify-between gap-3">
        <div class="flex-1 min-w-0">
          <div class="flex flex-wrap items-center gap-2 mb-1">
            <span class="text-[10px] font-semibold uppercase tracking-widest text-muted">
              ${esc(c.project?.name ?? '—')}
            </span>
            <span class="badge border ${CR_STATUS_CLS[c.status]}">${CR_STATUS_LABEL[c.status]}</span>
            ${budgetHtml}
          </div>
          <h3 class="text-sm font-semibold text-ink">${esc(c.title)}</h3>
          ${c.requestedBy ? `<p class="text-xs text-muted">Requested by: ${esc(c.requestedBy)}</p>` : ''}
          <p class="text-xs text-muted/80 mt-1 leading-relaxed">${esc(c.description)}</p>
          ${noteHtml}
        </div>
        <div class="flex items-center shrink-0">
          <span class="text-[11px] text-muted">${date}</span>
          ${deleteBtn}
        </div>
      </div>
      ${actions}
      <div id="cr-decision-${c.id}" class="hidden mt-3"></div>
    </div>`;
}

// ── Inline approve / reject form ─────────────────────────────
function _crShowDecisionForm(id, action) {
  const el = document.getElementById('cr-decision-' + id);
  if (!el) return;

  const isApprove = action === 'approve';
  const label     = isApprove ? 'Approve' : 'Reject';
  const btnCls    = isApprove
    ? 'bg-emerald-500 hover:bg-emerald-400 text-white'
    : 'bg-rose-500 hover:bg-rose-400 text-white';

  el.classList.remove('hidden');
  el.innerHTML = `
    <div class="bg-panel2 border border-line rounded-lg p-3 space-y-2">
      <label class="text-xs text-muted">Note <span class="opacity-60">(optional${!isApprove ? ', reason for rejection' : ''})</span></label>
      <textarea id="cr-note-${id}" rows="2"
        class="w-full bg-bg border border-line rounded-lg px-3 py-2 text-sm text-ink
               focus:outline-none focus:ring-1 focus:ring-accent resize-none"
        placeholder="${isApprove ? 'Any conditions or caveats…' : 'Reason for rejecting…'}"></textarea>
      <div class="flex gap-2">
        <button onclick="_crDecide('${id}','${action}')"
          class="px-4 py-1.5 rounded-lg text-xs font-semibold ${btnCls} transition cursor-pointer">
          ${label}
        </button>
        <button onclick="document.getElementById('cr-decision-${id}').classList.add('hidden')"
          class="px-3 py-1.5 rounded-lg text-xs text-muted hover:text-ink transition cursor-pointer">
          Cancel
        </button>
      </div>
    </div>`;
}

async function _crDecide(id, action) {
  const noteEl = document.getElementById('cr-note-' + id);
  const note   = noteEl?.value.trim() || null;
  const status = action === 'approve' ? 'APPROVED' : 'REJECTED';

  const res = await fetch('/api/change-requests/' + id, {
    method: 'PATCH',
    body: JSON.stringify({ status, ...(note ? { note } : {}) }),
  });
  if (res.ok) {
    await _crFetch();
  }
}

async function _crDelete(id) {
  if (!confirm('Delete this change request?')) return;
  await fetch('/api/change-requests/' + id, { method: 'DELETE' });
  await _crFetch();
}

// ── Add form ─────────────────────────────────────────────────
async function addCR() {
  const title       = document.getElementById('cr-title')?.value.trim();
  const description = document.getElementById('cr-description')?.value.trim();
  const projectId   = document.getElementById('cr-proj')?.value;
  const budgetRaw   = document.getElementById('cr-budget')?.value.trim();
  const requestedBy = document.getElementById('cr-requested-by')?.value.trim();

  if (!title || !description || !projectId) {
    msg('cr-msg', 'Title, description and project are required.', 'error');
    return;
  }

  const body = {
    title, description, projectId,
    budgetImpact: budgetRaw ? parseFloat(budgetRaw) : 0,
    ...(requestedBy ? { requestedBy } : {}),
  };

  const res = await fetch('/api/change-requests', { method: 'POST', body: JSON.stringify(body) });
  if (res.ok) {
    msg('cr-msg', 'Change request logged.', 'ok');
    document.getElementById('cr-title').value        = '';
    document.getElementById('cr-description').value  = '';
    document.getElementById('cr-budget').value        = '';
    document.getElementById('cr-requested-by').value  = '';
    document.getElementById('cr-proj').value          = '';
    await _crFetch();
  } else {
    const err = await res.json().catch(() => ({}));
    msg('cr-msg', err.message || 'Failed to log change request.', 'error');
  }
}

// ── Filter controls ──────────────────────────────────────────
function setCRStatusFilter(status) {
  _crStatusFilter = status;
  // Update filter button styles
  ['ALL', 'PENDING', 'APPROVED', 'REJECTED'].forEach(s => {
    const btn = document.getElementById('cr-filter-' + s.toLowerCase());
    if (!btn) return;
    btn.classList.toggle('bg-panel', s === status);
    btn.classList.toggle('text-ink',  s === status);
    btn.classList.toggle('text-muted', s !== status);
  });
  _crRenderList();
}
