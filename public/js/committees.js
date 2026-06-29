// ══════════════════════════════════════════════════════════════
// COMMITTEES — HR module
// Manages studio committees, membership, activities, and attendance.
// Depends on: $, esc, msg, coBadge, isAdmin (index.html / people.js)
// ══════════════════════════════════════════════════════════════

let COMMITTEES     = [];   // full list from API
let ACTIVE_CMTE_ID = null; // currently open committee
let CURRENT_CMTE   = null; // full detail of the currently open committee

// isAdmin may be defined in people.js (loaded before this file).
function _cmteIsAdmin() {
  try { return JSON.parse(localStorage.getItem('pop-os-user') || '{}').role === 'ADMIN'; } catch { return false; }
}

const CMTE_ROLE_LABEL = { CHAIR: 'Chair', SECRETARY: 'Secretary', MEMBER: 'Member' };
const CMTE_ROLE_CLS   = {
  CHAIR:     'bg-yellow-500/15 text-yellow-400',
  SECRETARY: 'bg-sky-500/15 text-sky-400',
  MEMBER:    'bg-zinc-500/15 text-zinc-400',
};

function cmteDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

function tenureDays(from, to) {
  const end = to ? new Date(to) : new Date();
  return Math.floor((end.getTime() - new Date(from).getTime()) / 86_400_000);
}

function tenureLabel(days) {
  if (days < 30)  return `${days}d`;
  if (days < 365) return `${Math.floor(days / 30)}mo`;
  const yr = Math.floor(days / 365);
  const mo = Math.floor((days % 365) / 30);
  return mo > 0 ? `${yr}yr ${mo}mo` : `${yr}yr`;
}

// ── main load ─────────────────────────────────────────────────

async function loadCommittees() {
  const result = await fetch('/api/committees').then(r => r.json()).catch(() => []);
  COMMITTEES = Array.isArray(result) ? result : [];

  // Hide create panel for non-admins
  const cp = $('cmte-create-panel');
  if (cp) cp.style.display = _cmteIsAdmin() ? '' : 'none';

  renderCommitteeList();
  updateStats();

  // Reopen previously selected committee if still present
  if (ACTIVE_CMTE_ID && COMMITTEES.find(c => c.id === ACTIVE_CMTE_ID)) {
    openCommittee(ACTIVE_CMTE_ID);
  } else {
    $('cmte-detail').innerHTML = `
      <div class="bg-panel border border-line rounded-xl p-10 text-center text-muted text-sm">
        Select a committee to view details.
      </div>`;
  }
}

function updateStats() {
  const active   = COMMITTEES.filter(c => c.active).length;
  const inactive = COMMITTEES.filter(c => !c.active).length;
  const totalM   = COMMITTEES.reduce((sum, c) => sum + (c._count?.members ?? 0), 0);
  const parts    = [
    `<span class="text-ink font-semibold">${active}</span><span class="text-muted"> active</span>`,
    inactive ? `<span class="text-ink font-semibold">${inactive}</span><span class="text-muted"> archived</span>` : null,
    `<span class="text-ink font-semibold">${totalM}</span><span class="text-muted"> total memberships</span>`,
  ].filter(Boolean);
  $('cmte-stats').innerHTML = parts.join(' <span class="text-line mx-2">·</span> ');
}

function renderCommitteeList() {
  const el = $('cmte-list');
  if (!COMMITTEES.length) {
    el.innerHTML = '<p class="text-xs text-muted">No committees yet.</p>';
    return;
  }
  el.innerHTML = COMMITTEES.map(c => {
    const activeMembers = (c.members || []).filter(m => !m.leftAt);
    const isSelected    = c.id === ACTIVE_CMTE_ID;
    const days          = tenureDays(c.createdAt, null);
    return `
      <button onclick="openCommittee('${c.id}')"
        class="w-full text-left px-3 py-2.5 rounded-lg border transition-colors cursor-pointer
               ${isSelected
                 ? 'bg-accent/10 border-accent/40 text-ink'
                 : 'bg-panel2 border-line text-muted hover:text-ink hover:border-accent/30'}">
        <div class="flex items-center justify-between gap-2">
          <span class="text-xs font-semibold truncate">${esc(c.name)}</span>
          ${!c.active ? '<span class="text-[10px] text-zinc-500 shrink-0">archived</span>' : ''}
        </div>
        <p class="text-[11px] mt-0.5 opacity-70">${activeMembers.length} active member${activeMembers.length !== 1 ? 's' : ''}</p>
        <p class="text-[10px] mt-0.5 opacity-50">Since ${cmteDate(c.createdAt)} · ${tenureLabel(days)}</p>
      </button>`;
  }).join('');
}

