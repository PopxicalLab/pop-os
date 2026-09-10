// ══════════════════════════════════════════════════════════════
// CAPACITY BOARD
// Depends on: $, msg, esc  (shared.js)
// ══════════════════════════════════════════════════════════════

// Snap any Date to the Monday of its ISO week at UTC midnight.
function getMondayOf(d) {
  const day  = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  const mon  = new Date(d);
  mon.setUTCDate(d.getUTCDate() + diff);
  mon.setUTCHours(0, 0, 0, 0);
  return mon;
}

function toISODate(d) { return d.toISOString().slice(0, 10); }

function fmtWeekRange(mon) {
  const fri = new Date(mon);
  fri.setUTCDate(mon.getUTCDate() + 4);
  const fmt = (d) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  return fmt(mon) + ' – ' + fmt(fri) + ' ' + fri.getUTCFullYear();
}

// The week currently shown on the board. Starts at the current Monday.
let _capWeek    = getMondayOf(new Date());
// Running totals per personId for the displayed week — kept in sync by loadCapacityBoard.
let _weekTotals = {};

function shiftWeek(delta) {
  _capWeek = new Date(_capWeek);
  _capWeek.setUTCDate(_capWeek.getUTCDate() + delta * 7);
  loadCapacityBoard();
}

async function loadCapacityBoard() {
  // STAFF: hide the add-allocation form and remove buttons (read-only view)
  const addPanel = $('add-allocation-panel');
  if (addPanel) addPanel.classList.toggle('hidden', isStaff());

  $('cap-week-label').textContent = fmtWeekRange(_capWeek);

  const [people, projects, entries] = await Promise.all([
    fetch('/api/people').then(r => r.json()),
    fetch('/api/projects').then(r => r.json()),
    fetch('/api/capacity?week=' + toISODate(_capWeek)).then(r => r.json()),
  ]);

  // Sum up each person's committed % for this week from the current entries.
  _weekTotals = {};
  for (const e of entries) {
    _weekTotals[e.personId] = (_weekTotals[e.personId] || 0) + e.pctWeek;
  }
  const weekTotals = _weekTotals;

  // Cached separately from the dropdown — used to compute who has NO
  // allocation at all this week (the "Unallocated" strip below the board).
  _capAllPeople = people.filter(p => p.status === 'ACTIVE');

  // Person dropdown — active staff only (not warm pool).
  // 100% = full weekday schedule; 101–140 = includes approved weekend days.
  // Disable completely at 140% (genuinely no capacity left).
  const pSel   = $('cap-person');
  const curPer = pSel.value;
  pSel.innerHTML = '<option value="">— select —</option>' +
    people
      .filter(p => p.status === 'ACTIVE')
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(p => {
        const used      = weekTotals[p.id] || 0;
        const remaining = 100 - used;
        const label     = used === 0   ? `${esc(p.name)} — free`
                        : used >= 140  ? `${esc(p.name)} — full (incl. weekend)`
                        : used >= 100  ? `${esc(p.name)} — weekend only (${140 - used}% left)`
                        :                `${esc(p.name)} — ${remaining}% left`;
        const disabled  = used >= 140 ? ' disabled' : '';
        return `<option value="${p.id}"${p.id === curPer ? ' selected' : ''}${disabled}>${label}</option>`;
      })
      .join('');

  // Project dropdown — active projects only.
  const prSel   = $('cap-project');
  const curProj = prSel.value;
  prSel.innerHTML = '<option value="">— select —</option>' +
    projects
      .filter(p => !['DELIVERED', 'CANCELLED', 'ON_HOLD'].includes(p.status))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(p => `<option value="${p.id}"${p.id === curProj ? ' selected' : ''}>${esc(p.name)}</option>`)
      .join('');

  if (_capPendingProjectName) {
    const f = $('cap-filter-project');
    if (f) f.value = _capPendingProjectName;
    _capPendingProjectName = null;
  }
  renderCapacityBoard(entries);
}

let _capAllEntries = []; // full cache — filters apply client-side
let _capAllPeople  = []; // full ACTIVE people cache, for the "Unallocated this week" strip
// 'person' (default) or 'project' — which column the board groups rows under.
let _capGroupBy    = localStorage.getItem('pop-os-cap-groupby') === 'project' ? 'project' : 'person';
// Collapsed group keys, e.g. "person:<id>" / "project:<id>" — lets a 30+
// person board collapse down to just summary rows instead of one giant list.
let _capCollapsed  = new Set();

function setCapGroupBy(mode) {
  _capGroupBy = mode;
  localStorage.setItem('pop-os-cap-groupby', mode);
  _capCollapsed.clear(); // group keys are mode-specific; stale collapse state would be meaningless
  renderCapacityBoard();
}

