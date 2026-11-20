// ══════════════════════════════════════════════════════════════
// SHARED SHELL — utilities, theme, auth, nav, user menu.
// Loaded by every page (index.html today; standalone tab pages as they're
// split out — see CLAUDE.md "one module, one page" migration).
// Depends on markup already being on the page: header (#mode-btn,
// #user-menu, #user-menu-wrap, the side menu #sidebar with data-tab links),
// the settings drawer (#settings-overlay/#settings-panel/#rows-colors),
// the company filter bar (#company-filter-bar, #filter-btn-LPS/PXL), and
// the User Manager modal (#user-mgr-overlay, #user-list, etc).
// Also depends on window._mode/_theme/_DARK/_LIGHT being set already by
// /js/theme.js, which every page loads in <head> just before this file
// (it picks the palette and writes the CSS before the page paints).
// ══════════════════════════════════════════════════════════════

// ── shared utilities — available to all module JS files ──────
const $ = (id) => document.getElementById(id);

function msg(el, text, kind) {
  el.textContent = text;
  el.className = kind === 'err' ? 'text-xs text-warm mt-2 min-h-[18px]'
               : kind === 'ok'  ? 'text-xs text-accent mt-2 min-h-[18px]'
                                : 'text-xs text-muted mt-2 min-h-[18px]';
  if (text) setTimeout(() => { if (el.textContent === text) el.textContent = ''; }, 4500);
}

// Client industries — one fixed list so "Property", "property" and
// "Real estate" don't end up as three different industries. Stored on
// Account.industry as plain text, so the list can change without a
// migration. Edit here to add / rename.
// Keep alphabetical, with 'Other' last.
const CLIENT_INDUSTRIES = [
  'Advertising & Agency', 'Agriculture & Plantation', 'Architecture & Interior Design',
  'Arts, Culture & Museums', 'Automotive', 'Aviation & Aerospace',
  'Banking & Finance', 'Beauty & Personal Care', 'Biotechnology & Life Sciences',
  'Construction', 'Consulting & Professional Services', 'Creative & Design Studio',
  'Deathcare & Memorial', 'E-commerce', 'Education', 'Energy, Oil & Gas',
  'Engineering', 'Events & Venues', 'F&B', 'Fashion & Apparel',
  'Fitness & Sports', 'Furniture & Home Living', 'Gaming & Esports',
  'Government & GLC', 'Healthcare & Pharma', 'Hospitality & Tourism',
  'Insurance', 'Jewellery & Luxury', 'Legal', 'Logistics & Transportation',
  'Manufacturing', 'Media & Entertainment', 'Non-profit & NGO',
  'Production House (Video, Sound & VFX)', 'Property & Real Estate', 'Retail & Consumer', 'Technology & Software',
  'Telecommunications', 'Theme Parks & Attractions', 'Utilities',
  'Other',
];

// <option>s for an industry <select>. A value saved before the list existed
// (e.g. typed by hand) is kept as an extra option so it's never lost.
function industryOptionsHtml(current) {
  const list = current && !CLIENT_INDUSTRIES.includes(current) ? [current, ...CLIENT_INDUSTRIES] : CLIENT_INDUSTRIES;
  return '<option value="">— not set —</option>' +
    list.map(v => `<option${v === current ? ' selected' : ''}>${esc(v)}</option>`).join('');
}

// A pop-up message in the bottom-right corner, visible wherever you are on
// the page (unlike msg(), which writes into one fixed spot). `html` may
// contain a link — escape any user text with esc() first. Click × to close;
// it also closes by itself after `ms`.
function toast(html, kind = 'ok', ms = 10000) {
  let box = document.getElementById('toast-box');
  if (!box) {
    box = document.createElement('div');
    box.id = 'toast-box';
    box.className = 'fixed bottom-4 right-4 left-4 sm:left-auto z-[100] flex flex-col gap-2 items-stretch sm:items-end pointer-events-none';
    document.body.appendChild(box);
  }
  const t = document.createElement('div');
  t.className = 'pointer-events-auto max-w-md bg-panel border rounded-xl shadow-lg px-4 py-3 text-xs flex items-start gap-3 '
    + (kind === 'err' ? 'border-warm/50 text-warm' : 'border-accent/40 text-ink');
  t.innerHTML = `<div class="flex-1 leading-relaxed">${html}</div>
    <button class="text-muted hover:text-ink cursor-pointer text-sm leading-none" aria-label="Close">×</button>`;
  t.querySelector('button').onclick = () => t.remove();
  box.appendChild(t);
  setTimeout(() => t.remove(), ms);
}

// ── Fold-away forms on phones ────────────────────────────────
// On a computer the "Add a lead / project / person…" forms sit in a narrow
// column beside the list. On a phone that column stacks ON TOP of the list
// and fills half the screen. Mark the form's panel with `data-fold-mobile`
// and, below the `lg` breakpoint (1024px, where the layout stacks), it shows
// only its heading as a "+ Add …" bar — tap to open, tap again to close.
// Computers are untouched: the CSS below only applies inside the media query.
// The panel's first <h2> is the bar; everything else in the panel hides.
const FOLD_MQ = '(max-width: 1023.98px)';
(function injectFoldCss() {
  const css = `@media ${FOLD_MQ} {
    [data-fold-mobile]:not(.fold-open) > :not(.fold-head) { display: none !important; }
    [data-fold-mobile]:not(.fold-open) { padding-top: .75rem; padding-bottom: .75rem; }
    [data-fold-mobile]:not(.fold-open) .fold-head,
    [data-fold-mobile]:not(.fold-open) .fold-head h2 { margin-bottom: 0; }
    [data-fold-mobile] .fold-head { cursor: pointer; user-select: none; }
    [data-fold-mobile] .fold-head h2 { display: flex; align-items: center; gap: .4rem; }
    [data-fold-mobile] .fold-head h2::before { content: '+'; font-size: 15px; line-height: 1; }
    [data-fold-mobile].fold-open .fold-head h2::before { content: '−'; }
    [data-fold-mobile] .fold-head h2::after { content: '▾'; margin-left: auto; font-size: 11px; }
    [data-fold-mobile].fold-open .fold-head h2::after { content: '▴'; }

    /* Keep everything inside the screen on phones.
       By default a grid cell or flex item refuses to shrink below its
       content (CSS "min-width: auto"), so one wide table or long name
       stretches the whole panel past the edge. min-width: 0 lets them
       shrink; wide tables then scroll sideways in their overflow-x-auto box.
       Fixed-width boxes (w-48 search, w-64…) are capped to the space there is. */
    .grid > * { min-width: 0; }
    .flex > input, .flex > select { min-width: 0; }
    input, select, textarea { max-width: 100%; }
  }`;
  const s = document.createElement('style');
  s.textContent = css;
  document.head.appendChild(s);
})();

