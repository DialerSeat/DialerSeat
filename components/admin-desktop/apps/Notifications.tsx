'use client'

import { useCallback, useEffect, useState } from 'react'

// =============================================================================
// NOTIFICATIONS — the history a push banner does not keep
// =============================================================================
// Web push is an interruption, not a record. The OS draws a banner, you tap
// it, and there is nothing left. A signup that arrived at 3am, or a capacity
// warning dismissed one-handed on a phone, was simply gone.
//
// lib/pushNotify writes a row before it attempts delivery, so this shows the
// same events the phone showed — plus the ones it did not. A muted preference
// or a failed delivery should not erase the fact that something happened, and
// the MUTED / UNDELIVERED tags below make that distinction visible rather than
// leaving a silent gap you would have to notice on your own.
// =============================================================================

const T = {
  bg: '#f0f1f4',
  surface: '#e2e4ea',
  border: '#c4c8d0',
  dark: '#1a1a2e',
  text: '#1a1c24',
  muted: '#5a5e6a',
  accent: '#2a4a8a',
  blue: '#4a9eff',
  green: '#1a6a1a',
  red: '#8a1a1a',
  amber: '#8a6a1a',
}
const FUTURA = "'Futura PT', Futura, 'Trebuchet MS', sans-serif"
const POLL_MS = 15000

interface Notification {
  id: string
  event_type: string
  title: string
  body: string
  url: string | null
  pushed: boolean
  delivered_to: number
  read_at: string | null
  created_at: string
}

/** Colour per event family. Money green, problems red, admin neutral. */
const EVENT_TONE: Record<string, string> = {
  signup: T.blue,
  new_sub: T.green,
  resub: T.green,
  renewal: T.green,
  cancel: T.red,
  sub_paused: T.amber,
  sub_resumed: T.green,
  account_deleted: T.red,
  agent_leg_refused: T.red,
  pool_capacity: T.amber,
  webhook_silence: T.red,
}

const EVENT_LABEL: Record<string, string> = {
  signup: 'SIGNUP',
  account_deleted: 'ACCOUNT DELETED',
  new_sub: 'NEW SUBSCRIPTION',
  resub: 'RESUBSCRIBED',
  renewal: 'RENEWAL',
  cancel: 'CANCELLED',
  sub_paused: 'PAUSED',
  sub_resumed: 'RESUMED',
  agent_leg_refused: 'AGENT LEG REFUSED',
  pool_capacity: 'POOL CAPACITY',
  webhook_silence: 'WEBHOOK SILENCE',
}

function ago(iso: string): string {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000))
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return d < 7 ? `${d}d ago` : new Date(iso).toLocaleDateString()
}

