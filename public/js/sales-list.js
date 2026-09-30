// ══════════════════════════════════════════════════════════════
// SALES — LIST VIEW (Airtable-style grid)
//
// One row per lead, like the old Airtable "All opportunities" view, with
// most cells editable in place (each change PATCHes /api/leads/:id and is
// audit-logged like any other lead edit). Click a name → the Job page.
//
// Columns can be shown / hidden per user (⚙ Columns). The choice is saved in
// this browser under the logged-in user's id — so two people sharing a
// computer each keep their own, but it doesn't follow you to another device.
//
// Data: _allLeads / _salesPeople from sales.js (loaded by loadSales()).
// Depends on: $, esc, msg, coBadge, matchesFilter, LEAD_STATUS_LABEL,
//             LEAD_STATUS_CLS, QUADRANT_LABEL, QUADRANT_CLS, STATUS_LABEL (shared.js)
// ══════════════════════════════════════════════════════════════

const SL_PRIORITY_LABEL = { VERY_HIGH: 'Very high', HIGH: 'High', MEDIUM: 'Medium', LOW: 'Low' };
// Same steps as the Airtable "Payment Status" options (and the Job page).
const SL_INVOICED_STEPS = [0, 30, 50, 70, 100];
const SL_PAID_STEPS     = [0, 20, 25, 30, 40, 50, 60, 70, 80, 100];

const slDate  = d => d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' }) : '';
const slIso   = d => d ? new Date(d).toISOString().split('T')[0] : '';
// One-line text cut to `px` wide with "…"; hover shows the full text.
const slClip = (text, px) =>
  `<span class="block truncate" style="max-width:${px}px" title="${esc(text)}">${esc(text)}</span>`;

const slInput = 'w-full bg-transparent border border-transparent hover:border-line focus:border-accent/60 ' +
                'rounded px-1 py-0.5 text-xs text-ink focus:outline-none cursor-pointer';

// An in-place editor. `field` is the lead field PATCHed on change; `kind`
// says how to convert the input's value (see onSalesListChange).
function slSelect(l, field, kind, options, current, labelOf = v => v, allowBlank = false) {
  return `<select data-lead="${l.id}" data-field="${field}" data-kind="${kind}" class="${slInput}">
    ${allowBlank ? `<option value="">—</option>` : ''}
    ${options.map(v => `<option value="${v}"${String(current ?? '') === String(v) ? ' selected' : ''}>${labelOf(v)}</option>`).join('')}
  </select>`;
}