function isPhoneLayout() { return window.matchMedia(FOLD_MQ).matches; }

// Wire every marked panel. The "head" is the panel's direct child that holds
// the first <h2> (usually the h2 itself; sometimes a row with buttons in it).
function initFoldPanels() {
  document.querySelectorAll('[data-fold-mobile]').forEach(panel => {
    if (panel.dataset.foldReady) return;
    const h2 = panel.querySelector('h2');
    if (!h2) return;
    let head = h2;
    while (head.parentElement !== panel) head = head.parentElement;
    head.classList.add('fold-head');
    h2.classList.add('max-lg:text-accent');   // phones: bar reads as a tappable action (theme colour)
    panel.dataset.foldReady = '1';
    head.addEventListener('click', e => {
      if (!isPhoneLayout()) return;                 // computers: plain heading
      if (e.target.closest('button, a, input, select')) return;   // buttons in the head still work
      panel.classList.toggle('fold-open');
    });
  });
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initFoldPanels);
else initFoldPanels();

// Open a fold panel (e.g. the Sales List "+ Add lead" button).
function foldOpen(panel) { if (panel) panel.classList.add('fold-open'); }

// Call after a successful save. On a phone the form closes so the list comes
// back, and `text` shows as a pop-up (the message inside the form would be
// hidden). On a computer nothing changes.
function foldAfterSave(panel, text) {
  if (!panel || !isPhoneLayout()) return;
  panel.classList.remove('fold-open');
  if (text) toast(esc(text), 'ok', 4000);
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

// ── shared role helpers — available to all tab JS files ──────
function currentRole() {
  try { return JSON.parse(localStorage.getItem('pop-os-user') || '{}').role || ''; } catch { return ''; }
}
function isStaff()  { return currentRole() === 'STAFF'; }
function isAdminOrProducer() { return ['ADMIN','PRODUCER'].includes(currentRole()); }
function isAdmin() { return currentRole() === 'ADMIN'; }
// Salary is sensitive — only ADMIN and FINANCE can see it.
function canSeeSalary() { return ['ADMIN', 'FINANCE'].includes(currentRole()); }

// ── day / night icons ────────────────────────────────────────
const ICON_SUN  = `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"/></svg>`;
const ICON_MOON = `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/></svg>`;

// Quick header toggle: flip mode, clear custom colours, reload.
// Switch modes while keeping the user's accent + warm colours intact.
// Only the structural colours (bg/panel/borders/text) change; the chosen
// accent and danger colours follow you across modes.
// Exception: if the accent / warning is still this mode's DEFAULT, take the
// other mode's default instead — day and night use slightly different
// shades of the same indigo / red so each stays readable on its background.
function applyModeSwitch(mode) {
  const base = mode === 'light' ? window._LIGHT : window._DARK;
  const here = window._mode === 'light' ? window._LIGHT : window._DARK;
  const keep = (k) => window._theme[k] === here[k] ? base[k] : window._theme[k];
  const next = {
    bg:     base.bg,
    panel:  base.panel,
    panel2: base.panel2,
    line:   base.line,
    ink:    base.ink,
    muted:  base.muted,
    accent: keep('accent'),
    warm:   keep('warm'),
  };
  localStorage.setItem('pop-os-mode', mode);
  localStorage.setItem('pop-os-theme-' + mode, JSON.stringify(next));
  location.reload();
}

function toggleMode() { applyModeSwitch(window._mode === 'dark' ? 'light' : 'dark'); }
function switchMode(mode) { if (mode !== window._mode) applyModeSwitch(mode); }

// ── company filter ───────────────────────────────────────────
// null = all companies visible; 'LPS'/'PXL' = filtered; 'GROUP' = all (same as null).
window._company = null;
// true when the filter is locked to the user's company (non-GROUP users).
window._companyLocked = false;

// Auto-apply based on logged-in user's company. Called after login / page load.
function applyUserCompany() {
  try {
    const user = JSON.parse(localStorage.getItem('pop-os-user') || '{}');
    const co   = user.company;
    if (co && co !== 'GROUP') {
      window._company       = co;
      window._companyLocked = true;
    } else {
      window._company       = null;
      window._companyLocked = false;
    }
    updateFilterUI();
  } catch(e) {}
}

// Returns true if an item should appear under the current filter.
// Untagged items (company = null) and GROUP items (cross-company —
// projects/people that belong to the studio as a whole, not one side)
// always show, whichever company the header filter is set to.
function matchesFilter(company) {
  if (!window._company) return true;
  if (!company) return true;
  if (company === 'GROUP') return true;
  return company === window._company;
}

// Reload whatever's on screen so it picks up the new filter. On the SPA
// shell (index.html) this checks which tab panel is visible. On a
// standalone tab page, none of those panels exist — the page instead
// registers its own reload function as window._reloadCurrentTab.
function setCompanyFilter(co) {
  if (window._companyLocked) return; // company-scoped users cannot change their filter
  window._company = (window._company === co) ? null : co; // toggle off if already active
  updateFilterUI();

  if (typeof window._reloadCurrentTab === 'function') { window._reloadCurrentTab(); return; }

  const active = ['dashboard', 'staffing'].find(t =>
    $('tab-' + t) && !$('tab-' + t).classList.contains('hidden')
  );
  if (active === 'dashboard')   loadDashboard();
  // 'projects', 'capacity', 'production', 'sales', 'clients', 'financial' and 'people' have their own pages now — see TAB_PAGE above.
  // staffing doesn't filter by company — all people shown regardless
}

function updateFilterUI() {
  const filterBar = $('company-filter-bar');
  // Locked users: hide filter controls entirely (backend already scopes their data)
  if (filterBar) filterBar.classList.toggle('hidden', window._companyLocked);

  ['LPS', 'PXL'].forEach(co => {
    const btn = $('filter-btn-' + co);
    if (!btn) return;
    const isActive    = window._company === co;
    const otherActive = window._company && window._company !== co;
    btn.classList.toggle('ring-2',        isActive);
    btn.classList.toggle('ring-accent',   isActive);
    btn.classList.toggle('opacity-40',    !!otherActive);
  });
}

// Company badge HTML — used by people.js and projects.js.
const CO_CLS = {
  LPS:   'bg-orange-500/15 text-orange-400',
  PXL:   'bg-sky-500/15 text-sky-400',
  GROUP: 'bg-zinc-500/15 text-zinc-400',
};
function coBadge(company) {
  if (!company) return '';
  return `<span class="badge ${CO_CLS[company] || ''} ml-1">${company}</span>`;
}

// Project display constants — used across ~11 tab files (Projects, Production,
// Dashboard, Sales, Clients, Change Requests, Committees, Staffing, My Work,
// Financial, Person Profile), so they live here rather than in projects.js.
const CLIENT_TIER_LABEL = { NEW: 'New', RETURNING: 'Returning', KEY_ACCOUNT: 'Key acct' };

const QUADRANT_LABEL = {
  GOLD: 'Gold', STRATEGIC_BET: 'Strategic Bet',
  OPERATIONAL_FILLER: 'Op. Filler', DRAIN: 'Drain',
};
const QUADRANT_CLS = {
  GOLD:               'bg-yellow-500/15 text-yellow-400',
  STRATEGIC_BET:      'bg-emerald-500/15 text-emerald-400',
  OPERATIONAL_FILLER: 'bg-sky-500/15 text-sky-400',
  DRAIN:              'bg-warm/15 text-warm',
};
const STATUS_LABEL = {
  BRIEF: 'Brief', IN_PROGRESS: 'In progress', INTERNAL_REVIEW: 'Internal review',
  DELIVERED: 'Delivered', ON_HOLD: 'On hold', CANCELLED: 'Cancelled',
};
const PRI_CLS = {
  P1: 'font-bold text-warm',
  P2: 'font-semibold text-accent',
  P3: 'font-medium text-muted',
};

// ── PPM client-side engine ───────────────────────────────────
// Mirrors ppm.service.ts exactly so the Job page gets live recommendations
// without a server round trip every time a PPM input changes.

const PPM_VALUE_MIDPOINT      = 50_000;
const PPM_COMPLEXITY_THRESHOLD = 3;

// The ONE way to show a ringgit amount, used by every page. Money is shown
// as entered — never rounded to the ringgit: whole amounts stay "RM 5,000",
// anything with cents shows exactly two decimals ("RM 44.70"). Callers
// handle null / "—" themselves.
function fmtMoney(n) {
  const v = Number(n);
  const cents = !Number.isInteger(Math.round(v * 100) / 100);
  return 'RM ' + v.toLocaleString('en-MY', { minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: 2 });
}

function computePpm({ estimatedValue, complexityScore, clientTier, marginTarget }) {
  const valueScore  = estimatedValue  != null ? Math.min((estimatedValue / PPM_VALUE_MIDPOINT) * 50, 100) : null;
  const effortScore = complexityScore != null ? ((6 - complexityScore) / 5) * 100 : null;
  const tierScore   = clientTier
    ? ({ NEW: 20, RETURNING: 60, KEY_ACCOUNT: 100 }[clientTier] ?? null)
    : null;
  const marginScore = marginTarget != null ? Math.min((marginTarget / 100) * 100, 100) : null;

  const components = [
    { score: valueScore,  w: 0.40 },
    { score: effortScore, w: 0.15 },
    { score: tierScore,   w: 0.25 },
    { score: marginScore, w: 0.20 },
  ];
  const available = components.filter(c => c.score != null);
  let score = null;
  if (available.length >= 2) {
    const totalW = available.reduce((s, c) => s + c.w, 0);
    score = Math.round(available.reduce((s, c) => s + c.score * c.w, 0) / totalW);
  }

  let recommendedQuadrant = null;
  if (estimatedValue != null && complexityScore != null) {
    const highValue = estimatedValue  >= PPM_VALUE_MIDPOINT;
    const lowEffort = complexityScore <= PPM_COMPLEXITY_THRESHOLD;
    if      ( highValue &&  lowEffort) recommendedQuadrant = 'GOLD';
    else if ( highValue && !lowEffort) recommendedQuadrant = 'STRATEGIC_BET';
    else if (!highValue &&  lowEffort) recommendedQuadrant = 'OPERATIONAL_FILLER';
    else                               recommendedQuadrant = 'DRAIN';
  }

  // Priority suggestion derived from the weighted score.
  const recommendedPriority = score != null
    ? (score >= 70 ? 'P1' : score >= 40 ? 'P2' : 'P3')
    : null;

  return { score, recommendedQuadrant, recommendedPriority };
}

// A job's quadrant badge, plus a small "overridden" mark when the team chose
// a different quadrant than computePpm suggests. Hover shows the reason
// (lead.quadrantNote). Used by the Sales card and List view.
function jobQuadrantBadge(l) {
  if (!l.quadrant) return '';
  const rec = computePpm(l).recommendedQuadrant;
  const over = rec && rec !== l.quadrant;
  const tip = over
    ? `Overridden — suggested ${QUADRANT_LABEL[rec]}. ${l.quadrantNote ? 'Why: ' + l.quadrantNote : 'No reason given.'}`
    : QUADRANT_LABEL[l.quadrant];
  return `<span class="badge ${QUADRANT_CLS[l.quadrant] || ''} text-[10px]" title="${esc(tip)}">${QUADRANT_LABEL[l.quadrant]}${over ? ' ✎' : ''}</span>`;
}

// Lead status display constants — used by Sales and Clients tabs.
const LEAD_STATUS_LABEL = {
  QUALIFICATION: 'Qualification',
  PROPOSAL:      'Proposal',
  NEGOTIATION:   'Negotiation',
  WON:           'Won',
  COMPLETED:     'Completed',
  LOST:          'Lost',
};
const LEAD_STATUS_CLS = {
  QUALIFICATION: 'bg-sky-500/15 border-sky-500/30 text-sky-400',
  PROPOSAL:      'bg-yellow-500/15 border-yellow-500/30 text-yellow-400',
  NEGOTIATION:   'bg-purple-500/15 border-purple-500/30 text-purple-400',
  WON:           'bg-emerald-500/15 border-emerald-500/30 text-emerald-400',
  COMPLETED:     'bg-slate-500/15 border-slate-500/30 text-slate-400',
  LOST:          'bg-warm/15 border-warm/30 text-warm',
};

// ── Navigation ───────────────────────────────────────────────
// Every tab has its own standalone page. hrefForTab() falls back to
// /index.html?tab=<name> for any future tab added here before its page exists.
const TAB_PAGE = {
  dashboard:  '/index.html',
  projects:   '/projects.html',
  capacity:   '/capacity.html',
  production: '/production.html',
  sales:      '/sales.html',
  clients:    '/clients.html',
  sp:         '/sp.html',
  financial:  '/financial.html',
  people:     '/people.html',
  staffing:   '/staffing.html',
  committees: '/committees.html',
  mywork:     '/mywork.html',
  journey:    '/journey.html',
  jobs:       '/jobs.html',
  notifications: '/notifications.html',
  audit:         '/audit.html',
};
function hrefForTab(name) {
  return TAB_PAGE[name] || ('/index.html?tab=' + name);
}

// The side menu, top to bottom: a heading per section, then its pages as
// [tab, label, icon]. To add a page to the menu, add a row here (plus its
// TAB_PAGE and TAB_ACCESS entries). Sections whose pages the role can't open
// hide themselves — see applyRoleVisibility().
const NAV = [
  { label: 'Menu', items: [
      ['mywork',    'My Work',   'user'],
      ['dashboard', 'Dashboard', 'grid'],
      ['jobs',      'Jobs',      'briefcase'] ] },
  { label: 'Sales', items: [
      ['sales',   'Sales pipeline', 'funnel'],
      ['clients', 'Clients',        'building'],
      ['sp',      'Performance',    'chart'] ] },
  { label: 'Production', items: [
      ['projects',   'Projects', 'folder'],
      ['production', 'Lanes',    'columns'],
      ['capacity',   'Capacity', 'calendar'] ] },
  { label: 'Finance', items: [
      ['financial', 'Financial', 'wallet'] ] },
  { label: 'HR', items: [
      ['people',     'People / ELC', 'users'],
      ['staffing',   'Staffing',     'sparkles'],
      ['committees', 'Committees',   'chat'] ] },
  { label: 'Admin', items: [
      ['notifications', 'Notifications', 'bell'],
      ['audit',         'Audit Log',     'clipboard'] ] },
];

// Menu icons — outline icons from Heroicons (MIT licence, heroicons.com),
// drawn at 24×24 with a 1.5 stroke. Just the SVG path data, keyed by name.
const NAV_ICONS = {
  user:      'M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z',
  grid:      'M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z',
  briefcase: 'M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0M12 12.75h.008v.008H12v-.008z',
  funnel:    'M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 00-.659-1.591L3.659 7.409A2.25 2.25 0 013 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z',
  building:  'M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z',
  chart:     'M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z',
  folder:    'M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z',
  columns:   'M9 4.5v15m6-15v15m-10.875 0h15.75c.621 0 1.125-.504 1.125-1.125V5.625c0-.621-.504-1.125-1.125-1.125H4.125C3.504 4.5 3 5.004 3 5.625v12.75c0 .621.504 1.125 1.125 1.125z',
  calendar:  'M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5',
  wallet:    'M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 9m18 0V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v3',
  users:     'M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z',
  sparkles:  'M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z',
  chat:      'M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155',
  bell:      'M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0',
  clipboard: 'M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z',
  collapse:  'M18.75 19.5l-7.5-7.5 7.5-7.5m-6 15L5.25 12l7.5-7.5',
};
const navIcon = (name, cls) =>
  `<svg class="${cls}" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24" aria-hidden="true">
     <path stroke-linecap="round" stroke-linejoin="round" d="${NAV_ICONS[name]}"/></svg>`;

// ── Side menu layout ──────────────────────────────────────────
// Wide screens (xl, 1280px+): the menu is fixed down the left side and the
// page is pushed right by the same width — 260px, or 80px when collapsed to
// icons. The collapsed choice is remembered per browser (localStorage).
// Smaller screens: the same menu becomes a slide-in drawer, opened by the
// ☰ button in the header and closed by tapping outside it.
// Plain CSS (not Tailwind classes) because it switches on classes on
// <html>: has-sidebar (this page has the menu) and sb-collapsed.
const SIDEBAR_KEY = 'pop-os-sidebar';
(function injectSidebarCss() {
  const s = document.createElement('style');
  s.textContent = `
    @media (min-width: 1280px) {
      html.has-sidebar body { padding-left: 260px; }
      html.has-sidebar.sb-collapsed body { padding-left: 80px; }
      #sidebar { width: 260px; max-width: none; }
      html.sb-collapsed #sidebar { width: 80px; }
      html.sb-collapsed #sidebar .sb-text,
      html.sb-collapsed #sidebar .sb-label { display: none; }
      html.sb-collapsed #sidebar .sb-sep { display: block; }
      html.sb-collapsed #sidebar .sb-item { justify-content: center; padding-left: 0; padding-right: 0; }
      html.sb-collapsed #sidebar .sb-head { justify-content: center; padding-left: 0; padding-right: 0; }
      html.sb-collapsed #sidebar .sb-collapse-icon { transform: rotate(180deg); }
      /* Animate only when the user clicks collapse — not on every page load. */
      html.sb-anim body, html.sb-anim #sidebar { transition: padding-left .2s ease, width .2s ease; }
    }`;
  document.head.appendChild(s);
})();

// Collapse / expand on wide screens.
function toggleSidebar() {
  const html = document.documentElement;
  html.classList.add('sb-anim');
  const collapsed = html.classList.toggle('sb-collapsed');
  try { localStorage.setItem(SIDEBAR_KEY, collapsed ? 'collapsed' : 'expanded'); } catch (e) {}
  setTimeout(() => html.classList.remove('sb-anim'), 250);
}

// Builds the side menu + the top bar (company filter, day/night, theme
// settings, user menu) as an HTML string. `activeTab` is this page's own
// tab — it's highlighted in the menu. Every menu item is a real <a href>.
function renderHeader(activeTab) {
  // Page guard: hiding menu items isn't enough — a link or a typed URL can
  // still reach a page. If this role can't use this tab, go to My Work
  // instead. (The API has its own role checks; this keeps the UI honest.)
  if (!canAccessTab(activeTab)) {
    window.location.replace('/mywork.html');
    return '';
  }
  // Set the layout classes now, before the page body paints, so the
  // content is already in the right place (no jump on load).
  const html = document.documentElement;
  html.classList.add('has-sidebar');
  try { if (localStorage.getItem(SIDEBAR_KEY) === 'collapsed') html.classList.add('sb-collapsed'); } catch (e) {}

  return `
  <header class="sticky top-0 z-50 bg-panel/95 backdrop-blur-sm border-b border-line">
    <div class="px-3 sm:px-6 h-16 flex items-center gap-2 sm:gap-4">
      <!-- Hamburger — below xl only, where the side menu is a drawer. -->
      <button id="mnav-btn" onclick="openMobileNav()" title="Menu" aria-label="Open menu"
        aria-controls="sidebar" aria-expanded="false"
        class="xl:hidden w-10 h-10 -ml-1 flex items-center justify-center rounded-lg border border-line text-muted
               hover:text-ink hover:bg-panel2 transition-colors cursor-pointer shrink-0">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/>
        </svg>
      </button>
      <!-- Company filter — click a logo to show only that company's work. -->
      <div id="company-filter-bar" class="flex items-center gap-2 sm:gap-3 shrink-0">
        <button id="filter-btn-LPS" onclick="setCompanyFilter('LPS')" title="Filter to Lorrypop Studio"
          class="rounded-lg p-0.5 cursor-pointer transition-all duration-150 hover:opacity-100">
          <img src="/lps-logo.png" class="h-7 w-auto object-contain" alt="LPS" />
        </button>
        <span class="h-5 w-px bg-line block"></span>
        <button id="filter-btn-PXL" onclick="setCompanyFilter('PXL')" title="Filter to Popxical Lab"
          class="rounded-lg p-0.5 cursor-pointer transition-all duration-150 hover:opacity-100">
          <img src="/pxl-logo.png" class="h-7 w-auto object-contain" alt="PXL" />
        </button>
      </div>

      <!-- Day / night toggle -->
      <button id="mode-btn" onclick="toggleMode()" title="Toggle day / night"
        class="ml-auto w-10 h-10 flex items-center justify-center rounded-full border border-line text-muted
               hover:text-ink hover:bg-panel2 transition-colors cursor-pointer shrink-0"></button>
      <!-- Settings trigger -->
      <button onclick="openSettings()" title="Theme settings"
        class="w-10 h-10 flex items-center justify-center rounded-full border border-line text-muted
               hover:text-ink hover:bg-panel2 transition-colors cursor-pointer shrink-0">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"/>
        </svg>
      </button>
      <!-- User badge + menu -->
      <div class="relative shrink-0" id="user-menu-wrap">
        <button id="user-btn" onclick="toggleUserMenu()"
          class="flex items-center gap-2 px-3 py-2 rounded-full border border-line text-sm text-ink
                 hover:bg-panel2 transition-colors cursor-pointer">
          <span id="user-name-label" class="hidden sm:inline max-w-[10rem] truncate font-medium">…</span>
          <span id="user-role-badge" class="badge text-[10px]"></span>
          <svg class="w-3 h-3 shrink-0 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
          </svg>
        </button>
        <div id="user-menu"
          class="hidden absolute right-0 top-full mt-2 w-56 bg-panel border border-line rounded-xl shadow-lg z-50 p-1.5">
          <div class="px-3 py-2 mb-1 border-b border-line">
            <p id="user-email-label" class="text-xs text-muted truncate"></p>
          </div>
          <button id="user-manage-btn" onclick="openUserManager()" style="display:none"
            class="w-full text-left px-3 py-2 rounded-lg text-sm text-ink hover:bg-panel2 transition-colors cursor-pointer">
            Manage users
          </button>
          <a href="/journey.html"
            class="block w-full text-left px-3 py-2 rounded-lg text-sm text-ink hover:bg-panel2 transition-colors cursor-pointer">
            My journey
          </a>
          <a href="/guide.html" target="_blank" rel="noopener"
            class="block w-full text-left px-3 py-2 rounded-lg text-sm text-ink hover:bg-panel2 transition-colors cursor-pointer">
            User guide
          </a>
          <a href="/changelog.html" target="_blank" rel="noopener"
            class="block w-full text-left px-3 py-2 rounded-lg text-sm text-ink hover:bg-panel2 transition-colors cursor-pointer">
            What's new
          </a>
          <button onclick="logout()"
            class="w-full text-left px-3 py-2 rounded-lg text-sm text-warm hover:bg-panel2 transition-colors cursor-pointer">
            Sign out
          </button>
        </div>
      </div>
    </div>
  </header>
  ${renderSidebar(activeTab)}`;
}

// The side menu. Rendered OUTSIDE <header> on purpose — the header's
// backdrop-blur would otherwise trap a position:fixed child inside the
// header's box. Links carry data-tab so applyRoleVisibility() can hide the
// ones this role can't open.
function renderSidebar(activeTab) {
  const item = ([t, label, icon]) => {
    const on = t === activeTab;
    return `<a data-tab="${t}" href="${hrefForTab(t)}" onclick="closeMobileNav()" title="${label}"
      ${on ? 'aria-current="page"' : ''}
      class="sb-item flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
             ${on ? 'bg-accent/10 text-accent' : 'text-ink/80 hover:bg-panel2 hover:text-ink'}">
      ${navIcon(icon, 'w-5 h-5 shrink-0 ' + (on ? 'text-accent' : 'text-muted'))}
      <span class="sb-text truncate">${label}</span></a>`;
  };
  const sections = NAV.map((s, i) => `
    <div data-section class="${i ? 'mt-5' : ''}">
      <p class="sb-label px-3 mb-2 text-[11px] font-medium uppercase tracking-wider text-muted/80">${s.label}</p>
      ${i ? '<div class="sb-sep hidden mx-3 mb-3 border-t border-line"></div>' : ''}
      <div class="space-y-0.5">${s.items.map(item).join('')}</div>
    </div>`).join('');

  return `
  <div id="sb-overlay" onclick="closeMobileNav()"
    class="hidden xl:hidden fixed inset-0 z-[90] bg-black/40 backdrop-blur-sm"></div>
  <aside id="sidebar" aria-label="Main menu"
    class="fixed top-0 left-0 z-[95] xl:z-40 h-[100dvh] w-72 max-w-[85vw] flex flex-col
           bg-panel border-r border-line shadow-2xl xl:shadow-none
           -translate-x-full xl:translate-x-0 transition-transform duration-200 ease-out">
    <div class="sb-head flex items-center gap-3 h-16 px-5 border-b border-line shrink-0">
      <a href="${hrefForTab('mywork')}" title="Pop OS" class="w-9 h-9 rounded-xl bg-accent text-white text-base font-bold
             flex items-center justify-center shrink-0">P</a>
      <div class="sb-text min-w-0">
        <p class="text-[15px] font-semibold text-ink leading-tight">Pop OS</p>
        <p class="text-[11px] text-muted leading-tight">Pop Group Studio</p>
      </div>
      <button onclick="closeMobileNav()" aria-label="Close menu"
        class="xl:hidden ml-auto w-9 h-9 flex items-center justify-center rounded-lg text-muted hover:text-ink hover:bg-panel2 cursor-pointer">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>
    </div>
    <nav class="flex-1 overflow-y-auto overscroll-contain px-3 py-5">${sections}</nav>
    <!-- Collapse to icons — wide screens only. -->
    <div class="hidden xl:block border-t border-line p-3 shrink-0">
      <button onclick="toggleSidebar()" title="Collapse / expand menu"
        class="sb-item w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted
               hover:bg-panel2 hover:text-ink transition-colors cursor-pointer">
        ${navIcon('collapse', 'sb-collapse-icon w-5 h-5 shrink-0 transition-transform duration-200')}
        <span class="sb-text">Collapse menu</span>
      </button>
    </div>
  </aside>`;
}

// Drawer open / close (below xl). Above xl the menu is always visible and
// these only matter if a resize crosses the breakpoint mid-way.
function openMobileNav() {
  $('sb-overlay')?.classList.remove('hidden');
  $('sidebar')?.classList.remove('-translate-x-full');
  $('mnav-btn')?.setAttribute('aria-expanded', 'true');
  document.body.style.overflow = 'hidden';   // stop the page scrolling behind the drawer
}
function closeMobileNav() {
  $('sb-overlay')?.classList.add('hidden');
  $('sidebar')?.classList.add('-translate-x-full');
  $('mnav-btn')?.setAttribute('aria-expanded', 'false');
  document.body.style.overflow = '';
}
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMobileNav(); });
// Rotating a tablet to landscape can cross the xl breakpoint with the
// drawer open — close it so the page doesn't stay scroll-locked.
window.matchMedia('(min-width: 1280px)').addEventListener('change', e => { if (e.matches) closeMobileNav(); });

