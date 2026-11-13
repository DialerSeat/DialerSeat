'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  BarChart3, BookOpen, Check, Code2, Copy, CreditCard, KeyRound, LayoutDashboard, ListChecks,
  PanelsTopLeft, Settings, SlidersHorizontal, Users, Webhook,
} from 'lucide-react'
import type { NavIcon } from '@/lib/developers/consoleNav'

export const NAV_ICONS: Record<NavIcon, typeof KeyRound> = {
  overview: LayoutDashboard, keys: KeyRound, webhooks: Webhook, miniplayer: PanelsTopLeft,
  modes: SlidersHorizontal, dispositions: ListChecks, seats: Users, usage: BarChart3,
  billing: CreditCard, settings: Settings, docs: BookOpen, api: Code2,
}

/** The DialerSeat mark with the developer suffix. */
export function DevLogo({ size = 28 }: { size?: number }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
      <span style={{ width: size, height: size, borderRadius: 7, background: 'linear-gradient(135deg, #4a9eff, #2a6eff)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <span style={{ color: '#fff', fontWeight: 700, fontSize: size * 0.45 }}>D</span>
      </span>
      <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 8, fontFamily: 'var(--dv-sans)' }}>
        <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: 4, color: 'var(--dv-text)' }}>DIALERSEAT</span>
        <span className="dv-logo-suffix" style={{ fontSize: 12, letterSpacing: 1.5, color: 'var(--dv-accent)', fontWeight: 500 }}>developers</span>
      </span>
    </span>
  )
}

export function useCopy(timeout = 1600) {
  const [copied, setCopied] = useState<string | null>(null)
  const copy = useCallback(async (text: string, id = 'default') => {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = text; document.body.appendChild(ta); ta.select()
      try { document.execCommand('copy') } catch { /* nothing else to try */ }
      ta.remove()
    }
    setCopied(id)
    setTimeout(() => setCopied(c => (c === id ? null : c)), timeout)
  }, [timeout])
  return { copied, copy }
}

export function CopyButton({ text, label, small = true }: { text: string; label?: string; small?: boolean }) {
  const { copied, copy } = useCopy()
  return (
    <button type="button" className={`dv-btn dv-btn-ghost${small ? ' dv-btn-sm' : ''}`} onClick={() => copy(text)} aria-label={label || 'Copy'}>
      {copied ? <Check size={14} color="var(--dv-green)" /> : <Copy size={14} />}
      {label && <span>{copied ? 'Copied' : label}</span>}
    </button>
  )
}

// Just enough highlighting to read code at a glance: strings, keywords,
// numbers, comments. Escapes first, so nothing in a sample becomes markup.
function highlight(code: string, lang: string): string {
  const esc = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  if (lang === 'text') return esc
  const rules: [RegExp, string][] = [
    [/(\/\/[^\n]*|#(?![!\w{])[^\n]*)/g, 'tok-c'],
    [/("(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`)/g, 'tok-s'],
    [/\b(const|let|var|function|return|import|from|if|else|await|async|new|true|false|null|curl|POST|GET|PATCH|DELETE)\b/g, 'tok-k'],
    [/\b(\d+(?:\.\d+)?)\b/g, 'tok-n'],
  ]
  // Tokenise once so a rule never re-matches inside another's output.
  type Tok = { start: number; end: number; cls: string }
  const toks: Tok[] = []
  for (const [re, cls] of rules) {
    for (const m of esc.matchAll(re)) {
      const start = m.index!, end = start + m[0].length
      if (toks.some(t => start < t.end && end > t.start)) continue
      toks.push({ start, end, cls })
    }
  }
  toks.sort((a, b) => a.start - b.start)
  let out = '', i = 0
  for (const t of toks) {
    out += esc.slice(i, t.start) + `<span class="${t.cls}">${esc.slice(t.start, t.end)}</span>`
    i = t.end
  }
  return out + esc.slice(i)
}

export function CodeBlock({ code, lang = 'text', title }: { code: string; lang?: string; title?: string }) {
  return (
    <div className="dv-code" data-theme="dark">
      <div className="dv-code-head">
        <span>{title || lang}</span>
        <CopyButton text={code} />
      </div>
      <pre><code dangerouslySetInnerHTML={{ __html: highlight(code, lang) }} /></pre>
    </div>
  )
}

export function MethodPill({ method }: { method: string }) {
  return <span className={`dv-method dv-method-${method}`}>{method}</span>
}

export function useToast() {
  const [msg, setMsg] = useState<string | null>(null)
  useEffect(() => {
    if (!msg) return
    const t = setTimeout(() => setMsg(null), 2600)
    return () => clearTimeout(t)
  }, [msg])
  const node = msg ? <div className="dv-toast" role="status">{msg}</div> : null
  return { toast: setMsg, toastNode: node }
}

/** fetch() for the console API: JSON in, JSON out, the server's message on failure. */
export async function api<T = unknown>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const res = await fetch(path, {
    method: init?.method || 'GET',
    headers: init?.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as { error?: { message?: string } })?.error?.message || `Request failed (${res.status})`)
  return data as T
}
