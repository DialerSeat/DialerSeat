'use client'

import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { BookOpen, Code2, CornerDownLeft, FileText, Lightbulb, Search, Settings2, Webhook, X } from 'lucide-react'
import { prepare, search, stem, tokenize, type SearchEntry, type SearchResult } from '@/lib/developers/search'
import { buildSearchEntries } from '@/lib/developers/searchIndex'
import { useDevHref } from './base'
import { NAV_ICONS } from './ui'
import { CONSOLE_NAV } from '@/lib/developers/consoleNav'

const KIND_LABEL: Record<SearchEntry['kind'], string> = {
  page: 'Console', setting: 'Settings', doc: 'Docs', endpoint: 'API', event: 'Webhook events', concept: 'Concepts',
}
const KIND_ORDER: SearchEntry['kind'][] = ['page', 'setting', 'doc', 'endpoint', 'event', 'concept']

function kindIcon(e: SearchEntry): ReactNode {
  if (e.kind === 'page') {
    const nav = CONSOLE_NAV.find(n => n.href === e.href)
    const I = nav ? NAV_ICONS[nav.icon] : FileText
    return <I size={15} />
  }
  if (e.kind === 'setting') return <Settings2 size={15} />
  if (e.kind === 'doc') return <BookOpen size={15} />
  if (e.kind === 'endpoint') return <Code2 size={15} />
  if (e.kind === 'event') return <Webhook size={15} />
  return <Lightbulb size={15} />
}

/** Wrap every word of `text` whose stem is in `terms` in a <mark>. */
function Highlight({ text, terms }: { text: string; terms: Set<string> }) {
  const parts = text.split(/([A-Za-z0-9_]+)/)
  return (
    <>
      {parts.map((p, i) => {
        if (!/^[A-Za-z0-9_]+$/.test(p)) return <span key={i}>{p}</span>
        const s = stem(p.toLowerCase())
        const hit = terms.has(s) || [...terms].some(t => t.length >= 3 && s.startsWith(t))
        return hit ? <mark key={i} className="dv-mark">{p}</mark> : <span key={i}>{p}</span>
      })}
    </>
  )
}

const SUGGESTIONS = ['rotate a leaked key', 'verify webhook signature', 'give one team predictive', 'allowed origins', 'who pays for seats', 'import contacts']

