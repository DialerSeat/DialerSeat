'use client'

import { useCallback, useEffect, useState } from 'react'

// =============================================================================
// SUGGESTIONS — what visitors wrote in from /vs and /faq
// =============================================================================
// The marketing pages used to end at a mailto: link, which meant the only
// record of a question was whatever landed in an inbox, and the only way to
// know whether anyone had answered was to remember. These rows are the same
// messages, kept, with a status you can move.
//
// Every one is written by a member of the public through an unauthenticated
// endpoint, so the message and email are untrusted text: rendered as text,
// never as markup, and never used to build a link.
// =============================================================================

const T = {
  bg: '#f0f1f4',
  surface: '#e2e4ea',
  border: '#c4c8d0',
  text: '#1a1c24',
  muted: '#5a5e6a',
  blue: '#4a9eff',
  royal: '#2a6eff',
  green: '#1a6a1a',
  amber: '#8a6a1a',
  purple: '#5a2a8a',
}
const FUTURA = "'Futura PT', Futura, 'Trebuchet MS', sans-serif"
const POLL_MS = 20000

interface Suggestion {
  id: string
  created_at: string
  kind: string
  message: string
  email: string | null
  source_path: string | null
  status: 'new' | 'read' | 'archived'
}

const KIND_LABEL: Record<string, string> = {
  question: 'QUESTION',
  suggestion: 'SUGGESTION',
  comparison: 'COMPARISON REQUEST',
  other: 'OTHER',
}

const KIND_TONE: Record<string, string> = {
  question: '#2a6eff',
  suggestion: '#1a6a1a',
  comparison: '#5a2a8a',
  other: '#5a5e6a',
}

type Filter = 'open' | 'new' | 'read' | 'archived'

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'new', label: 'Unread' },
  { value: 'read', label: 'Read' },
  { value: 'archived', label: 'Archived' },
]

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const mins = Math.floor((Date.now() - then) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return new Date(iso).toLocaleDateString()
}

