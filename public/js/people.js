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
let JOB_TITLES = [];
let DEPARTMENTS = [];
let PEOPLE = [];

const EMP_LABEL = {
  FULL_TIME: 'Full-time', CONTRACT: 'Contract',
  FREELANCE: 'Freelance', INTERN: 'Intern',
};

function fmtMYR(n) {
  if (n == null) return '<span class="text-muted">—</span>';
  return 'RM ' + Number(n).toLocaleString('en-MY', { maximumFractionDigits: 0 });
}

function isAdmin() {
  try { return JSON.parse(localStorage.getItem('pop-os-user') || '{}').role === 'ADMIN'; } catch { return false; }
}
// Salary is sensitive — only ADMIN and FINANCE can see it.
function canSeeSalary() {
  try { return ['ADMIN', 'FINANCE'].includes(JSON.parse(localStorage.getItem('pop-os-user') || '{}').role); } catch { return false; }
}

// Lock icon SVG — filled green if linked, outline grey if not
function lockIcon(linked) {
  return linked
    ? `<svg class="w-4 h-4 text-emerald-400" fill="currentColor" viewBox="0 0 24 24">
         <path d="M12 1a5 5 0 00-5 5v2H5a2 2 0 00-2 2v10a2 2 0 002 2h14a2 2 0 002-2V10a2 2 0 00-2-2h-2V6a5 5 0 00-5-5zm0 2a3 3 0 013 3v2H9V6a3 3 0 013-3zm0 9a2 2 0 110 4 2 2 0 010-4z"/>
       </svg>`
    : `<svg class="w-4 h-4 text-line hover:text-muted transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
         <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
           d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
       </svg>`;
}

// ── column visibility (same pattern as Projects tab) ─────────

const PEOPLE_COLS = [
  { id: 'role',   label: 'Job Title',        def: true  },
  { id: 'dept',   label: 'Dept',            def: true  },
  { id: 'type',   label: 'Employment type', def: false },
  { id: 'start',  label: 'Start date',      def: false },
  { id: 'salary', label: 'Salary',          def: false, restricted: true },
  { id: 'skills', label: 'Skills',          def: true  },
];

function getPeopleColVis() {
  const saved = JSON.parse(localStorage.getItem('pop-os-people-cols') || 'null') || {};
  const vis = {};
  PEOPLE_COLS.forEach(c => { vis[c.id] = c.id in saved ? saved[c.id] : c.def; });
  return vis;
}

function applyPeopleColVisibility() {
  const vis = getPeopleColVis();
  PEOPLE_COLS.forEach(c => {
    document.querySelectorAll(`[data-pcol="${c.id}"]`).forEach(el => {
      el.classList.toggle('hidden', !vis[c.id]);
    });
  });
}

function togglePeopleCol(id, visible) {
  const vis = getPeopleColVis();
  vis[id] = visible;
  localStorage.setItem('pop-os-people-cols', JSON.stringify(vis));
  applyPeopleColVisibility();
}

function buildPeopleColPicker() {
  const vis = getPeopleColVis();
  $('people-col-picker').innerHTML = PEOPLE_COLS.filter(c => !c.restricted || canSeeSalary()).map(c => `
    <label class="flex items-center gap-2.5 px-3 py-2 hover:bg-panel2/60 cursor-pointer">
      <input type="checkbox" ${vis[c.id] ? 'checked' : ''}
        onchange="togglePeopleCol('${c.id}', this.checked)"
        class="accent-accent w-3.5 h-3.5 cursor-pointer" />
      <span class="text-xs text-ink">${c.label}</span>
    </label>`).join('');
}

function togglePeopleColPicker() {
  const picker = $('people-col-picker');
  if (picker.classList.contains('hidden')) {
    buildPeopleColPicker();
    picker.classList.remove('hidden');
    setTimeout(() => document.addEventListener('click', function h(e) {
      if (!picker.contains(e.target) && !e.target.closest('button[onclick="togglePeopleColPicker()"]')) {
        picker.classList.add('hidden');
        document.removeEventListener('click', h);
      }
    }), 0);
  } else {
    picker.classList.add('hidden');
  }
}

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

