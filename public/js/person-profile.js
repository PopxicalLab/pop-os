// ══════════════════════════════════════════════════════════════
// PERSON PROFILE — full lifecycle view
// Opened as a full-screen modal. Access: admin (any person) or own profile.
// Depends on: $, esc, coBadge, fmtMYR (index.html / people.js)
// ══════════════════════════════════════════════════════════════

const EVENT_LABEL = {
  ROLE_CHANGE:       'Role change',
  DEPARTMENT_CHANGE: 'Department change',
  PROMOTION:         'Promotion',
  ACHIEVEMENT:       'Achievement',
  NOTE:              'Note',
};

const EVENT_CLS = {
  ROLE_CHANGE:       'bg-sky-500/15 text-sky-400',
  DEPARTMENT_CHANGE: 'bg-purple-500/15 text-purple-400',
  PROMOTION:         'bg-yellow-500/15 text-yellow-400',
  ACHIEVEMENT:       'bg-emerald-500/15 text-emerald-400',
  NOTE:              'bg-zinc-500/15 text-zinc-400',
};

function profileDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

function tenureStr(days) {
  if (days < 30)   return `${days}d`;
  if (days < 365)  return `${Math.floor(days / 30)}mo`;
  const yr = Math.floor(days / 365);
  const mo = Math.floor((days % 365) / 30);
  return mo > 0 ? `${yr}yr ${mo}mo` : `${yr}yr`;
}

// ── open / close ──────────────────────────────────────────────

async function openPersonProfile(personId) {
  let modal = $('profile-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'profile-modal';
    modal.className = 'fixed inset-0 z-50 flex flex-col bg-bg overflow-y-auto';
    document.body.appendChild(modal);
  }
  modal.innerHTML = `<div class="flex-1 flex items-center justify-center text-muted text-sm">Loading profile…</div>`;
  modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';

  const [data, committees] = await Promise.all([
    fetch(`/api/people/${personId}/profile`).then(r => r.json()).catch(() => null),
    fetch(`/api/committees/person/${personId}`).then(r => r.json()).catch(() => []),
  ]);
  if (!data || data.statusCode) {
    modal.innerHTML = `<div class="flex-1 flex items-center justify-center text-muted text-sm">Profile not available.</div>`;
    return;
  }
  renderProfile(modal, data, personId, committees);
}

function closePersonProfile() {
  const modal = $('profile-modal');
  if (modal) modal.classList.add('hidden');
  document.body.style.overflow = '';
}

// ── render ────────────────────────────────────────────────────

