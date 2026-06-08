// ══════════════════════════════════════════════════════════════
// CLIENTS HUB — account + contact management
// Depends on: $, msg, esc, coBadge  (index.html)
//             LEAD_STATUS_CLS, LEAD_STATUS_LABEL  (sales.js)
//             QUADRANT_CLS, QUADRANT_LABEL, STATUS_LABEL  (projects.js)
// ══════════════════════════════════════════════════════════════

let _clientsAll = [];

async function loadClients() {
  _clientsAll = await fetch('/api/accounts').then(r => r.json()).catch(() => []);
  renderClientList(_clientsAll);
}

function renderClientList(accounts) {
  const search = ($('client-search')?.value || '').toLowerCase();
  const list   = accounts.filter(a =>
    !search || a.name.toLowerCase().includes(search)
  );

  // Stats strip
  $('clients-stats').innerHTML =
    `<span class="text-ink font-semibold">${accounts.length}</span><span class="text-muted"> accounts</span>` +
    ` <span class="text-line mx-2">·</span> ` +
    `<span class="text-ink font-semibold">${list.length}</span><span class="text-muted"> shown</span>`;

  if (!list.length) {
    $('clients-list').innerHTML = '<div class="text-center text-muted text-sm py-10">No accounts found.</div>';
    return;
  }

  $('clients-list').innerHTML = `<div class="overflow-x-auto -mx-5 px-5">
    <table class="w-full text-sm">
      <thead>
        <tr class="border-b border-line">
          <th class="text-left pb-3 px-2 text-[11px] font-semibold uppercase tracking-wider text-muted">Account</th>
          <th class="text-left pb-3 px-2 text-[11px] font-semibold uppercase tracking-wider text-muted">Industry</th>
          <th class="text-left pb-3 px-2 text-[11px] font-semibold uppercase tracking-wider text-muted">Size</th>
          <th class="text-right pb-3 px-2 text-[11px] font-semibold uppercase tracking-wider text-muted">Leads</th>
          <th class="text-right pb-3 px-2 text-[11px] font-semibold uppercase tracking-wider text-muted">Projects</th>
          <th class="pb-3 px-2"></th>
        </tr>
      </thead>
      <tbody>
        ${list.map(a => `
          <tr class="border-b border-line/60 hover:bg-panel2/40 transition-colors cursor-pointer"
              onclick="showAccountDetail('${a.id}')">
            <td class="py-3 px-2 font-medium text-ink">${esc(a.name)}${coBadge(a.company)}</td>
            <td class="py-3 px-2 text-xs text-muted">${a.industry ? esc(a.industry) : '—'}</td>
            <td class="py-3 px-2 text-xs text-muted">${a.size || '—'}</td>
            <td class="py-3 px-2 text-xs text-right text-muted">${a._count?.leads ?? 0}</td>
            <td class="py-3 px-2 text-xs text-right text-muted">${a._count?.projects ?? 0}</td>
            <td class="py-3 px-2 text-right">
              <button class="btn-del" onclick="event.stopPropagation();deleteAccount('${a.id}')">Remove</button>
            </td>
          </tr>`).join('')}
      </tbody>
    </table>
  </div>`;
}