async function loadJobTitles() {
  JOB_TITLES = await (await fetch('/api/job-titles')).json();

  // Render master list chips (admin only — others see the list read-only)
  const listEl = $('jobTitleList');
  if (listEl) {
    listEl.innerHTML = JOB_TITLES.length
      ? JOB_TITLES.map(jt =>
          isAdmin()
            ? `<span class="inline-flex items-center gap-1 bg-panel2 border border-line px-2.5 py-0.5 rounded-full text-xs text-ink">
                 ${esc(jt.name)}
                 <button onclick="removeJobTitle('${jt.id}')" title="Remove"
                   class="text-muted hover:text-warm ml-0.5 leading-none cursor-pointer">×</button>
               </span>`
            : `<span class="inline-flex items-center bg-panel2 border border-line px-2.5 py-0.5 rounded-full text-xs text-ink">${esc(jt.name)}</span>`
        ).join('')
      : '<span class="text-xs text-muted">No job titles yet.</span>';
  }

  // Populate add-person role dropdown
  const roleOpts = '<option value="">— select job title —</option>' +
    JOB_TITLES.map(jt => `<option value="${esc(jt.name)}">${esc(jt.name)}</option>`).join('');
  const roleSel = $('role');
  if (roleSel) roleSel.innerHTML = roleOpts;

  // Populate onboard modal job title dropdown
  const obRoleSel = $('ob-role');
  if (obRoleSel) obRoleSel.innerHTML = roleOpts;
}

async function removeJobTitle(id) {
  if (!confirm('Remove this job title from the master list?')) return;
  const res = await fetch('/api/job-titles/' + id, { method: 'DELETE' });
  if (res.ok) { msg($('jobTitleMsg'), 'Removed.', 'ok'); await loadJobTitles(); }
  else msg($('jobTitleMsg'), 'Could not remove.', 'err');
}

$('addJobTitle').addEventListener('click', async () => {
  const name = $('newJobTitle').value.trim();
  if (!name) { msg($('jobTitleMsg'), 'Enter a job title.', 'err'); return; }
  const res = await fetch('/api/job-titles', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }),
  });
  if (res.ok) {
    $('newJobTitle').value = '';
    msg($('jobTitleMsg'), 'Job title added.', 'ok');
    await loadJobTitles();
  } else {
    const e = await res.json().catch(() => ({}));
    msg($('jobTitleMsg'), [].concat(e.message || 'Failed').join(', '), 'err');
  }
});

async function loadDepartments() {
  DEPARTMENTS = await (await fetch('/api/departments')).json();

  const listEl = $('deptList');
  if (listEl) {
    listEl.innerHTML = DEPARTMENTS.length
      ? DEPARTMENTS.map(d =>
          isAdmin()
            ? `<span class="inline-flex items-center gap-1 bg-panel2 border border-line px-2.5 py-0.5 rounded-full text-xs text-ink">
                 ${esc(d.name)}
                 <button onclick="removeDepartment('${d.id}')" title="Remove"
                   class="text-muted hover:text-warm ml-0.5 leading-none cursor-pointer">×</button>
               </span>`
            : `<span class="inline-flex items-center bg-panel2 border border-line px-2.5 py-0.5 rounded-full text-xs text-ink">${esc(d.name)}</span>`
        ).join('')
      : '<span class="text-xs text-muted">No departments yet.</span>';
  }

  const deptOpts = '<option value="">— select department —</option>' +
    DEPARTMENTS.map(d => `<option value="${esc(d.name)}">${esc(d.name)}</option>`).join('');
  const deptSel = $('department');
  if (deptSel) deptSel.innerHTML = deptOpts;
  const obDeptSel = $('ob-dept');
  if (obDeptSel) obDeptSel.innerHTML = deptOpts;
}

async function removeDepartment(id) {
  if (!confirm('Remove this department from the master list?')) return;
  const res = await fetch('/api/departments/' + id, { method: 'DELETE' });
  if (res.ok) { msg($('deptMsg'), 'Removed.', 'ok'); await loadDepartments(); }
  else msg($('deptMsg'), 'Could not remove.', 'err');
}

$('addDept').addEventListener('click', async () => {
  const name = $('newDept').value.trim();
  if (!name) { msg($('deptMsg'), 'Enter a department name.', 'err'); return; }
  const res = await fetch('/api/departments', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }),
  });
  if (res.ok) {
    $('newDept').value = '';
    msg($('deptMsg'), 'Department added.', 'ok');
    await loadDepartments();
  } else {
    const e = await res.json().catch(() => ({}));
    msg($('deptMsg'), [].concat(e.message || 'Failed').join(', '), 'err');
  }
});