// ══════════════════════════════════════════════════════════════
// THEME SETTINGS
// ══════════════════════════════════════════════════════════════

// The default colours for the active mode (set by the head script).
const THEME_DEFAULTS = window._mode === 'light' ? window._LIGHT : window._DARK;

// Day / Night are the defaults from theme.js (Mode buttons / Reset).
// "Warm Dark" is the original gold-on-brown Pop OS theme, kept as a preset
// for anyone who preferred it. (The preset buttons in each page's settings
// drawer call applyPreset('<name>'), so keep these names.)
const PRESETS = {
  'Day':          window._LIGHT,
  'Night':        window._DARK,
  'Warm Dark':    { bg:'#111009', panel:'#191814', panel2:'#201e19', line:'#2c2920', ink:'#e4e0d4', muted:'#857f73', accent:'#d4a23a', warm:'#c05535' },
  'Cool Dark':    { bg:'#0d0f14', panel:'#141920', panel2:'#1b2029', line:'#252e3b', ink:'#dde3ee', muted:'#7a8394', accent:'#5b9cf6', warm:'#e05252' },
  'Midnight':     { bg:'#0f0f18', panel:'#15151f', panel2:'#1c1c28', line:'#262635', ink:'#e0dff2', muted:'#7a7990', accent:'#7c6fcd', warm:'#e05b5b' },
  'Forest':       { bg:'#0d1209', panel:'#141a0f', panel2:'#1b2416', line:'#233020', ink:'#d8e6d0', muted:'#7a9070', accent:'#5aab66', warm:'#c06038' },
};

