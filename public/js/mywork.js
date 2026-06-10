// ══════════════════════════════════════════════════════════════
// MY WORK — personal dashboard for the logged-in user
// Depends on: $, esc, msg, coBadge  (index.html)
//             STAGE_LABEL, STAGE_CLS  (assets.js)
//             STATUS_LABEL, PRI_CLS, QUADRANT_LABEL  (projects.js)
// ══════════════════════════════════════════════════════════════

// Shared date formatter (short, e.g. "12 Jun")
function mwDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

// Days until a date (negative = overdue)
function daysUntil(iso) {
  if (!iso) return null;
  return Math.round((new Date(iso).getTime() - Date.now()) / 86_400_000);
}

function dueBadge(iso) {
  if (!iso) return '<span class="text-muted text-[11px]">No due date</span>';
  const d = daysUntil(iso);
  const cls = d < 0  ? 'text-warm font-semibold'
            : d <= 7 ? 'text-yellow-400 font-semibold'
            : 'text-muted';
  const label = d < 0  ? `${Math.abs(d)}d overdue`
              : d === 0 ? 'Due today'
              : d === 1 ? 'Due tomorrow'
              : `${d}d`;
  return `<span class="${cls} text-[11px]">${label}</span>`;
}

function priChipMW(p) {
  const cls = (typeof PRI_CLS !== 'undefined' ? PRI_CLS : {})[p] || 'text-muted';
  return `<span class="text-[11px] ${cls}">${p ?? '—'}</span>`;
}

function stageBadge(s) {
  const label = (typeof STAGE_LABEL !== 'undefined' ? STAGE_LABEL : {})[s] || s;
  const cls   = (typeof STAGE_CLS   !== 'undefined' ? STAGE_CLS   : {})[s] || 'bg-panel2 border-line text-muted';
  return `<span class="badge border ${cls} text-[10px]">${label}</span>`;
}

function leadStatusBadge(s) {
  const cls = s === 'QUALIFICATION' ? 'text-muted'
            : s === 'PROPOSAL'      ? 'text-sky-400'
            : s === 'NEGOTIATION'   ? 'text-yellow-400'
            : 'text-muted';
  const label = { QUALIFICATION:'Qualification', PROPOSAL:'Proposal', NEGOTIATION:'Negotiation' }[s] || s;
  return `<span class="text-[11px] ${cls}">${label}</span>`;
}

// ── main load ─────────────────────────────────────────────────

async function loadMyWork() {
  $('mw-content').innerHTML =
    '<div class="text-center text-muted text-sm py-16">Loading…</div>';

  const data = await fetch('/api/me/dashboard').then(r => r.json()).catch(() => null);
  if (!data) {
    $('mw-content').innerHTML =
      '<div class="text-center text-muted text-sm py-16">Could not load personal dashboard.</div>';
    return;
  }
  renderMyWork(data);
}