function renderProfile(modal, data, personId, committees = []) {
  const { person, projects, assets, badges, stats } = data;
  const admin = typeof isAdmin === 'function' && isAdmin();

  const earnedBadges  = badges.filter(b => b.earned);
  const lockedBadges  = badges.filter(b => !b.earned);

  const STATUS_CLS = {
    ACTIVE:     'bg-accent/15 text-accent',
    WARM_POOL:  'bg-warm/15 text-warm',
    RESIGNED:   'bg-zinc-500/15 text-zinc-400',
    TERMINATED: 'bg-rose-500/15 text-rose-400',
  };
  const STATUS_LABEL = { ACTIVE:'Active', WARM_POOL:'Warm pool', RESIGNED:'Resigned', TERMINATED:'Terminated' };

  modal.innerHTML = `
    <!-- top bar -->
    <div class="sticky top-0 z-10 bg-bg/95 backdrop-blur border-b border-line px-6 py-3 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <button onclick="closePersonProfile()"
          class="text-muted hover:text-ink transition-colors cursor-pointer flex items-center gap-1.5 text-xs">
          ← Back
        </button>
        <span class="text-line">|</span>
        <span class="text-xs text-muted">Lifecycle Profile</span>
      </div>
      ${admin ? `
      <button onclick="openAddEventModal('${personId}')"
        class="text-xs bg-panel2 border border-line text-ink px-3 py-1.5 rounded-lg
               hover:border-accent/50 transition-colors cursor-pointer">
        + Add event
      </button>` : ''}
    </div>

    <!-- hero -->
    <div class="max-w-4xl mx-auto w-full px-6 pt-8 pb-4">
      <div class="flex items-start gap-5 mb-6">
        <div class="w-16 h-16 rounded-2xl bg-panel2 border border-line flex items-center justify-center
                    text-2xl font-bold text-accent shrink-0">
          ${esc(person.name.charAt(0).toUpperCase())}
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 flex-wrap">
            <h1 class="text-xl font-bold text-ink">${esc(person.name)}</h1>
            ${coBadge(person.company)}
            <span class="badge ${STATUS_CLS[person.status] || ''} text-[10px]">${STATUS_LABEL[person.status] || person.status}</span>
          </div>
          <p class="text-sm text-muted mt-0.5">${esc(person.role)} · ${esc(person.department)}</p>
          <div class="flex items-center gap-4 mt-2 text-xs text-muted flex-wrap">
            <span>Joined ${profileDate(person.startDate)}</span>
            <span class="text-accent font-semibold">${tenureStr(stats.tenureDays)} tenure</span>
            ${person.user ? `<span>Login: ${esc(person.user.email)}</span>` : ''}
          </div>
        </div>
      </div>

      <!-- stat cards -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        ${statCard('Projects', stats.projectCount, '📁')}
        ${statCard('Assets', stats.assetCount, '🎨')}
        ${statCard('Skills', person.skills.length, '🧠')}
        ${statCard('Avg rating', stats.avgRating ?? '—', '⭐')}
      </div>

      <!-- badges -->
      <div class="bg-panel border border-line rounded-xl p-5 mb-5">
        <h2 class="text-[11px] font-semibold uppercase tracking-widest text-muted mb-3">
          Achievements <span class="text-accent">${earnedBadges.length}/${badges.length}</span>
        </h2>
        <div class="flex flex-wrap gap-2">
          ${earnedBadges.map(b => `
            <span class="inline-flex items-center gap-1.5 bg-accent/10 border border-accent/30
                         text-accent px-3 py-1.5 rounded-full text-xs font-medium">
              ${b.icon} ${esc(b.label)}
            </span>`).join('')}
          ${lockedBadges.map(b => `
            <span class="inline-flex items-center gap-1.5 bg-panel2 border border-line
                         text-muted/40 px-3 py-1.5 rounded-full text-xs" title="Not yet earned">
              🔒 ${esc(b.label)}
            </span>`).join('')}
        </div>
      </div>

      <!-- two-col layout: timeline + skills -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">

        <!-- timeline (2/3 width) -->
        <div class="lg:col-span-2 bg-panel border border-line rounded-xl p-5">
          <h2 class="text-[11px] font-semibold uppercase tracking-widest text-muted mb-4">Timeline</h2>
          <div id="profile-timeline">
            ${renderTimeline(data, admin, personId)}
          </div>
        </div>

        <!-- skills (1/3 width) -->
        <div class="bg-panel border border-line rounded-xl p-5">
          <h2 class="text-[11px] font-semibold uppercase tracking-widest text-muted mb-3">Skills</h2>
          ${person.skills.length ? person.skills
              .sort((a, b) => b.rating - a.rating)
              .map(s => `
                <div class="flex items-center gap-2 py-1.5 border-b border-line/40 last:border-0">
                  <div class="flex-1 min-w-0">
                    <p class="text-xs text-ink truncate">${esc(s.skill.name)}</p>
                  </div>
                  <div class="flex items-center gap-1 shrink-0">
                    ${[1,2,3,4,5].map(n =>
                      `<span class="w-2 h-2 rounded-full ${n <= s.rating ? 'bg-accent' : 'bg-line'}"></span>`
                    ).join('')}
                    <span class="text-[11px] text-accent font-semibold w-4 text-right">${s.rating}</span>
                  </div>
                </div>`).join('')
            : '<p class="text-xs text-muted">No skills rated yet.</p>'}
        </div>
      </div>

      <!-- projects -->
      ${projects.length ? `
      <div class="bg-panel border border-line rounded-xl p-5 mb-5">
        <h2 class="text-[11px] font-semibold uppercase tracking-widest text-muted mb-3">
          Projects Involved <span class="text-muted">(${projects.length})</span>
        </h2>
        <div class="flex flex-wrap gap-1.5">
          ${projects.map(p => `
            <span class="inline-flex items-center gap-1 bg-panel2 border border-line
                         px-2.5 py-1 rounded-lg text-xs text-ink">
              ${coBadge(p.company)}${esc(p.name)}
            </span>`).join('')}
        </div>
      </div>` : ''}

      <!-- committees -->
      ${committees.length ? `
      <div class="bg-panel border border-line rounded-xl p-5 mb-5">
        <h2 class="text-[11px] font-semibold uppercase tracking-widest text-muted mb-3">
          Committees <span class="text-muted">(${committees.length})</span>
        </h2>
        <div class="space-y-2">
          ${committees.map(m => {
            const still    = !m.leftAt;
            const days     = Math.floor(
              (new Date(m.leftAt ?? Date.now()).getTime() - new Date(m.joinedAt).getTime()) / 86_400_000
            );
            const tenure   = days < 30 ? `${days}d`
                           : days < 365 ? `${Math.floor(days/30)}mo`
                           : `${Math.floor(days/365)}yr`;
            const roleCls  = m.role === 'CHAIR' ? 'bg-yellow-500/15 text-yellow-400'
                           : m.role === 'SECRETARY' ? 'bg-sky-500/15 text-sky-400'
                           : 'bg-zinc-500/15 text-zinc-400';
            const roleLabel = { CHAIR:'Chair', SECRETARY:'Secretary', MEMBER:'Member' }[m.role] || m.role;
            return `
            <div class="flex items-center gap-3 py-2 border-b border-line/40 last:border-0">
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                  <span class="text-xs font-semibold text-ink">${esc(m.committee.name)}</span>
                  <span class="badge ${roleCls} text-[10px]">${roleLabel}</span>
                  ${!still ? '<span class="text-[10px] text-zinc-500">former</span>' : ''}
                </div>
                ${m.committee.purpose ? `<p class="text-[11px] text-muted mt-0.5">${esc(m.committee.purpose)}</p>` : ''}
              </div>
              <div class="text-right shrink-0">
                <p class="text-[11px] text-muted">${still ? `Serving` : `Served`} ${tenure}</p>
                <p class="text-[10px] text-muted/60">Since ${profileDate(m.joinedAt)}</p>
              </div>
            </div>`;
          }).join('')}
        </div>
      </div>` : ''}

      <!-- salary history (admin only) -->
      ${data.person.salaryHistory && data.person.salaryHistory.length ? `
      <div class="bg-panel border border-line rounded-xl p-5 mb-5">
        <h2 class="text-[11px] font-semibold uppercase tracking-widest text-muted mb-3">
          Salary History <span class="text-[10px] text-warm">(admin only)</span>
        </h2>
        ${data.person.salaryHistory.map((s, i, arr) => {
          const prev = s.prevAmount;
          const arrow = prev != null
            ? (s.amount > prev
                ? `<span class="text-emerald-400 text-[11px]">↑ +RM ${(s.amount - prev).toLocaleString()}</span>`
                : `<span class="text-warm text-[11px]">↓ -RM ${(prev - s.amount).toLocaleString()}</span>`)
            : '';
          return `
          <div class="flex items-center gap-3 py-2 border-b border-line/40 last:border-0">
            <div class="flex-1">
              <span class="text-xs font-semibold text-ink">RM ${s.amount.toLocaleString()}</span>
              ${arrow}
              ${s.reason ? `<span class="text-[11px] text-muted ml-1">· ${esc(s.reason)}</span>` : ''}
            </div>
            <span class="text-[11px] text-muted shrink-0">${profileDate(s.effectiveDate)}</span>
          </div>`;
        }).join('')}
      </div>` : ''}

    </div>

    <!-- add event modal placeholder -->
    <div id="add-event-modal"></div>
  `;
}

