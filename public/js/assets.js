// ══════════════════════════════════════════════════════════════
// ASSETS
// Depends on: $, msg, esc, matchesFilter, coBadge  (index.html)
// ══════════════════════════════════════════════════════════════

const STAGE_LABEL = {
  BRIEF:            'Brief',
  WIP:              'WIP',
  INTERNAL_REVIEW:  'Internal Review',
  REVISION:         'Revision',
  FINAL_DELIVERY:   'Final Delivery',
};

const STAGE_CLS = {
  BRIEF:            'bg-panel2 border-line text-muted',
  WIP:              'bg-sky-500/15 border-sky-500/30 text-sky-400',
  INTERNAL_REVIEW:  'bg-yellow-500/15 border-yellow-500/30 text-yellow-400',
  REVISION:         'bg-warm/15 border-warm/30 text-warm',
  FINAL_DELIVERY:   'bg-emerald-500/15 border-emerald-500/30 text-emerald-400',
};

const STAGE_ORDER = ['BRIEF', 'WIP', 'INTERNAL_REVIEW', 'REVISION', 'FINAL_DELIVERY'];

// ── project selector (shared between add form and filter) ─────

let _allProjects = [];
let _allPeople   = [];

async function loadAssetProjects() {
  [_allProjects, _allPeople] = await Promise.all([
    fetch('/api/projects').then(r => r.json()).catch(() => []),
    fetch('/api/people').then(r => r.json()).catch(() => []),
  ]);
  const active      = _allProjects.filter(p => !['DELIVERED', 'CANCELLED'].includes(p.status));
  const activePeople = _allPeople.filter(p => !p.warmPool)
                                  .sort((a, b) => a.name.localeCompare(b.name));

  // Add form project selector
  const addSel = $('asset-project');
  if (addSel) {
    addSel.innerHTML = '<option value="">— select project —</option>' +
      active.sort((a, b) => a.name.localeCompare(b.name))
            .map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('');
  }

  // Assignee selector (add form)
  const assigneeSel = $('asset-assignee');
  if (assigneeSel) {
    assigneeSel.innerHTML = '<option value="">— unassigned —</option>' +
      activePeople.map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('');
  }

  // Filter selector
  const filterSel = $('asset-filter-project');
  if (filterSel) {
    filterSel.innerHTML = '<option value="">All projects</option>' +
      _allProjects.sort((a, b) => a.name.localeCompare(b.name))
                  .map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('');
  }
}

// ── load & render ─────────────────────────────────────────────

async function loadAssets() {
  const projectId = $('asset-filter-project')?.value || '';
  const url = '/api/assets' + (projectId ? '?projectId=' + projectId : '');
  const all = await fetch(url).then(r => r.json()).catch(() => []);

  // Apply company filter
  const assets = all.filter(a => matchesFilter(a.project.company));

  renderAssetStats(assets);
  renderAssetBoard(assets);
}

function renderAssetStats(assets) {
  const el = $('asset-stats');
  if (!el) return;
  const counts = {};
  for (const s of STAGE_ORDER) counts[s] = 0;
  for (const a of assets) counts[a.stage] = (counts[a.stage] || 0) + 1;

  el.innerHTML = STAGE_ORDER
    .filter(s => counts[s] > 0)
    .map(s => `<span class="text-ink font-semibold">${counts[s]}</span><span class="text-muted"> ${STAGE_LABEL[s]}</span>`)
    .join(' <span class="text-line mx-1.5">·</span> ') ||
    '<span class="text-muted">No assets yet.</span>';
}