function renderMyWork(data) {
  const { profile, myCapacity, assignedAssets, myProjects, signOffQueue, activeLeads, paymentAlerts } = data;
  const role = profile.role;

  // ── stats strip ────────────────────────────────────────────
  const parts = [];
  if (myProjects.length)    parts.push(`<span class="text-ink font-semibold">${myProjects.length}</span><span class="text-muted"> project${myProjects.length !== 1 ? 's' : ''}</span>`);
  if (signOffQueue.length)  parts.push(`<span class="${signOffQueue.length > 0 ? 'text-yellow-400' : 'text-ink'} font-semibold">${signOffQueue.length}</span><span class="text-muted"> awaiting sign-off</span>`);
  if (assignedAssets.length) parts.push(`<span class="text-ink font-semibold">${assignedAssets.length}</span><span class="text-muted"> assigned to me</span>`);
  if (paymentAlerts.length)  parts.push(`<span class="text-warm font-semibold">${paymentAlerts.length}</span><span class="text-muted"> payment alert${paymentAlerts.length !== 1 ? 's' : ''}</span>`);

  $('mw-stats').innerHTML = parts.length
    ? parts.join(' <span class="text-line mx-2">·</span> ')
    : '<span class="text-muted">Nothing needs your attention right now.</span>';

  // ── no person link banner ──────────────────────────────────
  if (!profile.hasPersonLink) {
    $('mw-no-link').classList.remove('hidden');
  } else {
    $('mw-no-link').classList.add('hidden');
  }

  // ── build sections ────────────────────────────────────────
  let html = '';

  // Row 1: capacity + assigned assets (side by side on wide screens)
  const hasCapacity = myCapacity.length > 0;
  const hasAssigned = assignedAssets.length > 0;

  if (hasCapacity || hasAssigned) {
    html += `<div class="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">`;
    html += hasCapacity ? renderCapacity(myCapacity) : '';
    html += hasAssigned ? renderAssignedAssets(assignedAssets) : '';
    if (!hasCapacity || !hasAssigned) html += '<div></div>'; // keep grid balanced
    html += `</div>`;
  }

  // My Projects (PM / PRODUCER / ADMIN)
  if (myProjects.length) {
    html += renderMyProjects(myProjects, role);
  }

  // Sign-off queue
  if (signOffQueue.length) {
    html += renderSignOffQueue(signOffQueue);
  }

  // Active leads (SALES)
  if (activeLeads.length) {
    html += renderActiveLeads(activeLeads);
  }

  // Payment alerts (FINANCE / ADMIN / PM)
  if (paymentAlerts.length) {
    html += renderPaymentAlerts(paymentAlerts);
  }

  // Empty state
  if (!html) {
    html = `<div class="bg-panel border border-line rounded-xl p-10 text-center text-muted text-sm">
      ${profile.hasPersonLink
        ? 'Nothing assigned yet. Projects, assets, and capacity will appear here as they are set up.'
        : 'Ask an admin to link your account to a staff record to see your personal view here.'}
    </div>`;
  }

  $('mw-content').innerHTML = html;

  // Wire sign-off buttons (injected into the DOM above)
  $('mw-content').querySelectorAll('[data-mw-signoff]').forEach(btn => {
    btn.onclick = async () => {
      btn.disabled = true;
      btn.textContent = '…';
      const res = await fetch(`/api/me/sign-off/${btn.dataset.mwSignoff}`, { method: 'PATCH' });
      if (res.ok) loadMyWork();
    };
  });
}

// ── section renderers ─────────────────────────────────────────

function renderCapacity(entries) {
  // Group by weekStart label
  const weeks = {};
  for (const e of entries) {
    const label = mwDate(e.weekStart) + ' week';
    if (!weeks[label]) weeks[label] = [];
    weeks[label].push(e);
  }

  const rows = Object.entries(weeks).map(([week, allocs]) => {
    const items = allocs.map(e => {
      const pct = e.pctWeek;
      const barCls = pct > 100 ? 'bg-warm' : pct >= 80 ? 'bg-accent' : 'bg-muted/50';
      return `<div class="flex items-center gap-2 py-1 border-b border-line/40 last:border-0">
        <div class="flex-1 min-w-0">
          <p class="text-xs text-ink truncate">${esc(e.project.name)}</p>
          <p class="text-[11px] text-muted">${e.role === 'MAIN' ? 'Main' : 'Support'}</p>
        </div>
        <div class="flex items-center gap-1.5 shrink-0">
          <div class="w-14 h-1.5 bg-line rounded-full overflow-hidden">
            <div class="h-full ${barCls} rounded-full" style="width:${Math.min(pct,100)}%"></div>
          </div>
          <span class="text-[11px] text-muted w-8 text-right">${pct}%</span>
        </div>
      </div>`;
    }).join('');
    return `<div class="mb-3 last:mb-0">
      <p class="text-[10px] font-semibold uppercase tracking-wider text-muted mb-1.5">${week}</p>
      ${items}
    </div>`;
  }).join('');

  return `<div class="bg-panel border border-line rounded-xl p-5">
    <h2 class="text-[11px] font-semibold uppercase tracking-widest text-muted mb-3">My Capacity</h2>
    ${rows || '<p class="text-xs text-muted">No allocations for the next two weeks.</p>'}
  </div>`;
}