export default function Notifications() {
  const [items, setItems] = useState<Notification[]>([])
  const [unread, setUnread] = useState(0)
  const [error, setError] = useState<string | null>(null)
  // Opens on UNREAD. Opening on "all" meant the thing you came to see was
  // buried under everything you had already read — the app answered "what has
  // ever happened" when the question is always "what have I not seen yet".
  const [filter, setFilter] = useState<'all' | 'unread'>('unread')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async (mode: 'all' | 'unread') => {
    try {
      const res = await fetch(
        `/api/admin/notifications${mode === 'unread' ? '?unread=1' : ''}`,
        { cache: 'no-store' }
      )
      const json = await res.json()
      if (!json?.success) {
        setError(typeof json?.error === 'string' ? json.error : 'Could not load notifications')
        return
      }
      setError(null)
      setItems(json.notifications || [])
      setUnread(json.unreadCount || 0)
    } catch {
      setError('Could not reach the server')
    }
  }, [])

  useEffect(() => {
    // Scheduled rather than called inline: load() awaits a network round trip
    // before touching state, but react-hooks/set-state-in-effect cannot see
    // that and flags the direct call.
    const first = setTimeout(() => { void load(filter) }, 0)
    const t = setInterval(() => { void load(filter) }, POLL_MS)
    return () => { clearTimeout(first); clearInterval(t) }
  }, [load, filter])

  const act = useCallback(async (action: string, ids?: string[]) => {
    setBusy(true)
    try {
      await fetch('/api/admin/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ids }),
      })
      await load(filter)
    } finally {
      setBusy(false)
    }
  }, [load, filter])

  const btn = (active: boolean): React.CSSProperties => ({
    padding: '5px 11px',
    fontFamily: FUTURA,
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 1,
    border: `1px solid ${active ? T.accent : T.border}`,
    background: active ? T.accent : 'white',
    color: active ? 'white' : T.text,
    borderRadius: 3,
    cursor: 'pointer',
  })

  return (
    <div style={{
      height: '100%', display: 'flex', flexDirection: 'column',
      background: T.bg, fontFamily: FUTURA, color: T.text,
    }}>
      {/* ── TOOLBAR ────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
        padding: '10px 14px', borderBottom: `1px solid ${T.border}`, background: 'white',
      }}>
        <div style={{ fontSize: 12, fontWeight: 'bold', letterSpacing: 1.5 }}>
          NOTIFICATIONS
        </div>
        {unread > 0 && (
          <span style={{
            fontSize: 10, fontWeight: 'bold', padding: '2px 7px', borderRadius: 9,
            background: T.red, color: 'white',
          }}>
            {unread} UNREAD
          </span>
        )}
        <div style={{ flex: 1 }} />
        <button style={btn(filter === 'all')} onClick={() => setFilter('all')}>ALL</button>
        <button style={btn(filter === 'unread')} onClick={() => setFilter('unread')}>UNREAD</button>
        <button style={btn(false)} disabled={busy || unread === 0}
                onClick={() => act('read_all')}>MARK ALL READ</button>
        <button style={btn(false)} disabled={busy}
                onClick={() => act('clear_read')}>CLEAR READ</button>
      </div>

      {error && (
        <div style={{
          margin: '10px 14px 0', padding: '8px 12px', fontSize: 11,
          background: 'rgba(138,26,26,0.08)', border: `1px solid ${T.red}`,
          color: T.red, borderRadius: 3,
        }}>
          {error}
        </div>
      )}

      {/* ── LIST ───────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflow: 'auto', padding: '10px 14px 16px' }}>
        {items.length === 0 ? (
          <div style={{ fontSize: 12, color: T.muted, padding: '40px 0', textAlign: 'center' }}>
            {filter === 'unread' ? 'Nothing unread.' : 'No notifications yet.'}
          </div>
        ) : items.map(n => {
          const tone = EVENT_TONE[n.event_type] || T.muted
          const isUnread = !n.read_at
          return (
            <div
              key={n.id}
              style={{
                display: 'flex', gap: 10, alignItems: 'flex-start',
                padding: '10px 12px', marginBottom: 6, borderRadius: 4,
                background: isUnread ? 'white' : 'transparent',
                border: `1px solid ${isUnread ? T.border : 'transparent'}`,
                borderLeft: `3px solid ${isUnread ? tone : T.border}`,
                opacity: isUnread ? 1 : 0.7,
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', gap: 7, alignItems: 'center', flexWrap: 'wrap', marginBottom: 3 }}>
                  <span style={{
                    fontSize: 9, fontWeight: 'bold', letterSpacing: 1,
                    padding: '2px 6px', borderRadius: 2,
                    background: tone, color: 'white',
                  }}>
                    {EVENT_LABEL[n.event_type] || n.event_type.toUpperCase()}
                  </span>
                  {/* Why a notification might not have reached a phone. Without
                      these two tags a muted category looks identical to a
                      delivery that silently failed. */}
                  {!n.pushed && (
                    <span style={{ fontSize: 9, color: T.muted, letterSpacing: 0.5 }}
                          title="Logged but not sent — this event type or the master switch is off in Settings.">
                      MUTED
                    </span>
                  )}
                  {n.pushed && n.delivered_to === 0 && (
                    <span style={{ fontSize: 9, color: T.red, letterSpacing: 0.5 }}
                          title="Send was attempted but no browser subscription accepted it.">
                      UNDELIVERED
                    </span>
                  )}
                  <span style={{ fontSize: 10, color: T.muted }}>{ago(n.created_at)}</span>
                </div>
                <div style={{ fontSize: 12.5, fontWeight: isUnread ? 'bold' : 'normal' }}>
                  {n.title}
                </div>
                <div style={{ fontSize: 12, color: T.muted, lineHeight: 1.45, marginTop: 2 }}>
                  {n.body}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {isUnread && (
                  <button style={{ ...btn(false), padding: '3px 8px' }} disabled={busy}
                          onClick={() => act('read', [n.id])}>READ</button>
                )}
                <button style={{ ...btn(false), padding: '3px 8px' }} disabled={busy}
                        onClick={() => act('delete', [n.id])}>✕</button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
