// ══════════════════════════════════════════════════════════════
// SHARED SHELL — utilities, theme, auth, nav, user menu.
// Loaded by every page (index.html today; standalone tab pages as they're
// split out — see CLAUDE.md "one module, one page" migration).
// Depends on markup already being on the page: header (#mode-btn,
// #user-menu, #user-menu-wrap, nav tab buttons with id="tab-btn-<name>"),
// the settings drawer (#settings-overlay/#settings-panel/#rows-colors),
// the company filter bar (#company-filter-bar, #filter-btn-LPS/PXL), and
// the User Manager modal (#user-mgr-overlay, #user-list, etc).
// Also depends on window._mode/_theme/_DARK/_LIGHT being set already by
// the small inline <head> script that resolves the active theme before
// Tailwind loads (kept inline, per-page, so there's no flash of the wrong
// theme while this file downloads).
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
function applyModeSwitch(mode) {
  const base = mode === 'light' ? window._LIGHT : window._DARK;
  const next = {
    bg:     base.bg,
    panel:  base.panel,
    panel2: base.panel2,
    line:   base.line,
    ink:    base.ink,
    muted:  base.muted,
    accent: window._theme.accent,
    warm:   window._theme.warm,
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
// Untagged items (company = null) always show regardless of filter.
function matchesFilter(company) {
  if (!window._company) return true;
  if (!company) return true;
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

// Asset stage display constants — used by Assets, Projects (detail view) and My Work.
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

// ── tab switching (SPA shell only — no-op on a standalone tab page) ──
const ALL_TABS = ['dashboard','mywork','sales','clients','sp','projects','assets','production','capacity','cr','financial','people','staffing','committees','admin'];

// Which group each tab belongs to (for highlighting the group button)
const TAB_GROUP = {
  dashboard: null, mywork: null,
  sales: 'sales', clients: 'sales', sp: 'sales',
  projects: 'production', assets: 'production', production: 'production', capacity: 'production', cr: 'production',
  financial: null,
  people: 'hr', staffing: 'hr', committees: 'hr',
  admin: null,
};

// Every tab now has its own standalone page (see CLAUDE.md "one module, one
// page" migration) — index.html itself is just the Dashboard page now.
// hrefForTab() falls back to /index.html?tab=<name> for any future tab added
// here before its own page exists.
const TAB_PAGE = {
  dashboard:  '/index.html',
  projects:   '/projects.html',
  capacity:   '/capacity.html',
  assets:     '/assets.html',
  production: '/production.html',
  sales:      '/sales.html',
  clients:    '/clients.html',
  sp:         '/sp.html',
  cr:         '/cr.html',
  financial:  '/financial.html',
  people:     '/people.html',
  staffing:   '/staffing.html',
  committees: '/committees.html',
  mywork:     '/mywork.html',
  admin:      '/admin.html',
};
function hrefForTab(name) {
  return TAB_PAGE[name] || ('/index.html?tab=' + name);
}

// Builds the full app header — logo, company filter, nav, mode/settings
// buttons, user menu — as an HTML string. `activeTab` is the tab this page
// represents; on index.html that's whichever tab is currently switched to,
// on a standalone page (e.g. projects.html) it's always that page's own tab.
// Direct tabs and group sub-tabs render as real <a href> links so pages not
// yet split still work as a normal link, and once-split pages navigate
// straight there instead of trying to switchTab() a panel that no longer
// exists on this page.
function renderHeader(activeTab) {
  const directCls = (t) => 'px-4 py-1 rounded-full text-xs font-semibold transition-all duration-150 '
    + (t === activeTab ? 'bg-panel text-ink' : 'text-muted hover:text-ink');
  const groupBtnCls = (g) => 'flex items-center gap-1 px-4 py-1 rounded-full text-xs font-semibold transition-all duration-150 '
    + (TAB_GROUP[activeTab] === g ? 'bg-panel text-ink' : 'text-muted hover:text-ink');
  const subCls = (t) => 'nav-sub-item' + (t === activeTab ? ' active' : '');
  const chevron = `<svg class="w-3 h-3 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 9l-7 7-7-7"/>
    </svg>`;

  return `
  <header class="sticky top-0 z-50 bg-panel/95 backdrop-blur-sm border-b border-line">
    <div class="max-w-7xl mx-auto px-5 h-13 flex items-center gap-4 py-3">
      <div id="company-filter-bar" class="flex items-center gap-3 shrink-0">
        <button id="filter-btn-LPS" onclick="setCompanyFilter('LPS')" title="Filter to Lorrypop Studio"
          class="rounded-lg p-0.5 cursor-pointer transition-all duration-150 hover:opacity-100">
          <img src="/lps-logo.png" class="h-7 w-auto object-contain" alt="LPS" />
        </button>
        <span class="h-5 w-px bg-line block"></span>
        <button id="filter-btn-PXL" onclick="setCompanyFilter('PXL')" title="Filter to Popxical Lab"
          class="rounded-lg p-0.5 cursor-pointer transition-all duration-150 hover:opacity-100">
          <img src="/pxl-logo.png" class="h-7 w-auto object-contain" alt="PXL" />
        </button>
        <div class="pl-1">
          <p class="text-sm font-bold text-ink leading-tight tracking-tight">Pop OS</p>
          <p class="text-[10px] text-muted leading-tight hidden sm:block">Pop Group Studio</p>
        </div>
      </div>
      <!-- Grouped nav — 5 top-level items, sub-tabs in dropdowns -->
      <nav class="flex items-center gap-1 bg-bg/80 rounded-full p-1 border border-line">

        <!-- Dashboard (direct) -->
        <a id="tab-btn-dashboard" href="${hrefForTab('dashboard')}" class="${directCls('dashboard')}">Dashboard</a>

        <!-- My Work (direct — personal dashboard for the logged-in user) -->
        <a id="tab-btn-mywork" href="${hrefForTab('mywork')}" class="${directCls('mywork')}">My Work</a>

        <!-- Sales group -->
        <div class="relative" id="grp-sales">
          <button id="grp-btn-sales" onclick="toggleNavGroup('sales')" class="${groupBtnCls('sales')}">
            Sales
            ${chevron}
          </button>
          <div id="grp-drop-sales" class="hidden absolute left-0 top-full mt-1 w-36 bg-panel border border-line rounded-xl shadow-lg z-50 py-1">
            <a id="tab-btn-sales"   href="${hrefForTab('sales')}"   class="${subCls('sales')}">Sales pipeline</a>
            <a id="tab-btn-clients" href="${hrefForTab('clients')}" class="${subCls('clients')}">Clients</a>
            <a id="tab-btn-sp"      href="${hrefForTab('sp')}"      class="${subCls('sp')}">Performance</a>
          </div>
        </div>

        <!-- Production group -->
        <div class="relative" id="grp-production">
          <button id="grp-btn-production" onclick="toggleNavGroup('production')" class="${groupBtnCls('production')}">
            Production
            ${chevron}
          </button>
          <div id="grp-drop-production" class="hidden absolute left-0 top-full mt-1 w-36 bg-panel border border-line rounded-xl shadow-lg z-50 py-1">
            <a id="tab-btn-projects"   href="${hrefForTab('projects')}"   class="${subCls('projects')}">Projects</a>
            <a id="tab-btn-assets"     href="${hrefForTab('assets')}"     class="${subCls('assets')}">Assets</a>
            <a id="tab-btn-production" href="${hrefForTab('production')}" class="${subCls('production')}">Lanes</a>
            <a id="tab-btn-capacity"   href="${hrefForTab('capacity')}"   class="${subCls('capacity')}">Capacity</a>
            <a id="tab-btn-cr"         href="${hrefForTab('cr')}"         class="${subCls('cr')}">Change Requests</a>
          </div>
        </div>

        <!-- Financial (direct — single item group) -->
        <a id="tab-btn-financial" href="${hrefForTab('financial')}" class="${directCls('financial')}">Financial</a>

        <!-- Admin (direct — ADMIN only, hidden for all other roles) -->
        <a id="tab-btn-admin" href="${hrefForTab('admin')}" class="${directCls('admin')}">Admin</a>

        <!-- HR group -->
        <div class="relative" id="grp-hr">
          <button id="grp-btn-hr" onclick="toggleNavGroup('hr')" class="${groupBtnCls('hr')}">
            HR
            ${chevron}
          </button>
          <div id="grp-drop-hr" class="hidden absolute left-0 top-full mt-1 w-36 bg-panel border border-line rounded-xl shadow-lg z-50 py-1">
            <a id="tab-btn-people"     href="${hrefForTab('people')}"     class="${subCls('people')}">People / ELC</a>
            <a id="tab-btn-staffing"   href="${hrefForTab('staffing')}"   class="${subCls('staffing')}">Staffing</a>
            <a id="tab-btn-committees" href="${hrefForTab('committees')}" class="${subCls('committees')}">Committees</a>
          </div>
        </div>

      </nav>

      <!-- Day / night toggle -->
      <button id="mode-btn" onclick="toggleMode()" title="Toggle day / night"
        class="ml-auto w-8 h-8 flex items-center justify-center rounded-lg text-muted
               hover:text-ink hover:bg-panel2 transition-colors cursor-pointer shrink-0"></button>
      <!-- Settings trigger -->
      <button onclick="openSettings()" title="Theme settings"
        class="w-8 h-8 flex items-center justify-center rounded-lg text-muted
               hover:text-ink hover:bg-panel2 transition-colors cursor-pointer shrink-0">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"/>
        </svg>
      </button>
      <!-- User badge + logout -->
      <div class="relative shrink-0" id="user-menu-wrap">
        <button id="user-btn" onclick="toggleUserMenu()"
          class="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-line text-xs text-muted
                 hover:text-ink hover:bg-panel2 transition-colors cursor-pointer">
          <span id="user-name-label">…</span>
          <span id="user-role-badge" class="badge text-[10px]"></span>
          <svg class="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
          </svg>
        </button>
        <div id="user-menu"
          class="hidden absolute right-0 top-full mt-1 w-52 bg-panel border border-line rounded-xl shadow-lg z-50 py-1">
          <div class="px-4 py-2 border-b border-line">
            <p id="user-email-label" class="text-[11px] text-muted truncate"></p>
          </div>
          <button id="user-manage-btn" onclick="openUserManager()" style="display:none"
            class="w-full text-left px-4 py-2 text-xs text-ink hover:bg-panel2 transition-colors cursor-pointer">
            Manage users
          </button>
          <a href="/guide.html" target="_blank" rel="noopener"
            class="block w-full text-left px-4 py-2 text-xs text-ink hover:bg-panel2 transition-colors cursor-pointer">
            User guide
          </a>
          <a href="/changelog.html" target="_blank" rel="noopener"
            class="block w-full text-left px-4 py-2 text-xs text-ink hover:bg-panel2 transition-colors cursor-pointer">
            What's new
          </a>
          <button onclick="logout()"
            class="w-full text-left px-4 py-2 text-xs text-warm hover:bg-panel2 transition-colors cursor-pointer">
            Sign out
          </button>
        </div>
      </div>
    </div>
  </header>`;
}

function switchTab(name) {
  ALL_TABS.forEach(t => {
    const btn = $('tab-btn-' + t);
    if (btn) btn.classList.toggle('active', t === name);
    $('tab-' + t)?.classList.toggle('hidden', t !== name);
  });
  // Highlight the active group button
  ['sales','production','hr'].forEach(g => {
    const gbtn = $('grp-btn-' + g);
    if (!gbtn) return;
    const grpActive = TAB_GROUP[name] === g;
    gbtn.className = gbtn.className
      .replace(/bg-panel text-ink|text-muted hover:text-ink/g, '')
      .trim();
    gbtn.className += grpActive
      ? ' bg-panel text-ink'
      : ' text-muted hover:text-ink';
  });
  // Direct tabs (dashboard, mywork, financial, admin)
  ['dashboard','mywork','financial','admin'].forEach(t => {
    const btn = $('tab-btn-' + t);
    if (!btn) return;
    btn.className = (name === t)
      ? 'px-4 py-1 rounded-full text-xs font-semibold transition-all duration-150 bg-panel text-ink'
      : 'px-4 py-1 rounded-full text-xs font-semibold transition-all duration-150 text-muted hover:text-ink';
  });
  if (name === 'dashboard')  loadDashboard();
  // Every other tab has its own page now — see TAB_PAGE above. switchTab() only ever runs for 'dashboard' on index.html.
}

// ── group dropdown nav ────────────────────────────────────────
const GROUPS = ['sales','production','hr'];

function toggleNavGroup(g) {
  const isOpen = !$('grp-drop-' + g).classList.contains('hidden');
  closeAllNavGroups();
  if (!isOpen) $('grp-drop-' + g).classList.remove('hidden');
}

function closeAllNavGroups() {
  GROUPS.forEach(g => $('grp-drop-' + g)?.classList.add('hidden'));
}

function pickNavTab(name) {
  closeAllNavGroups();
  switchTab(name);
}

// Close dropdowns when clicking outside
document.addEventListener('click', function(e) {
  const inNav = e.target.closest('nav');
  if (!inNav) closeAllNavGroups();
});

// ══════════════════════════════════════════════════════════════
// THEME SETTINGS
// ══════════════════════════════════════════════════════════════

// The default colours for the active mode (set by the head script).
const THEME_DEFAULTS = window._mode === 'light' ? window._LIGHT : window._DARK;

const PRESETS = {
  'Warm Dark': { bg:'#111009', panel:'#191814', panel2:'#201e19', line:'#2c2920', ink:'#e4e0d4', muted:'#857f73', accent:'#d4a23a', warm:'#c05535' },
  'Cool Dark':  { bg:'#0d0f14', panel:'#141920', panel2:'#1b2029', line:'#252e3b', ink:'#dde3ee', muted:'#7a8394', accent:'#5b9cf6', warm:'#e05252' },
  'Midnight':   { bg:'#0f0f18', panel:'#15151f', panel2:'#1c1c28', line:'#262635', ink:'#e0dff2', muted:'#7a7990', accent:'#7c6fcd', warm:'#e05b5b' },
  'Forest':     { bg:'#0d1209', panel:'#141a0f', panel2:'#1b2416', line:'#233020', ink:'#d8e6d0', muted:'#7a9070', accent:'#5aab66', warm:'#c06038' },
  'Day':        window._LIGHT,
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
  sales:      ['ADMIN','SALES'],
  clients:    ['ADMIN','SALES'],
  sp:         ['ADMIN'],
  projects:   ['ADMIN','PRODUCER','FINANCE','PM','TEAM_LEAD','STAFF'],
  assets:     ['ADMIN','PRODUCER','PM','TEAM_LEAD','STAFF'],
  production: ['ADMIN','PRODUCER','PM','TEAM_LEAD','STAFF'],
  capacity:   ['ADMIN','PRODUCER','PM','TEAM_LEAD','STAFF'],
  cr:         ['ADMIN','PRODUCER','PM','TEAM_LEAD','FINANCE'],
  financial:  ['ADMIN','FINANCE'],
  people:      ['ADMIN','PRODUCER','PM','TEAM_LEAD'],
  staffing:    ['ADMIN','PRODUCER','PM','TEAM_LEAD'],
  committees:  ['ADMIN','PRODUCER','PM','TEAM_LEAD','FINANCE','STAFF'],
  admin:       ['ADMIN'],
};

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
    opts = { ...opts, headers: { 'Content-Type': 'application/json', ...(opts.headers || {}), Authorization: 'Bearer ' + _token } };
  }
  return _origFetch(url, opts).then(res => {
    if (res.status === 401) { logout(); }
    return res;
  });
};

// Apply role-based tab visibility — hides individual sub-items AND
// the whole group button if the role has no access to any tab in that group.
function applyRoleVisibility(role) {
  ALL_TABS.forEach(t => {
    const allowed = TAB_ACCESS[t]?.includes(role) ?? true;
    const btn = $('tab-btn-' + t);
    if (btn) btn.style.display = allowed ? '' : 'none';
  });
  // Hide the group button if all its tabs are hidden for this role
  const GROUP_TABS = {
    sales:      ['sales','clients','sp'],
    production: ['projects','assets','production','capacity','cr'],
    hr:         ['people','staffing','committees'],
  };
  GROUPS.forEach(g => {
    const anyVisible = (GROUP_TABS[g] || []).some(t => TAB_ACCESS[t]?.includes(role));
    const gbtn = $('grp-' + g);
    if (gbtn) gbtn.style.display = anyVisible ? '' : 'none';
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
        <button class="btn-del text-[11px]" onclick="deleteUser('${u.id}')">×</button>
      </td>
    </tr>`).join('');
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