export function SearchPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter()
  const href = useDevHref()
  const index = useMemo(() => prepare(buildSearchEntries()), [])
  const [q, setQ] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const results: SearchResult[] = useMemo(() => (q.trim() ? search(index, q, 14) : []), [index, q])
  // Keep the order the scores chose, but present them grouped by kind.
  const grouped = useMemo(() => {
    const firstRank = new Map<SearchEntry['kind'], number>()
    results.forEach((r, i) => { if (!firstRank.has(r.entry.kind)) firstRank.set(r.entry.kind, i) })
    const kinds = [...firstRank.keys()].sort((a, b) => firstRank.get(a)! - firstRank.get(b)! || KIND_ORDER.indexOf(a) - KIND_ORDER.indexOf(b))
    return kinds.map(k => ({ kind: k, items: results.filter(r => r.entry.kind === k) }))
  }, [results])
  const flat = useMemo(() => grouped.flatMap(g => g.items), [grouped])
  const queryTerms = useMemo(() => new Set(tokenize(q).filter(t => t.length >= 3).map(stem)), [q])

  useEffect(() => {
    listRef.current?.querySelector(`[data-idx="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [active])

  if (!open) return null

  const go = (r: SearchResult | undefined) => {
    if (!r) return
    onClose()
    router.push(href(r.entry.href))
  }

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(flat.length - 1, a + 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(0, a - 1)) }
    else if (e.key === 'Enter') { e.preventDefault(); go(flat[active]) }
    else if (e.key === 'Escape') { e.preventDefault(); onClose() }
  }

  let idx = -1
  // Portalled to the site root: rendered in place, the palette sat inside the
  // sticky sidebar's stacking context and page content drew on top of it.
  const host = document.querySelector('.dv') || document.body
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="Search" onMouseDown={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'rgba(3,3,8,.72)', backdropFilter: 'blur(6px)', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', padding: 'max(12px, min(10vh, 80px)) 12px 12px' }}>
      <div onMouseDown={e => e.stopPropagation()} onKeyDown={onKey}
        style={{ width: '100%', maxWidth: 680, background: 'var(--dv-panel)', border: '1px solid var(--dv-border)', borderRadius: 16, boxShadow: '0 30px 80px rgba(0,0,0,.6)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 14px', borderBottom: '1px solid var(--dv-border-soft)' }}>
          <Search size={17} color="var(--dv-muted)" />
          <input ref={inputRef} value={q} onChange={e => { setQ(e.target.value); setActive(0) }} placeholder="Search keys, settings, docs, endpoints, events…"
            autoFocus aria-label="Search" aria-controls="dv-search-results" aria-activedescendant={flat[active] ? `dv-sr-${active}` : undefined}
            style={{ flex: 1, height: 54, background: 'transparent', border: 'none', outline: 'none', color: 'var(--dv-text)', font: '16px var(--dv-sans)' }} />
          <button type="button" className="dv-btn dv-btn-ghost dv-btn-sm" onClick={onClose} aria-label="Close search"><X size={15} /></button>
        </div>

        <div ref={listRef} id="dv-search-results" role="listbox" style={{ maxHeight: '60vh', overflowY: 'auto', padding: 8 }}>
          {!q.trim() && (
            <div style={{ padding: '10px 10px 14px' }}>
              <div className="dv-dim" style={{ fontSize: 11, letterSpacing: .6, textTransform: 'uppercase', marginBottom: 10 }}>Try</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {SUGGESTIONS.map(s => (
                  <button key={s} type="button" className="dv-btn dv-btn-sm" onClick={() => { setQ(s); setActive(0); inputRef.current?.focus() }}>{s}</button>
                ))}
              </div>
            </div>
          )}
          {q.trim() && flat.length === 0 && (
            <div className="dv-empty">
              Nothing matches “{q}”. Try fewer words, or <a className="dv-link" href={href('/docs/quickstart')}>start from the quickstart</a>.
            </div>
          )}
          {grouped.map(g => (
            <div key={g.kind} style={{ marginBottom: 6 }}>
              <div className="dv-dim" style={{ fontSize: 11, letterSpacing: .6, textTransform: 'uppercase', padding: '8px 10px 4px' }}>{KIND_LABEL[g.kind]}</div>
              {g.items.map(r => {
                idx++
                const i = idx
                const on = i === active
                return (
                  <div key={r.entry.id} id={`dv-sr-${i}`} data-idx={i} role="option" aria-selected={on}
                    onMouseMove={() => setActive(i)} onClick={() => go(r)}
                    style={{ display: 'flex', gap: 12, padding: '10px 10px', borderRadius: 10, cursor: 'pointer', background: on ? 'var(--dv-raise)' : 'transparent' }}>
                    <span style={{ marginTop: 2, color: on ? 'var(--dv-accent)' : 'var(--dv-muted)', flexShrink: 0 }}>{kindIcon(r.entry)}</span>
                    <span style={{ minWidth: 0, flex: 1 }}>
                      <span style={{ display: 'block', fontSize: 14, color: 'var(--dv-text)' }}>
                        <Highlight text={r.entry.title} terms={queryTerms} />
                      </span>
                      <span className="dv-dim" style={{ display: 'block', fontSize: 11.5, marginTop: 2, fontFamily: r.entry.kind === 'endpoint' ? 'var(--dv-mono)' : undefined }}>{r.entry.section}</span>
                      {r.snippet && (
                        <span className="dv-muted" style={{ fontSize: 12.5, marginTop: 5, lineHeight: 1.5, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' } as React.CSSProperties}>
                          <Highlight text={r.snippet} terms={new Set([...queryTerms, ...r.terms])} />
                        </span>
                      )}
                    </span>
                    {on && <CornerDownLeft size={14} color="var(--dv-dim)" style={{ marginTop: 4, flexShrink: 0 }} />}
                  </div>
                )
              })}
            </div>
          ))}
        </div>

        <div className="dv-palette-foot" style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px', padding: '9px 14px', borderTop: '1px solid var(--dv-border-soft)', fontSize: 11.5, color: 'var(--dv-dim)' }}>
          <span><kbd className="dv-inline-code">↑</kbd> <kbd className="dv-inline-code">↓</kbd> move</span>
          <span><kbd className="dv-inline-code">Enter</kbd> open</span>
          <span><kbd className="dv-inline-code">Esc</kbd> close</span>
          <span className="dv-palette-hint" style={{ marginLeft: 'auto' }}>Typos and other words for the same thing are understood</span>
          <style>{`@media (max-width: 560px), (pointer: coarse) { .dv-palette-foot { display: none !important; } }`}</style>
        </div>
      </div>
    </div>,
    host,
  )
}

/** The "Find…  CTRL K" bar from the screenshots. Opens the palette; Ctrl/⌘ K and "/" work anywhere. */
export function SearchTrigger({ compact = false, shortcuts = !compact }: { compact?: boolean; shortcuts?: boolean }) {
  const [open, setOpen] = useState(false)
  // Read from the browser without an effect; the server renders CTRL.
  const mac = useSyncExternalStore(() => () => {}, () => /Mac|iPhone|iPad/.test(navigator.platform), () => false)
  useEffect(() => {
    // Only one search per page owns the keyboard shortcuts, so one Ctrl+K
    // never opens two palettes; the phone-layout copies pass shortcuts={false}.
    if (!shortcuts) return
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && (e.target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName))
      if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) { e.preventDefault(); setOpen(o => !o) }
      else if (e.key === '/' && !typing) { e.preventDefault(); setOpen(true) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [shortcuts])
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label="Search"
        style={{ display: 'flex', alignItems: 'center', justifyContent: compact ? 'center' : undefined, gap: 10, width: '100%', height: compact ? 40 : 38, padding: compact ? 0 : '0 8px 0 12px', borderRadius: 9, border: '1px solid var(--dv-border)', background: 'var(--dv-bg-2)', color: 'var(--dv-dim)', cursor: 'text', font: '14px var(--dv-sans)' }}>
        <Search size={15} />
        {!compact && <span style={{ flex: 1, textAlign: 'left' }}>Find…</span>}
        {!compact && (
          <span className="dv-kbd-hint" style={{ display: 'flex', gap: 4 }}>
            <kbd className="dv-inline-code" style={{ fontSize: 10.5 }}>{mac ? '⌘' : 'CTRL'}</kbd>
            <kbd className="dv-inline-code" style={{ fontSize: 10.5 }}>K</kbd>
          </span>
        )}
      </button>
      <style>{`@media (pointer: coarse), (max-width: 640px) { .dv-kbd-hint { display: none !important; } }`}</style>
      {/* Mounted only while open, so every opening starts with an empty query. */}
      {open && <SearchPalette open onClose={() => setOpen(false)} />}
    </>
  )
}
