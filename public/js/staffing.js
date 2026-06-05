// ══════════════════════════════════════════════════════════════
// STAFFING RECOMMENDER
// Depends on: $, msg, esc, coBadge  (index.html)
//             QUADRANT_CLS, QUADRANT_LABEL  (projects.js)
// ══════════════════════════════════════════════════════════════

// Week helpers (duplicated from capacity.js to keep files independent).
function staffingGetMonday(d) {
  const day  = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  const mon  = new Date(d);
  mon.setUTCDate(d.getUTCDate() + diff);
  mon.setUTCHours(0, 0, 0, 0);
  return mon;
}
function staffingISODate(d) { return d.toISOString().slice(0, 10); }
function staffingFmtWeek(mon) {
  const fri = new Date(mon);
  fri.setUTCDate(mon.getUTCDate() + 4);
  const fmt = d => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  return fmt(mon) + ' – ' + fmt(fri);
}

// Current week shown in the staffing view.
let _staffWeek = staffingGetMonday(new Date());

function staffingShiftWeek(delta) {
  _staffWeek = new Date(_staffWeek);
  _staffWeek.setUTCDate(_staffWeek.getUTCDate() + delta * 7);
  $('staff-week-label').textContent = staffingFmtWeek(_staffWeek);
  loadStaffingCandidates();
}

// Populate the project selector when the Staffing tab first loads.
async function initStaffingTab() {
  const projects = await fetch('/api/projects').then(r => r.json()).catch(() => []);
  const sel = $('staff-project');
  const active = projects.filter(p => !['DELIVERED', 'CANCELLED', 'ON_HOLD'].includes(p.status));
  sel.innerHTML = '<option value="">— select a project —</option>' +
    active
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(p => `<option value="${p.id}">${esc(p.name)}</option>`)
      .join('');
}

async function loadStaffingCandidates() {
  const projectId = $('staff-project').value;
  $('staff-week-label').textContent = staffingFmtWeek(_staffWeek);

  if (!projectId) {
    $('staff-results').innerHTML =
      '<div class="text-center text-muted text-sm py-10">Select a project to see candidate recommendations.</div>';
    return;
  }

  $('staff-results').innerHTML =
    '<div class="text-center text-muted text-sm py-10">Loading…</div>';

  const url  = `/api/staffing/recommend?projectId=${projectId}&weekStart=${staffingISODate(_staffWeek)}`;
  const data = await fetch(url).then(r => r.json()).catch(() => null);

  if (!data || !data.candidates) {
    $('staff-results').innerHTML =
      '<div class="text-center text-muted text-sm py-10">Failed to load candidates.</div>';
    return;
  }

  renderStaffingResults(data);
}

function ratingDots(n) {
  let h = '<span class="inline-flex gap-0.5 items-center">';
  for (let i = 1; i <= 5; i++)
    h += `<span class="w-1.5 h-1.5 rounded-full ${i <= n ? 'bg-accent' : 'bg-line'}"></span>`;
  return h + '</span>';
}

function availBar(pct) {
  const used   = 100 - pct;
  const barCls = pct === 0 ? 'bg-warm' : pct < 30 ? 'bg-yellow-500' : 'bg-accent';
  return `<div class="flex items-center gap-2">
    <div class="w-20 h-2 bg-line rounded-full overflow-hidden">
      <div class="h-full bg-panel2 rounded-full" style="width:${Math.min(used,100)}%"></div>
    </div>
    <div class="w-20 h-2 bg-line rounded-full overflow-hidden -ml-20 absolute">
    </div>
    <div class="w-20 h-2 bg-line rounded-full overflow-hidden relative">
      <div class="h-full ${barCls} rounded-full" style="width:${Math.min(pct,100)}%"></div>
    </div>
    <span class="text-xs font-semibold ${pct === 0 ? 'text-warm' : pct < 30 ? 'text-yellow-400' : 'text-accent'}">${Math.round(pct)}% free</span>
  </div>`;
}

function renderStaffingResults(data) {
  const { project, weekStart, candidates } = data;

  const qLabel = (typeof QUADRANT_LABEL !== 'undefined' ? QUADRANT_LABEL : {})[project.quadrant] || project.quadrant;
  const qCls   = (typeof QUADRANT_CLS   !== 'undefined' ? QUADRANT_CLS   : {})[project.quadrant] || 'bg-panel2 text-muted';

  let html = `<div class="mb-4 pb-4 border-b border-line flex items-center gap-2 flex-wrap">
    <span class="text-sm font-semibold text-ink">${esc(project.name)}</span>
    <span class="badge ${qCls}">${qLabel}</span>
    ${coBadge(project.company)}
  </div>`;

  if (!candidates.length) {
    html += '<div class="text-center text-muted text-sm py-8">No active staff found.</div>';
    $('staff-results').innerHTML = html;
    return;
  }

  html += candidates.map(c => {
    const assignedBadge = c.alreadyAssigned
      ? '<span class="badge bg-accent/15 text-accent ml-1">On project</span>'
      : '';
    const unavailable = c.availablePct === 0
      ? '<span class="badge bg-warm/15 text-warm ml-1">Fully booked</span>'
      : '';

    const skillChips = c.skills.length
      ? c.skills.map(s =>
          `<span class="inline-flex items-center gap-1 px-2 py-0.5 bg-panel2 border border-line rounded-full text-xs text-ink">
            ${esc(s.name)} ${ratingDots(s.rating)}
          </span>`
        ).join('')
      : '<span class="text-xs text-muted">No skills recorded</span>';

    return `<div class="py-4 border-b border-line/60 last:border-0">
      <div class="flex items-start justify-between gap-3 flex-wrap">
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-1.5 flex-wrap">
            <span class="text-sm font-semibold text-ink">${esc(c.person.name)}</span>
            <span class="text-xs text-muted">${esc(c.person.role)}</span>
            ${coBadge(c.person.company)}
            ${assignedBadge}${unavailable}
          </div>
          <div class="flex flex-wrap gap-1.5 mt-2">${skillChips}</div>
        </div>
        <div class="shrink-0 text-right">
          ${availBar(c.availablePct)}
          ${c.allocatedPct > 0 ? `<p class="text-[11px] text-muted mt-1">${Math.round(c.allocatedPct)}% committed</p>` : ''}
        </div>
      </div>
    </div>`;
  }).join('');

  $('staff-results').innerHTML = html;
}

// Wire up the project selector — runs inline since this script loads after the DOM.
(function () {
  const sel = $('staff-project');
  if (sel) sel.addEventListener('change', loadStaffingCandidates);
})();
