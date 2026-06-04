// ══════════════════════════════════════════════════════════════
// CAPACITY BOARD
// Depends on: $, msg, esc  (index.html shared script)
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

  // Person dropdown — active staff only (not warm pool).
  // 100% = full weekday schedule; 101–140 = includes approved weekend days.
  // Disable completely at 140% (genuinely no capacity left).
  const pSel   = $('cap-person');
  const curPer = pSel.value;
  pSel.innerHTML = '<option value="">— select —</option>' +
    people
      .filter(p => !p.warmPool)
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

  renderCapacityBoard(entries);
}

function renderCapacityBoard(entries) {
  const board = $('cap-board');

  // Filter by the active company — based on the project's company so that
  // cross-company (lent) people still appear when their project matches.
  const visible = entries.filter(e => matchesFilter(e.project.company));

  if (!visible.length) {
    board.innerHTML = '<div class="text-center text-muted text-sm py-10">No allocations this week — add one on the left.</div>';
    return;
  }

  // Group by person, preserving order from API (sorted by name asc).
  const byPerson = {};
  for (const e of visible) {
    if (!byPerson[e.personId]) byPerson[e.personId] = { person: e.person, entries: [] };
    byPerson[e.personId].entries.push(e);
  }
  const groups = Object.values(byPerson);
  for (const g of groups) {
    g.total = g.entries.reduce((s, e) => s + e.pctWeek, 0);
  }

  let html = '<div class="overflow-x-auto -mx-5 px-5"><table class="w-full text-sm">';
  html += `<thead><tr class="border-b border-line">
    <th class="text-left pb-3 px-2 text-[11px] font-semibold uppercase tracking-wider text-muted">Person</th>
    <th class="text-left pb-3 px-2 text-[11px] font-semibold uppercase tracking-wider text-muted">Project</th>
    <th class="text-left pb-3 px-2 text-[11px] font-semibold uppercase tracking-wider text-muted">Role</th>
    <th class="text-right pb-3 px-2 text-[11px] font-semibold uppercase tracking-wider text-muted">%</th>
    <th class="pb-3 px-2"></th>
  </tr></thead><tbody>`;

  for (const g of groups) {
    const totalCls = g.total > 100 ? 'text-warm font-bold'
                   : g.total >= 80  ? 'text-accent font-semibold'
                   :                  'text-muted';
    const barCls   = g.total > 100 ? 'bg-warm' : g.total >= 80 ? 'bg-accent' : 'bg-muted/50';
    // Scale the bar against 140 when weekend work is present; 100 otherwise.
    const hasWeekend = g.entries.some(e => e.weekendApproved);
    const barPct     = Math.min((g.total / (hasWeekend ? 140 : 100)) * 100, 100);

    html += `<tr class="bg-panel2/50 border-t border-line">
      <td class="px-2 py-2.5" colspan="3">
        <div class="flex items-center gap-2.5">
          <span class="font-semibold text-sm text-ink">${esc(g.person.name)}</span>
          <span class="text-xs text-muted">${esc(g.person.role)}</span>
        </div>
      </td>
      <td class="px-2 py-2.5 text-right">
        <span class="text-sm ${totalCls}">${g.total}%</span>
      </td>
      <td class="px-2 py-2.5">
        <div class="w-16 h-1.5 bg-line rounded-full overflow-hidden">
          <div class="h-full ${barCls} rounded-full" style="width:${barPct}%"></div>
        </div>
      </td>
    </tr>`;

    for (const e of g.entries) {
      const roleCls      = e.role === 'MAIN' ? 'text-accent' : 'text-muted';
      const roleLabel    = e.role === 'MAIN' ? 'Main' : 'Support';
      const weekendBadge = e.weekendApproved
        ? '<span class="ml-1.5 text-[10px] font-semibold uppercase tracking-wide text-warm border border-warm/40 rounded px-1 py-0.5">Weekend</span>'
        : '';
      html += `<tr class="border-b border-line/40 hover:bg-panel2/30 transition-colors">
        <td class="py-2.5 px-2"></td>
        <td class="py-2.5 px-2 text-ink">${esc(e.project.name)}${coBadge(e.project.company)}${weekendBadge}</td>
        <td class="py-2.5 px-2"><span class="text-xs ${roleCls}">${roleLabel}</span></td>
        <td class="py-2.5 px-2 text-right text-muted text-xs">${e.pctWeek}%</td>
        <td class="py-2.5 px-2"><button class="btn-del" data-cap-del="${e.id}">Remove</button></td>
      </tr>`;
    }
  }

  html += '</tbody></table></div>';
  board.innerHTML = html;

  board.querySelectorAll('[data-cap-del]').forEach(b => {
    b.onclick = () => removeAllocation(b.dataset.capDel);
  });
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
