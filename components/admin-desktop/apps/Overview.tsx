'use client'
import { useEffect, useState, useMemo } from 'react'






















interface AdminUser {
  clerk_id: string
  email: string
  first_name: string | null
  last_name: string | null
  created_at: string
  last_seen_at: string | null
  is_admin: boolean
  lead_count: number
  last_active_at: string | null
  team_member_count: number
  subscription: {
    status: string
    current_period_end: string | null
    cancel_at_period_end: boolean
    discount_coupon: string | null
    plan: 'pro' | 'wl' | null
    subscribed_since: string | null
  } | null
  is_active_subscription: boolean
}

type FilterMode = 'all' | 'active' | 'inactive'

const ONLINE_WINDOW_MS = 90_000

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

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  })
}

function timeAgo(iso: string | null) {
  if (!iso) return 'never'
  const ms = Date.now() - new Date(iso).getTime()
  const days = Math.floor(ms / 86400000)
  if (days === 0) {
    const hours = Math.floor(ms / 3600000)
    if (hours === 0) {
      const mins = Math.floor(ms / 60000)
      if (mins === 0) return 'just now'
      return `${mins}m ago`
    }
    return `${hours}h ago`
  }
  if (days === 1) return 'yesterday'
  if (days < 30) return `${days}d ago`
  if (days < 365) return `${Math.floor(days / 30)}mo ago`
  return `${Math.floor(days / 365)}y ago`
}

// Same bucketing as timeAgo(), but phrased as a plain duration rather than
// a point in the past — e.g. "3mo" not "3mo ago" — since call sites like
// the Overview subscription cell build their own framing around it
// ("subscribed for " + tenure(...), "was subscribed for " + tenure(...)).
function tenure(iso: string | null): string {
  if (!iso) return 'an unknown amount of time'
  const ms = Date.now() - new Date(iso).getTime()
  const days = Math.floor(ms / 86400000)
  if (days === 0) {
    const hours = Math.floor(ms / 3600000)
    if (hours === 0) {
      const mins = Math.floor(ms / 60000)
      if (mins <= 1) return 'under a minute'
      return `${mins} minutes`
    }
    return hours === 1 ? '1 hour' : `${hours} hours`
  }
  if (days === 1) return '1 day'
  if (days < 30) return `${days} days`
  if (days < 365) {
    const months = Math.floor(days / 30)
    return months === 1 ? '1 month' : `${months} months`
  }
  const years = Math.floor(days / 365)
  return years === 1 ? '1 year' : `${years} years`
}

function daysSince(iso: string | null): number {
  if (!iso) return Infinity
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
}

function isOnline(lastSeenAt: string | null): boolean {
  if (!lastSeenAt) return false
  return Date.now() - new Date(lastSeenAt).getTime() < ONLINE_WINDOW_MS
}