async function showAccountDetail(id) {
  const a = await fetch('/api/accounts/' + id).then(r => r.json()).catch(() => null);
  if (!a) return;

  const leadsHtml = a.leads.length
    ? a.leads.map(l => {
        const cls   = (typeof LEAD_STATUS_CLS   !== 'undefined' ? LEAD_STATUS_CLS   : {})[l.status]   || 'bg-panel2 text-muted border-line';
        const label = (typeof LEAD_STATUS_LABEL !== 'undefined' ? LEAD_STATUS_LABEL : {})[l.status]  || l.status;
        const val   = l.estimatedValue ? `RM ${Number(l.estimatedValue).toLocaleString('en-MY')}` : '—';
        return `<div class="flex items-center gap-2 py-2 border-b border-line/40 last:border-0">
          <span class="badge border ${cls} text-[10px] shrink-0">${label}</span>
          <span class="text-xs text-ink flex-1">${esc(l.name)}</span>
          <span class="text-xs text-muted">${val}</span>
        </div>`;
      }).join('')
    : '<p class="text-xs text-muted py-2">No leads.</p>';

  const projectsHtml = a.projects.length
    ? a.projects.map(p => {
        const qCls   = (typeof QUADRANT_CLS   !== 'undefined' ? QUADRANT_CLS   : {})[p.quadrant]  || 'bg-panel2 text-muted';
        const qLabel = (typeof QUADRANT_LABEL !== 'undefined' ? QUADRANT_LABEL : {})[p.quadrant]  || p.quadrant;
        const sLabel = (typeof STATUS_LABEL   !== 'undefined' ? STATUS_LABEL   : {})[p.status]    || p.status;
        return `<div class="flex items-center gap-2 py-2 border-b border-line/40 last:border-0">
          <span class="badge ${qCls} text-[10px] shrink-0">${qLabel}</span>
          <span class="text-xs text-ink flex-1">${esc(p.name)}</span>
          <span class="text-xs text-muted">${sLabel}</span>
        </div>`;
      }).join('')
    : '<p class="text-xs text-muted py-2">No projects yet.</p>';

  const contactsHtml = a.contacts.length
    ? a.contacts.map(c => `
        <div class="flex items-start gap-2 py-2 border-b border-line/40 last:border-0">
          ${c.vip ? '<span class="text-[10px] text-yellow-400 font-bold shrink-0">★</span>' : ''}
          <div class="flex-1 min-w-0">
            <p class="text-xs font-semibold text-ink">${esc(c.name)}${c.title ? ` <span class="text-muted font-normal">· ${esc(c.title)}</span>` : ''}</p>
            ${c.email ? `<p class="text-[11px] text-muted">${esc(c.email)}</p>` : ''}
            ${c.phone ? `<p class="text-[11px] text-muted">${esc(c.phone)}</p>` : ''}
          </div>
          <button class="btn-del shrink-0 text-[11px]" onclick="deleteContact('${c.id}','${a.id}')">×</button>
        </div>`).join('')
    : '<p class="text-xs text-muted py-2">No contacts.</p>';

  const addContactHtml = `
    <div class="mt-3 pt-3 border-t border-line/40">
      <p class="text-[11px] font-semibold uppercase tracking-widest text-muted mb-2">Add contact</p>
      <input id="new-contact-name" class="form-input text-xs mb-1.5" placeholder="Full name *" style="margin-top:0" />
      <input id="new-contact-title" class="form-input text-xs mb-1.5" placeholder="Title / role" style="margin-top:0" />
      <input id="new-contact-email" class="form-input text-xs mb-1.5" placeholder="Email" style="margin-top:0" />
      <input id="new-contact-phone" class="form-input text-xs mb-1.5" placeholder="Phone" style="margin-top:0" />
      <label class="flex items-center gap-2 text-xs text-muted cursor-pointer mb-2">
        <input type="checkbox" id="new-contact-vip" class="accent-yellow-400" /> VIP contact
      </label>
      <button onclick="addContact('${a.id}')"
        class="w-full bg-accent text-bg text-xs font-semibold py-1.5 rounded-lg
               hover:brightness-110 transition-all cursor-pointer">
        Add contact
      </button>
      <div id="contact-msg" class="text-xs mt-1.5 min-h-[16px]"></div>
    </div>`;

  $('client-detail').innerHTML = `
    <button onclick="$('client-detail').innerHTML='';$('clients-list-panel').classList.remove('hidden');$('client-detail').classList.add('hidden')"
      class="flex items-center gap-1.5 text-xs text-muted hover:text-ink transition-colors cursor-pointer mb-4">
      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
      </svg> All clients
    </button>
    <div class="flex items-start gap-3 flex-wrap mb-5">
      <div>
        <h2 class="text-xl font-bold text-ink">${esc(a.name)}</h2>
        <p class="text-sm text-muted mt-0.5">${[a.industry, a.size].filter(Boolean).join(' · ') || '—'}</p>
        ${a.website ? `<a href="${esc(a.website)}" target="_blank" class="text-xs text-accent hover:underline">${esc(a.website)}</a>` : ''}
      </div>
    </div>
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-5">
      <div>
        <p class="text-[11px] font-semibold uppercase tracking-widest text-muted mb-2">Contacts (${a.contacts.length})</p>
        ${contactsHtml}
        ${addContactHtml}
      </div>
      <div>
        <p class="text-[11px] font-semibold uppercase tracking-widest text-muted mb-2">Leads (${a.leads.length})</p>
        ${leadsHtml}
      </div>
      <div>
        <p class="text-[11px] font-semibold uppercase tracking-widest text-muted mb-2">Projects (${a.projects.length})</p>
        ${projectsHtml}
      </div>
    </div>`;

  $('clients-list-panel').classList.add('hidden');
  $('client-detail').classList.remove('hidden');
}

// ── add account ───────────────────────────────────────────────

async function addAccount() {
  const name  = $('acc-name').value.trim();
  const msgEl = $('acc-msg');
  if (!name) { msg(msgEl, 'Account name is required.', 'err'); return; }

  const res = await fetch('/api/accounts', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name,
      industry: $('acc-industry').value.trim() || undefined,
      size:     $('acc-size').value            || undefined,
      website:  $('acc-website').value.trim()  || undefined,
      company:  $('acc-company').value         || undefined,
    }),
  });

  if (res.ok) {
    $('acc-name').value = ''; $('acc-industry').value = ''; $('acc-website').value = '';
    msg(msgEl, 'Account added.', 'ok');
    loadClients();
  } else {
    const e = await res.json().catch(() => ({}));
    msg(msgEl, [].concat(e.message || 'Failed').join(', '), 'err');
  }
}

async function deleteAccount(id) {
  if (!confirm('Remove this account? Linked leads and contacts will also be removed.')) return;
  await fetch('/api/accounts/' + id, { method: 'DELETE' });
  loadClients();
}

async function addContact(accountId) {
  const name = $('new-contact-name').value.trim();
  const msgEl = $('contact-msg');
  if (!name) { msg(msgEl, 'Name is required.', 'err'); return; }

  const res = await fetch('/api/contacts', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name,
      accountId,
      title: $('new-contact-title').value.trim() || undefined,
      email: $('new-contact-email').value.trim() || undefined,
      phone: $('new-contact-phone').value.trim() || undefined,
      vip:   $('new-contact-vip').checked || undefined,
    }),
  });

  if (res.ok) {
    msg(msgEl, 'Contact added.', 'ok');
    showAccountDetail(accountId); // refresh detail view
  } else {
    const e = await res.json().catch(() => ({}));
    msg(msgEl, [].concat(e.message || 'Failed').join(', '), 'err');
  }
}

async function deleteContact(contactId, accountId) {
  if (!confirm('Remove this contact?')) return;
  await fetch('/api/contacts/' + contactId, { method: 'DELETE' });
  showAccountDetail(accountId);
}

$('acc-add').addEventListener('click', addAccount);
$('client-search').addEventListener('input', () => renderClientList(_clientsAll));
