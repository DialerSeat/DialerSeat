'use client'
import { useEffect, useState } from 'react'

// =============================================================================
// LOGS APP
// =============================================================================
// Scrollable timeline of customer events (signup / renewal / cancel) sourced
// from /api/admin/logs. Sorted most-recent-first. Each row shows:
//   - Avatar circle (initial of user name)
//   - User name + email
//   - Event badge (color-coded)
//   - Amount paid (or "—" for cancels)
//   - Date (relative + absolute)
//   - Retention pill (e.g. "4 wk")
// =============================================================================

interface LogEntry {
  id: string
  event_type: 'signup' | 'renewal' | 'cancel'
  user_name: string
  user_email: string | null
  amount_cents: number
  date_iso: string
  retention_weeks: number | null
  source: string
}

interface LogsResponse {
  entries: LogEntry[]
  counts: { signups: number; renewals: number; cancels: number }
  window_days: number
}

type FilterMode = 'all' | 'signup' | 'renewal' | 'cancel'

export default function LogsApp() {
  const [data, setData] = useState<LogsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<FilterMode>('all')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    fetch('/api/admin/logs', { cache: 'no-store' })
      .then(async (r) => {
        if (!r.ok) {
          const text = await r.text().catch(() => '')
          throw new Error(`HTTP ${r.status}: ${text || r.statusText}`)
        }
        return r.json() as Promise<LogsResponse>
      })
      .then((d) => {
        if (!cancelled) setData(d)
      })
      .catch((e) => {
        if (!cancelled) setError(e?.message || 'Failed to load')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  const entries = data?.entries ?? []
  const visible = filter === 'all' ? entries : entries.filter((e) => e.event_type === filter)

  return (
    <div style={S.root}>
      {/* ── TOOLBAR ─────────────────────────────────────────────────── */}
      <div style={S.toolbar}>
        <div style={S.title}>Customer Activity</div>
        <div style={S.filterBar}>
          <FilterChip
            label={`All (${entries.length})`}
            active={filter === 'all'}
            onClick={() => setFilter('all')}
          />
          <FilterChip
            label={`Signups (${data?.counts.signups ?? 0})`}
            active={filter === 'signup'}
            onClick={() => setFilter('signup')}
            color="#1a8a3a"
          />
          <FilterChip
            label={`Renewals (${data?.counts.renewals ?? 0})`}
            active={filter === 'renewal'}
            onClick={() => setFilter('renewal')}
            color="#2a6eff"
          />
          <FilterChip
            label={`Cancels (${data?.counts.cancels ?? 0})`}
            active={filter === 'cancel'}
            onClick={() => setFilter('cancel')}
            color="#c02020"
          />
        </div>
      </div>

      {/* ── BODY ────────────────────────────────────────────────────── */}
      <div style={S.body}>
        {loading && <div style={S.message}>Loading customer activity…</div>}

        {error && (
          <div style={{ ...S.message, color: '#c02020' }}>
            Couldn't load logs.
            <div style={{ fontSize: 11, marginTop: 8, opacity: 0.8 }}>{error}</div>
          </div>
        )}

        {!loading && !error && visible.length === 0 && (
          <div style={S.message}>
            {filter === 'all'
              ? 'No customer activity in the last 90 days yet.'
              : `No ${filter} events in the last 90 days.`}
          </div>
        )}

        {!loading && !error && visible.length > 0 && (
          <div style={S.list}>
            {visible.map((entry) => (
              <LogRow key={entry.id} entry={entry} />
            ))}
          </div>
        )}
      </div>

      {/* ── FOOTER ──────────────────────────────────────────────────── */}
      {data && (
        <div style={S.footer}>
          Last {data.window_days} days · {entries.length} events
          {entries.length === 200 && ' (capped at 200)'}
        </div>
      )}
    </div>
  )
}

// =============================================================================
// ROW
// =============================================================================

function LogRow({ entry }: { entry: LogEntry }) {
  const eventStyle = EVENT_STYLES[entry.event_type]
  const date = new Date(entry.date_iso)
  const initial = (entry.user_name?.[0] || '?').toUpperCase()

  return (
    <div style={S.row}>
      <div style={{ ...S.avatar, background: eventStyle.avatarBg }}>{initial}</div>

      <div style={S.rowMain}>
        <div style={S.rowName}>{entry.user_name || '(unknown)'}</div>
        {entry.user_email && <div style={S.rowEmail}>{entry.user_email}</div>}
      </div>

      <div style={{ ...S.badge, background: eventStyle.badgeBg, color: eventStyle.badgeText }}>
        {eventStyle.label}
      </div>

      <div style={S.amount}>
        {entry.event_type === 'cancel'
          ? <span style={{ opacity: 0.5 }}>—</span>
          : formatMoney(entry.amount_cents)}
      </div>

      {entry.retention_weeks !== null && (
        <div style={S.retention} title={`Customer for ${entry.retention_weeks} week(s)`}>
          {entry.retention_weeks} wk
        </div>
      )}

      <div style={S.date}>
        <div style={S.dateAbs}>{formatDate(date)}</div>
        <div style={S.dateRel}>{formatRelative(date)}</div>
      </div>
    </div>
  )
}

function FilterChip({
  label,
  active,
  onClick,
  color = '#2a4a8a',
}: {
  label: string
  active: boolean
  onClick: () => void
  color?: string
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '6px 12px',
        fontSize: 11,
        fontWeight: 600,
        border: '1px solid ' + (active ? color : '#c4c8d0'),
        background: active ? color : '#ffffff',
        color: active ? '#ffffff' : '#5a5e6a',
        borderRadius: 4,
        cursor: 'pointer',
        fontFamily: 'inherit',
        letterSpacing: 0.3,
      }}
    >
      {label}
    </button>
  )
}

