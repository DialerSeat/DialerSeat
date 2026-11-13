// The developer site's look: DialerSeat's own blue and Futura, laid out like
// the consoles developers already use. Scoped under .dv so nothing here
// reaches a dialerseat.com page.
//
// TWO THEMES. data-theme="light" (the default inside: console, docs, sign-in)
// or data-theme="dark" (the landing page, always, and anyone who switches).
// Any element can carry its own data-theme to scope a section: the landing
// page wraps itself in dark, and code blocks are dark in both themes.

export const DEV_CSS = `
.dv, .dv [data-theme="dark"], .dv[data-theme="dark"] {
  --dv-bg: #07070d;
  --dv-bg-2: #0b0b14;
  --dv-panel: #0f0f1a;
  --dv-panel-2: #141424;
  --dv-raise: #191930;
  --dv-border: #23233b;
  --dv-border-soft: #1a1a2d;
  --dv-text: #e9e9f3;
  --dv-muted: #9a9ab8;
  --dv-dim: #6a6a88;
  --dv-accent: #4a9eff;
  --dv-accent-2: #2a6eff;
  --dv-accent-soft: rgba(74,158,255,0.12);
  --dv-green: #34d399;
  --dv-green-soft: rgba(52,211,153,0.12);
  --dv-amber: #fbbf24;
  --dv-amber-soft: rgba(251,191,36,0.12);
  --dv-red: #f87171;
  --dv-red-soft: rgba(248,113,113,0.12);
  --dv-hover-border: #2e2e4c;
  --dv-header-bg: rgba(7,7,13,.85);
  --dv-prose: #c8c8dc;
  --dv-inline-code: #cfd8ff;
  --dv-card-shadow: none;
  --dv-get: #34d399; --dv-get-bg: rgba(52,211,153,.1);
  --dv-post: #4a9eff; --dv-post-bg: rgba(74,158,255,.12);
  --dv-patch: #fbbf24; --dv-patch-bg: rgba(251,191,36,.1);
  --dv-delete: #f87171; --dv-delete-bg: rgba(248,113,113,.1);
  color-scheme: dark;
}
.dv[data-theme="light"], .dv [data-theme="light"] {
  --dv-bg: #ffffff;
  --dv-bg-2: #fafafa;
  --dv-panel: #ffffff;
  --dv-panel-2: #f4f4f5;
  --dv-raise: #ededef;
  --dv-border: #e2e2e5;
  --dv-border-soft: #ececee;
  --dv-text: #131316;
  --dv-muted: #5e5f6b;
  --dv-dim: #8b8c96;
  --dv-accent: #2a6eff;
  --dv-accent-2: #1f5ee6;
  --dv-accent-soft: rgba(42,110,255,0.08);
  --dv-green: #047857;
  --dv-green-soft: rgba(16,185,129,0.10);
  --dv-amber: #a35200;
  --dv-amber-soft: rgba(245,158,11,0.12);
  --dv-red: #c62828;
  --dv-red-soft: rgba(220,38,38,0.08);
  --dv-hover-border: #cfcfd4;
  --dv-header-bg: rgba(255,255,255,.9);
  --dv-prose: #3a3b45;
  --dv-inline-code: #1f4fc4;
  --dv-card-shadow: 0 1px 2px rgba(0,0,0,.04);
  --dv-get: #047857; --dv-get-bg: rgba(16,185,129,.10);
  --dv-post: #1f5ee6; --dv-post-bg: rgba(42,110,255,.08);
  --dv-patch: #a35200; --dv-patch-bg: rgba(245,158,11,.12);
  --dv-delete: #c62828; --dv-delete-bg: rgba(220,38,38,.08);
  color-scheme: light;
}
.dv, .dv [data-theme] {
  --dv-mono: ui-monospace, SFMono-Regular, 'JetBrains Mono', Menlo, Consolas, monospace;
  --dv-sans: 'Futura PT', Futura, 'Trebuchet MS', sans-serif;
  --dv-ui: -apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, Roboto, 'Helvetica Neue', Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
}
.dv { background: var(--dv-bg); color: var(--dv-text); font-family: var(--dv-sans); min-height: 100vh; }
.dv [data-theme] { color: var(--dv-text); }
.dv *, .dv *::before, .dv *::after { box-sizing: border-box; }
.dv a { color: inherit; text-decoration: none; }
.dv ::selection { background: rgba(74,158,255,0.35); }
.dv code, .dv pre, .dv kbd { font-family: var(--dv-mono); }
.dv :focus-visible { outline: 2px solid var(--dv-accent); outline-offset: 2px; border-radius: 6px; }

/* ── buttons ── */
.dv-btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; height: 36px; padding: 0 14px; border-radius: 8px; font: 500 13px/1 var(--dv-sans); letter-spacing: .3px; cursor: pointer; border: 1px solid var(--dv-border); background: var(--dv-panel-2); color: var(--dv-text); transition: background .15s, border-color .15s, opacity .15s; white-space: nowrap; }
.dv-btn:hover { background: var(--dv-raise); border-color: var(--dv-hover-border); }
.dv-btn:disabled { opacity: .5; cursor: not-allowed; }
.dv-btn-primary { background: linear-gradient(135deg, var(--dv-accent), var(--dv-accent-2)); border-color: transparent; color: #fff; }
.dv-btn-primary:hover { background: linear-gradient(135deg, #5aa8ff, #3a7bff); border-color: transparent; }
.dv-btn-ghost { background: transparent; border-color: transparent; color: var(--dv-muted); }
.dv-btn-ghost:hover { background: var(--dv-panel-2); color: var(--dv-text); border-color: transparent; }
.dv-btn-danger { color: var(--dv-red); }
.dv-btn-danger:hover { background: var(--dv-red-soft); border-color: rgba(248,113,113,.35); }
.dv-btn-sm { height: 28px; padding: 0 10px; font-size: 12px; border-radius: 7px; }
.dv-btn-lg { height: 44px; padding: 0 20px; font-size: 14px; border-radius: 10px; }

/* ── inputs ── */
.dv-input, .dv-select, .dv-textarea { width: 100%; height: 36px; padding: 0 12px; border-radius: 8px; border: 1px solid var(--dv-border); background: var(--dv-bg-2); color: var(--dv-text); font: 14px var(--dv-sans); outline: none; transition: border-color .15s, box-shadow .15s; }
.dv-textarea { height: auto; min-height: 90px; padding: 10px 12px; font-family: var(--dv-mono); font-size: 13px; resize: vertical; }
.dv-input:focus, .dv-select:focus, .dv-textarea:focus { border-color: var(--dv-accent); box-shadow: 0 0 0 3px var(--dv-accent-soft); }
.dv-label { display: block; font-size: 12px; color: var(--dv-muted); margin-bottom: 6px; letter-spacing: .3px; }
.dv-help { font-size: 12px; color: var(--dv-dim); margin-top: 6px; line-height: 1.5; }

/* ── cards ── */
.dv-card { background: var(--dv-panel); border: 1px solid var(--dv-border-soft); border-radius: 14px; box-shadow: var(--dv-card-shadow); }
.dv-card-head { padding: 20px 22px 0; }
.dv-card-title { font-size: 16px; font-weight: 600; margin: 0; }
.dv-card-desc { font-size: 13px; color: var(--dv-muted); margin: 6px 0 0; line-height: 1.55; max-width: 640px; }
.dv-card-body { padding: 18px 22px 22px; }
.dv-card-foot { padding: 12px 22px; border-top: 1px solid var(--dv-border-soft); display: flex; align-items: center; justify-content: space-between; gap: 12px; font-size: 12px; color: var(--dv-dim); }
.dv-inset { background: var(--dv-bg-2); border: 1px solid var(--dv-border-soft); border-radius: 10px; }

/* ── badges ── */
.dv-badge { display: inline-flex; align-items: center; gap: 6px; height: 22px; padding: 0 8px; border-radius: 999px; font-size: 11px; letter-spacing: .4px; border: 1px solid var(--dv-border); color: var(--dv-muted); background: var(--dv-panel-2); white-space: nowrap; }
.dv-badge-green { color: var(--dv-green); background: var(--dv-green-soft); border-color: color-mix(in srgb, var(--dv-green) 30%, transparent); }
.dv-badge-amber { color: var(--dv-amber); background: var(--dv-amber-soft); border-color: color-mix(in srgb, var(--dv-amber) 30%, transparent); }
.dv-badge-red { color: var(--dv-red); background: var(--dv-red-soft); border-color: color-mix(in srgb, var(--dv-red) 30%, transparent); }
.dv-badge-blue { color: var(--dv-accent); background: var(--dv-accent-soft); border-color: color-mix(in srgb, var(--dv-accent) 30%, transparent); }
.dv-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }

/* ── tables ── */
.dv-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.dv-table th { text-align: left; font-weight: 500; color: var(--dv-dim); font-size: 11px; letter-spacing: .6px; text-transform: uppercase; padding: 10px 12px; border-bottom: 1px solid var(--dv-border-soft); }
.dv-table td { padding: 12px; border-bottom: 1px solid var(--dv-border-soft); vertical-align: middle; }
.dv-table tr:last-child td { border-bottom: none; }
.dv-table-wrap { overflow-x: auto; }

/* ── code: dark in both themes (CodeBlock carries data-theme="dark") ── */
.dv-code { position: relative; background: #05050a; border: 1px solid var(--dv-border-soft); border-radius: 12px; overflow: hidden; }
.dv-code-head { display: flex; align-items: center; justify-content: space-between; padding: 8px 10px 8px 14px; border-bottom: 1px solid var(--dv-border-soft); font: 12px var(--dv-mono); color: var(--dv-muted); }
.dv-code pre { margin: 0; padding: 14px 16px; overflow-x: auto; font-size: 12.5px; line-height: 1.65; color: #d6d6ea; }
.dv-inline-code { font-family: var(--dv-mono); font-size: .88em; background: var(--dv-panel-2); border: 1px solid var(--dv-border-soft); padding: 1px 6px; border-radius: 5px; color: var(--dv-inline-code); }
.tok-k { color: #c792ea; } .tok-s { color: #a5e3a1; } .tok-n { color: #f7c87a; } .tok-c { color: #5e6a8a; } .tok-p { color: #7fb6ff; }

/* ── method pills ── */
.dv-method { display: inline-flex; align-items: center; justify-content: center; min-width: 52px; height: 20px; padding: 0 6px; border-radius: 5px; font: 600 10.5px var(--dv-mono); letter-spacing: .5px; }
.dv-method-GET { color: var(--dv-get); background: var(--dv-get-bg); }
.dv-method-POST { color: var(--dv-post); background: var(--dv-post-bg); }
.dv-method-PATCH { color: var(--dv-patch); background: var(--dv-patch-bg); }
.dv-method-DELETE { color: var(--dv-delete); background: var(--dv-delete-bg); }

/* ── switches and segmented controls ── */
.dv-switch { position: relative; width: 36px; height: 20px; border-radius: 999px; background: var(--dv-border); border: none; cursor: pointer; transition: background .15s; flex-shrink: 0; }
.dv-switch::before { content: ''; position: absolute; inset: -10px -6px; }
.dv-switch::after { content: ''; position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; border-radius: 50%; background: #fff; transition: transform .15s; }
.dv-switch[aria-checked="true"] { background: var(--dv-accent); }
.dv-switch[aria-checked="true"]::after { transform: translateX(16px); }
.dv-seg { display: inline-flex; padding: 3px; gap: 2px; border-radius: 9px; background: var(--dv-bg-2); border: 1px solid var(--dv-border-soft); }
.dv-seg button { height: 28px; padding: 0 12px; border-radius: 7px; border: none; background: transparent; color: var(--dv-muted); font: 13px var(--dv-sans); cursor: pointer; }
.dv-seg button[aria-pressed="true"], .dv-seg button[aria-selected="true"] { background: var(--dv-raise); color: var(--dv-text); box-shadow: 0 1px 0 rgba(255,255,255,.04) inset; }

/* ── layout helpers ── */
.dv-stack > * + * { margin-top: 16px; }
.dv-row { display: flex; align-items: center; gap: 12px; }
.dv-grid-2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
.dv-grid-3 { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
@media (max-width: 900px) { .dv-grid-2, .dv-grid-3 { grid-template-columns: minmax(0, 1fr); } }
.dv-h1 { font-size: 26px; font-weight: 600; margin: 0; letter-spacing: -.2px; }
.dv-sub { color: var(--dv-muted); font-size: 14px; margin: 8px 0 0; line-height: 1.6; max-width: 720px; }
.dv-sep { height: 1px; background: var(--dv-border-soft); border: none; margin: 0; }
.dv-muted { color: var(--dv-muted); }
.dv-dim { color: var(--dv-dim); }
.dv-mono { font-family: var(--dv-mono); }
.dv-link { color: var(--dv-accent); }
.dv-link:hover { text-decoration: underline; }
.dv-toast { position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); z-index: 100; padding: 10px 16px; border-radius: 10px; background: var(--dv-raise); border: 1px solid var(--dv-border); font-size: 13px; box-shadow: 0 10px 40px rgba(0,0,0,.5); }
.dv-alert { display: flex; gap: 12px; padding: 14px 16px; border-radius: 12px; font-size: 13px; line-height: 1.55; border: 1px solid; }
.dv-alert-blue { background: var(--dv-accent-soft); border-color: color-mix(in srgb, var(--dv-accent) 30%, transparent); }
.dv-alert-amber { background: var(--dv-amber-soft); border-color: color-mix(in srgb, var(--dv-amber) 30%, transparent); }
.dv-alert-green { background: var(--dv-green-soft); border-color: color-mix(in srgb, var(--dv-green) 30%, transparent); }
.dv-empty { padding: 36px 20px; text-align: center; color: var(--dv-dim); font-size: 13px; }
mark.dv-mark { background: rgba(74,158,255,.22); color: inherit; border-radius: 3px; padding: 0 1px; }

/* ── the inside: the type and density of a developer dashboard ──
   Everything past the landing page (console, docs, welcome, sign-in) is
   .dv-app: the system UI font developer sites use, 14px base, tighter
   radii. The DialerSeat wordmark keeps Futura wherever it appears. */
.dv-app { font-family: var(--dv-ui); font-size: 14px; letter-spacing: 0; }
.dv-app .dv-btn { font-family: var(--dv-ui); font-weight: 500; letter-spacing: 0; border-radius: 8px; }
.dv-app .dv-input, .dv-app .dv-select, .dv-app .dv-seg button { font-family: var(--dv-ui); }
.dv-app .dv-card { border-radius: 12px; }
.dv-app .dv-h1 { font-size: 24px; font-weight: 600; letter-spacing: -.2px; }
.dv-app .dv-card-title { font-size: 15px; }
.dv-app .dv-badge { letter-spacing: 0; font-weight: 500; }
.dv-app[data-theme="light"] .dv-btn:not(.dv-btn-primary):not(.dv-btn-ghost),
.dv[data-theme="light"] .dv-app .dv-btn:not(.dv-btn-primary):not(.dv-btn-ghost) { background: #fff; box-shadow: 0 1px 1px rgba(0,0,0,.04); }

/* Top bar, tab row and sidebar (the Clerk-style console shell). */
.dv-top { height: 56px; display: flex; align-items: center; gap: 10px; padding: 0 20px; background: var(--dv-bg); border-bottom: 1px solid var(--dv-border-soft); }
.dv-crumb-sep { color: var(--dv-border); font-size: 20px; font-weight: 300; margin: 0 2px; }
.dv-switcher { display: inline-flex; align-items: center; gap: 8px; height: 32px; padding: 0 8px; border-radius: 8px; border: 1px solid transparent; background: transparent; color: var(--dv-text); font: 500 14px var(--dv-ui); cursor: pointer; white-space: nowrap; }
.dv-switcher:hover { background: var(--dv-panel-2); }
.dv-tabs { display: flex; gap: 4px; padding: 0 20px; border-bottom: 1px solid var(--dv-border-soft); background: var(--dv-bg); overflow-x: auto; scrollbar-width: none; }
.dv-tabs::-webkit-scrollbar { display: none; }
.dv-tab { position: relative; display: inline-flex; align-items: center; height: 44px; padding: 0 12px; font-size: 14px; color: var(--dv-muted); white-space: nowrap; }
.dv-tab:hover { color: var(--dv-text); }
.dv-tab[aria-current="page"] { color: var(--dv-text); font-weight: 500; }
.dv-tab[aria-current="page"]::after { content: ''; position: absolute; left: 12px; right: 12px; bottom: -1px; height: 2px; border-radius: 2px; background: var(--dv-text); }
.dv-side { padding: 20px 12px; }
.dv-side-group { font-size: 12px; color: var(--dv-dim); padding: 14px 10px 6px; font-weight: 500; }
.dv-side-item { display: flex; align-items: center; gap: 10px; height: 34px; padding: 0 10px; border-radius: 8px; font-size: 14px; color: var(--dv-muted); }
.dv-side-item:hover { background: var(--dv-panel-2); color: var(--dv-text); }
.dv-side-item[aria-current="page"] { background: var(--dv-raise); color: var(--dv-text); font-weight: 500; }
.dv-menu { position: absolute; top: calc(100% + 6px); left: 0; min-width: 240px; z-index: 60; background: var(--dv-panel); border: 1px solid var(--dv-border); border-radius: 12px; box-shadow: 0 12px 32px rgba(0,0,0,.14); padding: 6px; }
.dv-menu-item { display: flex; align-items: center; gap: 10px; width: 100%; padding: 9px 10px; border-radius: 8px; border: none; background: transparent; color: var(--dv-text); font: 14px var(--dv-ui); text-align: left; cursor: pointer; }
.dv-menu-item:hover { background: var(--dv-panel-2); }


/* ── phones and touch ──
   Fingers need bigger targets than a mouse: 40px for buttons, 36px for the
   small ones, 46px for primary actions. Inputs use 16px text because iOS
   zooms the whole page into any field smaller than that, and never zooms
   back out. */
@media (pointer: coarse), (max-width: 640px) {
  .dv-btn { min-height: 40px; }
  .dv-btn-sm { min-height: 36px; padding: 0 12px; }
  .dv-btn-lg { min-height: 46px; }
  .dv-input, .dv-select { height: 42px; font-size: 16px; }
  .dv-textarea { font-size: 16px; }
  .dv-switch { width: 44px; height: 26px; }
  .dv-switch::after { width: 22px; height: 22px; }
  .dv-switch[aria-checked="true"]::after { transform: translateX(18px); }
  .dv-seg button { height: 36px; }
}
@media (max-width: 640px) {
  .dv-h1 { font-size: 23px; }
  .dv-sub { font-size: 14px; }
  .dv-card-head { padding: 16px 16px 0; }
  .dv-card-body { padding: 14px 16px 16px; }
  .dv-card-foot { padding: 12px 16px; flex-wrap: wrap; }
  .dv-table th, .dv-table td { padding: 10px 8px; }
  .dv-code pre { font-size: 12px; padding: 12px; }
  .dv-toast { left: 16px; right: 16px; transform: none; text-align: center; }
}
`
