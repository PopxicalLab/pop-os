// ══════════════════════════════════════════════════════════════
// ADMIN — Mattermost notification rules
// Depends on: $, msg, esc  (shared.js)  and  _auditUsers  (admin.js)
//
// A rule = one message type + who receives it + when it is sent (GMT+8).
// The list of message types comes from the server (EVENT_CATALOGUE), so a new
// event added in code shows up in the dropdown with no change here.
// ══════════════════════════════════════════════════════════════

const DAY_NAMES = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

let _notif = { configured: false, events: [], rules: [] };
let _notifEditId  = null;   // null = creating a new rule
let _notifTargets = [];     // working copy of the targets being edited

// Show a moment as Kuala Lumpur time, whatever the viewer's own timezone is.
function fmtKL(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', {
    timeZone: 'Asia/Kuala_Lumpur', weekday: 'short', day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit',
  }) + ' GMT+8';
}

async function loadNotifRules() {
  const el = $('notif-rules');
  const res = await fetch('/api/notification-rules');
  if (!res.ok) { el.innerHTML = '<p class="text-xs text-warm">Could not load notification rules.</p>'; return; }
  _notif = await res.json();

  const st = $('notif-status');
  st.textContent = _notif.configured ? '● Mattermost connected' : '○ Not configured (.env)';
  st.className = 'text-[11px] px-2 py-1 rounded-full border ' +
    (_notif.configured ? 'border-emerald-500/30 text-emerald-400' : 'border-warm/40 text-warm');
  st.title = _notif.configured ? '' : 'Set MATTERMOST_URL, MATTERMOST_BOT_TOKEN and MATTERMOST_TEAM in the server .env, then restart.';

  if (!_notif.rules.length) {
    el.innerHTML = '<div class="bg-panel border border-line rounded-xl p-6 text-center text-xs text-muted">No rules yet. Click <b>+ New rule</b> to post the weekly capacity board to a channel.</div>';
    return;
  }
  el.innerHTML = _notif.rules.map(renderNotifRule).join('');
}

function renderNotifRule(r) {
  const ev = _notif.events.find(e => e.key === r.event);
  const when = r.dayOfWeek && r.timeOfDay ? `${DAY_NAMES[r.dayOfWeek]} ${r.timeOfDay} GMT+8` : 'On event';
  const chips = r.targets.map(t => t.type === 'CHANNEL'
    ? `<span class="badge bg-accent/10 text-accent border border-accent/30">#${esc(t.channel)}</span>`
    : `<span class="badge bg-panel2 text-ink border border-line">@ ${esc(t.userName || t.mattermostUsername || 'unknown user')}</span>`
  ).join(' ');
  const statusCls = !r.lastStatus ? 'text-muted' : r.lastStatus.startsWith('OK') ? 'text-emerald-400' : 'text-warm';

  return `<div class="bg-panel border border-line rounded-xl p-4 ${r.enabled ? '' : 'opacity-60'}">
    <div class="flex items-start justify-between gap-3 flex-wrap">
      <div class="min-w-0">
        <p class="text-sm font-semibold text-ink">${esc(r.name)}
          ${r.company ? `<span class="badge bg-panel2 text-muted border border-line ml-1">${esc(r.company)}</span>` : ''}
          ${r.enabled ? '' : '<span class="badge bg-panel2 text-muted border border-line ml-1">Paused</span>'}
        </p>
        <p class="text-xs text-muted mt-0.5">${esc(ev ? ev.label : r.event)} · ${esc(when)}</p>
        ${optionsSummary(r)}
        <div class="flex gap-1.5 flex-wrap mt-2">${chips}</div>
      </div>
      <div class="flex gap-1.5 flex-wrap">
        <button class="btn-edit" onclick="testNotifRule('${r.id}', this)">Send test</button>
        <button class="btn-edit" onclick="runNotifRule('${r.id}', this)">Run now</button>
        <button class="btn-edit" onclick="toggleNotifRule('${r.id}', ${!r.enabled})">${r.enabled ? 'Pause' : 'Resume'}</button>
        <button class="btn-edit" onclick="openNotifEditor('${r.id}')">Edit</button>
        <button class="btn-del"  onclick="deleteNotifRule('${r.id}')">Delete</button>
      </div>
    </div>
    <div class="flex gap-x-6 gap-y-1 flex-wrap mt-3 text-[11px] text-muted">
      <span>Next: <span class="text-ink">${r.enabled && r.nextRunAt ? fmtKL(r.nextRunAt) : '—'}</span></span>
      <span>Last: <span class="text-ink">${fmtKL(r.lastRunAt)}</span></span>
      ${r.lastStatus ? `<span class="${statusCls}">${esc(r.lastStatus)}</span>` : ''}
    </div>
  </div>`;
}

