'use client'
import { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts'

// ─────────────────────────────────────────────────────────────────────────
// A deliberately different visual language from the rest of the admin
// desktop: system sans-serif (not Futura), light neutral surface, a single
// violet accent, soft rounded cards. No terminal/CRT/OS-chrome styling.
// ─────────────────────────────────────────────────────────────────────────

const FONT = '-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, sans-serif'

const C = {
  bg: '#f7f7f9',
  card: '#ffffff',
  border: '#e8e8ee',
  borderSoft: '#f0f0f4',
  ink: '#14151a',
  muted: '#7a7d89',
  faint: '#a8aab4',
  accent: '#6d5bf7',
  accentSoft: 'rgba(109, 91, 247, 0.1)',
  accentSoft2: 'rgba(109, 91, 247, 0.06)',
  green: '#17a673',
  greenSoft: 'rgba(23, 166, 115, 0.1)',
  amber: '#c98a1a',
  red: '#e0463f',
}

type RangeKey = 'today' | 'week' | 'all'
type DetailRangeKey = 'today' | 'week' | 'month30' | 'all'

interface BucketStats {
  calls: number
  dialSeconds: number
  connectedCalls: number
  connectedSeconds: number
}

interface UserRow {
  clerk_id: string
  email: string
  first_name: string | null
  last_name: string | null
  created_at: string
  last_seen_at: string | null
  stats: { today: BucketStats; week: BucketStats; month30: BucketStats; all: BucketStats }
}

interface OverviewBlock {
  totals: BucketStats
  activeUsers: number
  totalUsers: number
  avgCallsPerActiveUser: number
  avgDialSecondsPerActiveUser: number
  avgConnectedSecondsPerActiveUser: number
}

interface SeriesPoint {
  date: string
  calls: number
  dialSeconds: number
  connectedSeconds: number
  activeUsers: number
  avgCallsPerActiveUser: number
}

interface ApiResponse {
  success: boolean
  generatedAt: string
  overview: {
    today: OverviewBlock
    week: OverviewBlock
    month30: OverviewBlock
    all: OverviewBlock
    series: SeriesPoint[]
  }
  users: UserRow[]
}

const SYNC_MS = 10_000

function fmtDuration(totalSeconds: number): string {
  if (!totalSeconds || totalSeconds <= 0) return '0m'
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = Math.floor(totalSeconds % 60)
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

function fmtNum(n: number): string {
  return n.toLocaleString()
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function fmtDayShort(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function nameFor(u: UserRow): string {
  const full = `${u.first_name || ''} ${u.last_name || ''}`.trim()
  return full || u.email?.split('@')[0] || 'Unknown'
}

function initials(u: UserRow): string {
  const full = nameFor(u)
  const parts = full.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return full.slice(0, 2).toUpperCase()
}

const RANGE_LABEL: Record<RangeKey, string> = { today: 'Today', week: 'This Week', all: 'All Time' }
const DETAIL_LABEL: Record<DetailRangeKey, string> = {
  today: 'Today', week: 'This Week', month30: 'Last 30 Days', all: 'All Time',
}

type SortKey = 'calls' | 'dialSeconds' | 'connectedSeconds' | 'avgCall'
type StatusFilter = 'all' | 'active' | 'inactive'

export default function UserTrackerApp() {
  const [data, setData] = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [range, setRange] = useState<RangeKey>('week')
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('calls')
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [lastSynced, setLastSynced] = useState<number>(() => Date.now())
  const [nowTick, setNowTick] = useState(() => Date.now())
  const inFlight = useRef(false)

  const load = useCallback(async () => {
    if (inFlight.current) return
    inFlight.current = true
    try {
      const r = await fetch('/api/admin/user-tracker', { cache: 'no-store' })
      const d = await r.json()
      if (d.success) {
        setData(d)
        setLastSynced(Date.now())
        setError(null)
      } else {
        setError(d.error || 'Failed to load')
      }
    } catch (e: any) {
      setError(e?.message || 'Network error')
    } finally {
      setLoading(false)
      inFlight.current = false
    }
  }, [])

  // initial load + auto-sync every 10s, no cron — plain client polling
  useEffect(() => {
    load()
    const id = setInterval(load, SYNC_MS)
    return () => clearInterval(id)
  }, [load])

  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const users = data?.users ?? []

  const rows = useMemo(() => {
    let list = users.map(u => {
      const b = u.stats[range]
      const avgCall = b.calls > 0 ? b.dialSeconds / b.calls : 0
      const isActiveNow = !!u.last_seen_at && Date.now() - new Date(u.last_seen_at).getTime() < 15 * 60_000
      return { u, b, avgCall, isActiveNow }
    })

    if (statusFilter === 'active') list = list.filter(r => r.b.calls > 0)
    else if (statusFilter === 'inactive') list = list.filter(r => r.b.calls === 0)

    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(r =>
        r.u.email.toLowerCase().includes(q) || nameFor(r.u).toLowerCase().includes(q)
      )
    }

    const dir = sortDir === 'desc' ? -1 : 1
    list.sort((a, b) => {
      let av = 0, bv = 0
      if (sortKey === 'calls') { av = a.b.calls; bv = b.b.calls }
      else if (sortKey === 'dialSeconds') { av = a.b.dialSeconds; bv = b.b.dialSeconds }
      else if (sortKey === 'connectedSeconds') { av = a.b.connectedSeconds; bv = b.b.connectedSeconds }
      else { av = a.avgCall; bv = b.avgCall }
      return (av - bv) * dir
    })
    return list
  }, [users, range, search, sortKey, sortDir, statusFilter])

  const selected = useMemo(() => users.find(u => u.clerk_id === selectedId) || null, [users, selectedId])

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => (d === 'desc' ? 'asc' : 'desc'))
    else { setSortKey(key); setSortDir('desc') }
  }

  const ov = data?.overview[range]
  const series = data?.overview.series ?? []

  const syncedAgo = Math.max(0, Math.round((nowTick - lastSynced) / 1000))

  return (
    <div className="ut-root">
      <style>{`
        .ut-root {
          width: 100%; height: 100%; overflow: hidden; display: flex; flex-direction: column;
          background: ${C.bg}; font-family: ${FONT}; color: ${C.ink}; position: relative;
        }
        .ut-scroll { flex: 1; overflow-y: auto; }
        .ut-header {
          padding: 20px 24px 16px; background: ${C.card}; border-bottom: 1px solid ${C.border};
          display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; flex-wrap: wrap;
        }
        .ut-title { font-size: 19px; font-weight: 700; letter-spacing: -0.3px; color: ${C.ink}; }
        .ut-subtitle { font-size: 12.5px; color: ${C.muted}; margin-top: 3px; }
        .ut-sync {
          display: flex; align-items: center; gap: 6px; font-size: 11px; color: ${C.muted};
          background: ${C.borderSoft}; padding: 5px 10px 5px 8px; border-radius: 20px; white-space: nowrap;
        }
        .ut-sync-dot {
          width: 6px; height: 6px; border-radius: 50%; background: ${C.green};
          animation: ut-pulse 2s ease-in-out infinite;
        }
        @keyframes ut-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }
        .ut-body { padding: 20px 24px 32px; }
        .ut-segmented {
          display: inline-flex; background: ${C.borderSoft}; border-radius: 10px; padding: 3px; gap: 2px;
        }
        .ut-seg-btn {
          border: none; background: transparent; padding: 7px 14px; border-radius: 8px;
          font-family: ${FONT}; font-size: 12.5px; font-weight: 600; color: ${C.muted}; cursor: pointer;
          transition: background 0.12s, color 0.12s;
        }
        .ut-seg-btn.active { background: ${C.card}; color: ${C.ink}; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
        .ut-kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin: 18px 0; }
        .ut-kpi {
          background: ${C.card}; border: 1px solid ${C.border}; border-radius: 14px; padding: 16px;
        }
        .ut-kpi-label { font-size: 10.5px; font-weight: 700; letter-spacing: 0.5px; color: ${C.faint}; text-transform: uppercase; }
        .ut-kpi-value { font-size: 22px; font-weight: 700; color: ${C.ink}; margin-top: 6px; letter-spacing: -0.4px; }
        .ut-kpi-sub { font-size: 11px; color: ${C.muted}; margin-top: 3px; }
        .ut-chart-card {
          background: ${C.card}; border: 1px solid ${C.border}; border-radius: 16px; padding: 18px 18px 8px; margin-bottom: 20px;
        }
        .ut-chart-head { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 4px; flex-wrap: wrap; gap: 6px; }
        .ut-chart-title { font-size: 13.5px; font-weight: 700; color: ${C.ink}; }
        .ut-chart-note { font-size: 11px; color: ${C.muted}; }
        .ut-toolbar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 12px; }
        .ut-search {
          flex: 1; min-width: 180px; padding: 9px 14px; border-radius: 10px; border: 1px solid ${C.border};
          background: ${C.card}; font-family: ${FONT}; font-size: 12.5px; outline: none; color: ${C.ink};
        }
        .ut-search:focus { border-color: ${C.accent}; }
        .ut-pills { display: inline-flex; background: ${C.borderSoft}; border-radius: 10px; padding: 3px; gap: 2px; }
        .ut-pill {
          border: none; background: transparent; padding: 7px 12px; border-radius: 8px; cursor: pointer;
          font-family: ${FONT}; font-size: 12px; font-weight: 600; color: ${C.muted};
        }
        .ut-pill.active { background: ${C.card}; color: ${C.ink}; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
        .ut-table-card { background: ${C.card}; border: 1px solid ${C.border}; border-radius: 16px; overflow: hidden; }
        .ut-row-head, .ut-row {
          display: grid; grid-template-columns: 32px 1fr 100px 110px 130px 100px; gap: 10px; align-items: center;
          padding: 11px 16px;
        }
        .ut-row-head { font-size: 10px; font-weight: 700; color: ${C.faint}; letter-spacing: 0.5px; text-transform: uppercase; border-bottom: 1px solid ${C.border}; }
        .ut-sortable { cursor: pointer; user-select: none; display: flex; align-items: center; gap: 3px; }
        .ut-sortable:hover { color: ${C.ink}; }
        .ut-row {
          border-bottom: 1px solid ${C.borderSoft}; cursor: pointer; transition: background 0.1s;
        }
        .ut-row:last-child { border-bottom: none; }
        .ut-row:hover { background: ${C.accentSoft2}; }
        .ut-rank { font-size: 11px; font-weight: 700; color: ${C.faint}; }
        .ut-rank.top { color: ${C.accent}; }
        .ut-user { display: flex; align-items: center; gap: 10px; min-width: 0; }
        .ut-avatar {
          width: 30px; height: 30px; border-radius: 9px; background: ${C.accentSoft}; color: ${C.accent};
          display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 800; flex-shrink: 0;
        }
        .ut-uname { font-size: 13px; font-weight: 600; color: ${C.ink}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .ut-uemail { font-size: 11px; color: ${C.muted}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .ut-metric { font-size: 12.5px; font-weight: 600; color: ${C.ink}; font-variant-numeric: tabular-nums; }
        .ut-metric-sub { font-size: 10px; color: ${C.muted}; }
        .ut-empty { padding: 48px 20px; text-align: center; color: ${C.muted}; font-size: 13px; }

        .ut-drawer-backdrop {
          position: absolute; inset: 0; background: rgba(20,21,26,0.28); backdrop-filter: blur(1px);
          animation: ut-fade 0.15s ease;
        }
        @keyframes ut-fade { from { opacity: 0; } to { opacity: 1; } }
        .ut-drawer {
          position: absolute; top: 0; right: 0; bottom: 0; width: min(440px, 100%); background: ${C.bg};
          border-left: 1px solid ${C.border}; box-shadow: -12px 0 32px rgba(0,0,0,0.12);
          display: flex; flex-direction: column; animation: ut-slide 0.18s ease;
        }
        @keyframes ut-slide { from { transform: translateX(24px); opacity: 0.4; } to { transform: translateX(0); opacity: 1; } }
        .ut-drawer-head { padding: 20px 20px 16px; background: ${C.card}; border-bottom: 1px solid ${C.border}; }
        .ut-close-btn {
          position: absolute; top: 16px; right: 16px; width: 28px; height: 28px; border-radius: 8px; border: none;
          background: ${C.borderSoft}; color: ${C.muted}; font-size: 14px; cursor: pointer; display: flex;
          align-items: center; justify-content: center;
        }
        .ut-drawer-scroll { flex: 1; overflow-y: auto; padding: 18px 20px 28px; }
        .ut-detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 22px; }
        .ut-detail-card { background: ${C.card}; border: 1px solid ${C.border}; border-radius: 14px; padding: 14px; }
        .ut-detail-range { font-size: 10px; font-weight: 700; letter-spacing: 0.5px; color: ${C.accent}; text-transform: uppercase; margin-bottom: 8px; }
        .ut-detail-line { display: flex; justify-content: space-between; align-items: baseline; padding: 3px 0; }
        .ut-detail-key { font-size: 11px; color: ${C.muted}; }
        .ut-detail-val { font-size: 12.5px; font-weight: 700; color: ${C.ink}; font-variant-numeric: tabular-nums; }

        @media (max-width: 640px) {
          .ut-row-head { display: none; }
          .ut-row { grid-template-columns: 1fr; gap: 4px; padding: 14px 16px; }
          .ut-row > *:not(.ut-user) { display: none; }
          .ut-row::after {
            content: attr(data-summary); font-size: 11.5px; color: ${C.muted}; margin-top: 2px; font-variant-numeric: tabular-nums;
          }
          .ut-detail-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      <div className="ut-header">
        <div>
          <div className="ut-title">User Tracker</div>
          <div className="ut-subtitle">Usage analytics across every DialerSeat account</div>
        </div>
        <div className="ut-sync">
          <span className="ut-sync-dot" />
          synced {syncedAgo <= 1 ? 'just now' : `${syncedAgo}s ago`}
        </div>
      </div>

      <div className="ut-scroll">
        <div className="ut-body">
          {error && (
            <div style={{ marginBottom: 16, padding: 12, borderRadius: 10, background: '#fdecea', color: C.red, fontSize: 12 }}>
              {error}
            </div>
          )}

          <div className="ut-segmented" role="tablist">
            {(['today', 'week', 'all'] as RangeKey[]).map(r => (
              <button
                key={r}
                className={`ut-seg-btn ${range === r ? 'active' : ''}`}
                onClick={() => setRange(r)}
              >
                {RANGE_LABEL[r]}
              </button>
            ))}
          </div>

          {loading && !data ? (
            <div className="ut-empty">Loading usage data…</div>
          ) : (
            <>
              <div className="ut-kpis">
                <div className="ut-kpi">
                  <div className="ut-kpi-label">Total Calls</div>
                  <div className="ut-kpi-value">{fmtNum(ov?.totals.calls ?? 0)}</div>
                  <div className="ut-kpi-sub">{RANGE_LABEL[range]}</div>
                </div>
                <div className="ut-kpi">
                  <div className="ut-kpi-label">Time Dialed</div>
                  <div className="ut-kpi-value">{fmtDuration(ov?.totals.dialSeconds ?? 0)}</div>
                  <div className="ut-kpi-sub">across all users</div>
                </div>
                <div className="ut-kpi">
                  <div className="ut-kpi-label">Time Connected</div>
                  <div className="ut-kpi-value">{fmtDuration(ov?.totals.connectedSeconds ?? 0)}</div>
                  <div className="ut-kpi-sub">{fmtNum(ov?.totals.connectedCalls ?? 0)} connected calls</div>
                </div>
                <div className="ut-kpi">
                  <div className="ut-kpi-label">Avg / Active User</div>
                  <div className="ut-kpi-value">{ov?.avgCallsPerActiveUser ?? 0}</div>
                  <div className="ut-kpi-sub">calls · {ov?.activeUsers ?? 0} of {ov?.totalUsers ?? 0} active</div>
                </div>
              </div>

              <div className="ut-chart-card">
                <div className="ut-chart-head">
                  <div className="ut-chart-title">Platform activity — last 30 days</div>
                  <div className="ut-chart-note">Overview average across all DialerSeat usage</div>
                </div>
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={series} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}>
                    <defs>
                      <linearGradient id="utCallsGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={C.accent} stopOpacity={0.28} />
                        <stop offset="100%" stopColor={C.accent} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke={C.borderSoft} vertical={false} />
                    <XAxis
                      dataKey="date"
                      tickFormatter={fmtDayShort}
                      tick={{ fontSize: 10, fill: C.faint }}
                      axisLine={false} tickLine={false}
                      interval={Math.max(0, Math.floor(series.length / 6) - 1)}
                    />
                    <YAxis tick={{ fontSize: 10, fill: C.faint }} axisLine={false} tickLine={false} width={30} allowDecimals={false} />
                    <Tooltip
                      labelFormatter={(label: any) => fmtDayShort(String(label ?? ''))}
                      formatter={(value: any, name: any) => {
                        if (name === 'calls') return [fmtNum(value as number), 'Calls']
                        if (name === 'avgCallsPerActiveUser') return [value, 'Avg / active user']
                        return [value, name]
                      }}
                      contentStyle={{ borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 12, fontFamily: FONT }}
                    />
                    <Area type="monotone" dataKey="calls" stroke={C.accent} strokeWidth={2} fill="url(#utCallsGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div className="ut-toolbar">
                <input
                  className="ut-search"
                  placeholder="Search by name or email…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
                <div className="ut-pills">
                  {(['all', 'active', 'inactive'] as StatusFilter[]).map(f => (
                    <button
                      key={f}
                      className={`ut-pill ${statusFilter === f ? 'active' : ''}`}
                      onClick={() => setStatusFilter(f)}
                      title={f === 'active' ? `Made ≥1 call ${RANGE_LABEL[range].toLowerCase()}` : f === 'inactive' ? `No calls ${RANGE_LABEL[range].toLowerCase()}` : 'Everyone'}
                    >
                      {f[0].toUpperCase() + f.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="ut-table-card">
                <div className="ut-row-head">
                  <span>#</span>
                  <span>User</span>
                  <span className="ut-sortable" onClick={() => toggleSort('calls')}>
                    Calls {sortKey === 'calls' ? (sortDir === 'desc' ? '↓' : '↑') : ''}
                  </span>
                  <span className="ut-sortable" onClick={() => toggleSort('dialSeconds')}>
                    Dialed {sortKey === 'dialSeconds' ? (sortDir === 'desc' ? '↓' : '↑') : ''}
                  </span>
                  <span className="ut-sortable" onClick={() => toggleSort('connectedSeconds')}>
                    Connected {sortKey === 'connectedSeconds' ? (sortDir === 'desc' ? '↓' : '↑') : ''}
                  </span>
                  <span className="ut-sortable" onClick={() => toggleSort('avgCall')}>
                    Avg/Call {sortKey === 'avgCall' ? (sortDir === 'desc' ? '↓' : '↑') : ''}
                  </span>
                </div>

                {rows.length === 0 && (
                  <div className="ut-empty">
                    {search.trim() ? 'No users match your search.' : 'No usage recorded for this range yet.'}
                  </div>
                )}

                {rows.map((r, idx) => (
                  <div
                    key={r.u.clerk_id}
                    className="ut-row"
                    onClick={() => setSelectedId(r.u.clerk_id)}
                    data-summary={`${fmtNum(r.b.calls)} calls · ${fmtDuration(r.b.dialSeconds)} dialed · ${fmtDuration(r.b.connectedSeconds)} connected`}
                  >
                    <span className={`ut-rank ${idx < 3 && r.b.calls > 0 ? 'top' : ''}`}>{idx + 1}</span>
                    <div className="ut-user">
                      <div className="ut-avatar">{initials(r.u)}</div>
                      <div style={{ minWidth: 0 }}>
                        <div className="ut-uname">{nameFor(r.u)}</div>
                        <div className="ut-uemail">{r.u.email}</div>
                      </div>
                    </div>
                    <div className="ut-metric">{fmtNum(r.b.calls)}</div>
                    <div>
                      <div className="ut-metric">{fmtDuration(r.b.dialSeconds)}</div>
                    </div>
                    <div>
                      <div className="ut-metric">{fmtDuration(r.b.connectedSeconds)}</div>
                      <div className="ut-metric-sub">{r.b.connectedCalls} calls</div>
                    </div>
                    <div className="ut-metric">{r.avgCall > 0 ? fmtDuration(r.avgCall) : '—'}</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {selected && (
        <div className="ut-drawer-backdrop" onClick={() => setSelectedId(null)}>
          <div className="ut-drawer" onClick={e => e.stopPropagation()}>
            <div className="ut-drawer-head" style={{ position: 'relative' }}>
              <button className="ut-close-btn" onClick={() => setSelectedId(null)} aria-label="Close">✕</button>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div className="ut-avatar" style={{ width: 42, height: 42, borderRadius: 12, fontSize: 14 }}>
                  {initials(selected)}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 700 }}>{nameFor(selected)}</div>
                  <div style={{ fontSize: 12, color: C.muted }}>{selected.email}</div>
                </div>
              </div>
              <div style={{ marginTop: 12, fontSize: 11, color: C.muted }}>
                Joined {fmtDate(selected.created_at)}
              </div>
            </div>

            <div className="ut-drawer-scroll">
              <div className="ut-detail-grid">
                {(['today', 'week', 'month30', 'all'] as DetailRangeKey[]).map(dr => {
                  const b = selected.stats[dr]
                  const avg = b.calls > 0 ? b.dialSeconds / b.calls : 0
                  return (
                    <div key={dr} className="ut-detail-card">
                      <div className="ut-detail-range">{DETAIL_LABEL[dr]}</div>
                      <div className="ut-detail-line">
                        <span className="ut-detail-key">Numbers dialed</span>
                        <span className="ut-detail-val">{fmtNum(b.calls)}</span>
                      </div>
                      <div className="ut-detail-line">
                        <span className="ut-detail-key">Time dialed</span>
                        <span className="ut-detail-val">{fmtDuration(b.dialSeconds)}</span>
                      </div>
                      <div className="ut-detail-line">
                        <span className="ut-detail-key">Time connected</span>
                        <span className="ut-detail-val">{fmtDuration(b.connectedSeconds)}</span>
                      </div>
                      <div className="ut-detail-line">
                        <span className="ut-detail-key">Connected calls</span>
                        <span className="ut-detail-val">{fmtNum(b.connectedCalls)}</span>
                      </div>
                      <div className="ut-detail-line">
                        <span className="ut-detail-key">Avg call length</span>
                        <span className="ut-detail-val">{avg > 0 ? fmtDuration(avg) : '—'}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