// ── committee detail ──────────────────────────────────────────

async function openCommittee(id) {
  ACTIVE_CMTE_ID = id;
  renderCommitteeList(); // update selection highlight

  const c = await fetch(`/api/committees/${id}`).then(r => r.json()).catch(() => null);
  if (!c || c.statusCode) {
    $('cmte-detail').innerHTML = '<div class="text-muted text-sm p-10 text-center">Failed to load committee.</div>';
    return;
  }
  CURRENT_CMTE = c; // store so openAddMemberModal can use fresh member list

  const activeMembers   = c.members.filter(m => !m.leftAt);
  const formerMembers   = c.members.filter(m => m.leftAt);
  const thisYear        = new Date().getFullYear();
  const activitiesThisYear = c.activities.filter(a => new Date(a.activityDate).getFullYear() === thisYear);

  $('cmte-detail').innerHTML = `
    <!-- header -->
    <div class="bg-panel border border-line rounded-xl p-5 mb-4">
      <div class="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div class="flex items-center gap-2 flex-wrap">
            <h2 class="text-base font-bold text-ink">${esc(c.name)}</h2>
            ${!c.active ? '<span class="badge bg-zinc-500/15 text-zinc-400 text-[10px]">Archived</span>' : '<span class="badge bg-accent/15 text-accent text-[10px]">Active</span>'}
          </div>
          ${c.purpose ? `<p class="text-xs text-muted mt-1">${esc(c.purpose)}</p>` : ''}
        </div>
        ${_cmteIsAdmin() ? `
        <div class="flex items-center gap-2 shrink-0">
          <button onclick="toggleArchive('${c.id}', ${c.active})"
            class="text-xs bg-panel2 border border-line text-muted px-3 py-1.5 rounded-lg
                   hover:border-line hover:text-ink transition-colors cursor-pointer">
            ${c.active ? 'Archive' : 'Reactivate'}
          </button>
          <button onclick="confirmDeleteCommittee('${c.id}', '${esc(c.name)}')"
            class="text-xs bg-panel2 border border-line text-warm px-3 py-1.5 rounded-lg
                   hover:border-warm/50 transition-colors cursor-pointer">
            Delete
          </button>
        </div>` : ''}
      </div>

      <!-- stat row -->
      <div class="flex items-center gap-6 mt-4 pt-4 border-t border-line text-xs text-muted flex-wrap">
        <span><span class="text-ink font-semibold">${activeMembers.length}</span> active members</span>
        <span><span class="text-ink font-semibold">${formerMembers.length}</span> former members</span>
        <span><span class="text-ink font-semibold">${c.activities.length}</span> total activities</span>
        <span><span class="text-ink font-semibold">${activitiesThisYear.length}</span> this year</span>
      </div>
    </div>

    <!-- members -->
    <div class="bg-panel border border-line rounded-xl p-5 mb-4">
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-[11px] font-semibold uppercase tracking-widest text-muted">Members</h3>
        ${_cmteIsAdmin() && c.active ? `
        <button onclick="openAddMemberModal('${c.id}')"
          class="text-xs bg-panel2 border border-line text-ink px-3 py-1 rounded-lg
                 hover:border-accent/50 transition-colors cursor-pointer">
          + Add member
        </button>` : ''}
      </div>

      ${activeMembers.length ? `
      <div class="space-y-2 mb-4">
        ${activeMembers.map(m => renderMemberRow(m, c.id, true)).join('')}
      </div>` : '<p class="text-xs text-muted mb-4">No active members.</p>'}

      ${formerMembers.length ? `
      <details class="group">
        <summary class="text-[11px] text-muted cursor-pointer hover:text-ink list-none flex items-center gap-1">
          <span class="group-open:hidden">▸</span>
          <span class="hidden group-open:inline">▾</span>
          Former members (${formerMembers.length})
        </summary>
        <div class="mt-2 space-y-2">
          ${formerMembers.map(m => renderMemberRow(m, c.id, false)).join('')}
        </div>
      </details>` : ''}
    </div>

    <!-- activities -->
    <div class="bg-panel border border-line rounded-xl p-5">
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-[11px] font-semibold uppercase tracking-widest text-muted">Activities</h3>
        ${_cmteIsAdmin() ? `
        <button onclick="openAddActivityModal('${c.id}')"
          class="text-xs bg-panel2 border border-line text-ink px-3 py-1 rounded-lg
                 hover:border-accent/50 transition-colors cursor-pointer">
          + Record activity
        </button>` : ''}
      </div>

      ${c.activities.length
        ? c.activities.map(a => renderActivityRow(a, c.id, c.members)).join('')
        : '<p class="text-xs text-muted">No activities recorded yet.</p>'}
    </div>

    <!-- modal mount point -->
    <div id="cmte-modal"></div>
  `;
}