async function load() {
  // Hide salary column header and add-form field for non-privileged roles
  document.querySelectorAll('[data-pcol="salary"]').forEach(el => {
    el.classList.toggle('hidden', !canSeeSalary());
  });
  const salaryField = $('salary-field');
  if (salaryField) salaryField.classList.toggle('hidden', !canSeeSalary());

  // New Joiner button is admin-only (it creates a login account)
  const onboardBtn = document.querySelector('[onclick="openOnboardModal()"]');
  if (onboardBtn) onboardBtn.classList.toggle('hidden', !isAdmin());

  // Only admins can add/remove people or manage master lists
  const addPersonPanel = document.querySelector('#tab-people .space-y-4 > .bg-panel');
  if (addPersonPanel) addPersonPanel.classList.toggle('hidden', !isAdmin());
  const skillMasterPanel = $('skill-master-panel');
  if (skillMasterPanel) skillMasterPanel.classList.toggle('hidden', !isAdmin());
  const jobTitleMasterPanel = $('job-title-master-panel');
  if (jobTitleMasterPanel) jobTitleMasterPanel.classList.toggle('hidden', !isAdmin());
  const deptMasterPanel = $('dept-master-panel');
  if (deptMasterPanel) deptMasterPanel.classList.toggle('hidden', !isAdmin());

  // Load master lists and people data in parallel
  await Promise.all([
    loadSkills(),
    loadJobTitles(),
    loadDepartments(),
    (async () => { PEOPLE = await (await fetch('/api/people')).json(); })(),
  ]);

  // Populate department filter from loaded data.
  const deptSel = $('people-filter-dept');
  if (deptSel) {
    const depts = [...new Set(PEOPLE.map(p => p.department).filter(Boolean))].sort();
    deptSel.innerHTML = '<option value="">All departments</option>' +
      depts.map(d => `<option value="${d}">${esc(d)}</option>`).join('');
  }

  renderPeople();
  populatePersonDropdowns();
}

