// ══════════════════════════════════════════════════════════════
// SALES HUB — pipeline board + add lead
// Depends on: $, msg, esc, coBadge, matchesFilter  (index.html)
// ══════════════════════════════════════════════════════════════

const LEAD_STATUS_LABEL = {
  QUALIFICATION: 'Qualification',
  PROPOSAL:      'Proposal',
  NEGOTIATION:   'Negotiation',
  WON:           'Won',
  LOST:          'Lost',
};
const LEAD_STATUS_CLS = {
  QUALIFICATION: 'bg-sky-500/15 border-sky-500/30 text-sky-400',
  PROPOSAL:      'bg-yellow-500/15 border-yellow-500/30 text-yellow-400',
  NEGOTIATION:   'bg-purple-500/15 border-purple-500/30 text-purple-400',
  WON:           'bg-emerald-500/15 border-emerald-500/30 text-emerald-400',
  LOST:          'bg-warm/15 border-warm/30 text-warm',
};
const LEAD_PRI_CLS = {
  VERY_HIGH: 'text-warm font-bold',
  HIGH:      'text-yellow-400 font-semibold',
  MEDIUM:    'text-accent',
  LOW:       'text-muted',
};
const PIPELINE_STAGES = ['QUALIFICATION', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST'];

let _salesAccounts = [];
let _salesPeople   = [];

async function initSalesTab() {
  [_salesAccounts, _salesPeople] = await Promise.all([
    fetch('/api/accounts').then(r => r.json()).catch(() => []),
    fetch('/api/people').then(r => r.json()).catch(() => []),
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
      _salesPeople.filter(p => !p.warmPool)
        .map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('');
  }
}

async function loadSales() {
  const leads = await fetch('/api/leads').then(r => r.json()).catch(() => []);
  renderSalesPipeline(leads);
}

function renderSalesPipeline(leads) {
  const filtered = leads.filter(l => matchesFilter(l.company));

  // Stats strip
  const active = filtered.filter(l => !['WON','LOST'].includes(l.status));
  const won    = filtered.filter(l => l.status === 'WON');
  const pipeline = active.reduce((s, l) => s + (l.estimatedValue || 0), 0);
  const wonValue  = won.reduce((s, l) => s + (l.estimatedValue || 0), 0);

  $('sales-stats').innerHTML =
    `<span class="text-ink font-semibold">${active.length}</span><span class="text-muted"> active leads</span>` +
    ` <span class="text-line mx-2">·</span> ` +
    `<span class="text-ink font-semibold">RM ${pipeline.toLocaleString('en-MY')}</span><span class="text-muted"> pipeline value</span>` +
    ` <span class="text-line mx-2">·</span> ` +
    `<span class="text-emerald-400 font-semibold">${won.length} won</span>` +
    ` <span class="text-line mx-2">·</span> ` +
    `<span class="text-emerald-400 font-semibold">RM ${wonValue.toLocaleString('en-MY')}</span><span class="text-muted"> closed</span>`;

  // Pipeline columns
  const byStage = {};
  for (const s of PIPELINE_STAGES) byStage[s] = [];
  for (const l of filtered) { if (byStage[l.status]) byStage[l.status].push(l); }

  $('sales-board').innerHTML =
    `<div class="grid grid-cols-1 sm:grid-cols-3 xl:grid-cols-5 gap-3">` +
    PIPELINE_STAGES.map(stage => {
      const cls   = LEAD_STATUS_CLS[stage];
      const items = byStage[stage];
      const total = items.reduce((s, l) => s + (l.estimatedValue || 0), 0);

      return `<div class="flex flex-col gap-2">
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

  $('sales-board').querySelectorAll('[data-lead-convert]').forEach(b => {
    b.onclick = () => convertLead(b.dataset.leadConvert);
  });

  $('sales-board').querySelectorAll('[data-lead-del]').forEach(b => {
    b.onclick = () => deleteLead(b.dataset.leadDel);
  });
}

function renderLeadCard(l) {
  const priCls  = LEAD_PRI_CLS[l.priority]  || 'text-muted';
  const val     = l.estimatedValue ? `RM ${Number(l.estimatedValue).toLocaleString('en-MY')}` : '—';
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
    : (l.projectId ? `<p class="text-[11px] text-emerald-400 mt-1.5">✓ Project created</p>` : '');

  const statusSel = PIPELINE_STAGES.map(s =>
    `<option value="${s}"${l.status === s ? ' selected' : ''}>${LEAD_STATUS_LABEL[s]}</option>`
  ).join('');

  return `<div class="bg-panel2 border border-line rounded-xl p-3 space-y-1.5">
    <div class="flex items-start justify-between gap-1">
      <p class="text-xs font-semibold text-ink leading-snug flex-1">${esc(l.name)}</p>
      <button class="btn-del shrink-0 text-[11px]" data-lead-del="${l.id}">×</button>
    </div>
    <p class="text-[11px] text-muted">${accName}</p>
    <div class="flex items-center gap-1.5">
      <span class="text-xs ${priCls}">${l.priority.replace('_', ' ')}</span>
      <span class="text-line">·</span>
      <span class="text-xs text-ink font-semibold">${val}</span>
    </div>
    ${l.closedBy ? `<p class="text-[11px] text-muted">by ${esc(l.closedBy.name)}</p>` : ''}
    ${payBadge}
    <select data-lead-status="${l.id}"
      class="w-full mt-1 bg-panel border border-line text-ink px-2 py-1 rounded-md text-xs
             focus:outline-none focus:border-accent/70 cursor-pointer">
      ${statusSel}
    </select>
    ${convertBtn}
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
    msg($('sales-msg'), `Project "${project.name}" created. Switch to Projects tab to configure it.`, 'ok');
    loadSales();
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