function statCard(label, value, icon) {
  return `
    <div class="bg-panel border border-line rounded-xl p-4 text-center">
      <div class="text-lg mb-1">${icon}</div>
      <div class="text-xl font-bold text-ink">${value}</div>
      <div class="text-[11px] text-muted">${label}</div>
    </div>`;
}

function renderTimeline(data, admin, personId) {
  const { person, assets } = data;

  // Build unified timeline entries from all sources
  const entries = [];

  // Join date
  entries.push({
    date: person.startDate,
    icon: '🎉',
    cls: 'bg-accent/15 text-accent',
    title: 'Joined the company',
    sub: `${esc(person.role)} · ${esc(person.department)}`,
    type: 'join',
  });

  // Manual events
  for (const e of (person.events || [])) {
    entries.push({
      date: e.eventDate,
      icon: e.type === 'PROMOTION' ? '🏆' : e.type === 'ACHIEVEMENT' ? '⭐' : e.type === 'ROLE_CHANGE' ? '🔄' : e.type === 'DEPARTMENT_CHANGE' ? '🏢' : '📝',
      cls: EVENT_CLS[e.type] || 'bg-zinc-500/15 text-zinc-400',
      title: esc(e.title),
      sub: e.note ? esc(e.note) : '',
      type: 'event',
      id: e.id,
    });
  }

  // Skill ratings
  for (const ps of (person.skills || [])) {
    for (const h of (ps.history || [])) {
      const arrow = h.oldRating == null ? `Rated ${h.newRating}/5` : `${h.oldRating} → ${h.newRating}/5`;
      entries.push({
        date: h.createdAt,
        icon: '🧠',
        cls: 'bg-sky-500/15 text-sky-400',
        title: `${esc(ps.skill.name)}: ${arrow}`,
        sub: h.note ? esc(h.note) : '',
        type: 'skill',
      });
    }
  }

  // Status change (if not active)
  if (person.status !== 'ACTIVE') {
    entries.push({
      date: person.updatedAt,
      icon: person.status === 'WARM_POOL' ? '🌿' : person.status === 'RESIGNED' ? '👋' : '🚪',
      cls: person.status === 'TERMINATED' ? 'bg-rose-500/15 text-rose-400' : 'bg-zinc-500/15 text-zinc-400',
      title: `Status changed to ${person.status.replace('_', ' ').toLowerCase()}`,
      sub: '',
      type: 'status',
    });
  }

  // Sort descending
  entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  if (!entries.length) return '<p class="text-xs text-muted">No events yet.</p>';

  return entries.map(e => `
    <div class="flex gap-3 pb-4 last:pb-0">
      <div class="flex flex-col items-center shrink-0">
        <div class="w-7 h-7 rounded-full ${e.cls} flex items-center justify-center text-sm">${e.icon}</div>
        <div class="w-px flex-1 bg-line/40 mt-1"></div>
      </div>
      <div class="flex-1 min-w-0 pt-0.5 pb-2">
        <div class="flex items-start justify-between gap-2">
          <p class="text-xs font-semibold text-ink">${e.title}</p>
          <div class="flex items-center gap-1.5 shrink-0">
            <span class="text-[11px] text-muted whitespace-nowrap">${profileDate(e.date)}</span>
            ${admin && e.type === 'event' ? `
              <button onclick="deleteProfileEvent('${e.id}', '${personId}')"
                class="text-muted/40 hover:text-warm text-xs leading-none cursor-pointer">×</button>` : ''}
          </div>
        </div>
        ${e.sub ? `<p class="text-[11px] text-muted mt-0.5">${e.sub}</p>` : ''}
      </div>
    </div>`).join('');
}