// =============================================================================
// FORMATTERS
// =============================================================================

function formatMoney(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

function formatDate(d: Date): string {
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatRelative(d: Date): string {
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  const weeks = Math.floor(days / 7)
  if (weeks < 4) return `${weeks}w ago`
  const months = Math.floor(days / 30)
  return `${months}mo ago`
}

// =============================================================================
// STYLES
// =============================================================================

const EVENT_STYLES = {
  signup: {
    label: 'SIGNUP',
    avatarBg: 'linear-gradient(135deg, #5ad17a, #1a6a1a)',
    badgeBg: '#e4f5e8',
    badgeText: '#1a6a1a',
  },
  renewal: {
    label: 'RENEWAL',
    avatarBg: 'linear-gradient(135deg, #4a9eff, #2a6eff)',
    badgeBg: '#e4eef8',
    badgeText: '#2a4a8a',
  },
  cancel: {
    label: 'CANCEL',
    avatarBg: 'linear-gradient(135deg, #ff6464, #c02020)',
    badgeBg: '#fae0e0',
    badgeText: '#a01a1a',
  },
} as const

const S: Record<string, React.CSSProperties> = {
  root: {
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
    height: '100%',
    background: '#f5f9fd',
    fontFamily: '"Segoe UI", Tahoma, sans-serif',
    color: '#1a1c24',
  },
  toolbar: {
    padding: '12px 16px',
    background: 'linear-gradient(to bottom, #ffffff 0%, #e8edf3 100%)',
    borderBottom: '1px solid #c4c8d0',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    flexShrink: 0,
  },
  title: {
    fontSize: 14,
    fontWeight: 700,
    letterSpacing: 0.3,
    color: '#1a1c24',
  },
  filterBar: {
    display: 'flex',
    gap: 6,
    flexWrap: 'wrap',
  },
  body: {
    flex: 1,
    overflowY: 'auto',
    overflowX: 'hidden',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
  },
  row: {
    display: 'grid',
    gridTemplateColumns: '36px 1fr auto auto auto auto',
    alignItems: 'center',
    gap: 12,
    padding: '10px 16px',
    borderBottom: '1px solid #e2e4ea',
    fontSize: 12,
    background: '#ffffff',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: '50%',
    color: '#ffffff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 14,
    fontWeight: 700,
    boxShadow: '0 1px 3px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.3)',
  },
  rowMain: {
    minWidth: 0,
  },
  rowName: {
    fontWeight: 600,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  rowEmail: {
    fontSize: 11,
    color: '#5a5e6a',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  badge: {
    padding: '3px 8px',
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: 0.6,
    borderRadius: 3,
    whiteSpace: 'nowrap',
  },
  amount: {
    fontWeight: 600,
    minWidth: 64,
    textAlign: 'right',
    fontVariantNumeric: 'tabular-nums',
  },
  retention: {
    padding: '2px 8px',
    fontSize: 10,
    fontWeight: 600,
    color: '#5a5e6a',
    background: '#f0f1f4',
    border: '1px solid #d4d8e0',
    borderRadius: 10,
    whiteSpace: 'nowrap',
  },
  date: {
    textAlign: 'right',
    minWidth: 90,
  },
  dateAbs: {
    fontSize: 11,
    color: '#1a1c24',
  },
  dateRel: {
    fontSize: 10,
    color: '#8a8e96',
  },
  message: {
    padding: 32,
    textAlign: 'center',
    color: '#5a5e6a',
    fontSize: 12,
  },
  footer: {
    padding: '8px 16px',
    background: '#e8edf3',
    borderTop: '1px solid #c4c8d0',
    fontSize: 10,
    color: '#5a5e6a',
    textAlign: 'center',
    flexShrink: 0,
  },
}