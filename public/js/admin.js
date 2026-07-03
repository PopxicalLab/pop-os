// ══════════════════════════════════════════════════════════════
// ADMIN — Audit Log viewer
// Depends on: $, msg, esc  (index.html)
// ══════════════════════════════════════════════════════════════

const ACTION_CLS = {
  CREATE: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  UPDATE: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  DELETE: 'bg-warm/15 text-warm border-warm/30',
};

let _auditUsers = [];
let _auditPage  = 1;

async function initAdminTab() {
  _auditUsers = await fetch('/api/users').then(r => r.json()).catch(() => []);
  const sel = $('audit-actor-filter');
  if (sel) {
    sel.innerHTML = '<option value="">All users</option>' +
      _auditUsers.map(u => `<option value="${u.id}">${esc(u.name)}</option>`).join('');
  }

  // Populate year picker from 2026 to current year.
  const currentYear = new Date().getFullYear();
  const yearSel = $('audit-year-filter');
  if (yearSel) {
    yearSel.innerHTML = '<option value="">All years</option>' +
      Array.from({ length: currentYear - 2025 }, (_, i) => currentYear - i)
        .map(y => `<option value="${y}"${y === currentYear ? ' selected' : ''}>${y}</option>`).join('');
    // Default: apply current year to date inputs.
    applyYearFilter(currentYear);
  }
}

function applyYearFilter(year) {
  const start = $('audit-start-date');
  const end   = $('audit-end-date');
  if (!start || !end) return;
  if (year) {
    start.value = `${year}-01-01`;
    end.value   = `${year}-12-31`;
  } else {
    start.value = '';
    end.value   = '';
  }
}

function onAuditYearChange() {
  const year = $('audit-year-filter')?.value;
  applyYearFilter(year ? Number(year) : null);
  loadAuditLog(1);
}

async function loadAuditLog(page = 1) {
  _auditPage = page;
  const params = new URLSearchParams();
  const resource  = $('audit-resource-filter')?.value;
  const action    = $('audit-action-filter')?.value;
  const actorId   = $('audit-actor-filter')?.value;
  const startDate = $('audit-start-date')?.value;
  const endDate   = $('audit-end-date')?.value;
  const search    = $('audit-search')?.value?.trim();

  if (resource)  params.set('resource',  resource);
  if (action)    params.set('action',    action);
  if (actorId)   params.set('actorId',   actorId);
  if (startDate) params.set('startDate', startDate);
  if (endDate)   params.set('endDate',   endDate);
  if (search)    params.set('search',    search);
  params.set('page', String(page));

  const data = await fetch('/api/audit?' + params).then(r => r.json()).catch(() => ({ total: 0, logs: [], pages: 1 }));
  renderAuditLog(data);
}

function renderAuditLog({ total, page, pages, logs }) {
  $('audit-total').textContent = `${total.toLocaleString()} events`;

  if (!logs.length) {
    $('audit-table-body').innerHTML = '<tr><td colspan="6" class="text-center text-muted py-8 text-xs">No events match the current filters.</td></tr>';
    $('audit-pagination').innerHTML = '';
    return;
  }

  $('audit-table-body').innerHTML = logs.map(log => {
    const ts    = new Date(log.createdAt);
    const date  = ts.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    const time  = ts.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const actCls = ACTION_CLS[log.action] || 'bg-line/30 text-muted border-line';
    const after  = log.after ? JSON.stringify(log.after, null, 2) : null;

    return `<tr class="border-b border-line hover:bg-panel2/50 transition-colors">
      <td class="px-3 py-2.5 text-[11px] text-muted whitespace-nowrap">
        <span class="text-ink">${date}</span><br>${time}
      </td>
      <td class="px-3 py-2.5">
        <p class="text-xs font-medium text-ink">${esc(log.actorName)}</p>
        <p class="text-[11px] text-muted">${esc(log.actorRole)}</p>
      </td>
      <td class="px-3 py-2.5">
        <span class="badge border text-[11px] ${actCls}">${log.action}</span>
      </td>
      <td class="px-3 py-2.5">
        <p class="text-xs text-ink">${esc(log.resource)}</p>
        ${log.resourceLabel ? `<p class="text-[11px] text-muted">${esc(log.resourceLabel)}</p>` : ''}
      </td>
      <td class="px-3 py-2.5 text-[11px] text-muted font-mono max-w-[120px] truncate" title="${esc(log.resourceId)}">${esc(log.resourceId)}</td>
      <td class="px-3 py-2.5">
        ${after ? `<button onclick="toggleAuditDetail(this)" data-detail='${esc(after)}'
            class="text-[11px] text-accent hover:underline cursor-pointer">View</button>` : '<span class="text-[11px] text-muted">—</span>'}
      </td>
    </tr>
    <tr class="audit-detail-row hidden border-b border-line">
      <td colspan="6" class="px-3 pb-3">
        <pre class="text-[11px] text-muted bg-bg rounded-lg p-3 overflow-x-auto max-h-48 overflow-y-auto"></pre>
      </td>
    </tr>`;
  }).join('');

  // Pagination
  const paginationHtml = pages <= 1 ? '' : Array.from({ length: pages }, (_, i) => i + 1).map(p =>
    `<button onclick="loadAuditLog(${p})"
       class="px-2.5 py-1 text-[11px] rounded-md border ${p === page
         ? 'bg-accent/15 border-accent/30 text-accent'
         : 'border-line text-muted hover:text-ink hover:border-accent/30'} transition-colors cursor-pointer">
       ${p}
     </button>`
  ).join('');
  $('audit-pagination').innerHTML = paginationHtml;
}

function toggleAuditDetail(btn) {
  const row = btn.closest('tr').nextElementSibling;
  const pre = row.querySelector('pre');
  const isHidden = row.classList.contains('hidden');
  row.classList.toggle('hidden', !isHidden);
  if (!isHidden) return;
  try { pre.textContent = JSON.stringify(JSON.parse(btn.dataset.detail), null, 2); }
  catch { pre.textContent = btn.dataset.detail; }
  btn.textContent = 'Hide';
}

function resetAuditFilters() {
  ['audit-resource-filter','audit-action-filter','audit-actor-filter','audit-search'].forEach(id => {
    const el = $(id); if (el) el.value = '';
  });
  // Reset to current year (not blank — blank = all time, which can be huge).
  const currentYear = new Date().getFullYear();
  const yearSel = $('audit-year-filter');
  if (yearSel) yearSel.value = String(currentYear);
  applyYearFilter(currentYear);
  loadAuditLog(1);
}