export default function SuggestionsApp() {
  const [items, setItems] = useState<Suggestion[]>([])
  const [unread, setUnread] = useState(0)
  const [filter, setFilter] = useState<Filter>('open')
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)

  /**
   * Which filter the rows on screen belong to.
   *
   * "Loading" is derived from this rather than kept as its own flag, which
   * gets two things right that a boolean did not: switching filters is
   * instantly loading without an effect having to set it, and the twenty-second
   * poll never flickers the list to "Loading…" while you are reading it,
   * because the filter has not changed.
   */
  const [loadedFilter, setLoadedFilter] = useState<Filter | null>(null)
  const loading = loadedFilter !== filter

  const load = useCallback(async () => {
    try {
      // "open" is the default view and means everything not archived, which is
      // what the endpoint returns when no status is given.
      const qs = filter === 'open' ? '' : `?status=${filter}`
      const res = await fetch(`/api/admin/suggestions${qs}`, { cache: 'no-store' })
      if (!res.ok) {
        setError('Could not load suggestions.')
        return
      }
      const data = await res.json()
      setItems(data.suggestions ?? [])
      setUnread(data.unread ?? 0)
      setError('')
    } catch {
      setError('Could not reach the server.')
    } finally {
      setLoadedFilter(filter)
    }
  }, [filter])

  // Polled rather than pushed. These arrive a few times a day at most, so a
  // socket would be a lot of machinery to save twenty seconds.
  //
  // Scheduled rather than called inline, matching apps/Notifications: load()
  // awaits a network round trip before it touches state, but
  // react-hooks/set-state-in-effect cannot see that and flags the direct call.
  useEffect(() => {
    const first = setTimeout(() => { void load() }, 0)
    const t = setInterval(() => { void load() }, POLL_MS)
    return () => { clearTimeout(first); clearInterval(t) }
  }, [load])

  const setStatus = async (id: string, status: Suggestion['status']) => {
    setBusyId(id)
    // Optimistic: the row moves out of the current filter immediately, because
    // waiting on a round trip to clear something you just triaged feels broken.
    const previous = items
    setItems((rows) =>
      filter === 'open' && status === 'archived'
        ? rows.filter((r) => r.id !== id)
        : filter !== 'open' && status !== filter
          ? rows.filter((r) => r.id !== id)
          : rows.map((r) => (r.id === id ? { ...r, status } : r)),
    )
    try {
      const res = await fetch('/api/admin/suggestions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      })
      if (!res.ok) {
        setItems(previous)
        setError('Could not update that one.')
        return
      }
      load()
    } catch {
      setItems(previous)
      setError('Could not reach the server.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="sgapp">
      <style>{`
        .sgapp { height: 100%; display: flex; flex-direction: column;
          background: ${T.bg}; color: ${T.text}; font-family: ${FUTURA}; }
        .sgapp * { box-sizing: border-box; }

        .sgapp-bar {
          display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
          padding: 14px 18px;
          border-bottom: 1px solid ${T.border};
          background: #fff;
        }
        .sgapp-title { font-size: 15px; font-weight: 800; letter-spacing: -0.2px; }
        .sgapp-badge {
          background: ${T.royal}; color: #fff;
          font-size: 10px; font-weight: bold; letter-spacing: 1px;
          padding: 3px 8px; border-radius: 999px;
        }
        .sgapp-filters { display: flex; gap: 6px; margin-left: auto; }
        .sgapp-filter {
          padding: 6px 12px;
          border: 1px solid ${T.border}; border-radius: 6px;
          background: ${T.bg}; color: ${T.muted};
          font-family: inherit; font-size: 11px; font-weight: bold; letter-spacing: 1px;
          cursor: pointer;
        }
        .sgapp-filter[aria-pressed="true"] {
          background: ${T.royal}; border-color: ${T.royal}; color: #fff;
        }

        .sgapp-list { flex: 1; overflow-y: auto; padding: 14px 18px 22px; }
        .sgapp-empty {
          padding: 48px 20px; text-align: center;
          font-size: 14px; color: ${T.muted};
        }
        .sgapp-err {
          margin: 12px 18px 0; padding: 10px 14px;
          background: rgba(138,26,26,0.07); border: 1px solid rgba(138,26,26,0.3);
          border-radius: 6px; font-size: 13px; color: #8a1a1a;
        }

        .sgapp-card {
          background: #fff;
          border: 1px solid ${T.border};
          border-radius: 8px;
          padding: 16px 18px;
          margin-bottom: 10px;
        }
        .sgapp-card.is-new { border-left: 3px solid ${T.royal}; }
        .sgapp-meta {
          display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
          margin-bottom: 10px;
        }
        .sgapp-kind {
          font-size: 9px; font-weight: bold; letter-spacing: 2px;
          padding: 3px 8px; border-radius: 4px;
        }
        .sgapp-when { font-size: 11px; color: ${T.muted}; }
        .sgapp-path {
          font-size: 11px; color: ${T.muted};
          background: ${T.bg}; border: 1px solid ${T.border};
          border-radius: 4px; padding: 2px 7px;
        }
        .sgapp-msg {
          font-size: 14px; line-height: 1.65; color: ${T.text};
          white-space: pre-wrap; word-break: break-word;
          margin: 0 0 12px 0;
        }
        .sgapp-email {
          font-size: 12.5px; color: ${T.muted};
          word-break: break-all;
        }
        .sgapp-email strong { color: ${T.text}; font-weight: 600; }
        .sgapp-actions { display: flex; gap: 8px; margin-top: 12px; flex-wrap: wrap; }
        .sgapp-btn {
          padding: 7px 14px;
          border: 1px solid ${T.border}; border-radius: 6px;
          background: ${T.bg}; color: ${T.text};
          font-family: inherit; font-size: 11px; font-weight: bold; letter-spacing: 1px;
          cursor: pointer;
        }
        .sgapp-btn:hover:not(:disabled) { border-color: ${T.royal}; color: ${T.royal}; }
        .sgapp-btn:disabled { opacity: 0.5; cursor: default; }
        .sgapp-btn.reply { background: ${T.royal}; border-color: ${T.royal}; color: #fff; text-decoration: none; display: inline-block; }
      `}</style>

      <div className="sgapp-bar">
        <span className="sgapp-title">Suggestions</span>
        {unread > 0 && <span className="sgapp-badge">{unread} NEW</span>}
        <div className="sgapp-filters">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              className="sgapp-filter"
              aria-pressed={filter === f.value}
              onClick={() => setFilter(f.value)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="sgapp-err">{error}</div>}

      <div className="sgapp-list">
        {loading ? (
          <div className="sgapp-empty">Loading…</div>
        ) : items.length === 0 ? (
          <div className="sgapp-empty">
            {filter === 'archived'
              ? 'Nothing archived yet.'
              : 'Nothing here. Visitors can write in from /vs and /faq.'}
          </div>
        ) : (
          items.map((s) => (
            <div key={s.id} className={`sgapp-card${s.status === 'new' ? ' is-new' : ''}`}>
              <div className="sgapp-meta">
                <span
                  className="sgapp-kind"
                  style={{
                    color: KIND_TONE[s.kind] || T.muted,
                    background: `${KIND_TONE[s.kind] || T.muted}18`,
                  }}
                >
                  {KIND_LABEL[s.kind] || s.kind.toUpperCase()}
                </span>
                <span className="sgapp-when">{timeAgo(s.created_at)}</span>
                {s.source_path && <span className="sgapp-path">{s.source_path}</span>}
              </div>

              <p className="sgapp-msg">{s.message}</p>

              <div className="sgapp-email">
                {s.email ? (
                  <>
                    Reply to <strong>{s.email}</strong>
                  </>
                ) : (
                  'No email given — anonymous.'
                )}
              </div>

              <div className="sgapp-actions">
                {s.email && (
                  <a
                    className="sgapp-btn reply"
                    href={`mailto:${encodeURIComponent(s.email)}?subject=${encodeURIComponent('Re: your message to DialerSeat')}`}
                  >
                    REPLY
                  </a>
                )}
                {s.status === 'new' && (
                  <button
                    type="button"
                    className="sgapp-btn"
                    disabled={busyId === s.id}
                    onClick={() => setStatus(s.id, 'read')}
                  >
                    MARK READ
                  </button>
                )}
                {s.status !== 'archived' ? (
                  <button
                    type="button"
                    className="sgapp-btn"
                    disabled={busyId === s.id}
                    onClick={() => setStatus(s.id, 'archived')}
                  >
                    ARCHIVE
                  </button>
                ) : (
                  <button
                    type="button"
                    className="sgapp-btn"
                    disabled={busyId === s.id}
                    onClick={() => setStatus(s.id, 'read')}
                  >
                    RESTORE
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