function renderMemberRow(m, committeeId, isActive) {
  const days  = tenureDays(m.joinedAt, m.leftAt ?? undefined);
  const label = tenureLabel(days);
  return `
    <div class="flex items-center gap-3 py-2 border-b border-line/40 last:border-0">
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 flex-wrap">
          <span class="text-xs font-semibold text-ink">${esc(m.person.name)}</span>
          <span class="badge ${CMTE_ROLE_CLS[m.role] || ''} text-[10px]">${CMTE_ROLE_LABEL[m.role] || m.role}</span>
          ${!isActive ? '<span class="text-[10px] text-zinc-500">former</span>' : ''}
        </div>
        <p class="text-[11px] text-muted">${esc(m.person.role)} · ${isActive ? `Serving ${label}` : `Served ${label} · Left ${cmteDate(m.leftAt)}`}</p>
      </div>
      ${_cmteIsAdmin() && isActive ? `
      <div class="flex items-center gap-1 shrink-0">
        <button onclick="openEditMemberModal('${m.id}', '${m.role}', '${committeeId}')"
          class="text-[10px] text-muted hover:text-ink border border-line rounded px-1.5 py-0.5 cursor-pointer">
          Edit
        </button>
        <button onclick="stepDownMember('${m.id}', '${committeeId}')"
          class="text-[10px] text-muted hover:text-warm border border-line rounded px-1.5 py-0.5 cursor-pointer">
          Step down
        </button>
      </div>` : ''}
    </div>`;
}

function renderActivityRow(a, committeeId, allMembers) {
  const attendeeIds = (a.attendees || []).map(x => x.personId);
  const memberCount = allMembers.filter(m => !m.leftAt).length;
  return `
    <div class="py-3 border-b border-line/40 last:border-0">
      <div class="flex items-start justify-between gap-2">
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="text-xs font-semibold text-ink">${esc(a.title)}</span>
            <span class="text-[11px] text-muted">${cmteDate(a.activityDate)}</span>
          </div>
          ${a.notes   ? `<p class="text-[11px] text-muted mt-0.5">${esc(a.notes)}</p>` : ''}
          ${a.outcome ? `<p class="text-[11px] text-accent mt-0.5">→ ${esc(a.outcome)}</p>` : ''}

          <!-- attendance -->
          <div class="flex items-center gap-1.5 mt-1.5 flex-wrap">
            <span class="text-[10px] text-muted">Attended:</span>
            ${a.attendees.length
              ? a.attendees.map(x =>
                  `<span class="text-[10px] bg-panel2 border border-line rounded px-1.5 py-0.5 text-ink">${esc(x.person.name)}</span>`
                ).join('')
              : '<span class="text-[10px] text-muted/50">none recorded</span>'}
            ${_cmteIsAdmin() ? `
            <button onclick="openAttendanceModal('${a.id}', '${committeeId}')"
              class="text-[10px] text-muted hover:text-ink border border-line rounded px-1.5 py-0.5 cursor-pointer">
              Edit
            </button>` : ''}
          </div>
        </div>
        ${_cmteIsAdmin() ? `
        <div class="flex items-center gap-1 shrink-0">
          <button onclick="confirmDeleteActivity('${a.id}', '${committeeId}')"
            class="text-[10px] text-muted hover:text-warm border border-line rounded px-1.5 py-0.5 cursor-pointer">
            ×
          </button>
        </div>` : ''}
      </div>
    </div>`;
}

// ── create committee ──────────────────────────────────────────

async function createCommittee() {
  const name    = $('cmte-new-name').value.trim();
  const purpose = $('cmte-new-purpose').value.trim();
  if (!name) { msg($('cmte-create-msg'), 'Name is required.', 'err'); return; }

  const res = await fetch('/api/committees', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, purpose: purpose || undefined }),
  });
  if (res.ok) {
    $('cmte-new-name').value = '';
    $('cmte-new-purpose').value = '';
    msg($('cmte-create-msg'), 'Created!', 'ok');
    await loadCommittees();
    const created = COMMITTEES.find(c => c.name === name);
    if (created) openCommittee(created.id);
  } else {
    const e = await res.json().catch(() => ({}));
    msg($('cmte-create-msg'), [].concat(e.message || 'Failed').join(', '), 'err');
  }
}