const COLOR_LABELS = {
  bg: 'Background', panel: 'Panel', panel2: 'Input bg',
  line: 'Borders', ink: 'Text', muted: 'Muted text',
  accent: 'Accent', warm: 'Warning',
};

// Find which preset (if any) matches the currently loaded colours.
function getActivePreset() {
  const t = window._theme;
  for (const [name, p] of Object.entries(PRESETS)) {
    if (Object.keys(p).every(k => p[k] === t[k])) return name;
  }
  return null;
}

// Highlight the preset button that matches the given name (or none).
function highlightActivePreset(activeName) {
  document.querySelectorAll('[data-preset]').forEach(btn => {
    const on = btn.dataset.preset === activeName;
    btn.classList.toggle('border-accent',    on);
    btn.classList.toggle('bg-accent/10',     on);
    btn.classList.toggle('border-line',      !on);
  });
}

// Highlight the active mode button in the settings drawer.
function highlightModeButtons() {
  const active   = 'bg-accent text-bg border-accent';
  const inactive = 'bg-panel2 text-ink border-line';
  ['day', 'night'].forEach(m => {
    const btn = $('mode-' + m + '-btn');
    if (!btn) return;
    const isActive = (m === 'day' && window._mode === 'light') || (m === 'night' && window._mode === 'dark');
    btn.className = btn.className.replace(/bg-\S+|text-\S+|border-\S+/g, '').trim();
    btn.classList.add(...(isActive ? active : inactive).split(' '));
  });
}