// One-line description of a capacity rule's settings, e.g.
// "This week · By person, Alerts · Depts: 3D, Motion".
function optionsSummary(r) {
  if (r.event !== 'CAPACITY_WEEKLY') return '';
  const o = r.options || { sections: ['PER_PERSON'], week: 'CURRENT', departments: [], includeUnbooked: false };
  const labels = (_notif.capacitySections || []).filter(s => o.sections.includes(s.key)).map(s => s.label);
  const parts = [
    o.week === 'NEXT' ? 'Next week' : 'This week',
    labels.join(', '),
    o.departments.length ? 'Depts: ' + o.departments.join(', ') : 'All departments',
    o.includeUnbooked ? 'incl. unbooked' : '',
  ].filter(Boolean);
  return `<p class="text-[11px] text-muted mt-0.5">${esc(parts.join(' · '))}</p>`;
}

// ── Row actions ───────────────────────────────────────────────
// Shared by "Send test" and "Run now": disable the button while the request runs.
async function notifAction(btn, url, okText) {
  const label = btn.textContent;
  btn.disabled = true; btn.textContent = '…';
  const res = await fetch(url, { method: 'POST' });
  const data = await res.json().catch(() => ({}));
  btn.disabled = false; btn.textContent = label;
  if (!res.ok) { msg($('notif-msg'), [].concat(data.message || 'Request failed.').join(' '), 'err'); return null; }
  const text = okText(data);
  msg($('notif-msg'), text, data.errors?.length || text.startsWith('Error') ? 'err' : 'ok');
  return data;
}

async function testNotifRule(id, btn) {
  await notifAction(btn, `/api/notification-rules/${id}/test`, d =>
    d.errors?.length ? `Test sent to ${d.sent}/${d.total}. ${d.errors.join('; ')}` : `Test message sent to ${d.sent} recipient(s).`);
}

async function runNotifRule(id, btn) {
  if (!confirm('Post this message to the recipients now?')) return;
  const data = await notifAction(btn, `/api/notification-rules/${id}/run`, d => d.lastStatus || 'Done.');
  if (data) loadNotifRules();
}

