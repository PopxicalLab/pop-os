// ══════════════════════════════════════════════════════════════
// SALES HUB — pipeline board + add lead
// Depends on: $, msg, esc, coBadge, matchesFilter  (index.html)
// ══════════════════════════════════════════════════════════════

const LEAD_STATUS_LABEL = {
  QUALIFICATION: 'Qualification',
  PROPOSAL:      'Proposal',
  NEGOTIATION:   'Negotiation',
  WON:           'Won',
  COMPLETED:     'Completed',
  LOST:          'Lost',
};
const LEAD_STATUS_CLS = {
  QUALIFICATION: 'bg-sky-500/15 border-sky-500/30 text-sky-400',
  PROPOSAL:      'bg-yellow-500/15 border-yellow-500/30 text-yellow-400',
  NEGOTIATION:   'bg-purple-500/15 border-purple-500/30 text-purple-400',
  WON:           'bg-emerald-500/15 border-emerald-500/30 text-emerald-400',
  COMPLETED:     'bg-slate-500/15 border-slate-500/30 text-slate-400',
  LOST:          'bg-warm/15 border-warm/30 text-warm',
};
const LEAD_PRI_CLS = {
  VERY_HIGH: 'text-warm font-bold',
  HIGH:      'text-yellow-400 font-semibold',
  MEDIUM:    'text-accent',
  LOW:       'text-muted',
};
const PIPELINE_STAGES = ['QUALIFICATION', 'PROPOSAL', 'NEGOTIATION', 'WON', 'COMPLETED', 'LOST'];

let _salesAccounts = [];
let _salesPeople   = [];
let _autocountDebtors = [];
let _allLeads = []; // full cache — search filters client-side
let _dragGhost = null; // placeholder bar shown at the drop position while dragging a lead card

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
    : (l.projectId ? `<p class="text-[11px] text-emerald-400 mt-1.5">✓ Project created</p>` : '');

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
      <p class="text-xs font-semibold text-ink leading-snug flex-1">${esc(l.name)}</p>
      <button class="btn-del shrink-0 text-[11px]" data-lead-del="${l.id}">×</button>
    </div>
    <p class="text-[11px] text-muted">${accName}</p>
    <div class="flex items-center gap-1.5">
      <span class="text-xs ${priCls}">${l.priority.replace('_', ' ')}</span>
      <span class="text-line">·</span>
      <span class="text-xs text-muted">RM</span>
      <input type="text" inputmode="decimal" data-lead-value="${l.id}" value="${l.estimatedValue ?? ''}"
        placeholder="—" title="Estimated amount"
        class="w-20 bg-transparent border-b border-transparent hover:border-line focus:border-accent/70
               text-xs text-ink font-semibold focus:outline-none px-0.5" />
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
    loadSales(); // refresh the board so the card shows "✓ Project created"
    switchTab('projects');
    showProjectDetail(project.id); // jump straight to the new project's detail view
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