// Render the color picker rows on first open.
function buildColorPickers() {
  const container = $('rows-colors');
  if (container.children.length) return; // already built
  const current = window._theme || THEME_DEFAULTS;
  container.innerHTML = Object.keys(COLOR_LABELS).map(key => `
    <div class="flex items-center justify-between py-2.5 border-b border-line last:border-0">
      <label for="color-${key}" class="text-xs text-ink cursor-pointer">${COLOR_LABELS[key]}</label>
      <div class="flex items-center gap-2">
        <span class="font-mono text-[11px] text-muted" id="hex-${key}">${current[key]}</span>
        <input type="color" id="color-${key}" value="${current[key]}"
          class="w-8 h-7 rounded-md cursor-pointer border border-line bg-transparent p-0.5"
          oninput="$('hex-${key}').textContent = this.value" />
      </div>
    </div>`).join('');
}

function openSettings()  {
  buildColorPickers();
  highlightModeButtons();
  highlightActivePreset(getActivePreset());
  $('settings-overlay').classList.remove('hidden');
  $('settings-panel').classList.remove('hidden');
}
function closeSettings() {
  $('settings-overlay').classList.add('hidden');
  $('settings-panel').classList.add('hidden');
}

function applyPreset(name) {
  const p = PRESETS[name];
  if (!p) return;
  Object.keys(p).forEach(k => {
    const el = $('color-' + k);
    if (el) { el.value = p[k]; $('hex-' + k).textContent = p[k]; }
  });
  highlightActivePreset(name);
}