function renderPeople() {
  const search = ($('people-search')?.value || '').toLowerCase();
  const dept   = $('people-filter-dept')?.value  || '';
  const type   = $('people-filter-type')?.value  || '';

  const visible = PEOPLE.filter(p => {
    if (!matchesFilter(p.company)) return false;
    if (dept && p.department    !== dept) return false;
    if (type && p.employmentType !== type) return false;
    if (search) {
      const hay = ((p.name || '') + ' ' + (p.role || '') + ' ' + (p.department || '')).toLowerCase();
      if (!hay.includes(search)) return false;
    }
    return true;
  });

  const rows = $('rows'); rows.innerHTML = '';
  $('empty').classList.toggle('hidden', visible.length > 0);
  for (const p of visible) {
    const skills = (p.skills || []).map(ps =>
      `<span class="inline-flex items-center gap-1.5 bg-panel2 border border-line px-2 py-0.5 rounded-full
                    text-xs cursor-pointer hover:border-accent/50 transition-colors"
            data-ps="${ps.id}" title="Click to update rating">
         ${esc(ps.skill.name)} ${dots(ps.rating)}
         <span class="font-bold text-accent">${ps.rating}</span>
       </span>`
    ).join('') || '<span class="text-xs text-muted">No skills rated</span>';

    const STATUS_BADGE = {
      ACTIVE:     '<span class="badge bg-accent/15 text-accent">Active</span>',
      WARM_POOL:  '<span class="badge bg-warm/15 text-warm">Warm pool</span>',
      RESIGNED:   '<span class="badge bg-zinc-500/15 text-zinc-400">Resigned</span>',
      TERMINATED: '<span class="badge bg-rose-500/15 text-rose-400">Terminated</span>',
    };
    const statusBadge = STATUS_BADGE[p.status] || STATUS_BADGE.ACTIVE;
    const companyBadge = coBadge(p.company);

    const startDate = p.startDate
      ? new Date(p.startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
      : '—';

    const tr = document.createElement('tr');
    tr.className = 'border-b border-line hover:bg-panel2/40 transition-colors';
    tr.innerHTML = `
      <td class="py-3 px-2 font-medium whitespace-nowrap">
        ${isAdmin()
          ? `<button class="text-ink hover:text-accent transition-colors cursor-pointer text-left"
               onclick="openPersonProfile('${p.id}')">${esc(p.name)}</button>`
          : esc(p.name)}${companyBadge}
      </td>
      <td data-pcol="role"   class="py-3 px-2 text-muted text-xs whitespace-nowrap">${esc(p.role)}</td>
      <td data-pcol="dept"   class="py-3 px-2 text-muted text-xs whitespace-nowrap">${esc(p.department)}</td>
      <td data-pcol="type"   class="py-3 px-2 text-muted text-xs whitespace-nowrap">${EMP_LABEL[p.employmentType] || p.employmentType}</td>
      <td data-pcol="start"  class="py-3 px-2 text-muted text-xs whitespace-nowrap">${startDate}</td>
      <td data-pcol="salary" class="py-3 px-2 text-xs whitespace-nowrap">${canSeeSalary() ? fmtMYR(p.salary) : '—'}</td>
      <td data-pcol="skills" class="py-3 px-2">
        <div class="flex flex-wrap gap-1">${skills}</div>
        <div class="mt-2">
          <button class="btn-del" data-assign="${p.id}">+ rate a skill</button>
        </div>
        <div id="area-${p.id}"></div>
      </td>
      <td class="py-3 px-2 whitespace-nowrap">${statusBadge}</td>
      <td class="py-3 px-2 whitespace-nowrap text-center">
        <div class="flex items-center justify-center gap-1">
          ${isAdmin()
            ? `<button title="${p.user ? 'Login: ' + p.user.email : 'No login — click to create'}"
                 data-login="${p.id}" data-has-login="${p.user ? '1' : '0'}"
                 class="inline-flex items-center justify-center w-7 h-7 rounded-lg
                        hover:bg-panel2 transition-colors cursor-pointer">
                 ${lockIcon(!!p.user)}
               </button>
               <button title="${p.canSignOff ? 'Can sign off assets — click to revoke' : 'Cannot sign off — click to grant'}"
                 data-signoff-toggle="${p.id}" data-signoff-state="${p.canSignOff ? '1' : '0'}"
                 class="inline-flex items-center justify-center w-7 h-7 rounded-lg
                        hover:bg-panel2 transition-colors cursor-pointer text-sm">
                 ${p.canSignOff ? '<span class="text-emerald-400" title="">✔</span>' : '<span class="text-muted/40">✔</span>'}
               </button>`
            : (p.user ? lockIcon(true) : '')
          }
        </div>
      </td>
      ${isAdmin() ? `<td class="py-3 px-2 whitespace-nowrap">
        <div class="flex items-center gap-1.5">
          <button class="btn-edit" data-edit="${p.id}">Edit</button>
          <button class="btn-del"  data-del="${p.id}">Remove</button>
        </div>
      </td>` : '<td></td>'}`;
    rows.appendChild(tr);
  }
  rows.querySelectorAll('[data-edit]').forEach(b => {
    const person = PEOPLE.find(p => p.id === b.dataset.edit);
    b.onclick = () => openEditModal(person);
  });
  rows.querySelectorAll('[data-del]').forEach(b => b.onclick = () => openExitModal(b.dataset.del));
  rows.querySelectorAll('[data-assign]').forEach(b => b.onclick = () => showAssign(b.dataset.assign));
  rows.querySelectorAll('[data-ps]').forEach(b => b.onclick = () => showChange(b.dataset.ps, b));
  rows.querySelectorAll('[data-login]').forEach(b => {
    const person = PEOPLE.find(p => p.id === b.dataset.login);
    b.onclick = () => openLoginModal(person);
  });
  rows.querySelectorAll('[data-signoff-toggle]').forEach(b => {
    b.onclick = async () => {
      const newVal = b.dataset.signoffState !== '1';
      await fetch(`/api/people/${b.dataset.signoffToggle}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ canSignOff: newVal }),
      });
      load();
    };
  });
  applyPeopleColVisibility();
}

// Wire up people filter inputs.
['people-search', 'people-filter-dept', 'people-filter-type'].forEach(id => {
  const el = $(id);
  if (el) el.addEventListener('input', renderPeople);
});

async function addPerson() {
  const body = {
    name:           $('name').value.trim(),
    role:           $('role').value.trim(),
    department:     $('department').value.trim(),
    startDate:      $('startDate').value || new Date().toISOString().slice(0, 10),
    employmentType: $('employmentType').value,
    status:         $('status').value || 'ACTIVE',
    company:        $('company').value || undefined,
    salary:         parseFloat($('salary').value) || undefined,
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

function openExitModal(id) {
  const person = PEOPLE.find(p => p.id === id);
  if (!person) return;

  let modal = $('exit-person-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'exit-person-modal';
    modal.className = 'fixed inset-0 z-50 flex items-center justify-center';
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
    <div class="absolute inset-0 bg-bg/80 backdrop-blur-sm" onclick="closeExitModal()"></div>
    <div class="relative bg-panel border border-line rounded-2xl p-6 w-full max-w-sm mx-4 z-10">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-sm font-semibold text-ink">How is ${esc(person.name)} leaving?</h2>
        <button onclick="closeExitModal()" class="text-muted hover:text-ink text-lg leading-none cursor-pointer">×</button>
      </div>
      <p class="text-xs text-muted mb-4">The person record is kept for history. Status is updated — they will no longer appear in active staff lists.</p>
      <div class="space-y-2 mb-5">
        <label class="flex items-center gap-3 p-3 rounded-lg border border-line hover:border-accent/50 cursor-pointer transition-colors">
          <input type="radio" name="exit-status" value="WARM_POOL" class="accent-accent cursor-pointer" />
          <div>
            <p class="text-xs font-semibold text-ink">Warm pool</p>
            <p class="text-[11px] text-muted">Left on good terms — may return as freelance or contract</p>
          </div>
        </label>
        <label class="flex items-center gap-3 p-3 rounded-lg border border-line hover:border-accent/50 cursor-pointer transition-colors">
          <input type="radio" name="exit-status" value="RESIGNED" class="accent-accent cursor-pointer" />
          <div>
            <p class="text-xs font-semibold text-ink">Resigned</p>
            <p class="text-[11px] text-muted">Quit voluntarily</p>
          </div>
        </label>
        <label class="flex items-center gap-3 p-3 rounded-lg border border-line hover:border-accent/50 cursor-pointer transition-colors">
          <input type="radio" name="exit-status" value="TERMINATED" class="accent-accent cursor-pointer" />
          <div>
            <p class="text-xs font-semibold text-ink">Terminated</p>
            <p class="text-[11px] text-muted">Employment ended by the company</p>
          </div>
        </label>
      </div>
      <button onclick="submitExit('${person.id}')"
        class="w-full bg-accent text-bg text-xs font-semibold py-2.5 rounded-lg
               hover:brightness-110 transition-all cursor-pointer">
        Confirm exit
      </button>
      <div class="border-t border-line mt-4 pt-4">
        <p class="text-[11px] text-muted mb-2">Permanent delete — removes all history. Use only for test/duplicate records.</p>
        <button onclick="hardDeletePerson('${person.id}')"
          class="w-full border border-rose-500/40 text-rose-400 text-xs font-medium py-2 rounded-lg
                 hover:bg-rose-500/10 transition-colors cursor-pointer">
          Hard delete (irreversible)
        </button>
      </div>
      <div id="exit-msg" class="text-xs mt-2 min-h-[16px]"></div>
    </div>`;

  modal.classList.remove('hidden');
}

function closeExitModal() {
  const modal = $('exit-person-modal');
  if (modal) modal.classList.add('hidden');
}

async function submitExit(personId) {
  const selected = document.querySelector('input[name="exit-status"]:checked');
  if (!selected) { msg($('exit-msg'), 'Please select a reason.', 'err'); return; }

  const res = await fetch('/api/people/' + personId, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: selected.value }),
  });

  if (res.ok) {
    msg($('exit-msg'), 'Status updated.', 'ok');
    setTimeout(() => { closeExitModal(); load(); }, 600);
  } else {
    const e = await res.json().catch(() => ({}));
    msg($('exit-msg'), [].concat(e.message || 'Failed').join(', '), 'err');
  }
}

async function hardDeletePerson(id) {
  if (!confirm('Permanently delete this person and ALL their history?\n\nThis cannot be undone.')) return;
  const res = await fetch('/api/people/' + id, { method: 'DELETE' });
  if (res.ok) { closeExitModal(); msg($('msg'), 'Deleted.', 'ok'); load(); }
  else msg($('exit-msg'), 'Could not delete.', 'err');
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

// ── Login modal ───────────────────────────────────────────────────────────────

function openLoginModal(person) {
  // Build modal if it doesn't exist yet
  let modal = $('login-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'login-modal';
    modal.className = 'fixed inset-0 z-50 flex items-center justify-center';
    document.body.appendChild(modal);
  }

  if (person.user) {
    // Already linked — show info only
    modal.innerHTML = `
      <div class="absolute inset-0 bg-bg/80 backdrop-blur-sm" onclick="closeLoginModal()"></div>
      <div class="relative bg-panel border border-line rounded-2xl p-6 w-full max-w-sm mx-4 z-10">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-sm font-semibold text-ink">Login account</h2>
          <button onclick="closeLoginModal()" class="text-muted hover:text-ink text-lg leading-none cursor-pointer">×</button>
        </div>
        <div class="flex items-center gap-2 mb-4">
          <div>${lockIcon(true)}</div>
          <div>
            <p class="text-xs font-semibold text-ink">${esc(person.name)}</p>
            <p class="text-[11px] text-muted">${esc(person.user.email)}</p>
          </div>
        </div>
        <div class="bg-panel2 rounded-lg p-3 text-xs text-muted space-y-1">
          <p>Role: <span class="text-ink font-medium">${person.user.role}</span></p>
          <p>Status: <span class="${person.user.active ? 'text-emerald-400' : 'text-warm'} font-medium">${person.user.active ? 'Active' : 'Disabled'}</span></p>
        </div>
        <p class="text-[11px] text-muted mt-3">To change the password or role, use the admin User Manager (your name → Manage users).</p>
      </div>`;
  } else {
    // No login yet — show create form
    const ROLE_OPTS = [
      { v: 'STAFF',     l: 'Staff' },
      { v: 'PRODUCER',  l: 'Producer' },
      { v: 'PM',        l: 'Project Manager' },
      { v: 'TEAM_LEAD', l: 'Team Lead' },
      { v: 'SALES',     l: 'Sales' },
      { v: 'FINANCE',   l: 'Finance' },
      { v: 'ADMIN',     l: 'Admin' },
    ].map(r => `<option value="${r.v}"${r.v === 'STAFF' ? ' selected' : ''}>${r.l}</option>`).join('');

    modal.innerHTML = `
      <div class="absolute inset-0 bg-bg/80 backdrop-blur-sm" onclick="closeLoginModal()"></div>
      <div class="relative bg-panel border border-line rounded-2xl p-6 w-full max-w-sm mx-4 z-10">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-sm font-semibold text-ink">Create login for ${esc(person.name)}</h2>
          <button onclick="closeLoginModal()" class="text-muted hover:text-ink text-lg leading-none cursor-pointer">×</button>
        </div>
        <label class="block text-xs text-muted font-medium mb-1.5">Email</label>
        <input id="lm-email" class="form-input text-xs mb-3" style="margin-top:0"
          placeholder="name@pop.studio" />
        <label class="block text-xs text-muted font-medium mb-1.5">Password</label>
        <input id="lm-pw" type="password" class="form-input text-xs mb-3" style="margin-top:0"
          placeholder="Min 6 characters" />
        <label class="block text-xs text-muted font-medium mb-1.5">Role</label>
        <select id="lm-role" class="form-input text-xs cursor-pointer mb-4" style="margin-top:0">
          ${ROLE_OPTS}
        </select>
        <button onclick="createPersonLogin('${person.id}')"
          class="w-full bg-accent text-bg text-xs font-semibold py-2.5 rounded-lg
                 hover:brightness-110 transition-all cursor-pointer">
          Create login
        </button>
        <div id="lm-msg" class="text-xs mt-2 min-h-[16px]"></div>
      </div>`;
  }

  modal.classList.remove('hidden');
}

function closeLoginModal() {
  const modal = $('login-modal');
  if (modal) modal.classList.add('hidden');
}

async function createPersonLogin(personId) {
  const email = $('lm-email').value.trim();
  const pw    = $('lm-pw').value;
  const role  = $('lm-role').value;
  const msgEl = $('lm-msg');

  if (!email || !pw) { msg(msgEl, 'Email and password are required.', 'err'); return; }

  const person = PEOPLE.find(p => p.id === personId);
  const res = await fetch('/api/users', {
    method: 'POST',
    body: JSON.stringify({ name: person?.name || '', email, password: pw, role, personId }),
  });

  if (res.ok) {
    msg(msgEl, 'Login created.', 'ok');
    setTimeout(() => { closeLoginModal(); load(); }, 800);
  } else {
    const e = await res.json().catch(() => ({}));
    msg(msgEl, [].concat(e.message || 'Failed').join(', '), 'err');
  }
}

// ── New Joiner modal ──────────────────────────────────────────────────────────

function openOnboardModal() {
  // Default start date to today
  $('ob-start').value = new Date().toISOString().slice(0, 10);
  $('ob-msg').textContent = '';
  $('onboard-overlay').classList.remove('hidden');
  $('ob-name').focus();
}

function closeOnboardModal() {
  $('onboard-overlay').classList.add('hidden');
  ['ob-name','ob-role','ob-dept','ob-email','ob-pw'].forEach(id => $(id).value = '');
}

async function submitOnboard() {
  const name  = $('ob-name').value.trim();
  const role  = $('ob-role').value.trim();
  const dept  = $('ob-dept').value.trim();
  const email = $('ob-email').value.trim();
  const pw    = $('ob-pw').value;
  const msgEl = $('ob-msg');

  if (!name || !role || !dept) { msg(msgEl, 'Name, job title and department are required.', 'err'); return; }
  if (!email)                  { msg(msgEl, 'Work email is required.', 'err'); return; }
  if (pw.length < 6)           { msg(msgEl, 'Password must be at least 6 characters.', 'err'); return; }

  const body = {
    name,
    role,
    department: dept,
    startDate:      $('ob-start').value || new Date().toISOString().slice(0, 10),
    employmentType: $('ob-emptype').value,
    company:        $('ob-company').value || undefined,
    email,
    password: pw,
    systemRole: $('ob-sysrole').value,
  };

  const res = await fetch('/api/people/onboard', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (res.ok) {
    msg(msgEl, 'Joiner created with login.', 'ok');
    setTimeout(() => { closeOnboardModal(); load(); }, 800);
  } else {
    const e = await res.json().catch(() => ({}));
    msg(msgEl, [].concat(e.message || 'Failed').join(', '), 'err');
  }
}

// ── Edit Person modal ─────────────────────────────────────────────────────────

function openEditModal(person) {
  let modal = $('edit-person-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'edit-person-modal';
    modal.className = 'fixed inset-0 z-50 flex items-center justify-center';
    document.body.appendChild(modal);
  }

  const jtOpts = JOB_TITLES.map(jt =>
    `<option value="${esc(jt.name)}" ${jt.name === person.role ? 'selected' : ''}>${esc(jt.name)}</option>`
  ).join('');
  const deptOpts = DEPARTMENTS.map(d =>
    `<option value="${esc(d.name)}" ${d.name === person.department ? 'selected' : ''}>${esc(d.name)}</option>`
  ).join('');
  const startVal = person.startDate ? person.startDate.slice(0, 10) : '';
  const salaryRow = canSeeSalary() ? `
    <div>
      <label class="block text-xs text-muted font-medium mb-1.5">Monthly salary (RM)</label>
      <input id="ep-salary" type="number" min="0" class="form-input text-xs" style="margin-top:0"
        value="${person.salary ?? ''}" placeholder="Optional" />
    </div>` : '';

  modal.innerHTML = `
    <div class="absolute inset-0 bg-bg/80 backdrop-blur-sm" onclick="closeEditModal()"></div>
    <div class="relative bg-panel border border-line rounded-2xl p-6 w-full max-w-md mx-4 z-10 max-h-[90vh] overflow-y-auto">
      <div class="flex items-center justify-between mb-5">
        <h2 class="text-sm font-semibold text-ink">Edit — ${esc(person.name)}</h2>
        <button onclick="closeEditModal()" class="text-muted hover:text-ink text-lg leading-none cursor-pointer">×</button>
      </div>
      <div class="space-y-3">
        <div>
          <label class="block text-xs text-muted font-medium mb-1.5">Name</label>
          <input id="ep-name" class="form-input text-xs" style="margin-top:0" value="${esc(person.name)}" />
        </div>
        <div>
          <label class="block text-xs text-muted font-medium mb-1.5">Job title</label>
          <select id="ep-role" class="form-input text-xs cursor-pointer" style="margin-top:0">
            <option value="">— select job title —</option>
            ${jtOpts}
          </select>
        </div>
        <div>
          <label class="block text-xs text-muted font-medium mb-1.5">Department</label>
          <select id="ep-dept" class="form-input text-xs cursor-pointer" style="margin-top:0">
            <option value="">— select department —</option>
            ${deptOpts}
          </select>
        </div>
        <div>
          <label class="block text-xs text-muted font-medium mb-1.5">Start date</label>
          <input id="ep-start" type="date" class="form-input text-xs" style="margin-top:0" value="${startVal}" />
        </div>
        <div>
          <label class="block text-xs text-muted font-medium mb-1.5">Employment type</label>
          <select id="ep-emptype" class="form-input text-xs cursor-pointer" style="margin-top:0">
            ${['FULL_TIME','CONTRACT','FREELANCE','INTERN'].map(t =>
              `<option value="${t}" ${t === person.employmentType ? 'selected' : ''}>${EMP_LABEL[t]}</option>`
            ).join('')}
          </select>
        </div>
        <div>
          <label class="block text-xs text-muted font-medium mb-1.5">Company</label>
          <select id="ep-company" class="form-input text-xs cursor-pointer" style="margin-top:0">
            <option value="" ${!person.company ? 'selected' : ''}>— none —</option>
            <option value="LPS"   ${person.company === 'LPS'   ? 'selected' : ''}>LPS</option>
            <option value="PXL"   ${person.company === 'PXL'   ? 'selected' : ''}>PXL</option>
            <option value="GROUP" ${person.company === 'GROUP' ? 'selected' : ''}>Group</option>
          </select>
        </div>
        <div>
          <label class="block text-xs text-muted font-medium mb-1.5">Status</label>
          <select id="ep-status" class="form-input text-xs cursor-pointer" style="margin-top:0">
            <option value="ACTIVE"     ${person.status === 'ACTIVE'     ? 'selected' : ''}>Active</option>
            <option value="WARM_POOL"  ${person.status === 'WARM_POOL'  ? 'selected' : ''}>Warm pool</option>
            <option value="RESIGNED"   ${person.status === 'RESIGNED'   ? 'selected' : ''}>Resigned</option>
            <option value="TERMINATED" ${person.status === 'TERMINATED' ? 'selected' : ''}>Terminated</option>
          </select>
        </div>
        ${salaryRow}
      </div>
      <div class="flex items-center gap-3 mt-5">
        <button onclick="submitEdit('${person.id}')"
          class="flex-1 bg-accent text-bg text-xs font-semibold py-2.5 rounded-lg
                 hover:brightness-110 transition-all cursor-pointer">
          Save changes
        </button>
        <button onclick="closeEditModal()"
          class="px-4 py-2.5 text-xs text-muted hover:text-ink transition-colors cursor-pointer">
          Cancel
        </button>
      </div>
      <div id="ep-msg" class="text-xs mt-2 min-h-[16px]"></div>
    </div>`;

  modal.classList.remove('hidden');
}

function closeEditModal() {
  const modal = $('edit-person-modal');
  if (modal) modal.classList.add('hidden');
}

async function submitEdit(personId) {
  const body = {
    name:           $('ep-name').value.trim(),
    role:           $('ep-role').value,
    department:     $('ep-dept').value,
    startDate:      $('ep-start').value || undefined,
    employmentType: $('ep-emptype').value,
    company:        $('ep-company').value || undefined,
    status:         $('ep-status').value || undefined,
    salary:         canSeeSalary() && $('ep-salary')
                      ? (parseFloat($('ep-salary').value) || undefined)
                      : undefined,
  };
  if (!body.name) { msg($('ep-msg'), 'Name is required.', 'err'); return; }

  const res = await fetch('/api/people/' + personId, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (res.ok) {
    msg($('ep-msg'), 'Saved.', 'ok');
    setTimeout(() => { closeEditModal(); load(); }, 600);
  } else {
    const e = await res.json().catch(() => ({}));
    msg($('ep-msg'), [].concat(e.message || 'Failed').join(', '), 'err');
  }
}
