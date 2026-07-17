'use client'
import { useEffect, useState, useCallback, useMemo } from 'react'






















type SubType = 'support' | 'bug' | 'suggestion' | 'exit'
type TabKey = 'all' | SubType
type Status = 'new' | 'open' | 'responded' | 'resolved' | 'closed'

interface Submission {
  id: string
  type: SubType
  clerk_id: string | null
  snap_name: string | null
  snap_username: string | null
  snap_email: string | null
  tenant_id: string | null
  disposition: string | null
  subject: string | null
  body: string
  status: Status
  responded_at: string | null
  responded_by: string | null
  response_body: string | null
  created_at: string
}

const TABS: { key: TabKey; label: string; icon: string; accent: string }[] = [
  { key: 'all', label: 'All', icon: '◆', accent: '#8a93ad' },
  { key: 'support', label: 'Support', icon: '✦', accent: '#4a9eff' },
  { key: 'bug', label: 'Bugs', icon: '⚑', accent: '#ff6b5e' },
  { key: 'suggestion', label: 'Suggestions', icon: '💡', accent: '#f7c948' },
  { key: 'exit', label: 'Exit', icon: '⤬', accent: '#c9a24a' },
]

const STATUS_META: Record<Status, { label: string; color: string }> = {
  new: { label: 'NEW', color: '#4a9eff' },
  open: { label: 'OPEN', color: '#8a8fa8' },
  responded: { label: 'RESPONDED', color: '#5ad17a' },
  resolved: { label: 'RESOLVED', color: '#5ad17a' },
  closed: { label: 'CLOSED', color: '#5a5e6a' },
}

const INK = '#0e0f15'
const PANEL = '#15161f'
const PANEL_2 = '#1b1d28'
const LINE = 'rgba(255,255,255,0.07)'
const TXT = '#e8eaf2'
const TXT_DIM = '#9aa0b4'
const TXT_FAINT = '#666c80'
const FONT = `'Futura PT', Futura, 'Helvetica Neue', Helvetica, Arial, sans-serif`

