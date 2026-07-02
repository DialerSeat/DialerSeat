'use client'
import { useEffect, useState } from 'react'


















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


const C = {
  bg: '#0a0a0a',
  bgDim: '#0f0f0f',
  text: '#00ff41',         // Matrix green — primary
  textDim: '#00a02a',      // Dimmer green for secondary
  textMute: '#0a5a18',     // Even dimmer for labels
  signup: '#00ff41',       // Green
  renewal: '#5cb6ff',      // Cyan-blue
  cancel: '#ff4444',       // Red
  error: '#ff8844',        // Amber for errors
  amount: '#ffe048',       // Yellow for money
} as const

const FONT = '"SF Mono", "Cascadia Mono", "JetBrains Mono", "Fira Code", Menlo, Consolas, "Courier New", monospace'

const FILTER_KEYS: FilterMode[] = ['all', 'signup', 'renewal', 'cancel']

export default function LogsApp() {
  const [data, setData] = useState<LogsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<{ message: string; body?: string } | null>(null)
  const [filter, setFilter] = useState<FilterMode>('all')

  
  const refetch = () => {
    let cancelled = false
    setLoading(true)
    setError(null)

    fetch('/api/admin/logs', { cache: 'no-store' })
      .then(async (r) => {
        const text = await r.text()
        if (!r.ok) {
          throw new Error(`HTTP ${r.status}: ${text.slice(0, 500)}`)
        }
        try {
          return JSON.parse(text) as LogsResponse
        } catch {
          throw new Error(`Bad JSON response. First 500 chars:\n${text.slice(0, 500)}`)
        }
      })
      .then((d) => {
        if (!cancelled) setData(d)
      })
      .catch((e) => {
        if (!cancelled) {
          setError({ message: e?.message || 'Failed to load' })
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }

  useEffect(() => {
    const cleanup = refetch()
    return cleanup
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return
      }
      if (e.key >= '1' && e.key <= '4') {
        setFilter(FILTER_KEYS[Number(e.key) - 1])
      } else if (e.key === 'r' || e.key === 'R') {
        refetch()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const entries = data?.entries ?? []
  const visible = filter === 'all' ? entries : entries.filter((e) => e.event_type === filter)

  return (
    <div style={S.root}>
      {/* Scanline overlay — subtle CRT vibe */}
      <style>{`
        @keyframes ds-cursor-blink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0; }
        }
        @keyframes ds-scanline {
          0% { background-position: 0 0; }
          100% { background-position: 0 4px; }
        }
        .logs-cursor::after {
          content: '█';
          color: ${C.text};
          margin-left: 4px;
          animation: ds-cursor-blink 1.1s infinite;
        }
        .logs-row:hover {
          background: rgba(0, 255, 65, 0.06);
        }
      `}</style>

      {/* HEADER LINE */}
      <div style={S.header}>
        <span style={{ color: C.textDim }}>admin@dialerseat</span>
        <span style={{ color: C.textMute }}>:~$</span>
        <span style={{ color: C.text, marginLeft: 8 }}>
          tail -f /var/log/customer-events.log
        </span>
      </div>

      {/* FILTER TOOLBAR */}
      <div style={S.toolbar}>
        <span style={{ color: C.textMute, marginRight: 8 }}>$ filter</span>
        {([
          { key: 'all', label: 'all', count: entries.length },
          { key: 'signup', label: 'signup', count: data?.counts.signups ?? 0 },
          { key: 'renewal', label: 'renewal', count: data?.counts.renewals ?? 0 },
          { key: 'cancel', label: 'cancel', count: data?.counts.cancels ?? 0 },
        ] as const).map((f, i) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            style={{
              ...S.chip,
              color: filter === f.key ? C.bg : C.text,
              background: filter === f.key ? C.text : 'transparent',
            }}
          >
            [{i + 1}] {f.label} ({f.count})
          </button>
        ))}

        <button
          onClick={refetch}
          style={{ ...S.chip, marginLeft: 'auto', color: C.textDim }}
          title="Refetch"
        >
          [r] refresh
        </button>
      </div>

      {/* BODY */}
      <div style={S.body}>
        {loading && (
          <div style={S.line}>
            <span style={{ color: C.textMute }}>{'>'}</span>{' '}
            <span className="logs-cursor">Loading customer events</span>
          </div>
        )}

        {error && (
          <div style={S.errorBlock}>
            <div style={{ color: C.error, fontWeight: 700, marginBottom: 6 }}>
              {'>'} ERROR fetching /api/admin/logs
            </div>
            <pre style={S.errorPre}>{error.message}</pre>
            <div style={{ marginTop: 12 }}>
              <button onClick={refetch} style={S.chip}>[r] retry</button>
            </div>
          </div>
        )}

        {!loading && !error && visible.length === 0 && (
          <div style={S.line}>
            <span style={{ color: C.textMute }}>{'>'}</span>{' '}
            <span style={{ color: C.textDim }}>
              {filter === 'all'
                ? 'No customer events in the last 90 days.'
                : `No ${filter} events in the last 90 days.`}
            </span>
          </div>
        )}

        {!loading && !error && visible.length > 0 && (
          <>
            {visible.map((entry) => (
              <LogLine key={entry.id} entry={entry} />
            ))}
            {/* End-of-stream indicator with cursor */}
            <div style={{ ...S.line, marginTop: 16 }}>
              <span style={{ color: C.textMute }}>{'>'}</span>{' '}
              <span style={{ color: C.textDim }}>--end of stream--</span>
            </div>
            <div style={S.line}>
              <span style={{ color: C.textDim }}>admin@dialerseat</span>
              <span style={{ color: C.textMute }}>:~$</span>
              <span className="logs-cursor"></span>
            </div>
          </>
        )}
      </div>

      {/* FOOTER STATUS */}
      {data && (
        <div style={S.footer}>
          <span>window: last {data.window_days}d</span>
          <span>events: {entries.length}{entries.length === 200 ? ' (capped)' : ''}</span>
          <span>signups: {data.counts.signups}</span>
          <span>renewals: {data.counts.renewals}</span>
          <span>cancels: {data.counts.cancels}</span>
        </div>
      )}
    </div>
  )
}


function LogLine({ entry }: { entry: LogEntry }) {
  const date = new Date(entry.date_iso)
  const ts = formatTimestamp(date)
  const eventColor =
    entry.event_type === 'signup' ? C.signup
    : entry.event_type === 'renewal' ? C.renewal
    : C.cancel
  const eventLabel = entry.event_type.toUpperCase().padEnd(7, ' ')

  return (
    <div className="logs-row" style={S.line}>
      <span style={{ color: C.textMute }}>[{ts}]</span>{' '}
      <span style={{ color: eventColor, fontWeight: 700 }}>{eventLabel}</span>{' '}
      <span style={{ color: C.text }}>{entry.user_name || '(unknown)'}</span>
      {entry.user_email && (
        <>
          {' '}
          <span style={{ color: C.textMute }}>&lt;{entry.user_email}&gt;</span>
        </>
      )}
      {entry.event_type !== 'cancel' && (
        <>
          {' '}
          <span style={{ color: C.amount }}>${(entry.amount_cents / 100).toFixed(2)}</span>
        </>
      )}
      {entry.retention_weeks !== null && (
        <>
          {' '}
          <span style={{ color: C.textDim }}>
            (retention: {entry.retention_weeks}w)
          </span>
        </>
      )}
    </div>
  )
}


function formatTimestamp(d: Date): string {
  
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const h = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  const s = String(d.getSeconds()).padStart(2, '0')
  return `${y}-${m}-${day} ${h}:${min}:${s}`
}


const S: Record<string, React.CSSProperties> = {
  root: {
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
    height: '100%',
    background: C.bg,
    color: C.text,
    fontFamily: FONT,
    fontSize: 13,
    lineHeight: 1.5,
    overflow: 'hidden',
    
    backgroundImage:
      'repeating-linear-gradient(0deg, rgba(0,255,65,0.02) 0px, rgba(0,255,65,0.02) 1px, transparent 1px, transparent 3px)',
  },
  header: {
    padding: '10px 14px',
    background: C.bgDim,
    borderBottom: '1px solid #0a3a1a',
    fontSize: 12,
    flexShrink: 0,
  },
  toolbar: {
    padding: '6px 14px',
    background: C.bgDim,
    borderBottom: '1px solid #0a3a1a',
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
    fontSize: 12,
    flexWrap: 'wrap',
  },
  chip: {
    padding: '3px 8px',
    fontSize: 11,
    fontFamily: FONT,
    background: 'transparent',
    color: C.text,
    border: '1px solid ' + C.textMute,
    borderRadius: 2,
    cursor: 'pointer',
    letterSpacing: 0,
  },
  body: {
    flex: 1,
    overflowY: 'auto',
    overflowX: 'auto',
    padding: '12px 14px',
    minHeight: 0,
  },
  line: {
    padding: '2px 0',
    whiteSpace: 'nowrap',
  },
  errorBlock: {
    padding: 12,
    border: '1px solid ' + C.error,
    borderRadius: 2,
    background: 'rgba(255, 136, 68, 0.04)',
    margin: '8px 0',
  },
  errorPre: {
    margin: 0,
    padding: 8,
    background: C.bgDim,
    color: C.error,
    fontFamily: FONT,
    fontSize: 11,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    maxHeight: 240,
    overflow: 'auto',
    border: '1px solid #1a1a1a',
  },
  footer: {
    padding: '6px 14px',
    background: C.bgDim,
    borderTop: '1px solid #0a3a1a',
    fontSize: 11,
    color: C.textDim,
    display: 'flex',
    gap: 16,
    flexShrink: 0,
    overflowX: 'auto',
  },
}