function saveAndApply() {
  const colors = {};
  Object.keys(COLOR_LABELS).forEach(k => {
    colors[k] = $('color-' + k)?.value || THEME_DEFAULTS[k];
  });
  localStorage.setItem('pop-os-theme-' + window._mode, JSON.stringify(colors));
  location.reload();
}

function resetTheme() {
  localStorage.removeItem('pop-os-theme-' + window._mode);
  location.reload();
}

// ══════════════════════════════════════════════════════════════
// AUTH — token check, fetch wrapper, role visibility
// ══════════════════════════════════════════════════════════════

// Which tabs each role can see. ADMIN sees everything.
const TAB_ACCESS = {
  dashboard:  ['ADMIN','PRODUCER','SALES','FINANCE','PM','TEAM_LEAD','STAFF'],
  mywork:     ['ADMIN','PRODUCER','SALES','FINANCE','PM','TEAM_LEAD','STAFF'],
  // Everyone has their own journey page. Viewing SOMEONE ELSE's
  // (?person=<id>) is checked by the API — JOURNEY_VIEWERS in roles.ts.
  journey:    ['ADMIN','PRODUCER','SALES','FINANCE','PM','TEAM_LEAD','STAFF'],
  // Jobs show money (value, costs, net, invoices) — money roles only.
  // Keep in sync with JOB_ROLES in src/common/roles.ts (the API enforces it).
  jobs:       ['ADMIN','PRODUCER','PM','FINANCE','SALES'],
  sales:      ['ADMIN','SALES','PRODUCER'],
  clients:    ['ADMIN','SALES'],
  sp:         ['ADMIN'],
  projects:   ['ADMIN','PRODUCER','FINANCE','PM','TEAM_LEAD','STAFF'],
  production: ['ADMIN','PRODUCER','PM','TEAM_LEAD','STAFF'],
  capacity:   ['ADMIN','PRODUCER','PM','TEAM_LEAD','STAFF'],
  financial:  ['ADMIN','FINANCE'],
  people:      ['ADMIN','PRODUCER','PM','TEAM_LEAD'],
  staffing:    ['ADMIN','PRODUCER','PM','TEAM_LEAD'],
  committees:  ['ADMIN','PRODUCER','PM','TEAM_LEAD','FINANCE','STAFF'],
  notifications: ['ADMIN'],
  audit:         ['ADMIN'],
};