// ── column catalogue ─────────────────────────────────────────
// def  = shown until the user changes it.  sort = value to sort by.
// First block mirrors the Airtable view; the rest are Pop OS extras.
const SALES_LIST_COLS = [
  { id: 'status',   label: 'Status',      def: true,
    sort: l => PIPELINE_STAGES.indexOf(l.status),
    cell: l => slSelect(l, 'status', 'str', PIPELINE_STAGES, l.status, s => LEAD_STATUS_LABEL[s]) },
  { id: 'priority', label: 'Priority',    def: true,
    sort: l => Object.keys(SL_PRIORITY_LABEL).indexOf(l.priority),
    cell: l => slSelect(l, 'priority', 'str', Object.keys(SL_PRIORITY_LABEL), l.priority, p => SL_PRIORITY_LABEL[p]) },
  { id: 'account',  label: 'Account',     def: true,
    sort: l => l.account?.name?.toLowerCase() ?? '',
    cell: l => l.account ? slClip(l.account.name, 130) : '<span class="text-muted">—</span>' },
  { id: 'contact',  label: 'Contact',     def: true,
    sort: l => l.contact?.name?.toLowerCase() ?? '',
    cell: l => l.contact ? slClip(l.contact.name, 110) : '<span class="text-muted">—</span>' },
  { id: 'closedBy', label: 'Sales PIC',   def: true,
    sort: l => l.closedBy?.name?.toLowerCase() ?? '',
    cell: l => {
      // Keep a departed closer selectable so the cell still shows who it was.
      const people = _salesPeople.filter(p => p.status === 'ACTIVE' || p.id === l.closedById);
      return `<select data-lead="${l.id}" data-field="closedById" data-kind="str" class="${slInput}">
        <option value="">—</option>
        ${people.map(p => `<option value="${p.id}"${p.id === l.closedById ? ' selected' : ''}>${esc(p.name)}</option>`).join('')}
      </select>`;
    } },
  { id: 'completed', label: 'Done',       def: true,
    sort: l => l.completed ? 1 : 0,
    cell: l => `<input type="checkbox" data-lead="${l.id}" data-field="completed" data-kind="bool"
                  ${l.completed ? 'checked' : ''} class="accent-accent cursor-pointer" />` },
  { id: 'value',    label: 'Value',       def: true, right: true,
    sort: l => l.estimatedValue ?? -1,
    cell: l => `<input type="number" min="0" step="100" data-lead="${l.id}" data-field="estimatedValue" data-kind="num"
                  value="${l.estimatedValue ?? ''}" placeholder="—" class="${slInput} text-right w-24" />` },
  { id: 'invoiced', label: 'Invoiced',    def: true,
    sort: l => l.invoicedPct,
    cell: l => slSelect(l, 'invoicedPct', 'int', SL_INVOICED_STEPS, l.invoicedPct, v => v ? v + '%' : '—') },
  { id: 'paid',     label: 'Paid',        def: true,
    sort: l => l.paidPct,
    cell: l => slSelect(l, 'paidPct', 'int', SL_PAID_STEPS, l.paidPct, v => v ? v + '%' : '—') },
  { id: 'paymentDate', label: 'Paid on',     def: true,
    sort: l => l.paymentDate ? new Date(l.paymentDate).getTime() : 0,
    cell: l => `<input type="date" data-lead="${l.id}" data-field="paymentDate" data-kind="date"
                  value="${slIso(l.paymentDate)}" class="${slInput}" />` },

  // ── Pop OS extras (not in Airtable) ──
  { id: 'company',  label: 'Company',     def: true,
    sort: l => l.company ?? '',
    cell: l => slSelect(l, 'company', 'str', ['LPS', 'PXL', 'GROUP'], l.company, c => c === 'GROUP' ? 'Group' : c, true) },
  { id: 'quadrant', label: 'PPM',         def: true,
    sort: l => l.quadrant ?? '',
    // Read-only here — PPM is assessed on the Job page (Drain approvals etc).
    cell: l => l.quadrant
      ? jobQuadrantBadge(l)
      : '<a href="/job.html?id=' + l.id + '" class="text-[11px] text-muted hover:text-accent">assess →</a>' },
  { id: 'project',  label: 'Project',     def: true,
    sort: l => l.project?.status ?? '',
    cell: l => l.project
      ? `<a href="/projects.html?open=${l.project.id}" class="text-[11px] text-accent hover:underline whitespace-nowrap">${STATUS_LABEL[l.project.status] || l.project.status}</a>`
      : '<span class="text-muted">—</span>' },
  { id: 'wonAt',    label: 'Won on',      def: false,
    sort: l => l.wonAt ? new Date(l.wonAt).getTime() : 0,
    cell: l => slDate(l.wonAt) || '<span class="text-muted">—</span>' },
  { id: 'created',  label: 'Created',     def: false,
    sort: l => new Date(l.createdAt).getTime(),
    cell: l => slDate(l.createdAt) },
];

// ── per-user column visibility ───────────────────────────────

function salesColsKey() {
  let id = '';
  try { id = JSON.parse(localStorage.getItem('pop-os-user') || '{}').id || ''; } catch {}
  return 'pop-os-sales-cols-' + id;
}

// Saved as { visible: [ids], known: [ids] }. `known` = the columns that
// existed when the user last saved, so a column added in a future release
// shows by its default instead of looking like one the user hid.
function getSalesColVis() {
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(salesColsKey()) || 'null'); } catch {}
  const vis = {};
  for (const c of SALES_LIST_COLS) {
    vis[c.id] = saved && saved.known?.includes(c.id)
      ? saved.visible.includes(c.id)
      : c.def;
  }
  return vis;
}

function setSalesColVis(vis) {
  const data = {
    visible: SALES_LIST_COLS.filter(c => vis[c.id]).map(c => c.id),
    known:   SALES_LIST_COLS.map(c => c.id),
  };
  try { localStorage.setItem(salesColsKey(), JSON.stringify(data)); } catch {}
}

function toggleSalesColPicker(e) {
  e.stopPropagation();
  const picker = $('sales-col-picker');
  if (!picker.classList.contains('hidden')) { picker.classList.add('hidden'); return; }
  const vis = getSalesColVis();
  picker.innerHTML = `
    <p class="text-[10px] font-semibold uppercase tracking-widest text-muted mb-1">Show columns</p>
    ${SALES_LIST_COLS.map(c => `
      <label class="flex items-center gap-2 text-xs text-ink cursor-pointer">
        <input type="checkbox" data-col="${c.id}" ${vis[c.id] ? 'checked' : ''} class="accent-accent cursor-pointer" /> ${c.label}
      </label>`).join('')}
    <button onclick="resetSalesCols()" class="text-[11px] text-muted hover:text-accent mt-1 cursor-pointer">Reset to default</button>`;
  picker.querySelectorAll('[data-col]').forEach(cb => {
    cb.onchange = () => {
      const v = getSalesColVis();
      v[cb.dataset.col] = cb.checked;
      setSalesColVis(v);
      renderSalesList();
    };
  });
  picker.classList.remove('hidden');
  // Close when clicking anywhere outside the picker.
  setTimeout(() => document.addEventListener('click', function close(ev) {
    if (!picker.contains(ev.target)) { picker.classList.add('hidden'); document.removeEventListener('click', close); }
  }), 0);
}