// ── add event modal ───────────────────────────────────────────

function openAddEventModal(personId) {
  const el = $('add-event-modal');
  if (!el) return;
  el.innerHTML = `
    <div class="fixed inset-0 z-[60] flex items-center justify-center">
      <div class="absolute inset-0 bg-bg/80 backdrop-blur-sm" onclick="closeAddEventModal()"></div>
      <div class="relative bg-panel border border-line rounded-2xl p-6 w-full max-w-sm mx-4 z-10">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-sm font-semibold text-ink">Add timeline event</h2>
          <button onclick="closeAddEventModal()" class="text-muted hover:text-ink text-lg leading-none cursor-pointer">×</button>
        </div>
        <label class="block text-xs text-muted font-medium mb-1.5">Type</label>
        <select id="ae-type" class="form-input text-xs cursor-pointer mb-3" style="margin-top:0">
          <option value="PROMOTION">Promotion</option>
          <option value="ROLE_CHANGE">Role change</option>
          <option value="DEPARTMENT_CHANGE">Department change</option>
          <option value="ACHIEVEMENT">Achievement</option>
          <option value="NOTE">Note</option>
        </select>
        <label class="block text-xs text-muted font-medium mb-1.5">Title</label>
        <input id="ae-title" class="form-input text-xs mb-3" style="margin-top:0"
          placeholder="e.g. Promoted to Senior 3D Artist" />
        <label class="block text-xs text-muted font-medium mb-1.5">Note (optional)</label>
        <textarea id="ae-note" rows="2"
          class="w-full bg-bg border border-line rounded-lg px-3 py-2 text-xs text-ink placeholder-muted/60
                 focus:outline-none focus:ring-1 focus:ring-accent/70 resize-none mb-3"
          placeholder="Additional context…"></textarea>
        <label class="block text-xs text-muted font-medium mb-1.5">Date</label>
        <input id="ae-date" type="date" class="form-input text-xs mb-4" style="margin-top:0"
          value="${new Date().toISOString().slice(0,10)}" />
        <button onclick="submitAddEvent('${personId}')"
          class="w-full bg-accent text-bg text-xs font-semibold py-2.5 rounded-lg
                 hover:brightness-110 transition-all cursor-pointer">
          Save event
        </button>
        <div id="ae-msg" class="text-xs mt-2 min-h-[16px]"></div>
      </div>
    </div>`;
}

function closeAddEventModal() {
  const el = $('add-event-modal');
  if (el) el.innerHTML = '';
}

async function submitAddEvent(personId) {
  const body = {
    type:      $('ae-type').value,
    title:     $('ae-title').value.trim(),
    note:      $('ae-note').value.trim() || undefined,
    eventDate: $('ae-date').value || undefined,
  };
  if (!body.title) { msg($('ae-msg'), 'Title is required.', 'err'); return; }

  const res = await fetch(`/api/people/${personId}/events`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  if (res.ok) {
    closeAddEventModal();
    openPersonProfile(personId); // reload
  } else {
    const e = await res.json().catch(() => ({}));
    msg($('ae-msg'), [].concat(e.message || 'Failed').join(', '), 'err');
  }
}

async function deleteProfileEvent(eventId, personId) {
  if (!confirm('Remove this event from the timeline?')) return;
  const res = await fetch(`/api/people/events/${eventId}`, { method: 'DELETE' });
  if (res.ok) openPersonProfile(personId);
}