function timeAgo(iso: string): string {
  const d = Date.now() - new Date(iso).getTime()
  const m = Math.floor(d / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function initials(name: string | null, username: string | null, email: string | null): string {
  const base = name || username || email || '?'
  const parts = base.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return base.slice(0, 2).toUpperCase()
}

export default function SupportApp() {
  const [tab, setTab] = useState<TabKey>('all')
  const [items, setItems] = useState<Submission[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  // Narrow viewports collapse to a single pane: list first, tap an item to
  // view it, back to return. Independent of `selectedId` — desktop still
  // keeps a submission open by default, mobile should always land on the
  // list, not whatever was auto-selected.
  const [mobileShowDetail, setMobileShowDetail] = useState(false)

  const load = useCallback(async (which: TabKey) => {
    setLoading(true)
    setError(null)
    try {
      const r = await fetch(which === 'all' ? '/api/admin/support' : `/api/admin/support?type=${which}`, { cache: 'no-store' })
      const d = await r.json()
      if (!d.success) throw new Error(d.error || 'load failed')
      setItems(d.submissions as Submission[])
    } catch (e: any) {
      setError(e?.message || 'Failed to load')
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load(tab) }, [tab, load])
  
  useEffect(() => {
    const t = setInterval(() => load(tab), 20000)
    return () => clearInterval(t)
  }, [tab, load])

  const selected = useMemo(
    () => items.find(i => i.id === selectedId) ?? null,
    [items, selectedId]
  )

  useEffect(() => {
    
    if (!items.length) { setSelectedId(null); return }
    if (!items.some(i => i.id === selectedId)) setSelectedId(items[0].id)
  }, [items, selectedId])

  useEffect(() => { setDraft(selected?.response_body ?? '') }, [selectedId]) // eslint-disable-line

  const selectItem = useCallback((id: string) => {
    setSelectedId(id)
    setMobileShowDetail(true)
  }, [])

  const changeTab = useCallback((t: TabKey) => {
    setTab(t)
    setMobileShowDetail(false)
  }, [])

  const activeTab = TABS.find(t => t.key === tab)!
  const accentFor = useCallback((it: Submission) => {
    if (tab !== 'all') return activeTab.accent
    return TABS.find(t => t.key === it.type)?.accent ?? activeTab.accent
  }, [tab, activeTab])
  const newCount = (t: SubType) => items.filter(i => i.status === 'new').length

  const patch = useCallback(async (id: string, fields: Record<string, any>) => {
    setSaving(true)
    try {
      const r = await fetch('/api/admin/support', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...fields }),
      })
      const d = await r.json()
      if (d.success && d.submission) {
        setItems(prev => prev.map(i => (i.id === id ? d.submission : i)))
      }
    } finally {
      setSaving(false)
    }
  }, [])

  const sendResponse = useCallback(() => {
    if (!selected || !draft.trim()) return
    
    patch(selected.id, { response_body: draft.trim(), status: 'responded' })
    const to = selected.snap_email || ''
    const subject = encodeURIComponent(
      selected.subject ? `Re: ${selected.subject}` : 'Re: your DialerSeat request'
    )
    const bodyEnc = encodeURIComponent(draft.trim())
    window.open(`mailto:${to}?subject=${subject}&body=${bodyEnc}`, '_blank')
  }, [selected, draft, patch])

  return (
    <div className={`sup-root${mobileShowDetail ? ' sup-detail-open' : ''}`} style={{ display: 'flex', height: '100%', background: INK, color: TXT, fontFamily: FONT, overflow: 'hidden', position: 'relative' }}>
      <style>{`
        @media (max-width: 720px) {
          .sup-list-pane { width: 100% !important; border-right: none !important; }
          .sup-back-btn { display: flex !important; }
          .sup-root.sup-detail-open .sup-list-pane { display: none !important; }
          .sup-root:not(.sup-detail-open) .sup-detail-pane { display: none !important; }
          .sup-detail-pane { width: 100% !important; }
        }
      `}</style>
      {/* ── LEFT: tab rail + list ── */}
      <div className="sup-list-pane" style={{ width: 340, borderRight: `1px solid ${LINE}`, display: 'flex', flexDirection: 'column', background: PANEL }}>
        {/* tab rail */}
        <div style={{ display: 'flex', padding: 8, gap: 4, borderBottom: `1px solid ${LINE}` }}>
          {TABS.map(t => {
            const active = t.key === tab
            return (
              <button
                key={t.key}
                onClick={() => changeTab(t.key)}
                style={{
                  flex: 1, padding: '8px 4px', borderRadius: 8, cursor: 'pointer',
                  border: `1px solid ${active ? t.accent : 'transparent'}`,
                  background: active ? `${t.accent}1f` : 'transparent',
                  color: active ? TXT : TXT_DIM,
                  fontFamily: FONT, fontSize: 9, letterSpacing: 0.8, fontWeight: 700,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                  transition: 'all 0.15s ease', minWidth: 0,
                }}
              >
                <span style={{ fontSize: 14, color: active ? t.accent : TXT_FAINT }}>{t.icon}</span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
                  {t.label.toUpperCase()}
                </span>
              </button>
            )
          })}
        </div>

        {/* list */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading && <div style={{ padding: 20, color: TXT_FAINT, fontSize: 12 }}>Loading…</div>}
          {error && <div style={{ padding: 20, color: '#ff6b5e', fontSize: 12 }}>{error}</div>}
          {!loading && !error && items.length === 0 && (
            <div style={{ padding: 28, textAlign: 'center', color: TXT_FAINT, fontSize: 12, lineHeight: 1.6 }}>
              No {tab === 'all' ? '' : `${activeTab.label.toLowerCase()} `}submissions yet.
            </div>
          )}
          {items.map(it => {
            const active = it.id === selectedId
            const sm = STATUS_META[it.status]
            const accent = accentFor(it)
            const typeMeta = TABS.find(t => t.key === it.type)
            return (
              <button
                key={it.id}
                onClick={() => selectItem(it.id)}
                style={{
                  width: '100%', textAlign: 'left', cursor: 'pointer',
                  padding: '12px 14px', borderBottom: `1px solid ${LINE}`,
                  background: active ? PANEL_2 : 'transparent',
                  borderLeft: `2px solid ${active ? accent : 'transparent'}`,
                  display: 'flex', gap: 11, alignItems: 'flex-start', fontFamily: FONT,
                }}
              >
                <div style={{
                  width: 34, height: 34, borderRadius: 9, flexShrink: 0,
                  background: `${accent}26`, color: accent,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 800, letterSpacing: 0.5,
                }}>
                  {initials(it.snap_name, it.snap_username, it.snap_email)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: TXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {it.snap_name || it.snap_username || 'Unknown user'}
                    </span>
                    <span style={{ fontSize: 9, color: sm.color, fontWeight: 800, letterSpacing: 1, flexShrink: 0 }}>
                      {sm.label}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3, flexWrap: 'wrap' }}>
                    {tab === 'all' && typeMeta && (
                      <span style={{ fontSize: 9, letterSpacing: 1, color: accent, fontWeight: 700 }}>
                        {typeMeta.icon} {typeMeta.label.toUpperCase()}
                      </span>
                    )}
                    {it.disposition && (
                      <span style={{ fontSize: 9.5, letterSpacing: 1, color: accent, fontWeight: 700 }}>
                        {tab === 'all' && typeMeta ? '· ' : ''}{it.disposition.toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div style={{ marginTop: 3, fontSize: 11.5, color: TXT_DIM, lineHeight: 1.45, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                    {it.body}
                  </div>
                  <div style={{ marginTop: 4, fontSize: 10, color: TXT_FAINT }}>{timeAgo(it.created_at)}</div>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── RIGHT: detail ── */}
      <div className="sup-detail-pane" style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {!selected ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: TXT_FAINT, fontSize: 13 }}>
            Select a submission to view it.
          </div>
        ) : (
          <>
            {/* header */}
            <div style={{ padding: '18px 22px', borderBottom: `1px solid ${LINE}`, background: PANEL }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
                <button
                  className="sup-back-btn"
                  onClick={() => setMobileShowDetail(false)}
                  aria-label="Back to list"
                  style={{
                    display: 'none', flexShrink: 0, width: 34, height: 34, borderRadius: 9,
                    border: `1px solid ${LINE}`, background: 'transparent', color: TXT_DIM,
                    cursor: 'pointer', alignItems: 'center', justifyContent: 'center', fontSize: 16,
                  }}
                >
                  ←
                </button>
                <div style={{
                  width: 44, height: 44, borderRadius: 11, flexShrink: 0,
                  background: `${accentFor(selected)}26`, color: accentFor(selected),
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 15, fontWeight: 800,
                }}>
                  {initials(selected.snap_name, selected.snap_username, selected.snap_email)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: TXT }}>
                    {selected.snap_name || 'Unknown user'}
                  </div>
                  <div style={{ fontSize: 12, color: TXT_DIM, marginTop: 2 }}>
                    {selected.snap_username ? `@${selected.snap_username}` : ''}
                    {selected.snap_username && selected.snap_email ? '  ·  ' : ''}
                    {selected.snap_email || ''}
                    {tab === 'all' && (
                      <>
                        {(selected.snap_username || selected.snap_email) ? '  ·  ' : ''}
                        <span style={{ color: accentFor(selected), fontWeight: 700 }}>
                          {TABS.find(t => t.key === selected.type)?.label}
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 1.5, color: STATUS_META[selected.status].color }}>
                    {STATUS_META[selected.status].label}
                  </div>
                  {selected.disposition && (
                    <div style={{ marginTop: 4, fontSize: 9.5, letterSpacing: 1, color: accentFor(selected), fontWeight: 700 }}>
                      {selected.disposition.toUpperCase()}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* body + response */}
            <div style={{ flex: 1, overflowY: 'auto', padding: 22 }}>
              {selected.subject && (
                <div style={{ fontSize: 15, fontWeight: 700, color: TXT, marginBottom: 10 }}>{selected.subject}</div>
              )}
              <div style={{
                fontSize: 13.5, lineHeight: 1.7, color: TXT, whiteSpace: 'pre-wrap',
                background: PANEL, border: `1px solid ${LINE}`, borderRadius: 10, padding: 16,
              }}>
                {selected.body}
              </div>
              <div style={{ marginTop: 8, fontSize: 11, color: TXT_FAINT }}>
                Submitted {timeAgo(selected.created_at)}
              </div>

              {/* status controls */}
              <div style={{ display: 'flex', gap: 6, marginTop: 18, flexWrap: 'wrap' }}>
                {(['new', 'open', 'resolved', 'closed'] as Status[]).map(s => (
                  <button
                    key={s}
                    onClick={() => patch(selected.id, { status: s })}
                    style={{
                      padding: '6px 12px', borderRadius: 7, cursor: 'pointer',
                      border: `1px solid ${selected.status === s ? STATUS_META[s].color : LINE}`,
                      background: selected.status === s ? `${STATUS_META[s].color}1f` : 'transparent',
                      color: selected.status === s ? TXT : TXT_DIM,
                      fontFamily: FONT, fontSize: 10, letterSpacing: 1, fontWeight: 700,
                    }}
                  >
                    {STATUS_META[s].label}
                  </button>
                ))}
              </div>

              {/* response box */}
              <div style={{ marginTop: 22 }}>
                <div style={{ fontSize: 10, letterSpacing: 2, color: TXT_FAINT, fontWeight: 700, marginBottom: 8 }}>
                  RESPONSE — via support@dialerseat.com
                </div>
                <textarea
                  value={draft}
                  onChange={e => setDraft(e.target.value)}
                  placeholder="Write your reply…"
                  style={{
                    width: '100%', minHeight: 120, resize: 'vertical', boxSizing: 'border-box',
                    background: PANEL, border: `1px solid ${LINE}`, borderRadius: 10,
                    color: TXT, fontFamily: FONT, fontSize: 13, lineHeight: 1.6, padding: 14, outline: 'none',
                  }}
                />
                <div style={{ display: 'flex', gap: 10, marginTop: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  <button
                    onClick={sendResponse}
                    disabled={!draft.trim() || saving}
                    style={{
                      padding: '10px 18px', borderRadius: 9, border: 'none',
                      cursor: draft.trim() && !saving ? 'pointer' : 'default',
                      background: draft.trim() ? accentFor(selected) : 'rgba(255,255,255,0.08)',
                      color: draft.trim() ? '#0b0c12' : TXT_FAINT,
                      fontFamily: FONT, fontSize: 11, letterSpacing: 1.5, fontWeight: 800,
                    }}
                  >
                    {saving ? 'SAVING…' : 'SEND & RECORD'}
                  </button>
                  <button
                    onClick={() => patch(selected.id, { response_body: draft.trim() })}
                    disabled={!draft.trim() || saving}
                    style={{
                      padding: '10px 16px', borderRadius: 9, cursor: 'pointer',
                      border: `1px solid ${LINE}`, background: 'transparent', color: TXT_DIM,
                      fontFamily: FONT, fontSize: 11, letterSpacing: 1.5, fontWeight: 700,
                    }}
                  >
                    SAVE DRAFT
                  </button>
                  {selected.responded_at && (
                    <span style={{ fontSize: 10, color: '#5ad17a', marginLeft: 'auto' }}>
                      Responded {timeAgo(selected.responded_at)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}