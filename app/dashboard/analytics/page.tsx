'use client'
import { useState, useEffect, useMemo } from 'react'
import { useUser } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'

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

const DISPOSITION_COLORS: Record<string, string> = {
  'CLOSED': T.green,
  'APPOINTMENT': T.accent,
  'NOT INTERESTED': T.amber,
  'DO NOT CALL': T.red,
  'SKIPPED': '#888',
  'NO ANSWER': '#bbb',
  'NO_ANSWER': '#bbb',
}

type Range = 'today' | 'week' | 'month' | 'all' | 'custom'

function getRangeBounds(range: Range, customStart?: string, customEnd?: string): { start: string | null; end: string | null } {
  if (range === 'all') return { start: null, end: null }
  const now = new Date()

  if (range === 'today') {
    const start = new Date(now); start.setHours(0, 0, 0, 0)
    const end = new Date(now); end.setHours(23, 59, 59, 999)
    return { start: start.toISOString(), end: end.toISOString() }
  }
  if (range === 'week') {
    // Current CALENDAR week — Sunday 00:00 of this week → now.
    // Resets every Sunday at midnight local time.
    // getDay(): 0=Sun, 1=Mon, ..., 6=Sat.
    const start = new Date(now)
    start.setDate(start.getDate() - start.getDay())
    start.setHours(0, 0, 0, 0)
    return { start: start.toISOString(), end: now.toISOString() }
  }
  if (range === 'month') {
    // Current CALENDAR month — 1st 00:00 of this month → now.
    // Resets on the 1st of every month at midnight local time.
    const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0)
    return { start: start.toISOString(), end: now.toISOString() }
  }
  if (range === 'custom') {
    if (!customStart || !customEnd) return { start: null, end: null }
    const start = new Date(customStart); start.setHours(0, 0, 0, 0)
    const end = new Date(customEnd); end.setHours(23, 59, 59, 999)
    return { start: start.toISOString(), end: end.toISOString() }
  }
  return { start: null, end: null }
}

function todayBounds() {
  const now = new Date()
  const start = new Date(now); start.setHours(0, 0, 0, 0)
  const end = new Date(now); end.setHours(23, 59, 59, 999)
  return { start: start.toISOString(), end: end.toISOString() }
}

// Used as the secondary fetch when range='today'. Returns the same calendar
// week as getRangeBounds('week') so the "This week" sub-stats stay aligned
// with whatever the WEEK tab would show.
function weekBounds() {
  const now = new Date()
  const start = new Date(now)
  start.setDate(start.getDate() - start.getDay())
  start.setHours(0, 0, 0, 0)
  return { start: start.toISOString(), end: now.toISOString() }
}

