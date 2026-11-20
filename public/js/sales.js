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

// 'chart' (default), 'board' or 'list' — which sub-tab of the right-hand panel is showing.
// (The List view itself lives in sales-list.js.)
let _salesSubTab = ['board', 'list'].includes(localStorage.getItem('pop-os-sales-subtab'))
  ? localStorage.getItem('pop-os-sales-subtab') : 'chart';

function setSalesSubTab(tab) {
  _salesSubTab = tab;
  localStorage.setItem('pop-os-sales-subtab', tab);
  applySalesSubTab();
}

function applySalesSubTab() {
  const on = 'bg-accent text-bg font-semibold', off = 'text-muted hover:text-ink';
  for (const t of ['chart', 'board', 'list']) {
    $('sales-subtab-' + t).className = 'px-2.5 py-1 rounded-md cursor-pointer transition-colors ' + (_salesSubTab === t ? on : off);
    $('sales-pane-' + t).classList.toggle('hidden', _salesSubTab !== t);
  }
  applySalesLayout();
  // A hidden chart can't be scrolled — jump to the newest months once it shows.
  const scroller = $('sales-chart-scroll');
  if (_salesSubTab === 'chart' && scroller) scroller.scrollLeft = scroller.scrollWidth;
}

// The List and Pipeline views need every pixel for their columns: they go
// full width and fold the Add-a-lead form away — it's brought back with the
// "+ Add lead" button in their toolbar (any button marked
// data-sales-add-toggle). The chart keeps the normal form-on-the-left layout.
let _salesAddOpen = false;

function applySalesLayout() {
  const wide    = _salesSubTab === 'list' || _salesSubTab === 'board';
  const showAdd = !wide || _salesAddOpen;
  $('sales-layout').className = 'mx-auto px-5 py-6 grid grid-cols-1 gap-5 items-start '
    + (wide ? 'max-w-none ' : 'max-w-7xl ')
    + (showAdd ? 'lg:grid-cols-[280px_1fr]' : '');
  $('sales-add-panel').classList.toggle('hidden', !showAdd);
  document.querySelectorAll('[data-sales-add-toggle]').forEach(btn =>
    btn.textContent = _salesAddOpen ? '× Close form' : '+ Add lead');
}

function toggleSalesAddPanel() {
  _salesAddOpen = !_salesAddOpen;
  applySalesLayout();
  // On phones the panel is also folded — open it, or this tap would only show the bar.
  if (_salesAddOpen) foldOpen($('sales-add-panel'));
}

// "Leads over time" chart: see sales-chart.js.

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

  _salesAccounts.sort((a, b) => a.name.localeCompare(b.name));
  const accSel = $('lead-account');
  if (accSel) {
    accSel.innerHTML = accountOptionsHtml('');
    // "＋ New client…" in the Add-a-lead form: create it, then select it.
    accSel.onchange = async () => {
      if (accSel.value !== NEW_ACCOUNT) return;
      const acc = await createAccountInline($('lead-company')?.value || null);
      accSel.innerHTML = accountOptionsHtml(acc?.id || '');
    };
  }

  const picSel = $('lead-closed-by');
  if (picSel) {
    picSel.innerHTML = '<option value="">— unassigned —</option>' +
      _salesPeople.filter(p => p.status === 'ACTIVE')
        .map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('');
  }
}

// ── client (account) picker ──────────────────────────────────
// One picker used in three places: the Add-a-lead form, each kanban card,
// and the List view's Account column. The first option, "＋ New client…",
// creates a client on the spot; it's added to _salesAccounts in memory, so
// every picker on the page offers it straight away — no page refresh.

const NEW_ACCOUNT = '__new__';

function accountOptionsHtml(selectedId) {
  return `<option value="${NEW_ACCOUNT}">＋ New client…</option>` +
    '<option value=""' + (selectedId ? '' : ' selected') + '>— no client —</option>' +
    _salesAccounts.map(a => `<option value="${a.id}"${a.id === selectedId ? ' selected' : ''}>${esc(a.name)}</option>`).join('');
}