function renderAssignedAssets(assets) {
  const rows = assets.map(a => `
    <div class="flex items-start gap-2 py-2 border-b border-line/40 last:border-0">
      <div class="flex-1 min-w-0">
        <p class="text-xs font-semibold text-ink truncate">${esc(a.name)}</p>
        <p class="text-[11px] text-muted truncate">${esc(a.project.name)}</p>
      </div>
      <div class="shrink-0 pt-0.5">${stageBadge(a.stage)}</div>
    </div>`).join('');

  return `<div class="bg-panel border border-line rounded-xl p-5">
    <h2 class="text-[11px] font-semibold uppercase tracking-widest text-muted mb-3">Assigned to Me</h2>
    ${rows || '<p class="text-xs text-muted">No assets assigned.</p>'}
  </div>`;
}

function renderMyProjects(projects, role) {
  const header = role === 'PM' ? 'My Projects (PM)' : role === 'PRODUCER' ? 'My Projects (Producer)' : 'All Active Projects';

  const rows = projects.map(p => {
    const alertCount = (p.assets || []).filter(a => !a.cdSignedOff || a.stage === 'REVISION').length;
    const teamNames  = (p.capacityEntries || []).map(e => e.person.name).join(', ') || '—';
    const docsAlert  = (p.accountingDocuments || []).filter(d => {
      if (!d.dueDate) return false;
      return daysUntil(d.dueDate) <= 14;
    });

    return `<tr class="border-b border-line/60 hover:bg-panel2/50 transition-colors">
      <td class="py-2.5 px-3 text-xs font-semibold text-ink">${esc(p.name)}</td>
      <td class="py-2.5 px-3">${priChipMW(p.priority)}</td>
      <td class="py-2.5 px-3 text-[11px] text-muted">${mwDate(p.deadline)} ${dueBadge(p.deadline)}</td>
      <td class="py-2.5 px-3">
        ${alertCount > 0
          ? `<span class="text-yellow-400 text-[11px] font-semibold">${alertCount} need attention</span>`
          : '<span class="text-muted text-[11px]">OK</span>'}
      </td>
      <td class="py-2.5 px-3 text-[11px] text-muted max-w-[160px] truncate" title="${esc(teamNames)}">${esc(teamNames)}</td>
      <td class="py-2.5 px-3">
        ${docsAlert.length > 0
          ? `<span class="text-warm text-[11px] font-semibold">${docsAlert.length} doc${docsAlert.length !== 1 ? 's' : ''} due</span>`
          : ''}
      </td>
    </tr>`;
  }).join('');

  return `<div class="bg-panel border border-line rounded-xl p-5 mb-5">
    <h2 class="text-[11px] font-semibold uppercase tracking-widest text-muted mb-3">${header}</h2>
    <div class="overflow-x-auto -mx-5 px-5">
      <table class="w-full min-w-[600px] text-sm">
        <thead>
          <tr class="border-b border-line">
            <th class="text-left pb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted">Project</th>
            <th class="text-left pb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted">Pri</th>
            <th class="text-left pb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted">Deadline</th>
            <th class="text-left pb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted">Assets</th>
            <th class="text-left pb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted">Team this week</th>
            <th class="text-left pb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted">Billing</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    ${!rows ? '<p class="text-xs text-muted text-center py-4">No active projects.</p>' : ''}
  </div>`;
}