function formatDuration(seconds: number) {
  if (!seconds) return '0s'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

function formatHours(seconds: number) {
  const hours = seconds / 3600
  if (hours >= 10) return `${Math.round(hours)}h`
  if (hours >= 1) return `${hours.toFixed(1)}h`
  if (hours > 0) {
    const m = Math.round(seconds / 60)
    return `${m}m`
  }
  return '0h'
}

function buildEmptySeries(range: Range): any[] {
  const points = range === 'today' ? 12 : 14
  const out: any[] = []
  for (let i = 0; i < points; i++) {
    out.push({
      label: range === 'today' ? `${i * 2}:00` : `D${i + 1}`,
      calls: 0,
      conversionRate: 0,
    })
  }
  return out
}

const EMPTY_DISPOSITIONS = [
  { disposition: 'NO DATA', count: 1 },
]

const EMPTY_CAMPAIGNS = [
  { name: '—', total: 0, contacted: 0, converted: 0 },
]

export default function AnalyticsPage() {
  const { user } = useUser()
  const router = useRouter()
  const [adminChecked, setAdminChecked] = useState(false)
  const [range, setRange] = useState<Range>('week')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [summary, setSummary] = useState<any>(null)
  const [secondarySummary, setSecondarySummary] = useState<any>(null)
  const [series, setSeries] = useState<any[]>([])
  const [dispositions, setDispositions] = useState<any[]>([])
  const [campaigns, setCampaigns] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Admin redirect
  useEffect(() => {
    if (!user) return
    fetch('/api/admin/check')
      .then(r => r.json())
      .then(d => {
        if (d.isAdmin) {
          router.replace('/dashboard/admin/analytics')
        } else {
          setAdminChecked(true)
        }
      })
      .catch(() => setAdminChecked(true))
  }, [user, router])

  const bounds = useMemo(() => getRangeBounds(range, customStart, customEnd), [range, customStart, customEnd])

  // Secondary fetch: when range is 'today', secondary = current calendar WEEK;
  // otherwise, secondary = TODAY.
  const secondaryBounds = useMemo(() => {
    return range === 'today' ? weekBounds() : todayBounds()
  }, [range])

  const secondaryLabel = range === 'today' ? 'This week' : 'Today'

  useEffect(() => {
    if (!user || !adminChecked) return
    if (range === 'custom' && (!customStart || !customEnd)) return

    const params = new URLSearchParams({ user_id: user.id })
    if (bounds.start) params.append('start', bounds.start)
    if (bounds.end) params.append('end', bounds.end)

    const tsParams = new URLSearchParams(params)
    tsParams.append('bucket', range === 'today' ? 'hour' : 'day')

    const secondaryParams = new URLSearchParams({
      user_id: user.id,
      start: secondaryBounds.start,
      end: secondaryBounds.end,
    })

    setLoading(true)
    Promise.all([
      fetch(`/api/analytics/summary?${params}`).then(r => r.json()),
      fetch(`/api/analytics/timeseries?${tsParams}`).then(r => r.json()),
      fetch(`/api/analytics/dispositions?${params}`).then(r => r.json()),
      fetch(`/api/analytics/campaigns?${params}`).then(r => r.json()),
      fetch(`/api/analytics/summary?${secondaryParams}`).then(r => r.json()),
    ]).then(([s, ts, d, c, sec]) => {
      if (s.success) setSummary(s.summary)
      if (ts.success) setSeries(ts.series)
      if (d.success) setDispositions(d.breakdown)
      if (c.success) setCampaigns(c.breakdown)
      if (sec.success) setSecondarySummary(sec.summary)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [user, adminChecked, range, customStart, customEnd, bounds.start, bounds.end, secondaryBounds.start, secondaryBounds.end])

  const ranges: { key: Range; label: string }[] = [
    { key: 'today', label: 'TODAY' },
    { key: 'week', label: 'WEEK' },
    { key: 'month', label: 'MONTH' },
    { key: 'all', label: 'ALL TIME' },
    { key: 'custom', label: 'CUSTOM' },
  ]

  const s = summary || {
    totalCalls: 0,
    contactsReached: 0,
    contactRate: 0,
    conversions: 0,
    conversionRate: 0,
    closed: 0,
    appointments: 0,
    totalDuration: 0,
    avgCallLength: 0,
    bestCampaign: null,
    bestCampaignRate: 0,
  }

  const sec = secondarySummary || {
    totalCalls: 0,
    totalDuration: 0,
    conversions: 0,
    closed: 0,
  }

  const hasData = !!summary && summary.totalCalls > 0
  const seriesToRender = series.length > 0 ? series : buildEmptySeries(range)
  const dispositionsToRender = dispositions.length > 0 ? dispositions : EMPTY_DISPOSITIONS
  const campaignsToRender = campaigns.length > 0 ? campaigns : EMPTY_CAMPAIGNS

  const fullName = user
    ? [user.firstName, user.lastName].filter(Boolean).join(' ').toUpperCase()
    : ''

  if (!adminChecked) {
    return (
      <div style={{
        flex: 1, background: T.bg,
        minHeight: 'calc(100vh - 64px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 11, letterSpacing: 3, color: T.muted,
      }}>LOADING...</div>
    )
  }

  return (
    <div className="analytics-root" style={{
      flex: 1,
      background: T.bg,
      minHeight: 'calc(100vh - 64px)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'auto',
    }}>
      <style>{`
        .analytics-root * { box-sizing: border-box; }
        .analytics-header {
          background: ${T.dark};
          padding: 12px 20px;
          border-bottom: 2px solid ${T.accent};
          display: flex;
          align-items: center;
          gap: 16px;
          flex-wrap: wrap;
        }
        /* Pushes the LANDING PAGE button to the far right of the header bar */
        .analytics-header-spacer { flex: 1 1 auto; }
        .landing-page-btn {
          padding: 6px 14px;
          background: rgba(74,158,255,0.08);
          border: 1px solid ${T.blue};
          border-radius: 4px;
          font-size: 10px;
          letter-spacing: 2px;
          color: ${T.blue};
          cursor: pointer;
          font-family: 'Futura PT', Futura, sans-serif;
          font-weight: bold;
          text-decoration: none;
          transition: background 0.15s;
          white-space: nowrap;
        }
        .landing-page-btn:hover {
          background: rgba(74,158,255,0.18);
        }
        .welcome-row {
          background: ${T.bg};
          padding: 18px 20px 4px;
        }
        .welcome-line {
          font-size: 18px;
          font-weight: bold;
          color: ${T.text};
          letter-spacing: 2px;
          font-family: 'Futura PT', Futura, sans-serif;
        }
        .range-tabs { display: flex; gap: 4px; flex-wrap: wrap; }
        .range-tab {
          padding: 6px 14px;
          background: transparent;
          border: 1px solid #4a4a5e;
          border-radius: 3px;
          font-size: 10px;
          letter-spacing: 2px;
          color: #8888aa;
          cursor: pointer;
          font-family: 'Futura PT', Futura, sans-serif;
          font-weight: bold;
        }
        .range-tab.active {
          background: ${T.blue};
          border-color: ${T.blue};
          color: white;
        }
        .custom-range { display: flex; gap: 6px; align-items: center; }
        .custom-range input {
          padding: 4px 8px;
          background: #2a2a3e;
          border: 1px solid #4a4a5e;
          border-radius: 3px;
          color: white;
          font-size: 11px;
          font-family: monospace;
        }
        .stat-grid {
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: 8px;
          padding: 16px;
        }
        .stat-card {
          padding: 12px 14px;
          background: ${T.surface};
          border: 1px solid ${T.border};
          border-radius: 4px;
          border-top: 3px solid ${T.blue};
          position: relative;
        }
        .stat-card.empty { opacity: 0.55; }
        .stat-label {
          font-size: 9px;
          letter-spacing: 2px;
          color: ${T.muted};
          margin-bottom: 6px;
          font-weight: bold;
        }
        .stat-value {
          font-size: 22px;
          font-weight: bold;
          font-family: monospace;
          color: ${T.text};
          letter-spacing: -0.5px;
        }
        .stat-sub {
          font-size: 10px;
          color: ${T.muted};
          margin-top: 4px;
          font-family: monospace;
        }
        .charts-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          padding: 0 16px 16px;
        }
        .chart-card {
          background: ${T.surface};
          border: 1px solid ${T.border};
          border-radius: 4px;
          padding: 14px;
          position: relative;
        }
        .chart-title {
          font-size: 10px;
          letter-spacing: 3px;
          color: ${T.muted};
          margin-bottom: 12px;
          font-weight: bold;
        }
        .chart-empty-overlay {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          pointer-events: none;
          z-index: 2;
        }
        .chart-empty-pill {
          background: rgba(26, 26, 46, 0.85);
          color: white;
          font-size: 10px;
          letter-spacing: 3px;
          font-weight: bold;
          padding: 8px 18px;
          border-radius: 4px;
          font-family: 'Futura PT', Futura, sans-serif;
        }
        .chart-faded { opacity: 0.35; }
        .empty-state {
          padding: 60px 20px;
          text-align: center;
          font-size: 11px;
          letter-spacing: 3px;
          color: ${T.muted};
        }

        @media (max-width: 768px) {
          .analytics-header { padding: 10px 12px; }
          .welcome-row { padding: 14px 12px 4px; }
          .welcome-line { font-size: 15px; letter-spacing: 1px; }
          .range-tab { padding: 6px 10px; font-size: 9px; letter-spacing: 1px; }
          .landing-page-btn { padding: 5px 10px; font-size: 9px; letter-spacing: 1.5px; }
          .stat-grid {
            grid-template-columns: repeat(2, 1fr) !important;
            padding: 12px;
            gap: 8px;
          }
          .stat-card { padding: 10px; }
          .stat-value { font-size: 18px; }
          .charts-grid {
            grid-template-columns: 1fr !important;
            padding: 0 12px 12px;
          }
          .custom-range { flex-wrap: wrap; }
        }
      `}</style>

      <div className="analytics-header">
        <span style={{ fontSize: 11, fontWeight: 'bold', letterSpacing: 4, color: T.blue }}>
          ANALYTICS OVERVIEW
        </span>
        <div className="range-tabs">
          {ranges.map(r => (
            <button
              key={r.key}
              className={`range-tab ${range === r.key ? 'active' : ''}`}
              onClick={() => setRange(r.key)}
            >{r.label}</button>
          ))}
        </div>
        {range === 'custom' && (
          <div className="custom-range">
            <input
              type="date"
              value={customStart}
              onChange={e => setCustomStart(e.target.value)}
            />
            <span style={{ color: '#8888aa', fontSize: 10 }}>→</span>
            <input
              type="date"
              value={customEnd}
              onChange={e => setCustomEnd(e.target.value)}
            />
          </div>
        )}

        {/* Pushes the LANDING PAGE button to the right edge */}
        <div className="analytics-header-spacer" />

        {/*
          LANDING PAGE button — links to landing with ?view=landing param.
          Without that param, app/page.tsx would redirect us right back to
          /dashboard because logged-in users normally get sent there.
          The param tells page.tsx "render the landing for this visit".
        */}
        <Link href="/?view=landing" className="landing-page-btn">
          LANDING PAGE →
        </Link>
      </div>

      <div className="welcome-row">
        <div className="welcome-line">
          WELCOME BACK{fullName ? `, ${fullName}` : ''}.
        </div>
      </div>

      {loading ? (
        <div className="empty-state">LOADING ANALYTICS...</div>
      ) : (
        <>
          <div className="stat-grid">
            <div className={`stat-card ${!hasData ? 'empty' : ''}`}>
              <div className="stat-label">TOTAL CALLS</div>
              <div className="stat-value">{(s.totalCalls || 0).toLocaleString()}</div>
              <div className="stat-sub">{secondaryLabel} {(sec.totalCalls || 0).toLocaleString()}</div>
            </div>
            <div className={`stat-card ${!hasData ? 'empty' : ''}`} style={{ borderTopColor: T.accent }}>
              <div className="stat-label">HOURS DIALED</div>
              <div className="stat-value" style={{ color: T.accent }}>{formatHours(s.totalDuration || 0)}</div>
              <div className="stat-sub">{secondaryLabel} {formatHours(sec.totalDuration || 0)}</div>
            </div>
            <div className={`stat-card ${!hasData ? 'empty' : ''}`} style={{ borderTopColor: T.green }}>
              <div className="stat-label">CONVERSIONS</div>
              <div className="stat-value" style={{ color: T.green }}>{(s.conversions || 0).toLocaleString()}</div>
              <div className="stat-sub">{secondaryLabel} {(sec.conversions || 0).toLocaleString()}</div>
            </div>
            <div className={`stat-card ${!hasData ? 'empty' : ''}`} style={{ borderTopColor: T.green }}>
              <div className="stat-label">CLOSED</div>
              <div className="stat-value" style={{ color: T.green }}>{(s.closed || 0).toLocaleString()}</div>
              <div className="stat-sub">{secondaryLabel} {(sec.closed || 0).toLocaleString()}</div>
            </div>
            <div className={`stat-card ${!hasData ? 'empty' : ''}`}>
              <div className="stat-label">TALK TIME</div>
              <div className="stat-value">{formatDuration(s.totalDuration || 0)}</div>
              <div className="stat-sub">avg {formatDuration(s.avgCallLength || 0)}/call</div>
            </div>
            <div className={`stat-card ${!hasData ? 'empty' : ''}`} style={{ borderTopColor: T.amber }}>
              <div className="stat-label">BEST CAMPAIGN</div>
              <div className="stat-value" style={{ fontSize: s.bestCampaign ? 13 : 22, color: T.amber }}>
                {s.bestCampaign || '—'}
              </div>
              <div className="stat-sub">{s.bestCampaign ? `${s.bestCampaignRate}% conv` : 'need 5+ calls'}</div>
            </div>
          </div>

          <div className="charts-grid">

            <div className="chart-card">
              <div className="chart-title">▸ CALL VOLUME OVER TIME</div>
              <div className={series.length === 0 ? 'chart-faded' : ''}>
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={seriesToRender}>
                    <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
                    <XAxis dataKey="label" stroke={T.muted} fontSize={10} />
                    <YAxis stroke={T.muted} fontSize={10} allowDecimals={false} domain={[0, 'auto']} />
                    <Tooltip contentStyle={{ background: T.dark, border: `1px solid ${T.border}`, color: 'white', fontSize: 11 }} />
                    <Line type="monotone" dataKey="calls" stroke={T.blue} strokeWidth={2} dot={{ fill: T.blue, r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              {series.length === 0 && (
                <div className="chart-empty-overlay">
                  <div className="chart-empty-pill">AWAITING DATA</div>
                </div>
              )}
            </div>

            <div className="chart-card">
              <div className="chart-title">▸ CONVERSION RATE OVER TIME</div>
              <div className={series.length === 0 ? 'chart-faded' : ''}>
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={seriesToRender}>
                    <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
                    <XAxis dataKey="label" stroke={T.muted} fontSize={10} />
                    <YAxis stroke={T.muted} fontSize={10} unit="%" domain={[0, 100]} />
                    <Tooltip
                      contentStyle={{ background: T.dark, border: `1px solid ${T.border}`, color: 'white', fontSize: 11 }}
                      formatter={(v: any) => `${v}%`}
                    />
                    <Line type="monotone" dataKey="conversionRate" stroke={T.green} strokeWidth={2} dot={{ fill: T.green, r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              {series.length === 0 && (
                <div className="chart-empty-overlay">
                  <div className="chart-empty-pill">AWAITING DATA</div>
                </div>
              )}
            </div>

            <div className="chart-card">
              <div className="chart-title">▸ DISPOSITION BREAKDOWN</div>
              <div className={dispositions.length === 0 ? 'chart-faded' : ''}>
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie
                      data={dispositionsToRender}
                      dataKey="count"
                      nameKey="disposition"
                      cx="50%"
                      cy="50%"
                      outerRadius={75}
                      label={(entry: any) => `${entry.disposition}`}
                      labelLine={false}
                    >
                      {dispositionsToRender.map((d, i) => (
                        <Cell key={i} fill={DISPOSITION_COLORS[d.disposition] || '#bbb'} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: T.dark, border: `1px solid ${T.border}`, color: 'white', fontSize: 11 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              {dispositions.length === 0 && (
                <div className="chart-empty-overlay">
                  <div className="chart-empty-pill">AWAITING DATA</div>
                </div>
              )}
            </div>

            <div className="chart-card">
              <div className="chart-title">▸ CAMPAIGN PERFORMANCE</div>
              <div className={campaigns.length === 0 ? 'chart-faded' : ''}>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={campaignsToRender} layout="horizontal">
                    <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
                    <XAxis dataKey="name" stroke={T.muted} fontSize={9} />
                    <YAxis stroke={T.muted} fontSize={10} allowDecimals={false} domain={[0, 'auto']} />
                    <Tooltip contentStyle={{ background: T.dark, border: `1px solid ${T.border}`, color: 'white', fontSize: 11 }} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Bar dataKey="total" fill={T.blue} name="Total" />
                    <Bar dataKey="contacted" fill={T.accent} name="Contacted" />
                    <Bar dataKey="converted" fill={T.green} name="Converted" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              {campaigns.length === 0 && (
                <div className="chart-empty-overlay">
                  <div className="chart-empty-pill">AWAITING DATA</div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}