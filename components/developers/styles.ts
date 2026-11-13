// The developer site's look: DialerSeat's own blue and Futura on a dark
// ground, laid out like the consoles developers already use. Scoped under
// .dv so nothing here reaches a dialerseat.com page.

export const DEV_CSS = `
.dv {
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
  --dv-mono: ui-monospace, SFMono-Regular, 'JetBrains Mono', Menlo, Consolas, monospace;
  --dv-sans: 'Futura PT', Futura, 'Trebuchet MS', sans-serif;
  background: var(--dv-bg);
  color: var(--dv-text);
  font-family: var(--dv-sans);
  min-height: 100vh;
  color-scheme: dark;
  -webkit-font-smoothing: antialiased;
}
.dv *, .dv *::before, .dv *::after { box-sizing: border-box; }
.dv a { color: inherit; text-decoration: none; }
.dv ::selection { background: rgba(74,158,255,0.35); }
.dv code, .dv pre, .dv kbd { font-family: var(--dv-mono); }
.dv :focus-visible { outline: 2px solid var(--dv-accent); outline-offset: 2px; border-radius: 6px; }

/* ── buttons ── */
.dv-btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; height: 36px; padding: 0 14px; border-radius: 8px; font: 500 13px/1 var(--dv-sans); letter-spacing: .3px; cursor: pointer; border: 1px solid var(--dv-border); background: var(--dv-panel-2); color: var(--dv-text); transition: background .15s, border-color .15s, opacity .15s; white-space: nowrap; }
.dv-btn:hover { background: var(--dv-raise); border-color: #2e2e4c; }
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
.dv-card { background: var(--dv-panel); border: 1px solid var(--dv-border-soft); border-radius: 14px; }
.dv-card-head { padding: 20px 22px 0; }
.dv-card-title { font-size: 16px; font-weight: 600; margin: 0; }
.dv-card-desc { font-size: 13px; color: var(--dv-muted); margin: 6px 0 0; line-height: 1.55; max-width: 640px; }
.dv-card-body { padding: 18px 22px 22px; }
.dv-card-foot { padding: 12px 22px; border-top: 1px solid var(--dv-border-soft); display: flex; align-items: center; justify-content: space-between; gap: 12px; font-size: 12px; color: var(--dv-dim); }
.dv-inset { background: var(--dv-bg-2); border: 1px solid var(--dv-border-soft); border-radius: 10px; }

/* ── badges ── */
.dv-badge { display: inline-flex; align-items: center; gap: 6px; height: 22px; padding: 0 8px; border-radius: 999px; font-size: 11px; letter-spacing: .4px; border: 1px solid var(--dv-border); color: var(--dv-muted); background: var(--dv-panel-2); white-space: nowrap; }
.dv-badge-green { color: var(--dv-green); background: var(--dv-green-soft); border-color: rgba(52,211,153,.3); }
.dv-badge-amber { color: var(--dv-amber); background: var(--dv-amber-soft); border-color: rgba(251,191,36,.3); }
.dv-badge-red { color: var(--dv-red); background: var(--dv-red-soft); border-color: rgba(248,113,113,.3); }
.dv-badge-blue { color: var(--dv-accent); background: var(--dv-accent-soft); border-color: rgba(74,158,255,.3); }
.dv-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }

/* ── tables ── */
.dv-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.dv-table th { text-align: left; font-weight: 500; color: var(--dv-dim); font-size: 11px; letter-spacing: .6px; text-transform: uppercase; padding: 10px 12px; border-bottom: 1px solid var(--dv-border-soft); }
.dv-table td { padding: 12px; border-bottom: 1px solid var(--dv-border-soft); vertical-align: middle; }
.dv-table tr:last-child td { border-bottom: none; }
.dv-table-wrap { overflow-x: auto; }

/* ── code ── */
.dv-code { position: relative; background: #05050a; border: 1px solid var(--dv-border-soft); border-radius: 12px; overflow: hidden; }
.dv-code-head { display: flex; align-items: center; justify-content: space-between; padding: 8px 10px 8px 14px; border-bottom: 1px solid var(--dv-border-soft); font: 12px var(--dv-mono); color: var(--dv-muted); }
.dv-code pre { margin: 0; padding: 14px 16px; overflow-x: auto; font-size: 12.5px; line-height: 1.65; color: #d6d6ea; }
.dv-inline-code { font-family: var(--dv-mono); font-size: .88em; background: var(--dv-panel-2); border: 1px solid var(--dv-border-soft); padding: 1px 6px; border-radius: 5px; color: #cfd8ff; }
.tok-k { color: #c792ea; } .tok-s { color: #a5e3a1; } .tok-n { color: #f7c87a; } .tok-c { color: #5e6a8a; } .tok-p { color: #7fb6ff; }

/* ── method pills ── */
.dv-method { display: inline-flex; align-items: center; justify-content: center; min-width: 52px; height: 20px; padding: 0 6px; border-radius: 5px; font: 600 10.5px var(--dv-mono); letter-spacing: .5px; }
.dv-method-GET { color: #34d399; background: rgba(52,211,153,.1); }
.dv-method-POST { color: #4a9eff; background: rgba(74,158,255,.12); }
.dv-method-PATCH { color: #fbbf24; background: rgba(251,191,36,.1); }
.dv-method-DELETE { color: #f87171; background: rgba(248,113,113,.1); }

/* ── switches and segmented controls ── */
.dv-switch { position: relative; width: 36px; height: 20px; border-radius: 999px; background: var(--dv-border); border: none; cursor: pointer; transition: background .15s; flex-shrink: 0; }
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
.dv-alert-blue { background: var(--dv-accent-soft); border-color: rgba(74,158,255,.3); }
.dv-alert-amber { background: var(--dv-amber-soft); border-color: rgba(251,191,36,.3); }
.dv-alert-green { background: var(--dv-green-soft); border-color: rgba(52,211,153,.3); }
.dv-empty { padding: 36px 20px; text-align: center; color: var(--dv-dim); font-size: 13px; }
mark.dv-mark { background: rgba(74,158,255,.22); color: inherit; border-radius: 3px; padding: 0 1px; }
`