// Can the signed-in user open this tab? Used by the page guard in
// renderHeader() and to hide cross-page links (e.g. Job → Sales pipeline).
// Unknown tab names are allowed — TAB_ACCESS lists the restricted ones.
function canAccessTab(tab) {
  let role = null;
  try { role = JSON.parse(localStorage.getItem('pop-os-user') || '{}').role; } catch (e) {}
  if (!role || !TAB_ACCESS[tab]) return true;   // not signed in → login redirect handles it
  return TAB_ACCESS[tab].includes(role);
}

const ROLE_LABEL = {
  ADMIN:     'Admin',
  PRODUCER:  'Producer',
  SALES:     'Sales',
  FINANCE:   'Finance',
  PM:        'Project Manager',
  TEAM_LEAD: 'Team Lead',
  STAFF:     'Staff',
};
const ROLE_CLS = {
  ADMIN:     'bg-warm/15 text-warm border border-warm/30',
  PRODUCER:  'bg-accent/15 text-accent border border-accent/30',
  SALES:     'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
  FINANCE:   'bg-sky-500/15 text-sky-400 border border-sky-500/30',
  PM:        'bg-purple-500/15 text-purple-400 border border-purple-500/30',
  TEAM_LEAD: 'bg-teal-500/15 text-teal-400 border border-teal-500/30',
  STAFF:     'bg-zinc-500/15 text-zinc-400 border border-zinc-500/30',
};

// Redirect to login if no token
const _token = localStorage.getItem('pop-os-token');
if (!_token) { window.location.replace('/login.html'); }

// Intercept all fetch() calls to inject the Bearer token automatically.
// This means none of the tab JS files need to know about auth.
const _origFetch = window.fetch;
window.fetch = function(url, opts = {}) {
  if (typeof url === 'string' && url.startsWith('/api') && _token) {
    // File uploads (FormData) must NOT get a JSON Content-Type — the browser
    // sets "multipart/form-data; boundary=…" itself, and the server needs it.
    const json = opts.body instanceof FormData ? {} : { 'Content-Type': 'application/json' };
    opts = { ...opts, headers: { ...json, ...(opts.headers || {}), Authorization: 'Bearer ' + _token } };
  }
  return _origFetch(url, opts).then(res => {
    if (res.status === 401) { logout(); }
    return res;
  });
};

