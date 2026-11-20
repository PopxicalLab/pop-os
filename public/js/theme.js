// ══════════════════════════════════════════════════════════════
// THEME BOOT — colours, font, shadows and shared component classes.
// Loaded in <head> of every app page, straight AFTER the Tailwind CDN
// <script> and BEFORE shared.js:
//
//     <script src="https://cdn.tailwindcss.com"></script>
//     <script src="/js/theme.js"></script>
//     <script src="/js/shared.js"></script>
//
// Why one file: this used to be ~60 lines copied into the <head> of 17
// pages. Changing a colour meant editing all 17. Now it's here, once.
//
// Why it must be a plain (blocking) <script> in <head>, not deferred: it
// has to pick the palette and write the CSS before the browser paints the
// <body>, otherwise the page flashes in the wrong colours.
//
// Look & feel follows the TailAdmin dashboard style (MIT-licensed free
// template, tailadmin.com): cool grays, one indigo accent, white cards with
// a thin border, soft shadows, rounded-2xl corners, the Outfit font.
// Colour values are TailAdmin's (its gray scale is the "Untitled UI" grays).
// ══════════════════════════════════════════════════════════════
(function () {
  // The 8 colour tokens every page uses (bg-bg, bg-panel, border-line,
  // text-ink, text-muted, text-accent, text-warm …). Change a value here and
  // every page follows. Users can still override them in ⚙ Theme settings.
  const LIGHT = {
    bg:     '#f9fafb',  // page background        (gray-50)
    panel:  '#ffffff',  // cards, header, menus   (white)
    panel2: '#f2f4f7',  // inputs, hover, insets  (gray-100)
    line:   '#e4e7ec',  // borders                (gray-200)
    ink:    '#1d2939',  // main text              (gray-800)
    muted:  '#667085',  // secondary text         (gray-500)
    accent: '#465fff',  // brand / links / active (brand-500)
    warm:   '#f04438',  // errors, delete, overdue (error-500)
  };
  const DARK = {
    bg:     '#101828',  // gray-900
    panel:  '#171f2f',  // a card is white at ~3% on top of gray-900
    panel2: '#1d2939',  // gray-800
    line:   '#263142',  // between gray-800 and gray-700, so input edges still show
    ink:    '#e4e7ec',  // gray-200
    muted:  '#98a2b3',  // gray-400
    accent: '#7592ff',  // brand-400 — the 500 is too dim on dark
    warm:   '#f97066',  // error-400
  };

  // Saved palettes from the OLD warm/gold theme would otherwise win over the
  // new defaults (the day/night toggle saves the full palette every time).
  // Bump THEME_VERSION whenever the defaults change: everyone's saved colours
  // are cleared once, so they see the new look. Their day/night choice stays.
  const THEME_VERSION = '2';
  let mode = 'light', custom = null;
  try {
    if (localStorage.getItem('pop-os-theme-v') !== THEME_VERSION) {
      ['pop-os-theme', 'pop-os-theme-dark', 'pop-os-theme-light'].forEach(k => localStorage.removeItem(k));
      localStorage.setItem('pop-os-theme-v', THEME_VERSION);
    }
    mode   = localStorage.getItem('pop-os-mode') || 'light';
    custom = JSON.parse(localStorage.getItem('pop-os-theme-' + mode) || 'null');
  } catch (e) { /* private window / storage blocked — just use the defaults */ }

  const theme = custom || (mode === 'dark' ? DARK : LIGHT);
  window._mode  = mode;
  window._theme = theme;
  window._DARK  = DARK;
  window._LIGHT = LIGHT;

  // Soft, slightly blue-tinted shadows (TailAdmin's shadow-theme-* scale)
  // replace Tailwind's default grey ones, so every existing shadow-lg /
  // shadow-xl on menus and pop-ups picks up the new feel automatically.
  const SHADOW = {
    sm:      '0 1px 2px 0 rgba(16,24,40,.05)',
    DEFAULT: '0 1px 3px 0 rgba(16,24,40,.10), 0 1px 2px 0 rgba(16,24,40,.06)',
    md:      '0 4px 8px -2px rgba(16,24,40,.10), 0 2px 4px -2px rgba(16,24,40,.06)',
    lg:      '0 12px 16px -4px rgba(16,24,40,.08), 0 4px 6px -2px rgba(16,24,40,.03)',
    xl:      '0 20px 24px -4px rgba(16,24,40,.08), 0 8px 8px -4px rgba(16,24,40,.03)',
    '2xl':   '0 24px 48px -12px rgba(16,24,40,.18)',
  };

  tailwind.config = {
    theme: {
      extend: {
        colors: theme,
        // Outfit first; the system fonts are the fallback while it loads.
        fontFamily: { sans: ['Outfit', 'ui-sans-serif', 'system-ui', 'Segoe UI', 'Roboto', 'sans-serif'] },
        // Cards here use rounded-xl. TailAdmin's cards are 16px, so xl
        // grows from 12px to 16px here instead of editing ~100 class lists.
        borderRadius: { xl: '1rem' },
        boxShadow: SHADOW,
        // Bigger text. Most body text here is text-xs (12px) or text-sm
        // (14px) — small at 100% zoom. Each step grows ~2.5px here, so every
        // page gets bigger without editing ~1,000 class lists. (The tiny
        // hand-picked sizes, text-[10px] / text-[11px], are bumped in the
        // plain CSS below.) The side menu uses fixed text-[15px] / [12px]
        // sizes on purpose, so it stays as it is when these change.
        fontSize: {
          xs: ['0.90625rem', { lineHeight: '1.375rem' }],  // 12px → 14.5px
          sm: ['1rem',       { lineHeight: '1.5rem' }],    // 14px → 16px
        },
        // Pages sit in a max-w-7xl box (1280px). With the side menu taking
        // 260px, big monitors left wide empty margins — allow up to 1536px.
        maxWidth: { '7xl': '96rem' },
      },
    },
  };

  // Plain CSS: the font file (self-hosted in /fonts — no Google Fonts call,
  // so it works on the office network with no internet) and the page
  // background, painted at once so there's no flash.
  // Then the shared component classes, written as a text/tailwindcss block
  // so the CDN processes the @apply rules (a normal .css file can't use them).
  document.write(`
<style>
  @font-face {
    font-family: 'Outfit';
    font-style: normal;
    font-weight: 100 900;
    font-display: swap;
    src: url('/fonts/outfit-latin-wght-normal.woff2') format('woff2');
  }
  body { background-color: ${theme.bg}; }

  /* Bump the hand-picked tiny sizes one step (see fontSize above).
     "html " in front makes these win over Tailwind's own rule. */
  html .text-\\[9px\\], html .text-\\[10px\\] { font-size: 12.5px; }
  html .text-\\[11px\\] { font-size: 13.5px; }

  /* Phones: iPhone Safari zooms the whole page in when you tap a field whose
     text is smaller than 16px — and doesn't zoom back out. 16px stops that. */
  @media (max-width: 767.98px) {
    input:not([type=checkbox]):not([type=radio]):not([type=color]), select, textarea { font-size: 16px !important; }
  }
</style>
<style type="text/tailwindcss">
  @layer components {
    .form-input {
      @apply w-full bg-panel border border-line text-ink placeholder-muted/60
             px-3 py-2 rounded-lg text-sm shadow-sm
             focus:outline-none focus:border-accent/70 focus:ring-4 focus:ring-accent/10
             transition-colors duration-150;
    }
    .form-label {
      @apply block text-xs text-muted font-medium mb-1.5 mt-3;
    }
    .btn-del {
      @apply bg-transparent border border-line text-muted px-2.5 py-1 rounded-lg
             text-xs font-medium hover:border-warm/60 hover:text-warm hover:bg-warm/5
             transition-colors duration-150 cursor-pointer;
    }
    .btn-edit {
      @apply bg-transparent border border-line text-muted px-2.5 py-1 rounded-lg
             text-xs font-medium hover:border-accent/60 hover:text-accent hover:bg-accent/5
             transition-colors duration-150 cursor-pointer;
    }
    .badge {
      @apply inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium;
    }
    /* Open dropdown lists: some in-table selects are transparent, so without
       this the browser paints the options on white with the theme's text
       colour — unreadable in night mode. Give every option the panel colours. */
    select option {
      @apply bg-panel text-ink;
    }
  }
</style>`);
})();
