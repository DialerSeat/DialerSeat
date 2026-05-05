'use client'
import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'

interface AdminUser {
  clerk_id: string
  email: string
  first_name: string | null
  last_name: string | null
  created_at: string
  is_admin: boolean
  lead_count: number
  campaign_count: number
  team_member_count: number
  subscription: {
    status: string
    current_period_end: string | null
    cancel_at_period_end: boolean
  } | null
  is_active_subscription: boolean
}

type FilterMode = 'all' | 'active' | 'inactive'

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
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function timeAgo(iso: string) {
  const ms = Date.now() - new Date(iso).getTime()
  const days = Math.floor(ms / 86400000)
  if (days === 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 30) return `${days}d ago`
  if (days < 365) return `${Math.floor(days / 30)}mo ago`
  return `${Math.floor(days / 365)}y ago`
}

export default function AdminOverviewPage() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<FilterMode>('all')
  const [search, setSearch] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin/users')
      .then(async r => {
        if (r.status === 403) throw new Error('Forbidden — admin only')
        if (r.status === 401) throw new Error('Not signed in')
        return r.json()
      })
      .then(d => {
        if (d.success) setUsers(d.users)
        else setError(d.error || 'Failed to load')
        setLoading(false)
      })
      .catch(err => {
        setError(err.message)
        setLoading(false)
      })
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
    return list
  }, [users, filter, search])

  const counts = useMemo(() => ({
    all: users.length,
    active: users.filter(u => u.is_active_subscription).length,
    inactive: users.filter(u => !u.is_active_subscription).length,
  }), [users])

  return (
    <div style={{
      flex: 1,
      background: T.bg,
      minHeight: 'calc(100vh - 64px)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
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
        .ovr-status-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }
        .ovr-status-dot.active {
          background: #32ff7e;
          box-shadow: 0 0 6px #32ff7e;
        }
        .ovr-status-dot.inactive {
          background: ${T.muted};
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
        .ovr-detail-value.link {
          color: ${T.blue};
          text-decoration: none;
        }
        .ovr-detail-value.link:hover {
          text-decoration: underline;
        }
        @media (max-width: 600px) {
          .ovr-row-main {
            grid-template-columns: 1fr auto;
            gap: 8px;
          }
          .ovr-row-main .ovr-leadcount,
          .ovr-row-main .ovr-joindate { display: none; }
        }
      `}</style>

      <div className="ovr-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontSize: 11, fontWeight: 'bold', letterSpacing: 4, color: T.blue }}>
            USER OVERVIEW
          </span>
          <span style={{ fontSize: 10, fontFamily: 'monospace', color: '#8888aa', letterSpacing: 1 }}>
            {users.length.toLocaleString()} TOTAL
          </span>
        </div>
      </div>

      <div className="ovr-controls">
        <div className="ovr-pills">
          <button
            className={`ovr-pill ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >ALL · {counts.all}</button>
          <button
            className={`ovr-pill ${filter === 'active' ? 'active' : ''}`}
            onClick={() => setFilter('active')}
          >ACTIVE · {counts.active}</button>
          <button
            className={`ovr-pill ${filter === 'inactive' ? 'active' : ''}`}
            onClick={() => setFilter('inactive')}
          >INACTIVE · {counts.inactive}</button>
        </div>
        <input
          className="ovr-search"
          placeholder="Search name or email..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className="ovr-list">
        {loading && (
          <div style={{ padding: 40, textAlign: 'center', fontSize: 11, letterSpacing: 3, color: T.muted }}>
            LOADING...
          </div>
        )}

        {error && (
          <div style={{
            padding: 20,
            textAlign: 'center',
            fontSize: 12,
            letterSpacing: 2,
            color: T.red,
            background: '#f8e8e8',
            border: `1px solid ${T.red}`,
            borderRadius: 4,
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
                        marginLeft: 8,
                        fontSize: 8,
                        letterSpacing: 2,
                        padding: '2px 6px',
                        background: 'rgba(74,158,255,0.12)',
                        color: T.blue,
                        border: `1px solid ${T.blue}`,
                        borderRadius: 2,
                      }}>ADMIN</span>
                    )}
                  </div>
                  <div className="ovr-email">{u.email}</div>
                </div>
                <div className="ovr-leadcount" style={{
                  fontFamily: 'monospace',
                  fontSize: 11,
                  color: T.muted,
                  whiteSpace: 'nowrap',
                }}>
                  {u.lead_count.toLocaleString()} LEADS
                </div>
                <div className="ovr-joindate" style={{
                  fontFamily: 'monospace',
                  fontSize: 11,
                  color: T.muted,
                  whiteSpace: 'nowrap',
                }}>
                  {timeAgo(u.created_at)}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div className={`ovr-status-dot ${u.is_active_subscription ? 'active' : 'inactive'}`} />
                  <span style={{
                    fontSize: 9,
                    letterSpacing: 2,
                    fontWeight: 'bold',
                    color: u.is_active_subscription ? T.green : T.muted,
                  }}>
                    {u.is_active_subscription ? 'ACTIVE' : 'INACTIVE'}
                  </span>
                </div>
              </div>

              {expanded && (
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
                    <div className="ovr-detail-label">CAMPAIGNS</div>
                    <div className="ovr-detail-value">{u.campaign_count.toLocaleString()}</div>
                  </div>
                  <div className="ovr-detail-cell">
                    <div className="ovr-detail-label">SUBSCRIPTION</div>
                    <div className="ovr-detail-value" style={{
                      color: u.is_active_subscription ? T.green : T.muted,
                      fontSize: 11,
                    }}>
                      {u.subscription
                        ? u.subscription.status.toUpperCase() + (u.subscription.cancel_at_period_end ? ' · CANCEL PENDING' : '')
                        : 'NONE'}
                    </div>
                  </div>
                  <div className="ovr-detail-cell">
                    <div className="ovr-detail-label">TEAM MEMBERS</div>
                    {u.team_member_count > 0 ? (
                      <Link
                        href={`/dashboard/admin/teams?owner=${u.clerk_id}`}
                        className="ovr-detail-value link"
                      >
                        {u.team_member_count} →
                      </Link>
                    ) : (
                      <div className="ovr-detail-value" style={{ color: T.muted }}>0</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}