async function toggleNotifRule(id, enabled) {
  await fetch(`/api/notification-rules/${id}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled }),
  });
  loadNotifRules();
}

async function deleteNotifRule(id) {
  const r = _notif.rules.find(x => x.id === id);
  if (!confirm(`Delete rule "${r?.name}"? This cannot be undone.`)) return;
  await fetch(`/api/notification-rules/${id}`, { method: 'DELETE' });
  loadNotifRules();
}

// ── Editor modal ──────────────────────────────────────────────
function openNotifEditor(id) {
  _notifEditId = id || null;
  const r = id ? _notif.rules.find(x => x.id === id) : null;

  $('notif-editor-title').textContent = r ? 'Edit rule' : 'New rule';
  $('nr-name').value    = r?.name || '';
  $('nr-company').value = r?.company || '';
  $('nr-day').value     = r?.dayOfWeek || 1;
  $('nr-time').value    = r?.timeOfDay || '09:00';
  $('nr-enabled').checked = r ? r.enabled : true;

  // The event can't change after creation — the message and schedule fields are tied to it.
  const evSel = $('nr-event');
  evSel.innerHTML = _notif.events.map(e => `<option value="${e.key}">${esc(e.label)}</option>`).join('');
  if (r) evSel.value = r.event;
  evSel.disabled = !!r;
  onNotifEventChange();
  // A brand-new rule gets the defaults; an older rule saved before options
  // existed (options = null) keeps its original behaviour: per-person, booked people only.
  fillCapacityOptions(r ? (r.options || { sections: ['PER_PERSON'], week: 'CURRENT', departments: [], includeUnbooked: false }) : undefined);

  _notifTargets = r
    ? r.targets.map(t => ({ type: t.type, channel: t.channel || '', userId: t.userId || '', mattermostUsername: t.mattermostUsername || '' }))
    : [{ type: 'CHANNEL', channel: '', userId: '', mattermostUsername: '' }];
  renderNotifTargets();

  $('nr-msg').textContent = '';
  $('notif-overlay').classList.remove('hidden');
}

function closeNotifEditor() { $('notif-overlay').classList.add('hidden'); }

function onNotifEventChange() {
  const ev = _notif.events.find(e => e.key === $('nr-event').value);
  $('nr-event-desc').textContent = ev?.description || '';
  $('nr-schedule').classList.toggle('hidden', ev?.kind !== 'SCHEDULED');
  $('nr-capacity-opts').classList.toggle('hidden', ev?.optionsForm !== 'CAPACITY');
}

// Build the capacity options checkboxes. `o` is the rule's saved options, or
// undefined for a new rule (sensible defaults: per-person table, this week).
function fillCapacityOptions(o) {
  const cur = o || { sections: ['PER_PERSON'], week: 'CURRENT', departments: [], includeUnbooked: !o };
  $('nr-sections').innerHTML = (_notif.capacitySections || []).map(s => `
    <label class="flex items-start gap-2 text-xs text-ink cursor-pointer">
      <input type="checkbox" data-section="${s.key}" class="mt-0.5" ${cur.sections.includes(s.key) ? 'checked' : ''} />
      <span><span class="font-medium">${esc(s.label)}</span> <span class="text-muted">— ${esc(s.description)}</span></span>
    </label>`).join('');
  $('nr-week').value = cur.week;
  $('nr-unbooked').checked = cur.includeUnbooked;
  $('nr-departments').innerHTML = (_notif.departments || []).map(d => `
    <label class="flex items-center gap-1.5 text-xs text-ink cursor-pointer">
      <input type="checkbox" data-dept="${esc(d)}" ${cur.departments.includes(d) ? 'checked' : ''} /> ${esc(d)}
    </label>`).join('') || '<span class="text-[11px] text-muted">No departments defined.</span>';
}

// Read the capacity options back out of the form.
function readCapacityOptions() {
  return {
    sections: [...document.querySelectorAll('#nr-sections [data-section]:checked')].map(i => i.dataset.section),
    week: $('nr-week').value,
    departments: [...document.querySelectorAll('#nr-departments [data-dept]:checked')].map(i => i.dataset.dept),
    includeUnbooked: $('nr-unbooked').checked,
  };
}

function addNotifTarget(type) {
  syncNotifTargets(); // keep whatever has been typed so far
  _notifTargets.push({ type, channel: '', userId: '', mattermostUsername: '' });
  renderNotifTargets();
}

function removeNotifTarget(i) {
  syncNotifTargets();
  _notifTargets.splice(i, 1);
  renderNotifTargets();
}

// Copy the current input values back into _notifTargets — re-rendering wipes the DOM inputs.
function syncNotifTargets() {
  document.querySelectorAll('#nr-targets [data-t]').forEach(row => {
    const t = _notifTargets[Number(row.dataset.t)];
    if (!t) return;
    if (t.type === 'CHANNEL') {
      t.channel = row.querySelector('[data-f="channel"]').value;
    } else {
      t.userId = row.querySelector('[data-f="userId"]').value;
      t.mattermostUsername = row.querySelector('[data-f="username"]').value;
    }
  });
}

function renderNotifTargets() {
  const box = $('nr-targets');
  if (!_notifTargets.length) { box.innerHTML = '<p class="text-[11px] text-warm">Add at least one recipient.</p>'; return; }
  const userOpts = (sel) => '<option value="">Choose person…</option>' +
    _auditUsers.filter(u => u.active).map(u => `<option value="${u.id}"${u.id === sel ? ' selected' : ''}>${esc(u.name)}</option>`).join('');

  box.innerHTML = _notifTargets.map((t, i) => t.type === 'CHANNEL'
    ? `<div data-t="${i}" class="flex items-center gap-2">
         <span class="text-xs text-muted w-16 shrink-0">Channel</span>
         <input data-f="channel" class="form-input text-xs" style="margin-top:0" placeholder="channel-url-name" value="${esc(t.channel)}" autocomplete="off" />
         <button type="button" class="btn-del" onclick="removeNotifTarget(${i})">×</button>
       </div>`
    : `<div data-t="${i}" class="flex items-center gap-2">
         <span class="text-xs text-muted w-16 shrink-0">DM</span>
         <select data-f="userId" class="form-input text-xs cursor-pointer" style="margin-top:0">${userOpts(t.userId)}</select>
         <input data-f="username" class="form-input text-xs" style="margin-top:0" placeholder="@username (optional)" value="${esc(t.mattermostUsername)}" autocomplete="off" />
         <button type="button" class="btn-del" onclick="removeNotifTarget(${i})">×</button>
       </div>`
  ).join('');
}

async function saveNotifRule() {
  syncNotifTargets();
  const msgEl = $('nr-msg');
  const ev = _notif.events.find(e => e.key === $('nr-event').value);

  // Drop blank rows the admin added but never filled in.
  const targets = _notifTargets
    .filter(t => t.type === 'CHANNEL' ? t.channel.trim() : t.userId)
    .map(t => t.type === 'CHANNEL'
      ? { type: 'CHANNEL', channel: t.channel.trim() }
      : { type: 'USER', userId: t.userId, ...(t.mattermostUsername.trim() ? { mattermostUsername: t.mattermostUsername.trim() } : {}) });

  const name = $('nr-name').value.trim();
  if (!name) { msg(msgEl, 'Give the rule a name.', 'err'); return; }
  if (!targets.length) { msg(msgEl, 'Add at least one recipient.', 'err'); return; }

  const capacity = ev?.optionsForm === 'CAPACITY';
  const options = capacity ? readCapacityOptions() : null;
  if (capacity && !options.sections.length) { msg(msgEl, 'Tick at least one section to include.', 'err'); return; }

  const scheduled = ev?.kind === 'SCHEDULED';
  if (scheduled && !$('nr-time').value) { msg(msgEl, 'Choose a time.', 'err'); return; }

  const body = {
    name,
    company: $('nr-company').value || null,
    enabled: $('nr-enabled').checked,
    targets,
    ...(options ? { options } : {}),
    ...(scheduled ? { dayOfWeek: Number($('nr-day').value), timeOfDay: $('nr-time').value } : {}),
    // The event is fixed once a rule exists, so it is only sent on create.
    ...(_notifEditId ? {} : { event: $('nr-event').value }),
  };

  const res = await fetch(_notifEditId ? `/api/notification-rules/${_notifEditId}` : '/api/notification-rules', {
    method: _notifEditId ? 'PATCH' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    msg(msgEl, [].concat(err.message || 'Could not save the rule.').join(' '), 'err');
    return;
  }
  closeNotifEditor();
  loadNotifRules();
}