// Ask for a name and create the client. If one with the same name already
// exists, reuse it instead of making a duplicate. Returns the account, or
// null if cancelled / failed.
async function createAccountInline(company) {
  _creatingAccount = true;   // the prompt steals focus — don't let refreshClientLists() fire mid-create
  const name = (prompt('New client name:') || '').trim();
  _creatingAccount = false;
  if (!name) return null;
  const existing = _salesAccounts.find(a => a.name.toLowerCase() === name.toLowerCase());
  if (existing) { toast(`"${esc(existing.name)}" already exists — selected it.`); return existing; }

  const res = await fetch('/api/accounts', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, company: company && company !== 'ALL' ? company : undefined }),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    toast(esc([].concat(e.message || 'Could not create client').join(', ')), 'err');
    return null;
  }
  const acc = await res.json();
  _salesAccounts.push(acc);
  _salesAccounts.sort((a, b) => a.name.localeCompare(b.name));
  // Keep the Add-a-lead form's picker current too (keep its selection).
  const formSel = $('lead-account');
  if (formSel) formSel.innerHTML = accountOptionsHtml(formSel.value === NEW_ACCOUNT ? '' : formSel.value);
  // Pop-up (visible from the cards, the List view or the form) pointing to
  // the Clients page to fill in industry, size, contacts… New tab, so Sales
  // stays put. The link is only shown if this role can open Clients.
  toast(`Client <b>${esc(acc.name)}</b> created.` + (canAccessTab('clients')
    ? ` <a href="/clients.html?open=${acc.id}" target="_blank" rel="noopener" class="text-accent underline font-semibold whitespace-nowrap">Add details on the Clients page →</a>`
    : ''), 'ok', 15000);
  return acc;
}

