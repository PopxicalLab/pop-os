// ══════════════════════════════════════════════════════════════
// JOBS TAB — every won deal in one list
//
// A job = a won lead + its project + its money (see src/common/job.ts).
// This list is the front door: one row per job with sales stage,
// production status and money side by side. Click a row → Job page.
// Data: GET /api/jobs (money roles only — see TAB_ACCESS.jobs).
// Depends on: $, esc, coBadge, matchesFilter, LEAD_STATUS_LABEL,
//             LEAD_STATUS_CLS, STATUS_LABEL  (shared.js)
// ══════════════════════════════════════════════════════════════

let _allJobs = [];

const jobsRm   = v => v == null ? '—' : 'RM ' + Math.round(v).toLocaleString('en-MY');
const jobsDate = d => d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—';

// "In progress" = production isn't finished and the deal isn't wrapped up.
// A job with no project yet counts as in progress (it still needs one).
function jobIsDone(j) {
  return ['COMPLETED', 'LOST'].includes(j.status)
      || ['DELIVERED', 'CANCELLED'].includes(j.project?.status);
}

async function loadJobs() {
  const res = await fetch('/api/jobs');
  if (res.status === 403) {
    $('jobs-table').innerHTML = '<p class="text-sm text-muted">Jobs aren\'t available for your role.</p>';
    return;
  }
  _allJobs = res.ok ? await res.json() : [];
  renderJobs();
}

function renderJobs() {
  const search = ($('jobs-search')?.value || '').toLowerCase();
  const show   = $('jobs-show')?.value || 'active';

  const jobs = _allJobs.filter(j => {
    if (!matchesFilter(j.company)) return false;
    if (show === 'active' && jobIsDone(j))  return false;
    if (show === 'done'   && !jobIsDone(j)) return false;
    if (!search) return true;
    const hay = [j.name, j.account?.name, j.project?.producer?.name, j.project?.pm?.name, j.closedBy?.name]
      .filter(Boolean).join(' ').toLowerCase();
    return hay.includes(search);
  });

  // ── summary strip (for whatever is currently listed) ──
  const sum = (f) => jobs.reduce((s, j) => s + (f(j) || 0), 0);
  const overdue = sum(j => j.overdue);
  $('jobs-stats').innerHTML = [
    `<span class="text-ink font-semibold">${jobs.length}</span><span class="text-muted"> jobs</span>`,
    `<span class="text-ink font-semibold">${jobsRm(sum(j => j.estimatedValue))}</span><span class="text-muted"> value</span>`,
    `<span class="text-ink font-semibold">${jobsRm(sum(j => j.costTotal))}</span><span class="text-muted"> costs</span>`,
    `<span class="text-emerald-400 font-semibold">${jobsRm(sum(j => j.net))}</span><span class="text-muted"> net</span>`,
    `<span class="text-ink font-semibold">${jobsRm(sum(j => j.outstanding))}</span><span class="text-muted"> invoiced, unpaid</span>`
      + (overdue ? ` <span class="text-warm font-semibold">(${overdue} overdue)</span>` : ''),
  ].join(' <span class="text-line mx-2">·</span> ');

  if (!jobs.length) {
    $('jobs-table').innerHTML = '<p class="text-sm text-muted py-4">No jobs match.</p>';
    return;
  }

  const th = (t, right = false) =>
    `<th class="pb-2 px-2 font-medium ${right ? 'text-right' : 'text-left'} whitespace-nowrap">${t}</th>`;

  $('jobs-table').innerHTML = `
    <table class="w-full text-xs">
      <thead><tr class="text-[11px] text-muted border-b border-line">
        ${th('Job')}${th('Co')}${th('Sales / PPM')}${th('Production')}${th('Deadline')}${th('Producer / PM')}
        ${th('Value', true)}${th('Costs', true)}${th('Net', true)}${th('Inv / Paid', true)}${th('Unpaid', true)}
      </tr></thead>
      <tbody>
        ${jobs.map(j => {
          const p = j.project;
          const late = p?.deadline && !jobIsDone(j) && new Date(p.deadline) < new Date();
          return `
          <tr class="border-b border-line/40 last:border-0 hover:bg-panel2 cursor-pointer"
              onclick="location.href='/job.html?id=${j.id}'">
            <td class="py-2.5 px-2">
              <p class="text-ink font-semibold">${esc(j.name)}</p>
              <p class="text-[11px] text-muted">${j.account ? esc(j.account.name) : 'No client'}</p>
            </td>
            <td class="py-2.5 px-2">${j.company ? coBadge(j.company) : ''}</td>
            <td class="py-2.5 px-2 whitespace-nowrap">
              <span class="badge border ${LEAD_STATUS_CLS[j.status] || ''} text-[10px]">${LEAD_STATUS_LABEL[j.status] || j.status}</span>
              ${j.quadrant ? `<span class="badge ${QUADRANT_CLS[j.quadrant] || ''} text-[10px] ml-1">${QUADRANT_LABEL[j.quadrant]}</span>` : ''}
            </td>
            <td class="py-2.5 px-2 whitespace-nowrap">${p ? (STATUS_LABEL[p.status] || p.status) : '<span class="text-muted">No project</span>'}</td>
            <td class="py-2.5 px-2 whitespace-nowrap ${late ? 'text-warm font-semibold' : ''}">${jobsDate(p?.deadline)}${late ? ' ⚠' : ''}</td>
            <td class="py-2.5 px-2 text-[11px]">
              ${p?.producer ? esc(p.producer.name) : '—'}<span class="text-muted"> / ${p?.pm ? esc(p.pm.name) : '—'}</span>
            </td>
            <td class="py-2.5 px-2 text-right text-ink whitespace-nowrap">${jobsRm(j.estimatedValue)}</td>
            <td class="py-2.5 px-2 text-right whitespace-nowrap">${j.costTotal ? jobsRm(j.costTotal) : '<span class="text-muted">—</span>'}</td>
            <td class="py-2.5 px-2 text-right whitespace-nowrap font-semibold ${j.net != null && j.net < 0 ? 'text-warm' : 'text-emerald-400'}">${jobsRm(j.net)}</td>
            <td class="py-2.5 px-2 text-right whitespace-nowrap text-[11px]">
              <span class="text-yellow-400">${j.invoicedPct}%</span> / <span class="text-emerald-400">${j.paidPct}%</span>
            </td>
            <td class="py-2.5 px-2 text-right whitespace-nowrap ${j.overdue ? 'text-warm font-semibold' : ''}">
              ${j.outstanding ? jobsRm(j.outstanding) + (j.overdue ? ' ⚠' : '') : '<span class="text-muted">—</span>'}
            </td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>`;
}

$('jobs-search')?.addEventListener('input', renderJobs);
$('jobs-show')?.addEventListener('change', renderJobs);
