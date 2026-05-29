// ══════════════════════════════════════════════════════════════
// PEOPLE / ELC
// Depends on: $, msg, esc  (defined in index.html shared script)
// ══════════════════════════════════════════════════════════════

function dots(n) {
  let h = '<span class="inline-flex gap-0.5 items-center">';
  for (let i = 1; i <= 5; i++)
    h += `<span class="w-1.5 h-1.5 rounded-full ${i <= n ? 'bg-accent' : 'bg-line'}"></span>`;
  return h + '</span>';
}

const SOURCES = {
  INTERVIEW:           'Interview',
  PROJECT_COMPLETION:  'Project completion',
  MANUAL_ADJUSTMENT:   'Manual adjustment',
};

let SKILLS = [];
let PEOPLE = [];

async function loadSkills() {
  SKILLS = await (await fetch('/api/skills')).json();
  $('skillList').innerHTML = SKILLS.length
    ? SKILLS.map(s =>
        `<span class="inline-flex items-center bg-panel2 border border-line px-2.5 py-0.5 rounded-full text-xs text-ink">${esc(s.name)}</span>`
      ).join('')
    : '<span class="text-xs text-muted">No skills yet.</span>';
}

$('addSkill').addEventListener('click', async () => {
  const name = $('newSkill').value.trim();
  if (!name) { msg($('skillMsg'), 'Enter a skill name.', 'err'); return; }
  const res = await fetch('/api/skills', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }),
  });
  if (res.ok) {
    $('newSkill').value = '';
    msg($('skillMsg'), 'Skill added.', 'ok');
    await loadSkills();
  } else {
    const e = await res.json().catch(() => ({}));
    msg($('skillMsg'), [].concat(e.message || 'Failed').join(', '), 'err');
  }
});

async function load() {
  PEOPLE = await (await fetch('/api/people')).json();
  const rows = $('rows'); rows.innerHTML = '';
  $('empty').classList.toggle('hidden', PEOPLE.length > 0);
  for (const p of PEOPLE) {
    const skills = (p.skills || []).map(ps =>
      `<span class="inline-flex items-center gap-1.5 bg-panel2 border border-line px-2 py-0.5 rounded-full
                    text-xs cursor-pointer hover:border-accent/50 transition-colors"
            data-ps="${ps.id}" title="Click to update rating">
         ${esc(ps.skill.name)} ${dots(ps.rating)}
         <span class="font-bold text-accent">${ps.rating}</span>
       </span>`
    ).join('') || '<span class="text-xs text-muted">No skills rated</span>';

    const statusBadge = p.warmPool
      ? '<span class="badge bg-warm/15 text-warm">Warm pool</span>'
      : '<span class="badge bg-accent/15 text-accent">Active</span>';

    const tr = document.createElement('tr');
    tr.className = 'border-b border-line hover:bg-panel2/40 transition-colors';
    tr.innerHTML = `
      <td class="py-3 px-2 font-medium whitespace-nowrap">${esc(p.name)}</td>
      <td class="py-3 px-2 text-muted text-xs whitespace-nowrap">${esc(p.role)}</td>
      <td class="py-3 px-2 text-muted text-xs whitespace-nowrap">${esc(p.department)}</td>
      <td class="py-3 px-2">
        <div class="flex flex-wrap gap-1">${skills}</div>
        <div class="mt-2">
          <button class="btn-del" data-assign="${p.id}">+ rate a skill</button>
        </div>
        <div id="area-${p.id}"></div>
      </td>
      <td class="py-3 px-2 whitespace-nowrap">${statusBadge}</td>
      <td class="py-3 px-2 whitespace-nowrap">
        <button class="btn-del" data-del="${p.id}">Remove</button>
      </td>`;
    rows.appendChild(tr);
  }
  rows.querySelectorAll('[data-del]').forEach(b => b.onclick = () => removePerson(b.dataset.del));
  rows.querySelectorAll('[data-assign]').forEach(b => b.onclick = () => showAssign(b.dataset.assign));
  rows.querySelectorAll('[data-ps]').forEach(b => b.onclick = () => showChange(b.dataset.ps, b));
  populatePersonDropdowns();
}