function resetSalesCols() {
  try { localStorage.removeItem(salesColsKey()); } catch {}
  $('sales-col-picker').classList.add('hidden');
  renderSalesList();
}

// ── sorting ──────────────────────────────────────────────────

let _salesListSort = { col: null, dir: 1 };   // null = newest first (as loaded)

function sortSalesList(colId) {
  _salesListSort = _salesListSort.col === colId
    ? { col: colId, dir: -_salesListSort.dir }
    : { col: colId, dir: 1 };
  renderSalesList();
}

// ── render ───────────────────────────────────────────────────

function renderSalesList() {
  const el = $('sales-list');
  if (!el) return;

  const search = ($('sales-list-search')?.value || '').toLowerCase();
  let leads = (_allLeads || []).filter(l => {
    if (!matchesFilter(l.company)) return false;
    if (!search) return true;
    return [l.name, l.account?.name, l.contact?.name, l.closedBy?.name]
      .filter(Boolean).join(' ').toLowerCase().includes(search);
  });

  if (_salesListSort.col) {
    const col = _salesListSort.col === 'name'
      ? { sort: l => l.name.toLowerCase() }
      : SALES_LIST_COLS.find(c => c.id === _salesListSort.col);
    leads = [...leads].sort((a, b) => {
      const x = col.sort(a), y = col.sort(b);
      return (x < y ? -1 : x > y ? 1 : 0) * _salesListSort.dir;
    });
  }

  const vis  = getSalesColVis();
  const cols = SALES_LIST_COLS.filter(c => vis[c.id]);
  const arrow = id => _salesListSort.col === id ? (_salesListSort.dir === 1 ? ' ↑' : ' ↓') : '';
  const th = (id, label, right = false) =>
    `<th onclick="sortSalesList('${id}')"
        class="pb-2 px-1.5 font-medium whitespace-nowrap cursor-pointer hover:text-ink select-none ${right ? 'text-right' : 'text-left'}">${label}${arrow(id)}</th>`;

  if (!leads.length) {
    el.innerHTML = '<p class="text-sm text-muted text-center py-10">No leads match.</p>';
    return;
  }

  const total = leads.reduce((s, l) => s + (l.estimatedValue || 0), 0);
  el.innerHTML = `
    <table class="w-full text-xs">
      <thead><tr class="text-[11px] text-muted border-b border-line">
        ${th('name', 'Opportunity')}
        ${cols.map(c => th(c.id, c.label, c.right)).join('')}
      </tr></thead>
      <tbody>
        ${leads.map(l => `
          <tr class="border-b border-line/40 last:border-0 hover:bg-panel2/60">
            <td class="py-1.5 px-1.5">
              <a href="/job.html?id=${l.id}" title="${esc(l.name)}"
                 class="block truncate max-w-[200px] text-ink font-semibold hover:text-accent">${esc(l.name)}</a>
            </td>
            ${cols.map(c => `<td class="py-1.5 px-1.5 ${c.right ? 'text-right' : ''}">${c.cell(l)}</td>`).join('')}
          </tr>`).join('')}
      </tbody>
      <tfoot><tr class="text-[11px] text-muted">
        <td class="pt-2 px-1.5">${leads.length} lead${leads.length === 1 ? '' : 's'}</td>
        ${cols.map(c => `<td class="pt-2 px-1.5 ${c.right ? 'text-right' : ''}">${c.id === 'value' ? 'RM ' + Math.round(total).toLocaleString('en-MY') : ''}</td>`).join('')}
      </tr></tfoot>
    </table>`;
}

// ── in-place edits ───────────────────────────────────────────
// One delegated listener for every editable cell: PATCH the field, then
// reload so the board, chart, stats and this list all agree.
async function onSalesListChange(e) {
  const t = e.target.closest('[data-lead][data-field]');
  if (!t) return;
  const { lead: id, field, kind } = t.dataset;
  let value;
  if (kind === 'bool')      value = t.checked;
  else if (kind === 'num')  value = t.value === '' ? null : Number(t.value);
  else if (kind === 'int')  value = Number(t.value);
  else if (kind === 'date') { if (!t.value) return; value = t.value; }   // clearing a date isn't supported by the API
  else                      value = t.value || null;

  const res = await fetch('/api/leads/' + id, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ [field]: value }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    msg($('sales-msg'), [].concat(err.message || 'Save failed').join(', '), 'err');
  }
  loadSales();
}

$('sales-list')?.addEventListener('change', onSalesListChange);
$('sales-list-search')?.addEventListener('input', renderSalesList);
