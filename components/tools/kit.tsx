'use client'

import { useState, type ReactNode } from 'react'
import { t } from '@/lib/i18n/client'

// =============================================================================
// SHARED PIECES FOR THE FREE TOOLS
// =============================================================================
// The look is lifted from AbandonRateCalculator (light panels, small-caps
// labels, a green/red result band) so every tool on the site is visibly the
// same family. Inputs act immediately; nothing waits on a submit button.
// =============================================================================

export const TOOL_CSS = `
.tk { color: #1a1c24; text-align: start; }
.tk-grid { display: grid; grid-template-columns: repeat(var(--cols, 3), minmax(0, 1fr)); gap: 12px; }
.tk-field { background: #f5f7fb; border: 1px solid #d6dbe3; border-radius: 10px; padding: 12px 14px; min-width: 0; }
.tk-field label, .tk-label { display: block; font-size: 10px; font-weight: bold; letter-spacing: 2px; color: #5a6072; margin-bottom: 8px; text-transform: uppercase; }
.tk-field input, .tk-field select, .tk-field textarea, .tk textarea.tk-area {
  width: 100%; box-sizing: border-box; font: inherit; font-size: 15px; font-weight: 600; padding: 8px 10px;
  border: 1px solid #c4c8d0; border-radius: 6px; color: #1a1c24; background: #fff;
}
.tk textarea.tk-area { min-height: 170px; font-weight: 500; font-size: 14px; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; resize: vertical; }
.tk-hint { font-size: 11.5px; color: #6b7182; margin-top: 6px; line-height: 1.5; }
.tk-result { margin-top: 14px; border-radius: 10px; padding: 16px 18px; background: #eef3ff; border: 1px solid #c9d7fb; }
.tk-result.ok { background: rgba(31,138,76,0.08); border-color: rgba(31,138,76,0.35); }
.tk-result.over { background: rgba(180,35,24,0.07); border-color: rgba(180,35,24,0.35); }
.tk-big { font-size: 32px; font-weight: 800; font-variant-numeric: tabular-nums; line-height: 1.1; }
.tk-result.ok .tk-big { color: #1f8a4c; } .tk-result.over .tk-big { color: #b42318; }
.tk .tk-result p { margin: 6px 0 0; font-size: 14px; line-height: 1.55; }
.tk-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 10px; margin-top: 14px; }
.tk-stat { background: #fff; border: 1px solid #d6dbe3; border-radius: 10px; padding: 12px 14px; }
.tk-stat b { display: block; font-size: 22px; font-variant-numeric: tabular-nums; }
.tk-stat span { font-size: 11px; letter-spacing: 1px; color: #5a6072; text-transform: uppercase; }
.tk-row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-top: 12px; }
.tk-btn { font: inherit; font-size: 12px; font-weight: 700; letter-spacing: 1px; padding: 9px 14px; border-radius: 8px; border: 1px solid #2a6eff; background: #2a6eff; color: #fff; cursor: pointer; }
.tk-btn.ghost { background: #fff; color: #2a6eff; }
.tk-btn:disabled { opacity: .5; cursor: default; }
.tk-table { width: 100%; border-collapse: collapse; font-size: 13.5px; margin-top: 12px; }
.tk-table th { text-align: start; font-size: 10px; letter-spacing: 1.5px; color: #5a6072; padding: 8px; border-bottom: 1px solid #d6dbe3; text-transform: uppercase; }
.tk-table td { padding: 8px; border-bottom: 1px solid #eceff4; vertical-align: top; }
.tk-tablewrap { overflow-x: auto; max-height: 420px; overflow-y: auto; border: 1px solid #e3e7ee; border-radius: 10px; margin-top: 12px; }
.tk-tablewrap .tk-table { margin-top: 0; }
.tk-pill { display: inline-block; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 999px; }
.tk-pill.ok { background: rgba(31,138,76,0.12); color: #1f8a4c; } .tk-pill.no { background: rgba(180,35,24,0.1); color: #b42318; } .tk-pill.warn { background: rgba(196,120,0,0.12); color: #96600a; }
.tk-out { white-space: pre-wrap; background: #fff; border: 1px solid #d6dbe3; border-radius: 10px; padding: 14px 16px; font-size: 14.5px; line-height: 1.65; margin-top: 10px; }
.tk-out h4 { margin: 0 0 6px; font-size: 11px; letter-spacing: 1.5px; color: #5a6072; text-transform: uppercase; }
.tk-foot { margin-top: 12px; font-size: 11.5px; color: #6b7182; line-height: 1.6; }
.tk-check { display: flex; gap: 10px; align-items: flex-start; padding: 10px 0; border-bottom: 1px solid #eceff4; }
.tk-check input { margin-top: 4px; width: 18px; height: 18px; flex: none; }
.tk-check small { display: block; color: #6b7182; font-size: 12px; margin-top: 2px; }
@media (max-width: 640px) { .tk-grid { grid-template-columns: 1fr; } }
`

export function ToolStyles() {
  return <style>{TOOL_CSS}</style>
}

export function NumField(p: {
  id: string; label: string; value: number; onChange: (n: number) => void
  min?: number; max?: number; step?: number; hint?: string
}) {
  return (
    <div className="tk-field">
      <label htmlFor={p.id}>{t(p.label)}</label>
      <input
        id={p.id} type="number" inputMode="decimal" value={Number.isFinite(p.value) ? p.value : ''}
        min={p.min ?? 0} max={p.max} step={p.step ?? 1}
        onChange={(e) => {
          const n = Number(e.target.value)
          p.onChange(Number.isFinite(n) ? Math.max(p.min ?? 0, p.max != null ? Math.min(p.max, n) : n) : 0)
        }}
      />
      {p.hint && <div className="tk-hint">{t(p.hint)}</div>}
    </div>
  )
}

export function TextField(p: { id: string; label: string; value: string; onChange: (s: string) => void; placeholder?: string }) {
  return (
    <div className="tk-field">
      <label htmlFor={p.id}>{t(p.label)}</label>
      <input id={p.id} type="text" value={p.value} placeholder={p.placeholder} onChange={(e) => p.onChange(e.target.value)} />
    </div>
  )
}

export function SelectField<T extends string>(p: {
  id: string; label: string; value: T; onChange: (v: T) => void; options: { value: T; label: string }[]
}) {
  return (
    <div className="tk-field">
      <label htmlFor={p.id}>{t(p.label)}</label>
      <select id={p.id} value={p.value} onChange={(e) => p.onChange(e.target.value as T)}>
        {p.options.map((o) => <option key={o.value} value={o.value}>{t(o.label)}</option>)}
      </select>
    </div>
  )
}

export function Stat({ value, label }: { value: ReactNode; label: string }) {
  return <div className="tk-stat"><b>{value}</b><span>{t(label)}</span></div>
}

export function CopyButton({ text, label = 'COPY' }: { text: string; label?: string }) {
  const [done, setDone] = useState(false)
  return (
    <button
      type="button" className="tk-btn ghost" disabled={!text}
      onClick={async () => {
        try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1500) } catch {}
      }}
    >
      {done ? t("COPIED") : t(label)}
    </button>
  )
}

export const fmt = (n: number, digits = 0) =>
  Number.isFinite(n) ? n.toLocaleString('en-US', { maximumFractionDigits: digits, minimumFractionDigits: digits }) : '—'

export const pct = (n: number, digits = 1) => (Number.isFinite(n) ? `${fmt(n * 100, digits)}%` : '—')

export const money = (n: number, digits = 2) =>
  Number.isFinite(n) ? n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: digits, minimumFractionDigits: digits }) : '—'