async function toggleArchive(id, isActive) {
  await fetch(`/api/committees/${id}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ active: !isActive }),
  });
  await loadCommittees();
  openCommittee(id);
}

async function confirmDeleteCommittee(id, name) {
  if (!confirm(`Delete committee "${name}"? This will remove all members and activities.`)) return;
  await fetch(`/api/committees/${id}`, { method: 'DELETE' });
  ACTIVE_CMTE_ID = null;
  await loadCommittees();
}

// ── member modals ─────────────────────────────────────────────

async function openAddMemberModal(committeeId) {
  const el = $('cmte-modal');
  if (!el) return;

  el.innerHTML = `
    <div class="fixed inset-0 z-50 flex items-center justify-center">
      <div class="absolute inset-0 bg-bg/80 backdrop-blur-sm" onclick="closeCmteModal()"></div>
      <div id="am-inner" class="relative bg-panel border border-line rounded-2xl p-6 w-full max-w-sm mx-4 z-10">
        <p class="text-xs text-muted text-center py-4">Loading…</p>
      </div>
    </div>`;

  // Use the globally-loaded PEOPLE array (populated by people.js at boot).
  // Falls back to a fresh API call if PEOPLE hasn't loaded yet.
  let people = (typeof PEOPLE !== 'undefined' && Array.isArray(PEOPLE) && PEOPLE.length > 0)
    ? PEOPLE
    : await fetch('/api/people').then(r => r.json()).catch(() => []);
  if (!Array.isArray(people)) people = [];

  const inner = $('am-inner');
  if (!inner) return; // modal was closed while loading

  if (!people.length) {
    inner.innerHTML = '<p class="text-xs text-warm text-center py-4">No people found. Make sure people are added in the People tab first.</p>';
    return;
  }

  // Exclude only ACTIVE members (not stepped-down former members — they can rejoin)
  const cmte     = (CURRENT_CMTE?.id === committeeId) ? CURRENT_CMTE : null;
  const existing = (cmte?.members || [])
    .filter(m => !m.leftAt)
    .map(m => m.person?.id ?? m.personId)
    .filter(Boolean);

  const STATUS_LABEL_SHORT = { ACTIVE:'Active', WARM_POOL:'Warm pool', RESIGNED:'Resigned', TERMINATED:'Terminated' };
  const available = people
    .filter(p => p.employmentType === 'FULL_TIME' && !existing.includes(p.id))
    .sort((a, b) => a.name.localeCompare(b.name));

  if (!available.length) {
    inner.innerHTML = `
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-sm font-semibold text-ink">Add member</h2>
        <button onclick="closeCmteModal()" class="text-muted hover:text-ink text-lg cursor-pointer">×</button>
      </div>
      <p class="text-xs text-muted text-center py-4">All full-time staff are already active members of this committee.</p>`;
    return;
  }

  inner.innerHTML = `
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-sm font-semibold text-ink">Add member</h2>
          <button onclick="closeCmteModal()" class="text-muted hover:text-ink text-lg cursor-pointer">×</button>
        </div>
        <label class="block text-xs text-muted font-medium mb-1.5">Person</label>
        <select id="am-person" class="form-input text-xs cursor-pointer mb-3" style="margin-top:0">
          <option value="">— select person —</option>
          ${available.map(p => {
            const statusTag = p.status && p.status !== 'ACTIVE' ? ` · ${STATUS_LABEL_SHORT[p.status] || p.status}` : '';
            return `<option value="${p.id}">${esc(p.name)} (${esc(p.role)}${statusTag})</option>`;
          }).join('')}
        </select>
        <label class="block text-xs text-muted font-medium mb-1.5">Role on committee</label>
        <select id="am-role" class="form-input text-xs cursor-pointer mb-3" style="margin-top:0">
          <option value="MEMBER">Member</option>
          <option value="SECRETARY">Secretary</option>
          <option value="CHAIR">Chair</option>
        </select>
        <label class="block text-xs text-muted font-medium mb-1.5">Joined date</label>
        <input id="am-date" type="date" class="form-input text-xs mb-4" style="margin-top:0"
          value="${new Date().toISOString().slice(0,10)}" />
        <button onclick="submitAddMember('${committeeId}')"
          class="w-full bg-accent text-bg text-xs font-semibold py-2.5 rounded-lg
                 hover:brightness-110 transition-all cursor-pointer">
          Add to committee
        </button>
        <div id="am-msg" class="text-xs mt-2 min-h-[16px]"></div>`;
}

async function submitAddMember(committeeId) {
  const personId = $('am-person').value;
  const role     = $('am-role').value;
  const joinedAt = $('am-date').value;
  if (!personId) { msg($('am-msg'), 'Select a person.', 'err'); return; }

  const res = await fetch(`/api/committees/${committeeId}/members`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ personId, role, joinedAt }),
  });
  if (res.ok) { closeCmteModal(); await loadCommittees(); openCommittee(committeeId); }
  else {
    const e = await res.json().catch(() => ({}));
    msg($('am-msg'), [].concat(e.message || 'Failed').join(', '), 'err');
  }
}

function openEditMemberModal(memberId, currentRole, committeeId) {
  const el = $('cmte-modal');
  el.innerHTML = `
    <div class="fixed inset-0 z-50 flex items-center justify-center">
      <div class="absolute inset-0 bg-bg/80 backdrop-blur-sm" onclick="closeCmteModal()"></div>
      <div class="relative bg-panel border border-line rounded-2xl p-6 w-full max-w-sm mx-4 z-10">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-sm font-semibold text-ink">Edit membership</h2>
          <button onclick="closeCmteModal()" class="text-muted hover:text-ink text-lg cursor-pointer">×</button>
        </div>
        <label class="block text-xs text-muted font-medium mb-1.5">Role on committee</label>
        <select id="em-role" class="form-input text-xs cursor-pointer mb-4" style="margin-top:0">
          <option value="MEMBER"    ${currentRole==='MEMBER'    ?'selected':''}>Member</option>
          <option value="SECRETARY" ${currentRole==='SECRETARY' ?'selected':''}>Secretary</option>
          <option value="CHAIR"     ${currentRole==='CHAIR'     ?'selected':''}>Chair</option>
        </select>
        <button onclick="submitEditMember('${memberId}', '${committeeId}')"
          class="w-full bg-accent text-bg text-xs font-semibold py-2.5 rounded-lg
                 hover:brightness-110 transition-all cursor-pointer">
          Save
        </button>
        <div id="em-msg" class="text-xs mt-2 min-h-[16px]"></div>
      </div>
    </div>`;
}

async function submitEditMember(memberId, committeeId) {
  const res = await fetch(`/api/committees/members/${memberId}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: $('em-role').value }),
  });
  if (res.ok) { closeCmteModal(); openCommittee(committeeId); }
  else { const e = await res.json().catch(() => ({})); msg($('em-msg'), [].concat(e.message||'Failed').join(', '), 'err'); }
}