function toggleCapGroup(key) {
  _capCollapsed.has(key) ? _capCollapsed.delete(key) : _capCollapsed.add(key);
  renderCapacityBoard();
}

// Collapse/expand every group currently on screen in one click.
function toggleAllCapGroups() {
  const keys = window._capVisibleGroupKeys || [];
  const anyExpanded = keys.some(k => !_capCollapsed.has(k));
  keys.forEach(k => anyExpanded ? _capCollapsed.add(k) : _capCollapsed.delete(k));
  renderCapacityBoard();
}
// Pre-fill the project filter when arriving via a "View in Capacity" link
// from the Projects page (capacity.html?project=<name>). Read once at load
// and cleared after use, same as the old same-page switchTab() handoff did.
let _capPendingProjectName = new URLSearchParams(location.search).get('project');

function renderCapacityBoard(entries) {
  if (entries) _capAllEntries = entries; // refresh cache when called from loadCapacityBoard
  const board = $('cap-board');

  // Group-by toggle button active states.
  const personBtn  = $('cap-group-person');
  const projectBtn = $('cap-group-project');
  if (personBtn && projectBtn) {
    const on  = 'bg-accent text-bg font-semibold';
    const off = 'text-muted hover:text-ink';
    personBtn.className  = 'px-2.5 py-1 rounded-md cursor-pointer transition-colors ' + (_capGroupBy === 'person'  ? on : off);
    projectBtn.className = 'px-2.5 py-1 rounded-md cursor-pointer transition-colors ' + (_capGroupBy === 'project' ? on : off);
  }

  const personQ  = ($('cap-filter-person')?.value  || '').toLowerCase();
  const projectQ = ($('cap-filter-project')?.value || '').toLowerCase();

  // Filter by company, then optional person/project text search.
  const visible = _capAllEntries.filter(e => {
    if (!matchesFilter(e.project.company)) return false;
    if (personQ  && !e.person.name.toLowerCase().includes(personQ))   return false;
    if (projectQ && !e.project.name.toLowerCase().includes(projectQ)) return false;
    return true;
  });

  renderCapUnallocated(personQ);

  if (!visible.length) {
    board.innerHTML = '<div class="text-center text-muted text-sm py-10">No allocations this week — add one on the left.</div>';
    window._capVisibleGroupKeys = [];
    return;
  }

  const byProject = _capGroupBy === 'project';

  // Group by whichever dimension is active, preserving API order (name asc).
  const groupsByKey = {};
  for (const e of visible) {
    const rawKey = byProject ? e.projectId : e.personId;
    if (!groupsByKey[rawKey]) {
      groupsByKey[rawKey] = byProject
        ? { key: 'project:' + rawKey, label: e.project.name, company: e.project.company, sub: null, entries: [] }
        : { key: 'person:'  + rawKey, label: e.person.name,  company: null, sub: e.person.role, entries: [] };
    }
    groupsByKey[rawKey].entries.push(e);
  }
  const groupList = Object.values(groupsByKey);
  for (const g of groupList) g.total = g.entries.reduce((s, e) => s + e.pctWeek, 0);
  window._capVisibleGroupKeys = groupList.map(g => g.key);

  let html = '<div class="overflow-x-auto -mx-5 px-5"><table class="w-full text-sm">';
  html += `<thead><tr class="border-b border-line">
    <th class="text-left pb-3 px-2 text-[11px] font-semibold uppercase tracking-wider text-muted">${byProject ? 'Project' : 'Person'}</th>
    <th class="text-left pb-3 px-2 text-[11px] font-semibold uppercase tracking-wider text-muted">${byProject ? 'Person' : 'Project'}</th>
    <th class="text-left pb-3 px-2 text-[11px] font-semibold uppercase tracking-wider text-muted">Role</th>
    <th class="text-right pb-3 px-2 text-[11px] font-semibold uppercase tracking-wider text-muted">%</th>
    <th class="pb-3 px-2"></th>
  </tr></thead><tbody>`;

  for (const g of groupList) {
    const collapsed = _capCollapsed.has(g.key);

    // Person grouping: the total is a real "% of week used" — show the
    // usual capacity bar. Project grouping: summing % across different
    // people isn't a percentage of anything single, so show headcount
    // instead of implying a capacity-used bar that doesn't apply.
    let totalCell, barCell;
    if (byProject) {
      totalCell = `<span class="text-sm text-ink">${g.entries.length} ${g.entries.length === 1 ? 'person' : 'people'}</span>`;
      barCell   = '';
    } else {
      const totalCls   = g.total > 100 ? 'text-warm font-bold' : g.total >= 80 ? 'text-accent font-semibold' : 'text-muted';
      const barCls     = g.total > 100 ? 'bg-warm' : g.total >= 80 ? 'bg-accent' : 'bg-muted/50';
      const hasWeekend = g.entries.some(e => e.weekendApproved);
      const barPct     = Math.min((g.total / (hasWeekend ? 140 : 100)) * 100, 100);
      totalCell = `<span class="text-sm ${totalCls}">${g.total}%</span>`;
      barCell   = `<div class="w-16 h-1.5 bg-line rounded-full overflow-hidden">
          <div class="h-full ${barCls} rounded-full" style="width:${barPct}%"></div>
        </div>`;
    }

    html += `<tr class="bg-panel2/50 border-t border-line cursor-pointer hover:bg-panel2/70 transition-colors" data-cap-group-toggle="${g.key}">
      <td class="px-2 py-2.5" colspan="3">
        <div class="flex items-center gap-2">
          <span class="text-muted text-[10px] w-3 inline-block">${collapsed ? '▸' : '▾'}</span>
          <span class="font-semibold text-sm text-ink">${esc(g.label)}</span>
          ${g.company ? coBadge(g.company) : ''}
          ${g.sub ? `<span class="text-xs text-muted">${esc(g.sub)}</span>` : ''}
        </div>
      </td>
      <td class="px-2 py-2.5 text-right">${totalCell}</td>
      <td class="px-2 py-2.5">${barCell}</td>
    </tr>`;

    if (collapsed) continue;

    for (const e of g.entries) {
      const roleCls      = e.role === 'MAIN' ? 'text-accent' : 'text-muted';
      const roleLabel    = e.role === 'MAIN' ? 'Main' : 'Support';
      const weekendBadge = e.weekendApproved
        ? '<span class="ml-1.5 text-[10px] font-semibold uppercase tracking-wide text-warm border border-warm/40 rounded px-1 py-0.5">Weekend</span>'
        : '';
      const otherCell = byProject
        ? `<span class="text-ink">${esc(e.person.name)}</span>`
        : `<a href="/projects.html?open=${e.project.id}" class="hover:text-accent transition-colors">${esc(e.project.name)}</a>${coBadge(e.project.company)}`;

      html += `<tr class="border-b border-line/40 hover:bg-panel2/30 transition-colors">
        <td class="py-2.5 px-2"></td>
        <td class="py-2.5 px-2 text-ink">${otherCell}${weekendBadge}</td>
        <td class="py-2.5 px-2"><span class="text-xs ${roleCls}">${roleLabel}</span></td>
        <td class="py-2.5 px-2 text-right">
          ${isStaff()
            ? `<span class="text-muted text-xs">${e.pctWeek}%</span>`
            : `<input type="text" inputmode="decimal" data-cap-pct="${e.id}" value="${e.pctWeek}"
                 title="Click to change this allocation's % of the week"
                 class="w-11 bg-transparent border-b border-transparent hover:border-line focus:border-accent/70
                        text-right text-xs text-muted font-semibold focus:outline-none px-0.5" />%`}
        </td>
        ${isStaff() ? '<td></td>' : `<td class="py-2.5 px-2"><button class="btn-del" data-cap-del="${e.id}">Remove</button></td>`}
      </tr>`;
    }
  }

  html += '</tbody></table></div>';
  board.innerHTML = html;

  board.querySelectorAll('[data-cap-del]').forEach(b => {
    b.onclick = (ev) => { ev.stopPropagation(); removeAllocation(b.dataset.capDel); };
  });
  board.querySelectorAll('[data-cap-pct]').forEach(inp => {
    inp.onclick  = (ev) => ev.stopPropagation(); // don't collapse the group when editing %
    inp.onchange = () => updateAllocationPct(inp);
  });
  board.querySelectorAll('[data-cap-group-toggle]').forEach(row => {
    row.onclick = () => toggleCapGroup(row.dataset.capGroupToggle);
  });

  const toggleAllBtn = $('cap-toggle-all');
  if (toggleAllBtn) {
    const anyExpanded = groupList.some(g => !_capCollapsed.has(g.key));
    toggleAllBtn.textContent = anyExpanded ? 'Collapse all' : 'Expand all';
  }
}

// Anyone ACTIVE with no allocation at all this week (any company/project) —
// answers "who's free right now" at a glance instead of forcing a scan of
// every row for an absence.
function renderCapUnallocated(personQ) {
  const el = $('cap-unallocated');
  if (!el) return;

  const allocatedIds = new Set(_capAllEntries.map(e => e.personId));
  const free = _capAllPeople
    .filter(p => matchesFilter(p.company))
    .filter(p => !allocatedIds.has(p.id))
    .filter(p => !personQ || p.name.toLowerCase().includes(personQ))
    .sort((a, b) => (a.company || '').localeCompare(b.company || '') || a.name.localeCompare(b.name));

  el.innerHTML = free.length
    ? free.map(p => `<span class="badge bg-panel2 border border-line text-muted text-xs">${esc(p.name)}${coBadge(p.company)}</span>`).join('')
    : '<span class="text-xs text-muted">Everyone active is allocated this week.</span>';
}

// Inline-editable % cell — PATCH on blur/enter. Reverts on failure.
// Pushing the person over 100% for the week requires weekend approval
// (server-enforced) — this editor has no checkbox for that up front, so
// on that specific rejection it asks via confirm() and retries with
// weekendApproved:true, same effect as ticking the box on the add form.
async function updateAllocationPct(inp) {
  const id      = inp.dataset.capPct;
  const entry   = _capAllEntries.find(e => e.id === id);
  const raw     = inp.value.trim();
  const pctWeek = Number(raw);

  if (!entry) return;
  if (raw === '' || isNaN(pctWeek) || pctWeek < 1 || pctWeek > 140) {
    inp.value = entry.pctWeek;
    msg($('cap-msg'), 'Enter a value between 1 and 140.', 'err');
    return;
  }
  if (pctWeek === entry.pctWeek) return;

  const result = await patchAllocation(id, { pctWeek });

  if (result.ok) {
    msg($('cap-msg'), 'Allocation updated.', 'ok');
    loadCapacityBoard();
    return;
  }

  // Two distinct server messages land here — "requires weekend approval"
  // (this edit alone pushes >100%) and "...max 100%)" (fine alone, but
  // combined with the person's other allocations it isn't) — both are
  // exactly the cases weekend approval (cap 140 instead of 100) fixes.
  const needsWeekend = /weekend approval|\(max 100%\)/i.test(result.message) && !entry.weekendApproved;
  if (needsWeekend && confirm(`${result.message}\n\nApprove weekend work to allow this?`)) {
    const retry = await patchAllocation(id, { pctWeek, weekendApproved: true });
    if (retry.ok) {
      msg($('cap-msg'), 'Allocation updated (weekend approved).', 'ok');
      loadCapacityBoard();
      return;
    }
    inp.value = entry.pctWeek;
    msg($('cap-msg'), retry.message, 'err');
    return;
  }

  inp.value = entry.pctWeek;
  msg($('cap-msg'), result.message, 'err');
}

async function patchAllocation(id, body) {
  const res = await fetch(`/api/capacity/${id}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (res.ok) return { ok: true };
  const e = await res.json().catch(() => ({}));
  return { ok: false, message: [].concat(e.message || 'Failed').join(', ') };
}

async function addAllocation() {
  const personId       = $('cap-person').value;
  const projectId      = $('cap-project').value;
  const role           = $('cap-role').value;
  const pctWeek        = parseFloat($('cap-pct').value);
  const weekendApproved = $('cap-weekend').checked;
  const msgEl          = $('cap-msg');

  if (!personId)      { msg(msgEl, 'Select a person.',       'err'); return; }
  if (!projectId)     { msg(msgEl, 'Select a project.',      'err'); return; }
  if (isNaN(pctWeek)) { msg(msgEl, '% of week is required.', 'err'); return; }
  const personTotal = _weekTotals[personId] || 0;
  if ((personTotal + pctWeek > 100) && !weekendApproved) {
    msg(msgEl, 'Check "Weekend approved by producer" — this allocation exceeds 100% for the week.', 'err');
    return;
  }

  const res = await fetch('/api/capacity', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ personId, projectId, weekStart: toISODate(_capWeek), role, pctWeek, weekendApproved }),
  });

  if (res.ok) {
    $('cap-pct').value     = '';
    $('cap-weekend').checked = false;
    $('cap-weekend-row').classList.add('hidden');
    msg(msgEl, 'Allocation added.', 'ok');
    loadCapacityBoard();
  } else {
    const e = await res.json().catch(() => ({}));
    msg(msgEl, [].concat(e.message || 'Failed').join(', '), 'err');
  }
}

async function removeAllocation(id) {
  if (!confirm('Remove this allocation?')) return;
  await fetch('/api/capacity/' + id, { method: 'DELETE' });
  loadCapacityBoard();
}

// Show the weekend-approval row when this allocation would push the person over 100%.
function updateWeekendRowVisibility() {
  const personId    = $('cap-person').value;
  const pct         = parseFloat($('cap-pct').value);
  const personTotal = _weekTotals[personId] || 0;
  const wouldExceed = !isNaN(pct) && (personTotal + pct > 100);
  $('cap-weekend-row').classList.toggle('hidden', !wouldExceed);
  if (!wouldExceed) $('cap-weekend').checked = false;
}
$('cap-pct').addEventListener('input', updateWeekendRowVisibility);
$('cap-person').addEventListener('change', updateWeekendRowVisibility);

$('cap-add').addEventListener('click', addAllocation);

// Wire up capacity filter inputs — re-render from cache without re-fetching.
['cap-filter-person', 'cap-filter-project'].forEach(id => {
  const el = $(id);
  if (el) el.addEventListener('input', () => renderCapacityBoard());
});