// Apply role-based menu visibility — hides each side-menu page this role
// can't open, then any section (heading included) left with nothing in it,
// e.g. the whole Admin section for non-admins.
function applyRoleVisibility(role) {
  document.querySelectorAll('#sidebar [data-tab]').forEach(a => {
    a.style.display = (TAB_ACCESS[a.dataset.tab]?.includes(role) ?? true) ? '' : 'none';
  });
  document.querySelectorAll('#sidebar [data-section]').forEach(sec => {
    const any = [...sec.querySelectorAll('[data-tab]')].some(a => a.style.display !== 'none');
    sec.style.display = any ? '' : 'none';
  });
  // Show "Manage users" only to admins
  const manageBtn = $('user-manage-btn');
  if (manageBtn) manageBtn.style.display = role === 'ADMIN' ? '' : 'none';
}

// Render user info in the header
function initUserUI() {
  // Set the day/night icon here (not at file-load time) so this file can be
  // loaded before the header markup exists in the DOM — needed for pages
  // that inject the header via renderHeader()/document.write.
  const modeBtn = $('mode-btn');
  if (modeBtn) modeBtn.innerHTML = window._mode === 'dark' ? ICON_MOON : ICON_SUN;

  try {
    const user = JSON.parse(localStorage.getItem('pop-os-user') || '{}');
    if (!user.name) return;
    $('user-name-label').textContent = user.name;
    const badge = $('user-role-badge');
    badge.textContent  = ROLE_LABEL[user.role] || user.role;
    badge.className    = 'badge text-[10px] ' + (ROLE_CLS[user.role] || '');
    $('user-email-label').textContent = user.email || '';
    applyRoleVisibility(user.role);
    applyUserCompany(); // auto-lock company filter based on user's company
  } catch(e) {}
}

function toggleUserMenu() {
  $('user-menu').classList.toggle('hidden');
}
document.addEventListener('click', e => {
  if (!$('user-menu-wrap')?.contains(e.target)) {
    $('user-menu')?.classList.add('hidden');
  }
});

function logout() {
  localStorage.removeItem('pop-os-token');
  localStorage.removeItem('pop-os-user');
  window.location.replace('/login.html');
}

// ── User manager (admin only) ─────────────────────────────────
function openUserManager() {
  $('user-menu').classList.add('hidden');
  $('user-mgr-overlay').classList.remove('hidden');
  loadUserList();
}
function closeUserManager() {
  $('user-mgr-overlay').classList.add('hidden');
}

async function loadUserList() {
  const users = await fetch('/api/users').then(r => r.json()).catch(() => []);
  const ROLE_OPTS = ['ADMIN','PRODUCER','SALES','FINANCE','PM','TEAM_LEAD','STAFF'].map(r =>
    `<option value="${r}">${ROLE_LABEL[r]}</option>`).join('');

  $('user-list').innerHTML = users.map(u => `
    <tr class="border-b border-line/60">
      <td class="py-2 px-3 text-xs text-ink">${esc(u.name)}</td>
      <td class="py-2 px-3 text-xs text-muted">${esc(u.email)}</td>
      <td class="py-2 px-3 text-xs">
        <span class="badge text-[10px] ${ROLE_CLS[u.role] || ''}">${ROLE_LABEL[u.role]||u.role}</span>
      </td>
      <td class="py-2 px-3 text-xs text-center">
        <input type="checkbox" ${u.active ? 'checked' : ''} disabled class="accent-accent" />
      </td>
      <td class="py-2 px-3 text-right">
        <div class="flex items-center justify-end gap-1.5">
          <button class="btn-edit text-[11px]" onclick="resetUserPassword('${u.id}','${esc(u.name)}')">Reset PW</button>
          <button class="btn-del text-[11px]" onclick="deleteUser('${u.id}')">×</button>
        </div>
      </td>
    </tr>`).join('');
}

// Admin-initiated reset — generates a random password client-side and PATCHes
// it straight to the user record (the backend already bcrypt-hashes it, same
// path as every other password write). Shown once in the modal so the admin
// can copy it and relay it to the person — never emailed, never logged.
function generateRandomPassword() {
  // Excludes visually-ambiguous characters (0/O, 1/l/I) since an admin has
  // to read this back accurately to relay it.
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const bytes = new Uint32Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => chars[b % chars.length]).join('');
}

async function resetUserPassword(id, name) {
  if (!confirm(`Reset password for ${name}?\n\nA new random password will be generated and their current password will stop working immediately.`)) return;

  const newPw = generateRandomPassword();
  const res = await fetch('/api/users/' + id, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: newPw }),
  });

  const msgEl = $('user-mgr-msg');
  if (res.ok) {
    // Deliberately not using msg() — it auto-clears after 4.5s, too short
    // to reliably copy a password out of.
    msgEl.className = 'text-xs mt-2 text-ink';
    msgEl.innerHTML = `Password reset for <strong>${esc(name)}</strong>. New password: ` +
      `<code class="bg-panel2 border border-line rounded px-1.5 py-0.5 font-mono text-accent select-all">${esc(newPw)}</code>` +
      ` — copy this now, it won't be shown again.`;
  } else {
    const e = await res.json().catch(() => ({}));
    msg(msgEl, [].concat(e.message || 'Failed').join(', '), 'err');
  }
}

async function addUser() {
  const name  = $('new-user-name').value.trim();
  const email = $('new-user-email').value.trim();
  const pw    = $('new-user-pw').value;
  const role  = $('new-user-role').value;
  const msgEl = $('user-mgr-msg');
  if (!name || !email || !pw) { msg(msgEl,'All fields required.','err'); return; }

  const res = await fetch('/api/users', {
    method:'POST',
    body: JSON.stringify({ name, email, password: pw, role }),
  });
  if (res.ok) {
    $('new-user-name').value = $('new-user-email').value = $('new-user-pw').value = '';
    msg(msgEl, 'User added.', 'ok');
    loadUserList();
  } else {
    const e = await res.json().catch(() => ({}));
    msg(msgEl, [].concat(e.message||'Failed').join(', '), 'err');
  }
}

async function deleteUser(id) {
  const me = JSON.parse(localStorage.getItem('pop-os-user') || '{}');
  if (me.id === id) { alert("You can't delete your own account."); return; }
  if (!confirm('Remove this user?')) return;
  await fetch('/api/users/' + id, { method:'DELETE' });
  loadUserList();
}