export default function OverviewApp() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<FilterMode>('all')
  const [search, setSearch] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  
  const [deletingUser, setDeletingUser] = useState<AdminUser | null>(null)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deleteInFlight, setDeleteInFlight] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleteResult, setDeleteResult] = useState<any>(null)
  const [sortMode, setSortMode] = useState<'joined_new' | 'joined_old' | 'active_first' | 'name'>('joined_new')
  const [lastSynced, setLastSynced] = useState<number>(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 10_000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    let cancelled = false

    const load = (showLoader: boolean) => {
      if (showLoader) setLoading(true)
      fetch('/api/admin/users', { cache: 'no-store' })
        .then(async r => {
          if (r.status === 403) throw new Error('Forbidden — admin only')
          if (r.status === 401) throw new Error('Not signed in')
          return r.json()
        })
        .then(d => {
          if (cancelled) return
          if (d.success) { setUsers(d.users); setLastSynced(Date.now()) }
          else setError(d.error || 'Failed to load')
          setLoading(false)
        })
        .catch(err => {
          if (cancelled) return
          setError(err.message)
          setLoading(false)
        })
    }

    // auto-sync every 10 seconds — plain client-side polling, no cron job
    load(true)
    const id = setInterval(() => load(false), 10_000)
    return () => { cancelled = true; clearInterval(id) }
  }, [])

  const filtered = useMemo(() => {
    let list = users
    if (filter === 'active') list = list.filter(u => u.is_active_subscription)
    else if (filter === 'inactive') list = list.filter(u => !u.is_active_subscription)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(u =>
        u.email.toLowerCase().includes(q) ||
        `${u.first_name || ''} ${u.last_name || ''}`.toLowerCase().includes(q)
      )
    }
    list = [...list]
    if (sortMode === 'joined_new') {
      list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    } else if (sortMode === 'joined_old') {
      list.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    } else if (sortMode === 'active_first') {
      list.sort((a, b) => {
        const aT = a.last_seen_at ? new Date(a.last_seen_at).getTime() : 0
        const bT = b.last_seen_at ? new Date(b.last_seen_at).getTime() : 0
        return bT - aT
      })
    } else if (sortMode === 'name') {
      list.sort((a, b) =>
        `${a.first_name || ''} ${a.last_name || a.email}`.localeCompare(`${b.first_name || ''} ${b.last_name || b.email}`)
      )
    }
    return list
  }, [users, filter, search, sortMode])

  const counts = useMemo(() => ({
    all: users.length,
    active: users.filter(u => u.is_active_subscription).length,
    inactive: users.filter(u => !u.is_active_subscription).length,
    online: users.filter(u => isOnline(u.last_seen_at)).length,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [users, tick])

  function openDeleteModal(u: AdminUser) {
    setDeletingUser(u)
    setDeleteConfirmText('')
    setDeleteError(null)
    setDeleteResult(null)
  }

  function closeDeleteModal() {
    if (deleteInFlight) return
    setDeletingUser(null)
    setDeleteConfirmText('')
    setDeleteError(null)
    setDeleteResult(null)
  }

  async function executeDelete() {
    if (!deletingUser) return
    if (deleteConfirmText.trim().toLowerCase() !== 'delete') return
    setDeleteInFlight(true)
    setDeleteError(null)
    try {
      const r = await fetch('/api/admin/users/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clerkId: deletingUser.clerk_id }),
      })
      const d = await r.json()
      if (!r.ok || !d.success) {
        setDeleteError(d.error || `Request failed (${r.status})`)
        setDeleteInFlight(false)
        return
      }
      setDeleteResult(d.summary)
      setUsers(prev => prev.filter(u => u.clerk_id !== deletingUser.clerk_id))
      if (expandedId === deletingUser.clerk_id) setExpandedId(null)
    } catch (err: any) {
      setDeleteError(err?.message || 'Network error')
    } finally {
      setDeleteInFlight(false)
    }
  }

  const canExecuteDelete =
    !!deletingUser &&
    !deleteInFlight &&
    !deleteResult &&
    deleteConfirmText.trim().toLowerCase() === 'delete'

  return (
    <div style={{
      width: '100%',
      height: '100%',
      background: T.bg,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      fontFamily: 'Futura PT, Futura, sans-serif',
    }}>
      <style>{`
        .ovr-header {
          background: ${T.dark};
          padding: 12px 20px;
          border-bottom: 2px solid ${T.accent};
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          flex-wrap: wrap;
        }
        .ovr-controls {
          padding: 12px 16px;
          background: ${T.surface};
          border-bottom: 1px solid ${T.border};
          display: flex;
          gap: 12px;
          align-items: center;
          flex-wrap: wrap;
        }
        .ovr-pills {
          display: flex;
          gap: 4px;
          background: ${T.bg};
          border: 1px solid ${T.border};
          border-radius: 4px;
          padding: 3px;
        }
        .ovr-pill {
          padding: 6px 14px;
          border: none;
          background: transparent;
          color: ${T.muted};
          font-size: 10px;
          letter-spacing: 2px;
          font-weight: bold;
          cursor: pointer;
          border-radius: 3px;
          font-family: 'Futura PT', Futura, sans-serif;
        }
        .ovr-pill.active {
          background: ${T.dark};
          color: ${T.blue};
        }
        .ovr-search {
          flex: 1;
          min-width: 200px;
          padding: 8px 12px;
          background: ${T.bg};
          border: 1px solid ${T.border};
          border-radius: 4px;
          font-family: monospace;
          font-size: 12px;
          color: ${T.text};
          outline: none;
        }
        .ovr-sort {
          padding: 8px 10px;
          background: ${T.bg};
          border: 1px solid ${T.border};
          border-radius: 4px;
          font-family: 'Futura PT', Futura, sans-serif;
          font-size: 11px;
          letter-spacing: 0.5px;
          color: ${T.text};
          outline: none;
          cursor: pointer;
        }
        .ovr-list {
          flex: 1;
          overflow-y: auto;
          padding: 12px 16px;
        }
        .ovr-row {
          background: ${T.surface};
          border: 1px solid ${T.border};
          border-radius: 4px;
          margin-bottom: 6px;
          overflow: hidden;
          transition: border-color 0.15s;
        }
        .ovr-row.expanded {
          border-color: ${T.blue};
        }
        .ovr-row-main {
          padding: 12px 16px;
          display: grid;
          grid-template-columns: 1fr auto auto auto;
          gap: 16px;
          align-items: center;
          cursor: pointer;
        }
        .ovr-row-main:hover {
          background: ${T.bg};
        }
        .ovr-name {
          font-weight: bold;
          font-family: monospace;
          color: ${T.text};
          font-size: 13px;
          letter-spacing: 0.5px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .ovr-email {
          font-size: 11px;
          color: ${T.muted};
          font-family: monospace;
          margin-top: 2px;
        }
        .ovr-status-stack {
          display: flex;
          flex-direction: column;
          gap: 4px;
          align-items: flex-end;
          min-width: 90px;
        }
        .ovr-pill-status {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 3px 8px;
          border-radius: 3px;
          font-size: 9px;
          letter-spacing: 2px;
          font-weight: bold;
          white-space: nowrap;
          width: fit-content;
        }
        .ovr-pill-status.active {
          background: rgba(26,106,26,0.1);
          border: 1px solid ${T.green};
          color: ${T.green};
        }
        .ovr-pill-status.inactive {
          background: rgba(90,94,106,0.1);
          border: 1px solid ${T.muted};
          color: ${T.muted};
        }
        .ovr-pill-status.online {
          background: rgba(74,158,255,0.1);
          border: 1px solid ${T.blue};
          color: ${T.blue};
        }
        .ovr-status-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }
        .ovr-status-dot.green {
          background: #32ff7e;
          box-shadow: 0 0 6px #32ff7e;
        }
        .ovr-status-dot.gray {
          background: ${T.muted};
        }
        .ovr-status-dot.blue {
          background: ${T.blue};
          box-shadow: 0 0 6px ${T.blue};
          animation: pulse-blue 2s ease-in-out infinite;
        }
        @keyframes pulse-blue {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.55; }
        }
        .ovr-detail {
          background: ${T.bg};
          border-top: 1px solid ${T.border};
          padding: 14px 16px;
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
          gap: 14px;
        }
        .ovr-detail-cell {
          padding: 8px 10px;
          background: ${T.surface};
          border: 1px solid ${T.border};
          border-radius: 3px;
        }
        .ovr-detail-label {
          font-size: 8px;
          letter-spacing: 2px;
          color: ${T.muted};
          margin-bottom: 4px;
          font-weight: bold;
        }
        .ovr-detail-value {
          font-size: 13px;
          font-weight: bold;
          font-family: monospace;
          color: ${T.text};
        }
        .ovr-danger-zone {
          background: ${T.bg};
          border-top: 1px dashed ${T.red};
          padding: 12px 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
        }
        .ovr-danger-label {
          font-size: 9px;
          letter-spacing: 2px;
          color: ${T.red};
          font-weight: bold;
        }
        .ovr-danger-btn {
          padding: 7px 14px;
          background: transparent;
          border: 1px solid ${T.red};
          color: ${T.red};
          font-size: 10px;
          letter-spacing: 2px;
          font-weight: bold;
          cursor: pointer;
          border-radius: 3px;
          font-family: 'Futura PT', Futura, sans-serif;
        }
        .ovr-danger-btn:hover:not(:disabled) {
          background: ${T.red};
          color: #fff;
        }
        .ovr-danger-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }
        .ovr-modal-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.7);
          z-index: 11000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
        }
        .ovr-modal {
          background: ${T.bg};
          border: 2px solid ${T.red};
          border-radius: 4px;
          max-width: 520px;
          width: 100%;
          max-height: 90vh;
          overflow-y: auto;
          font-family: 'Futura PT', Futura, sans-serif;
        }
        .ovr-modal-header {
          background: ${T.red};
          color: #fff;
          padding: 12px 16px;
          font-size: 11px;
          letter-spacing: 3px;
          font-weight: bold;
        }
        .ovr-modal-body {
          padding: 16px;
        }
        .ovr-modal-warning {
          background: #f8e8e8;
          border: 1px solid ${T.red};
          padding: 12px;
          border-radius: 3px;
          font-size: 12px;
          color: ${T.text};
          line-height: 1.5;
          margin-bottom: 14px;
          font-family: system-ui, sans-serif;
        }
        .ovr-modal-list {
          font-family: monospace;
          font-size: 11px;
          color: ${T.text};
          margin: 8px 0 0 0;
          padding-left: 18px;
        }
        .ovr-modal-list li {
          margin: 2px 0;
        }
        .ovr-modal-input {
          width: 100%;
          padding: 10px 12px;
          background: ${T.surface};
          border: 1px solid ${T.border};
          border-radius: 3px;
          font-family: monospace;
          font-size: 13px;
          color: ${T.text};
          outline: none;
          margin-top: 6px;
        }
        .ovr-modal-input:focus {
          border-color: ${T.red};
        }
        .ovr-modal-input-label {
          font-size: 10px;
          letter-spacing: 2px;
          color: ${T.muted};
          font-weight: bold;
        }
        .ovr-modal-footer {
          padding: 12px 16px;
          background: ${T.surface};
          border-top: 1px solid ${T.border};
          display: flex;
          gap: 10px;
          justify-content: flex-end;
        }
        .ovr-modal-btn {
          padding: 8px 16px;
          border-radius: 3px;
          font-size: 10px;
          letter-spacing: 2px;
          font-weight: bold;
          cursor: pointer;
          font-family: 'Futura PT', Futura, sans-serif;
          border: 1px solid ${T.border};
          background: ${T.bg};
          color: ${T.text};
        }
        .ovr-modal-btn.danger {
          background: ${T.red};
          border-color: ${T.red};
          color: #fff;
        }
        .ovr-modal-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }
        .ovr-modal-error {
          background: #f8e8e8;
          border: 1px solid ${T.red};
          color: ${T.red};
          padding: 10px;
          border-radius: 3px;
          font-size: 11px;
          font-family: monospace;
          margin-top: 10px;
        }
        .ovr-modal-result {
          background: #e8f4e8;
          border: 1px solid ${T.green};
          color: ${T.text};
          padding: 10px;
          border-radius: 3px;
          font-size: 11px;
          font-family: monospace;
          margin-top: 10px;
          white-space: pre-wrap;
          word-break: break-word;
        }
        @media (max-width: 700px) {
          .ovr-row-main {
            grid-template-columns: 1fr auto;
            gap: 8px;
          }
          .ovr-row-main .ovr-leadcount,
          .ovr-row-main .ovr-joindate { display: none; }
        }
      `}</style>

      <div className="ovr-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, fontWeight: 'bold', letterSpacing: 4, color: T.blue }}>
            USER OVERVIEW
          </span>
          <span style={{ fontSize: 10, fontFamily: 'monospace', color: '#8888aa', letterSpacing: 1 }}>
            {filtered.length === users.length
              ? `${users.length.toLocaleString()} TOTAL`
              : `${filtered.length} OF ${users.length} TOTAL`}
          </span>
          {counts.online > 0 && (
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 10,
              letterSpacing: 2,
              color: T.blue,
              fontWeight: 'bold',
            }}>
              <span style={{
                width: 6, height: 6, borderRadius: '50%',
                background: T.blue, boxShadow: `0 0 4px ${T.blue}`,
              }} />
              {counts.online} ONLINE
            </span>
          )}
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            fontSize: 9, letterSpacing: 1.5, color: T.muted, fontFamily: 'monospace',
          }}>
            <span style={{
              width: 5, height: 5, borderRadius: '50%', background: T.green,
              animation: 'pulse-blue 2s ease-in-out infinite',
            }} />
            SYNCED {Math.max(0, Math.round((Date.now() - lastSynced) / 1000))}S AGO
          </span>
        </div>
      </div>

      <div className="ovr-controls">
        <div className="ovr-pills">
          <button className={`ovr-pill ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>
            ALL · {counts.all}
          </button>
          <button className={`ovr-pill ${filter === 'active' ? 'active' : ''}`} onClick={() => setFilter('active')}>
            ACTIVE · {counts.active}
          </button>
          <button className={`ovr-pill ${filter === 'inactive' ? 'active' : ''}`} onClick={() => setFilter('inactive')}>
            INACTIVE · {counts.inactive}
          </button>
        </div>
        <input
          className="ovr-search"
          placeholder="Search name or email..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select
          className="ovr-sort"
          value={sortMode}
          onChange={e => setSortMode(e.target.value as typeof sortMode)}
          aria-label="Sort users"
        >
          <option value="joined_new">Newest joined</option>
          <option value="joined_old">Oldest joined</option>
          <option value="active_first">Most active first</option>
          <option value="name">Name A–Z</option>
        </select>
      </div>

      <div className="ovr-list">
        {loading && users.length === 0 && (
          <div style={{ padding: 40, textAlign: 'center', fontSize: 11, letterSpacing: 3, color: T.muted }}>
            LOADING...
          </div>
        )}

        {error && (
          <div style={{
            padding: 20, textAlign: 'center', fontSize: 12, letterSpacing: 2, color: T.red,
            background: '#f8e8e8', border: `1px solid ${T.red}`, borderRadius: 4,
          }}>
            {error}
          </div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <div style={{ padding: 40, textAlign: 'center', fontSize: 11, letterSpacing: 3, color: T.muted }}>
            NO USERS MATCH
          </div>
        )}

        {filtered.map(u => {
          const expanded = expandedId === u.clerk_id
          const fullName = `${u.first_name || ''} ${u.last_name || ''}`.trim() || '(no name)'
          const inactiveDays = daysSince(u.last_active_at)
          const userOnline = isOnline(u.last_seen_at)

          return (
            <div key={u.clerk_id} className={`ovr-row ${expanded ? 'expanded' : ''}`}>
              <div
                className="ovr-row-main"
                onClick={() => setExpandedId(expanded ? null : u.clerk_id)}
              >
                <div style={{ minWidth: 0 }}>
                  <div className="ovr-name">
                    {fullName}
                    {u.is_admin && (
                      <span style={{
                        marginLeft: 8, fontSize: 8, letterSpacing: 2, padding: '2px 6px',
                        background: 'rgba(74,158,255,0.12)', color: T.blue,
                        border: `1px solid ${T.blue}`, borderRadius: 2,
                      }}>ADMIN</span>
                    )}
                  </div>
                  <div className="ovr-email">{u.email}</div>
                </div>
                <div className="ovr-leadcount" style={{
                  fontFamily: 'monospace', fontSize: 11, color: T.muted, whiteSpace: 'nowrap',
                }}>
                  {u.lead_count.toLocaleString()} LEADS
                </div>
                <div className="ovr-joindate" style={{
                  fontFamily: 'monospace', fontSize: 11, color: T.muted, whiteSpace: 'nowrap',
                }}>
                  {timeAgo(u.created_at)}
                </div>
                <div className="ovr-status-stack">
                  <span className={`ovr-pill-status ${u.is_active_subscription ? 'active' : 'inactive'}`}>
                    <span className={`ovr-status-dot ${u.is_active_subscription ? 'green' : 'gray'}`} />
                    {u.is_active_subscription ? 'ACTIVE' : 'INACTIVE'}
                  </span>
                  {userOnline && (
                    <span className="ovr-pill-status online">
                      <span className="ovr-status-dot blue" />
                      ONLINE
                    </span>
                  )}
                </div>
              </div>

              {expanded && (
                <>
                  <div className="ovr-detail">
                    <div className="ovr-detail-cell">
                      <div className="ovr-detail-label">EMAIL</div>
                      <div className="ovr-detail-value" style={{ fontSize: 11 }}>{u.email}</div>
                    </div>
                    <div className="ovr-detail-cell">
                      <div className="ovr-detail-label">JOINED</div>
                      <div className="ovr-detail-value">{formatDate(u.created_at)}</div>
                    </div>
                    <div className="ovr-detail-cell">
                      <div className="ovr-detail-label">LEADS</div>
                      <div className="ovr-detail-value">{u.lead_count.toLocaleString()}</div>
                    </div>
                    <div className="ovr-detail-cell">
                      <div className="ovr-detail-label">LAST ACTIVE</div>
                      <div className="ovr-detail-value" style={{
                        color: !u.last_active_at ? T.muted
                          : inactiveDays > 14 ? T.red
                          : inactiveDays > 7 ? T.amber
                          : T.green,
                      }}>
                        {timeAgo(u.last_active_at)}
                      </div>
                    </div>
                    <div className="ovr-detail-cell">
                      <div className="ovr-detail-label">SUBSCRIPTION</div>
                      <div className="ovr-detail-value" style={{
                        color: u.is_active_subscription ? T.green : T.muted, fontSize: 11,
                      }}>
                        {u.subscription
                          ? (
                            <>
                              {u.subscription.plan === 'wl' ? 'MANAGER+' : u.subscription.plan === 'pro' ? 'PRO' : 'PLAN UNKNOWN'}
                              {' · '}
                              {u.subscription.status.toUpperCase()}
                              {u.subscription.cancel_at_period_end ? ' · CANCEL PENDING' : ''}
                              {u.subscription.subscribed_since && (
                                <div style={{ color: T.muted, fontSize: 10, marginTop: 2 }}>
                                  {u.subscription.status === 'canceled' ? 'was subscribed for ' : 'subscribed for '}
                                  {tenure(u.subscription.subscribed_since)}
                                </div>
                              )}
                            </>
                          )
                          : 'NONE'}
                      </div>
                    </div>
                    <div className="ovr-detail-cell">
                      <div className="ovr-detail-label">TEAM MEMBERS</div>
                      <div className="ovr-detail-value" style={{
                        color: u.team_member_count > 0 ? T.blue : T.muted,
                      }}>
                        {u.team_member_count > 0
                          ? `${u.team_member_count} (see Teams app)`
                          : '0'}
                      </div>
                    </div>
                  </div>

                  <div className="ovr-danger-zone">
                    <span className="ovr-danger-label">
                      DANGER ZONE{u.is_admin ? ' · ADMIN PROTECTED' : ''}
                    </span>
                    <button
                      className="ovr-danger-btn"
                      disabled={u.is_admin}
                      title={u.is_admin ? 'Admin accounts cannot be deleted from this UI' : 'Delete this user permanently'}
                      onClick={(e) => {
                        e.stopPropagation()
                        if (u.is_admin) return
                        openDeleteModal(u)
                      }}
                    >
                      DELETE
                    </button>
                  </div>
                </>
              )}
            </div>
          )
        })}
      </div>

      {deletingUser && (
        <div className="ovr-modal-backdrop" onClick={closeDeleteModal}>
          <div className="ovr-modal" onClick={e => e.stopPropagation()}>
            <div className="ovr-modal-header">
              {deleteResult ? 'DELETION COMPLETE' : 'PERMANENTLY DELETE USER'}
            </div>
            <div className="ovr-modal-body">
              {!deleteResult && (
                <>
                  <div className="ovr-modal-warning">
                    You are about to permanently delete{' '}
                    <strong style={{ fontFamily: 'monospace' }}>{deletingUser.email}</strong>.
                    This will remove:
                    <ul className="ovr-modal-list">
                      <li>Clerk account (sign-in identity)</li>
                      <li>Stripe customer + all subscriptions (canceled first)</li>
                      <li>All campaigns, scripts, leads, and calls</li>
                      <li>Team memberships and owned teams</li>
                      <li>Subscription history and data-preserved flag</li>
                    </ul>
                    <div style={{ marginTop: 10, fontWeight: 'bold' }}>
                      This action cannot be undone.
                    </div>
                  </div>

                  <label className="ovr-modal-input-label">
                    TYPE &quot;DELETE&quot; TO CONFIRM
                  </label>
                  <input
                    className="ovr-modal-input"
                    autoFocus
                    value={deleteConfirmText}
                    onChange={e => setDeleteConfirmText(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && canExecuteDelete) executeDelete()
                    }}
                    placeholder="delete"
                    disabled={deleteInFlight}
                  />

                  {deleteError && (
                    <div className="ovr-modal-error">{deleteError}</div>
                  )}
                </>
              )}

              {deleteResult && (
                <div className="ovr-modal-result">
                  {`Stripe subscriptions canceled: ${deleteResult.stripe.subscriptionsCanceled}
Stripe customer deleted: ${deleteResult.stripe.customerDeleted}
${deleteResult.stripe.error ? `Stripe error: ${deleteResult.stripe.error}\n` : ''}Clerk deleted: ${deleteResult.clerk.deleted}
${deleteResult.clerk.error ? `Clerk error: ${deleteResult.clerk.error}\n` : ''}
Supabase rows removed:
  users: ${deleteResult.supabase.users}
  subscriptions: ${deleteResult.supabase.subscriptions}
  campaigns: ${deleteResult.supabase.campaigns}
  campaign_scripts: ${deleteResult.supabase.campaign_scripts}
  leads: ${deleteResult.supabase.leads}
  calls: ${deleteResult.supabase.calls}
  team_members: ${deleteResult.supabase.team_members}
  teams: ${deleteResult.supabase.teams}
  data_preserved_users: ${deleteResult.supabase.data_preserved_users}
${deleteResult.supabase.errors.length > 0 ? `\nSupabase errors:\n  ${deleteResult.supabase.errors.join('\n  ')}` : ''}`}
                </div>
              )}
            </div>
            <div className="ovr-modal-footer">
              {!deleteResult ? (
                <>
                  <button
                    className="ovr-modal-btn"
                    onClick={closeDeleteModal}
                    disabled={deleteInFlight}
                  >
                    CANCEL
                  </button>
                  <button
                    className="ovr-modal-btn danger"
                    onClick={executeDelete}
                    disabled={!canExecuteDelete}
                  >
                    {deleteInFlight ? 'DELETING...' : 'DELETE PERMANENTLY'}
                  </button>
                </>
              ) : (
                <button
                  className="ovr-modal-btn"
                  onClick={closeDeleteModal}
                >
                  CLOSE
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}