// Coming back to Sales (switching back to this browser tab, or clicking
// into this window after editing a client on the Clients page beside it):
// reload the client list quietly so every picker is current. Only
// re-renders if something actually changed, and at most every 3 seconds.
let _creatingAccount = false, _lastClientRefresh = 0;
async function refreshClientLists() {
  if (_creatingAccount || !$('lead-account') || Date.now() - _lastClientRefresh < 3000) return;
  _lastClientRefresh = Date.now();
  const fresh = await fetch('/api/accounts').then(r => r.ok ? r.json() : null).catch(() => null);
  if (!fresh) return;
  fresh.sort((a, b) => a.name.localeCompare(b.name));
  const sig = list => list.map(a => a.id + ':' + a.name).join('|');
  if (sig(fresh) === sig(_salesAccounts)) return;
  _salesAccounts = fresh;
  const formSel = $('lead-account');
  formSel.innerHTML = accountOptionsHtml(formSel.value === NEW_ACCOUNT ? '' : formSel.value);
  loadSales();   // cards + list re-render with the renamed / new clients
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') refreshClientLists(); });
window.addEventListener('focus', refreshClientLists);

// A lead's client changed (card or List view). The contact belongs to the
// old client, so it's cleared. The server also moves the project's client.
async function onLeadAccountChange(sel, leadId) {
  const lead = _allLeads.find(l => l.id === leadId);
  let accountId = sel.value || null;
  if (accountId === NEW_ACCOUNT) {
    const acc = await createAccountInline(lead?.company || null);
    if (!acc) { sel.innerHTML = accountOptionsHtml(lead?.accountId || ''); return; }
    accountId = acc.id;
  }
  if (lead && accountId === (lead.accountId || null)) { loadSales(); return; }
  const body = { accountId };
  if (lead?.contactId) body.contactId = null;
  const res = await fetch('/api/leads/' + leadId, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    toast(esc([].concat(e.message || 'Save failed').join(', ')), 'err');
  }
  loadSales();
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
    `<span class="text-ink font-semibold">${fmtMoney(pipeline)}</span><span class="text-muted"> pipeline value</span>` +
    ` <span class="text-line mx-2">·</span> ` +
    `<span class="text-emerald-400 font-semibold">${won.length} won</span>` +
    ` <span class="text-line mx-2">·</span> ` +
    `<span class="text-emerald-400 font-semibold">${fmtMoney(wonValue)}</span><span class="text-muted"> closed</span>` +
    ` <span class="text-line mx-2">·</span> ` +
    `<span class="text-slate-400 font-semibold">${completed.length}</span><span class="text-muted"> completed</span>`;

  renderSalesChart(filtered);
  renderSalesList();   // List view (sales-list.js) — has its own search box

  // Pipeline columns
  const byStage = {};
  for (const s of PIPELINE_STAGES) byStage[s] = [];
  for (const l of filtered) { if (byStage[l.status]) byStage[l.status].push(l); }

  // Board layout, Trello-style:
  // - Wide screens (xl+): all six stages side by side in a grid, as before.
  // - Phones / tablets: stages stay in ONE horizontal row. Swipe left/right
  //   to move between stages (scroll-snap stops each column neatly at the
  //   left edge, and the next column peeks in so you know there's more).
  //   Each column has a capped height and scrolls its own cards, so the
  //   board never grows downward — you never scroll the page to see a stage.
  $('sales-board').innerHTML =
    `<div class="flex gap-3 overflow-x-auto snap-x snap-mandatory overscroll-x-contain -mx-5 px-5 pb-2
                 xl:grid xl:grid-cols-6 xl:overflow-visible xl:mx-0 xl:px-0 xl:pb-0">` +
    PIPELINE_STAGES.map(stage => {
      const cls   = LEAD_STATUS_CLS[stage];
      const items = byStage[stage];
      const total = items.reduce((s, l) => s + (l.estimatedValue || 0), 0);

      return `<div class="flex flex-col gap-2 rounded-xl transition-colors
                          w-[80vw] max-w-[300px] shrink-0 snap-start bg-panel2/40 p-2
                          xl:w-auto xl:max-w-none xl:bg-transparent xl:p-0" data-stage-drop="${stage}">
        <div class="flex items-center justify-between mb-1">
          <span class="badge border ${cls} text-[11px]">${LEAD_STATUS_LABEL[stage]}</span>
          <span class="text-[11px] text-muted">${items.length}</span>
        </div>
        ${total > 0 ? `<p class="text-[11px] text-muted -mt-1 mb-1">${fmtMoney(total)}</p>` : ''}
        <div class="flex flex-col gap-2 max-h-[65dvh] overflow-y-auto overscroll-contain
                    xl:max-h-none xl:overflow-visible">
          ${items.length ? items.map(l => renderLeadCard(l)).join('') : '<p class="text-xs text-muted text-center py-4">—</p>'}
        </div>
      </div>`;
    }).join('') +
    `</div>`;

  // Status can be changed two ways: the per-card dropdown (some people prefer
  // it) or dragging the card between columns (below). Both PATCH the same field.
  $('sales-board').querySelectorAll('[data-lead-account]').forEach(sel => {
    sel.onchange = () => onLeadAccountChange(sel, sel.dataset.leadAccount);
  });

  $('sales-board').querySelectorAll('[data-lead-status]').forEach(sel => {
    sel.onchange = async () => {
      await fetch(`/api/leads/${sel.dataset.leadStatus}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: sel.value }),
      });
      loadSales();
    };
  });

  // Wire up the inline "closed by" dropdown.
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
  // (PATCH /api/leads/:id with the new status). Dragging within a column just
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

  $('sales-board').querySelectorAll('[data-doc-unlink]').forEach(b => {
    b.onclick = () => unlinkLeadDoc(b.dataset.docUnlink, b.dataset.docNo);
  });
}

// Detach a wrongly linked quotation / invoice from its lead. The document
// stays in Autocount and in Pop OS (Financial still counts it) — it can be
// linked again from the Job page.
async function unlinkLeadDoc(docId, docNo) {
  if (!confirm(`Unlink ${docNo} from this lead?\n\nIt stays in Autocount — it just won't belong to this lead any more. You can link it again from the Job page.`)) return;
  const res = await fetch(`/api/autocount/documents/${docId}/link`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ leadId: null }),
  });
  if (res.ok) { toast(`${esc(docNo)} unlinked`); loadSales(); }
  else toast('Unlink failed', 'err');
}

function renderLeadCard(l) {
  const priCls  = LEAD_PRI_CLS[l.priority]  || 'text-muted';

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
        ? (canAccessTab('projects')
            ? `<a href="/projects.html?open=${l.projectId}" class="block text-[11px] text-emerald-400 mt-1.5 hover:underline cursor-pointer">✓ ${esc(l.project?.name || 'Project created')}</a>`
            : `<p class="text-[11px] text-emerald-400 mt-1.5">✓ ${esc(l.project?.name || 'Project created')}</p>`)
        : '');

  // Show existing document badges (quotations + invoices — a lead can carry
  // several of each, e.g. milestone billing) + always allow pushing another quote.
  const docs = l.accountingDocuments || [];
  const docBadges = docs.map(d => {
    const statusCls = d.status === 'VOID' ? 'text-muted line-through' : d.status === 'PAID' ? 'text-emerald-400' : 'text-sky-400';
    const icon = d.docType === 'SALES_INVOICE' ? '🧾' : '📄';
    const due = d.dueDate ? ` · due ${new Date(d.dueDate).toLocaleDateString('en-GB',{day:'numeric',month:'short'})}` : '';
    // × detaches a wrongly linked document (Autocount itself is not changed).
    return `<span class="flex items-center gap-1">
        <span class="${statusCls} text-[11px] flex-1 min-w-0 truncate">${icon} ${esc(d.docNo)}${due}</span>
        <button class="text-muted hover:text-warm text-xs leading-none px-1 cursor-pointer" title="Unlink ${esc(d.docNo)} from this lead"
                data-doc-unlink="${d.id}" data-doc-no="${esc(d.docNo)}">×</button>
      </span>`;
  }).join('');

  const quotationBtn = ['PROPOSAL', 'NEGOTIATION', 'WON', 'COMPLETED'].includes(l.status)
    ? `<div class="mt-1 space-y-0.5">
         ${docBadges}
         <button class="w-full text-[11px] bg-sky-500/15 border border-sky-500/30 text-sky-400
                        px-2 py-1 rounded-lg hover:bg-sky-500/25 transition-colors cursor-pointer mt-1"
                 data-lead-quote="${l.id}" data-lead-name="${esc(l.name)}" data-debtor="${esc(l.account?.autocountDebtorCode || '')}">
           ↑ Push quotation
         </button>
         <a href="/job.html?id=${encodeURIComponent(l.id)}&link=1"
            class="block text-center text-[11px] text-muted hover:text-ink mt-1">🔗 Link existing quotation</a>
       </div>`
    : '';

  // PPM is assessed on the job page, ideally at Proposal / Negotiation —
  // before the quote goes out — so a Drain is caught before committing.
  // Assessed → quadrant badge (+ Drain gate status); not yet → a nudge.
  const drainPending = l.quadrant === 'DRAIN' && !(l.drainApprovedByExec && l.drainApprovedByProducer);
  const ppmLine = l.quadrant
    ? `<div class="flex items-center gap-1.5 flex-wrap">
         ${jobQuadrantBadge(l)}
         ${drainPending ? '<span class="text-[10px] text-warm font-semibold">needs approval</span>' : ''}
         <a href="/job.html?id=${l.id}" draggable="false" class="text-[11px] text-accent hover:underline ml-auto">Open job →</a>
       </div>`
    : ['PROPOSAL', 'NEGOTIATION'].includes(l.status)
      ? `<a href="/job.html?id=${l.id}" draggable="false"
            class="inline-block text-[11px] text-yellow-400 font-semibold hover:underline">Assess (PPM) →</a>`
      : `<a href="/job.html?id=${l.id}" draggable="false"
            class="inline-block text-[11px] text-accent hover:underline">Open job →</a>`;

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
    <select data-lead-account="${l.id}" draggable="false" title="Client"
      class="w-full -mx-0.5 bg-transparent border border-transparent hover:border-line focus:border-accent/70
             rounded px-0.5 py-0.5 text-[11px] ${l.accountId ? 'text-muted' : 'text-muted/60'} focus:outline-none cursor-pointer truncate">
      ${accountOptionsHtml(l.accountId || '')}
    </select>
    ${ppmLine}
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
    <select data-lead-status="${l.id}" draggable="false" title="Status"
      class="w-full mt-1 bg-panel border border-line text-ink px-2 py-1 rounded-md text-xs
             focus:outline-none focus:border-accent/70 cursor-pointer">
      ${PIPELINE_STAGES.map(s => `<option value="${s}"${l.status === s ? ' selected' : ''}>${LEAD_STATUS_LABEL[s]}</option>`).join('')}
    </select>
    <select data-lead-closed-by="${l.id}"
      class="w-full mt-1 bg-panel border border-line text-muted px-2 py-1 rounded-md text-xs
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
      accountId:  [NEW_ACCOUNT, ''].includes($('lead-account').value) ? undefined : $('lead-account').value,
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
    foldAfterSave($('sales-add-panel'), 'Lead added.');   // phones: fold the form away
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