function renderAssetBoard(assets) {
  const board = $('asset-board');
  if (!board) return;

  if (!assets.length) {
    board.innerHTML = '<div class="text-center text-muted text-sm py-10">No assets yet — add one on the left.</div>';
    return;
  }

  // Group by stage
  const byStage = {};
  for (const s of STAGE_ORDER) byStage[s] = [];
  for (const a of assets) {
    if (byStage[a.stage]) byStage[a.stage].push(a);
  }

  // Render as stage columns
  board.innerHTML = `<div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">` +
    STAGE_ORDER.map(stage => {
      const items   = byStage[stage];
      const cls     = STAGE_CLS[stage];
      const label   = STAGE_LABEL[stage];
      const cards   = items.map(a => renderAssetCard(a)).join('');
      const empty   = items.length ? '' :
        '<p class="text-xs text-muted text-center py-4">—</p>';
      return `<div class="flex flex-col gap-2">
        <div class="flex items-center justify-between mb-1">
          <span class="badge border ${cls} text-[11px]">${label}</span>
          <span class="text-[11px] text-muted">${items.length}</span>
        </div>
        ${cards}${empty}
      </div>`;
    }).join('') +
  `</div>`;

  // Wire up inline controls
  board.querySelectorAll('[data-asset-stage]').forEach(sel => {
    sel.onchange = async () => {
      const id    = sel.dataset.assetStage;
      const stage = sel.value;
      // CD sign-off row visibility
      const cdRow = document.getElementById('cd-row-' + id);
      if (cdRow) cdRow.classList.toggle('hidden', stage !== 'INTERNAL_REVIEW');
      await fetch(`/api/assets/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage }),
      });
      loadAssets();
    };
  });

  board.querySelectorAll('[data-asset-cd]').forEach(cb => {
    cb.onchange = async () => {
      await fetch(`/api/assets/${cb.dataset.assetCd}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cdSignedOff: cb.checked }),
      });
    };
  });

  board.querySelectorAll('[data-asset-assignee]').forEach(sel => {
    sel.onchange = async () => {
      await fetch(`/api/assets/${sel.dataset.assetAssignee}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignedToId: sel.value || null }),
      });
    };
  });

  board.querySelectorAll('[data-asset-del]').forEach(b => {
    b.onclick = () => removeAsset(b.dataset.assetDel);
  });
}

function renderAssetCard(a) {
  const stageSel = STAGE_ORDER.map(s =>
    `<option value="${s}"${a.stage === s ? ' selected' : ''}>${STAGE_LABEL[s]}</option>`
  ).join('');

  const cdRow = a.stage === 'INTERNAL_REVIEW'
    ? `<div id="cd-row-${a.id}" class="flex items-center gap-1.5 mt-1.5">
        <input type="checkbox" id="cd-${a.id}" data-asset-cd="${a.id}"
          ${a.cdSignedOff ? 'checked' : ''}
          class="accent-accent w-3.5 h-3.5 cursor-pointer" />
        <label for="cd-${a.id}" class="text-[11px] text-muted cursor-pointer">CD signed off</label>
        ${a.cdSignedOff ? '<span class="text-[11px] text-accent font-semibold">✓</span>' : '<span class="text-[11px] text-warm">pending</span>'}
      </div>`
    : `<div id="cd-row-${a.id}" class="hidden"></div>`;

  // Assignee dropdown — populated from the already-loaded _allPeople list
  const peopleSel = [{ id: '', name: '— unassigned —' }, ..._allPeople.filter(p => !p.warmPool)]
    .map(p => `<option value="${p.id}"${a.assignedTo?.id === p.id ? ' selected' : ''}>${esc(p.name)}</option>`)
    .join('');

  return `<div class="bg-panel2 border border-line rounded-xl p-3 space-y-2">
    <div class="flex items-start justify-between gap-1">
      <p class="text-xs font-semibold text-ink leading-snug flex-1">${esc(a.name)}</p>
      <button class="btn-del shrink-0" data-asset-del="${a.id}">×</button>
    </div>
    ${a.description ? `<p class="text-[11px] text-muted leading-snug">${esc(a.description)}</p>` : ''}
    <div class="flex items-center gap-1.5 flex-wrap">
      ${coBadge(a.project.company)}
      <span class="text-[11px] text-muted truncate">${esc(a.project.name)}</span>
    </div>
    <select data-asset-stage="${a.id}"
      class="w-full bg-panel border border-line text-ink px-2 py-1 rounded-md text-xs
             focus:outline-none focus:border-accent/70 cursor-pointer">
      ${stageSel}
    </select>
    <select data-asset-assignee="${a.id}"
      class="w-full bg-panel border border-line text-ink px-2 py-1 rounded-md text-xs
             focus:outline-none focus:border-accent/70 cursor-pointer">
      ${peopleSel}
    </select>
    ${cdRow}
  </div>`;
}

// ── add asset ─────────────────────────────────────────────────

async function addAsset() {
  const name         = $('asset-name').value.trim();
  const projectId    = $('asset-project').value;
  const desc         = $('asset-desc').value.trim();
  const assignedToId = $('asset-assignee')?.value || undefined;
  const msgEl        = $('asset-msg');

  if (!name)      { msg(msgEl, 'Asset name is required.', 'err'); return; }
  if (!projectId) { msg(msgEl, 'Select a project.', 'err'); return; }

  const res = await fetch('/api/assets', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, projectId, description: desc || undefined, assignedToId: assignedToId || undefined }),
  });

  if (res.ok) {
    $('asset-name').value = '';
    $('asset-desc').value = '';
    msg(msgEl, 'Asset added.', 'ok');
    loadAssets();
  } else {
    const e = await res.json().catch(() => ({}));
    msg(msgEl, [].concat(e.message || 'Failed').join(', '), 'err');
  }
}

async function removeAsset(id) {
  if (!confirm('Remove this asset?')) return;
  await fetch('/api/assets/' + id, { method: 'DELETE' });
  loadAssets();
}

// ── wire up static listeners ──────────────────────────────────
$('asset-add').addEventListener('click', addAsset);
$('asset-filter-project').addEventListener('change', loadAssets);