async function stepDownMember(memberId, committeeId) {
  const today = new Date().toISOString().slice(0, 10);
  if (!confirm('Mark this member as stepped down today?')) return;
  await fetch(`/api/committees/members/${memberId}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ leftAt: today }),
  });
  openCommittee(committeeId);
}

// ── activity modals ───────────────────────────────────────────

function openAddActivityModal(committeeId) {
  const el = $('cmte-modal');
  el.innerHTML = `
    <div class="fixed inset-0 z-50 flex items-center justify-center">
      <div class="absolute inset-0 bg-bg/80 backdrop-blur-sm" onclick="closeCmteModal()"></div>
      <div class="relative bg-panel border border-line rounded-2xl p-6 w-full max-w-md mx-4 z-10">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-sm font-semibold text-ink">Record activity</h2>
          <button onclick="closeCmteModal()" class="text-muted hover:text-ink text-lg cursor-pointer">×</button>
        </div>
        <label class="block text-xs text-muted font-medium mb-1.5">Title</label>
        <input id="aa-title" class="form-input text-xs mb-3" style="margin-top:0"
          placeholder="e.g. Q2 Safety Audit" />
        <label class="block text-xs text-muted font-medium mb-1.5">Date</label>
        <input id="aa-date" type="date" class="form-input text-xs mb-3" style="margin-top:0"
          value="${new Date().toISOString().slice(0,10)}" />
        <label class="block text-xs text-muted font-medium mb-1.5">Notes (agenda / discussion)</label>
        <textarea id="aa-notes" rows="2"
          class="w-full bg-bg border border-line rounded-lg px-3 py-2 text-xs text-ink placeholder-muted/60
                 focus:outline-none focus:ring-1 focus:ring-accent/70 resize-none mb-3"
          placeholder="What was discussed…"></textarea>
        <label class="block text-xs text-muted font-medium mb-1.5">Outcome / decisions</label>
        <textarea id="aa-outcome" rows="2"
          class="w-full bg-bg border border-line rounded-lg px-3 py-2 text-xs text-ink placeholder-muted/60
                 focus:outline-none focus:ring-1 focus:ring-accent/70 resize-none mb-4"
          placeholder="Decisions made, action items…"></textarea>
        <button onclick="submitAddActivity('${committeeId}')"
          class="w-full bg-accent text-bg text-xs font-semibold py-2.5 rounded-lg
                 hover:brightness-110 transition-all cursor-pointer">
          Save activity
        </button>
        <div id="aa-msg" class="text-xs mt-2 min-h-[16px]"></div>
      </div>
    </div>`;
}

async function submitAddActivity(committeeId) {
  const body = {
    title:        $('aa-title').value.trim(),
    activityDate: $('aa-date').value,
    notes:        $('aa-notes').value.trim()   || undefined,
    outcome:      $('aa-outcome').value.trim() || undefined,
  };
  if (!body.title || !body.activityDate) { msg($('aa-msg'), 'Title and date are required.', 'err'); return; }
  const res = await fetch(`/api/committees/${committeeId}/activities`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  if (res.ok) { closeCmteModal(); openCommittee(committeeId); }
  else { const e = await res.json().catch(() => ({})); msg($('aa-msg'), [].concat(e.message||'Failed').join(', '), 'err'); }
}

async function confirmDeleteActivity(activityId, committeeId) {
  if (!confirm('Delete this activity record?')) return;
  await fetch(`/api/committees/activities/${activityId}`, { method: 'DELETE' });
  openCommittee(committeeId);
}

// ── attendance modal ──────────────────────────────────────────

async function openAttendanceModal(activityId, committeeId) {
  const c = await fetch(`/api/committees/${committeeId}`).then(r => r.json()).catch(() => null);
  if (!c) return;

  const activity      = c.activities.find(a => a.id === activityId);
  const activeMembers = c.members.filter(m => !m.leftAt);
  const attendeeIds   = new Set((activity?.attendees || []).map(x => x.personId));

  const el = $('cmte-modal');
  el.innerHTML = `
    <div class="fixed inset-0 z-50 flex items-center justify-center">
      <div class="absolute inset-0 bg-bg/80 backdrop-blur-sm" onclick="closeCmteModal()"></div>
      <div class="relative bg-panel border border-line rounded-2xl p-6 w-full max-w-sm mx-4 z-10">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-sm font-semibold text-ink">Mark attendance</h2>
          <button onclick="closeCmteModal()" class="text-muted hover:text-ink text-lg cursor-pointer">×</button>
        </div>
        <p class="text-[11px] text-muted mb-3">Toggle who attended this session.</p>
        <div class="space-y-1.5 mb-4">
          ${activeMembers.map(m => {
            const attended = attendeeIds.has(m.person.id);
            return `
              <label class="flex items-center gap-2 cursor-pointer py-1.5 px-2 rounded-lg
                            hover:bg-panel2 transition-colors">
                <input type="checkbox" data-pid="${m.person.id}" ${attended ? 'checked' : ''}
                  class="accent-[var(--accent)] w-3.5 h-3.5" />
                <span class="text-xs text-ink">${esc(m.person.name)}</span>
                <span class="text-[10px] text-muted">${esc(m.person.role)}</span>
              </label>`;
          }).join('')}
        </div>
        <button onclick="submitAttendance('${activityId}', '${committeeId}')"
          class="w-full bg-accent text-bg text-xs font-semibold py-2.5 rounded-lg
                 hover:brightness-110 transition-all cursor-pointer">
          Save attendance
        </button>
      </div>
    </div>`;
}

async function submitAttendance(activityId, committeeId) {
  const checkboxes = document.querySelectorAll('#cmte-modal [data-pid]');
  const saves = [];
  for (const cb of checkboxes) {
    const pid = cb.dataset.pid;
    const url = `/api/committees/activities/${activityId}/attendees/${pid}`;
    saves.push(fetch(url, { method: cb.checked ? 'POST' : 'DELETE' }));
  }
  await Promise.all(saves);
  closeCmteModal();
  openCommittee(committeeId);
}

function closeCmteModal() {
  const el = $('cmte-modal');
  if (el) el.innerHTML = '';
}