async function addPerson() {
  const body = {
    name:           $('name').value.trim(),
    role:           $('role').value.trim(),
    department:     $('department').value.trim(),
    startDate:      $('startDate').value || new Date().toISOString().slice(0, 10),
    employmentType: $('employmentType').value,
    warmPool:       $('warmPool').value === 'true',
  };
  if (!body.name || !body.role || !body.department) {
    msg($('msg'), 'Name, role and department are required.', 'err'); return;
  }
  const res = await fetch('/api/people', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  if (res.ok) {
    ['name', 'role', 'department'].forEach(id => $(id).value = '');
    msg($('msg'), 'Person added.', 'ok');
    load();
  } else {
    const e = await res.json().catch(() => ({}));
    msg($('msg'), [].concat(e.message || 'Failed').join(', '), 'err');
  }
}

async function removePerson(id) {
  if (!confirm('Remove this person? Their skill ratings and history go too.')) return;
  const res = await fetch('/api/people/' + id, { method: 'DELETE' });
  if (res.ok) { msg($('msg'), 'Removed.', 'ok'); load(); }
  else msg($('msg'), 'Could not remove.', 'err');
}

function showAssign(personId) {
  const area = $('area-' + personId);
  if (area.dataset.open === '1') { area.innerHTML = ''; area.dataset.open = '0'; return; }
  area.dataset.open = '1';
  const opts = SKILLS.map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join('');
  area.innerHTML = `
    <div class="bg-panel2 border border-line rounded-xl p-4 mt-3 space-y-3">
      <div class="grid grid-cols-3 gap-2">
        <div>
          <p class="text-[10px] text-muted font-medium mb-1">Skill</p>
          <select class="a-skill w-full bg-bg border border-line text-ink px-2 py-1.5 rounded-lg text-xs focus:outline-none focus:border-accent/70 cursor-pointer">
            ${opts || '<option>(add skills first)</option>'}
          </select>
        </div>
        <div>
          <p class="text-[10px] text-muted font-medium mb-1">Rating 1–5</p>
          <select class="a-rating w-full bg-bg border border-line text-ink px-2 py-1.5 rounded-lg text-xs focus:outline-none focus:border-accent/70 cursor-pointer">
            ${[1,2,3,4,5].map(n => `<option>${n}</option>`).join('')}
          </select>
        </div>
        <div>
          <p class="text-[10px] text-muted font-medium mb-1">Source</p>
          <select class="a-source w-full bg-bg border border-line text-ink px-2 py-1.5 rounded-lg text-xs focus:outline-none focus:border-accent/70 cursor-pointer">
            ${Object.entries(SOURCES).map(([k,v]) => `<option value="${k}">${v}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="a-note-wrap hidden">
        <p class="text-[10px] text-muted font-medium mb-1">Note <span class="text-warm">(required for manual adjustment)</span></p>
        <input class="a-note w-full bg-bg border border-line text-ink px-2 py-1.5 rounded-lg text-xs placeholder-muted/60 focus:outline-none focus:border-accent/70" placeholder="Reason for this rating" />
      </div>
      <div class="flex items-center gap-3">
        <button class="a-save bg-accent text-bg text-xs font-semibold px-4 py-1.5 rounded-lg hover:brightness-110 transition-all cursor-pointer">Save rating</button>
        <span class="a-msg text-xs"></span>
      </div>
    </div>`;
  const sourceSel = area.querySelector('.a-source');
  const noteWrap  = area.querySelector('.a-note-wrap');
  sourceSel.onchange = () => noteWrap.classList.toggle('hidden', sourceSel.value !== 'MANUAL_ADJUSTMENT');
  area.querySelector('.a-save').onclick = async () => {
    const body = {
      skillId: area.querySelector('.a-skill').value,
      rating:  +area.querySelector('.a-rating').value,
      source:  sourceSel.value,
      note:    area.querySelector('.a-note').value.trim() || undefined,
    };
    const res = await fetch(`/api/people/${personId}/skills`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    if (res.ok) { area.innerHTML = ''; area.dataset.open = '0'; load(); }
    else { const e = await res.json().catch(() => ({})); msg(area.querySelector('.a-msg'), [].concat(e.message || 'Failed').join(', '), 'err'); }
  };
}

async function showChange(psId, chip) {
  const area = chip.closest('td').querySelector('[id^="area-"]');
  const hist = await (await fetch(`/api/person-skills/${psId}/history`)).json();
  const histHtml = hist.map(h => {
    const arrow = h.oldRating == null ? `— → ${h.newRating}` : `${h.oldRating} → ${h.newRating}`;
    return `<div class="flex items-start gap-2 py-2 border-b border-line last:border-0">
      <span class="w-1.5 h-1.5 rounded-full bg-muted/50 mt-1.5 shrink-0"></span>
      <span class="text-xs">
        <b class="text-ink">${arrow}</b>
        <span class="text-muted"> · ${SOURCES[h.source] || h.source}</span>
        ${h.note ? `<span class="text-muted"> · "${esc(h.note)}"</span>` : ''}
        <span class="text-muted"> · ${new Date(h.createdAt).toLocaleDateString()}</span>
      </span>
    </div>`;
  }).join('') || '<p class="text-xs text-muted py-2">No history.</p>';

  area.dataset.open = '1';
  area.innerHTML = `
    <div class="bg-panel2 border border-line rounded-xl p-4 mt-3 space-y-3">
      <div class="grid grid-cols-2 gap-2">
        <div>
          <p class="text-[10px] text-muted font-medium mb-1">New rating 1–5</p>
          <select class="c-rating w-full bg-bg border border-line text-ink px-2 py-1.5 rounded-lg text-xs focus:outline-none focus:border-accent/70 cursor-pointer">
            ${[1,2,3,4,5].map(n => `<option>${n}</option>`).join('')}
          </select>
        </div>
        <div>
          <p class="text-[10px] text-muted font-medium mb-1">Source</p>
          <select class="c-source w-full bg-bg border border-line text-ink px-2 py-1.5 rounded-lg text-xs focus:outline-none focus:border-accent/70 cursor-pointer">
            ${Object.entries(SOURCES).map(([k,v]) => `<option value="${k}">${v}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="c-note-wrap">
        <p class="text-[10px] text-muted font-medium mb-1">Note <span class="text-warm">(required for manual adjustment)</span></p>
        <input class="c-note w-full bg-bg border border-line text-ink px-2 py-1.5 rounded-lg text-xs placeholder-muted/60 focus:outline-none focus:border-accent/70" placeholder="Reason for the change" />
      </div>
      <div class="flex items-center gap-3">
        <button class="c-save bg-accent text-bg text-xs font-semibold px-4 py-1.5 rounded-lg hover:brightness-110 transition-all cursor-pointer">Apply change</button>
        <button class="c-remove btn-del">Remove skill</button>
        <span class="c-msg text-xs"></span>
      </div>
      <div class="border-t border-line pt-3">
        <p class="text-[10px] font-semibold uppercase tracking-wider text-muted mb-2">History</p>
        ${histHtml}
      </div>
    </div>`;
  const sourceSel = area.querySelector('.c-source');
  const noteWrap  = area.querySelector('.c-note-wrap');
  sourceSel.value = 'MANUAL_ADJUSTMENT';
  sourceSel.onchange = () => noteWrap.classList.toggle('hidden', sourceSel.value !== 'MANUAL_ADJUSTMENT');
  area.querySelector('.c-save').onclick = async () => {
    const body = {
      newRating: +area.querySelector('.c-rating').value,
      source:    sourceSel.value,
      note:      area.querySelector('.c-note').value.trim() || undefined,
    };
    const res = await fetch(`/api/person-skills/${psId}/rating`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    if (res.ok) { area.innerHTML = ''; load(); }
    else { const e = await res.json().catch(() => ({})); msg(area.querySelector('.c-msg'), [].concat(e.message || 'Failed').join(', '), 'err'); }
  };
  area.querySelector('.c-remove').onclick = async () => {
    if (!confirm('Remove this skill from the person?')) return;
    const res = await fetch(`/api/person-skills/${psId}`, { method: 'DELETE' });
    if (res.ok) { area.innerHTML = ''; load(); }
    else msg(area.querySelector('.c-msg'), 'Failed', 'err');
  };
}

// Called after load() so producer/PM dropdowns in the Projects form stay in sync.
function populatePersonDropdowns() {
  const opts = '<option value="">— none —</option>' +
    PEOPLE.map(p => `<option value="${p.id}">${esc(p.name)} (${esc(p.role)})</option>`).join('');
  $('p-producer').innerHTML = opts;
  $('p-pm').innerHTML = opts;
}

$('add').addEventListener('click', addPerson);