function renderSignOffQueue(assets) {
  const rows = assets.map(a => `
    <tr class="border-b border-line/60 hover:bg-panel2/50 transition-colors">
      <td class="py-2.5 px-3">
        <p class="text-xs font-semibold text-ink">${esc(a.name)}</p>
        ${a.assignedTo ? `<p class="text-[11px] text-muted">${esc(a.assignedTo.name)}</p>` : ''}
      </td>
      <td class="py-2.5 px-3">
        <p class="text-xs text-ink">${esc(a.project.name)}</p>
        <p class="text-[11px] text-muted">${priChipMW(a.project.priority)}</p>
      </td>
      <td class="py-2.5 px-3"><span class="text-yellow-400 text-[11px]">Awaiting sign-off</span></td>
      <td class="py-2.5 px-3 text-right">
        <button data-mw-signoff="${a.id}"
          class="text-[11px] bg-accent/15 text-accent border border-accent/30 px-2.5 py-1 rounded-md
                 hover:bg-accent/25 transition-colors cursor-pointer font-semibold">
          Sign Off
        </button>
      </td>
    </tr>`).join('');

  return `<div class="bg-panel border border-line rounded-xl p-5 mb-5">
    <h2 class="text-[11px] font-semibold uppercase tracking-widest text-muted mb-3">
      Sign-off Queue <span class="text-yellow-400">· ${assets.length} pending</span>
    </h2>
    <div class="overflow-x-auto -mx-5 px-5">
      <table class="w-full min-w-[480px] text-sm">
        <thead>
          <tr class="border-b border-line">
            <th class="text-left pb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted">Asset</th>
            <th class="text-left pb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted">Project</th>
            <th class="text-left pb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted">Status</th>
            <th class="pb-2 px-3"></th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  </div>`;
}

function renderActiveLeads(leads) {
  const rows = leads.map(l => `
    <tr class="border-b border-line/60 hover:bg-panel2/50 transition-colors">
      <td class="py-2.5 px-3 text-xs font-semibold text-ink">${esc(l.name)}</td>
      <td class="py-2.5 px-3 text-[11px] text-muted">${esc(l.account?.name || '—')}</td>
      <td class="py-2.5 px-3">${leadStatusBadge(l.status)}</td>
      <td class="py-2.5 px-3 text-[11px] text-muted">${l.estimatedValue ? 'RM ' + l.estimatedValue.toLocaleString() : '—'}</td>
    </tr>`).join('');

  return `<div class="bg-panel border border-line rounded-xl p-5 mb-5">
    <h2 class="text-[11px] font-semibold uppercase tracking-widest text-muted mb-3">Active Leads</h2>
    <div class="overflow-x-auto -mx-5 px-5">
      <table class="w-full min-w-[400px] text-sm">
        <thead>
          <tr class="border-b border-line">
            <th class="text-left pb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted">Lead</th>
            <th class="text-left pb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted">Account</th>
            <th class="text-left pb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted">Stage</th>
            <th class="text-left pb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted">Value</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  </div>`;
}

function renderPaymentAlerts(docs) {
  const rows = docs.map(d => `
    <tr class="border-b border-line/60 hover:bg-panel2/50 transition-colors">
      <td class="py-2.5 px-3 text-xs font-semibold text-ink">${esc(d.docNo)}</td>
      <td class="py-2.5 px-3 text-[11px] text-muted">${esc(d.project?.name || d.debtorName || '—')}</td>
      <td class="py-2.5 px-3 text-[11px] text-muted">${d.amount ? 'RM ' + d.amount.toLocaleString() : '—'}</td>
      <td class="py-2.5 px-3">${dueBadge(d.dueDate)}</td>
    </tr>`).join('');

  return `<div class="bg-panel border border-line rounded-xl p-5 mb-5">
    <h2 class="text-[11px] font-semibold uppercase tracking-widest text-muted mb-3">
      Payment Alerts <span class="text-warm">· Due within 14 days</span>
    </h2>
    <div class="overflow-x-auto -mx-5 px-5">
      <table class="w-full min-w-[400px] text-sm">
        <thead>
          <tr class="border-b border-line">
            <th class="text-left pb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted">Doc</th>
            <th class="text-left pb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted">Project / Client</th>
            <th class="text-left pb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted">Amount</th>
            <th class="text-left pb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted">Due</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  </div>`;
}
