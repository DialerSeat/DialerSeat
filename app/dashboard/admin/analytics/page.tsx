'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts'

type Range = '7d' | '30d' | '90d' | '1y' | 'all' | 'custom'

interface AtRiskUser {
  clerk_id: string
  email: string
  first_name: string | null
  last_name: string | null
  last_call_at: string | null
  days_silent: number | null
}

interface HotProspect {
  clerk_id: string
  email: string
  first_name: string | null
  last_name: string | null
  calls_7d: number
  last_call_at: string
}

interface AnalyticsData {
  range: Range
  bucketSize: 'day' | 'week'
  summary: {
    totalUsers: number
    payingActiveSubs: number
    couponSubsCount: number
    wrr: number
    mrr: number
    signupsInRange: number
    paidConversionsInRange: number
    cancellationsInRange: number
    netNewPaying: number
    churnRate: number
    avgLifetimeWeeks: number
    wowDelta: number
    wowPct: number
    newPayingUsers: number
    establishedPayingUsers: number
  }
  atRiskUsers: AtRiskUser[]
  hotProspects: HotProspect[]
  series: { date: string; signups: number; revenue: number; calls: number }[]
  heatmap: { date: string; calls: number }[]
}

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

const RANGE_LABELS: Record<Range, string> = {
  '7d': '7 DAYS',
  '30d': '30 DAYS',
  '90d': '90 DAYS',
  '1y': '1 YEAR',
  'all': 'ALL TIME',
  'custom': 'CUSTOM',
}

function fmtMoney(n: number) {
  return '$' + n.toLocaleString()
}

function fmtDateTick(iso: any) {
  const d = new Date(String(iso) + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function timeAgo(iso: string | null) {
  if (!iso) return 'never'
  const ms = Date.now() - new Date(iso).getTime()
  const days = Math.floor(ms / 86400000)
  if (days === 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 30) return `${days}d ago`
  return `${Math.floor(days / 30)}mo ago`
}

function fullName(u: { first_name: string | null; last_name: string | null; email: string }) {
  const n = `${u.first_name || ''} ${u.last_name || ''}`.trim()
  return n || u.email
}

// Color scale for heatmap — empty → green
function heatColor(calls: number, max: number) {
  if (calls === 0) return T.surface
  const intensity = Math.min(1, calls / Math.max(max, 1))
  // Pale green at low, deep green at high
  const r = Math.round(232 - 200 * intensity)
  const g = Math.round(245 - 80 * intensity)
  const b = Math.round(232 - 200 * intensity)
  return `rgb(${r}, ${g}, ${b})`
}

export default function AdminAnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [range, setRange] = useState<Range>('30d')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')

  useEffect(() => {
    setLoading(true)
    setError(null)
    const params = new URLSearchParams({ range })
    if (range === 'custom' && customStart && customEnd) {
      params.set('start', customStart)
      params.set('end', customEnd)
    }
    fetch(`/api/admin/analytics?${params}`)
      .then(async r => {
        if (r.status === 403) throw new Error('Forbidden — admin only')
        if (r.status === 401) throw new Error('Not signed in')
        return r.json()
      })
      .then(d => {
        if (d.success) setData(d)
        else setError(d.error || 'Failed to load')
        setLoading(false)
      })
      .catch(err => {
        setError(err.message)
        setLoading(false)
      })
  }, [range, customStart, customEnd])

  const heatmapMax = data ? Math.max(...data.heatmap.map(h => h.calls), 1) : 1

  return (
    <div style={{
      flex: 1,
      background: T.bg,
      minHeight: 'calc(100vh - 64px)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'auto',
    }}>
      <style>{`
        .an-header {
          background: ${T.dark};
          padding: 12px 20px;
          border-bottom: 2px solid ${T.accent};
          display: flex;
          align-items: center;
          gap: 16px;
          flex-wrap: wrap;
          justify-content: space-between;
        }
        .an-range-pills {
          display: flex;
          gap: 4px;
          background: rgba(255,255,255,0.05);
          border: 1px solid #2a2c34;
          border-radius: 4px;
          padding: 3px;
          flex-wrap: wrap;
        }
        .an-range-pill {
          padding: 5px 10px;
          border: none;
          background: transparent;
          color: #8888aa;
          font-size: 9px;
          letter-spacing: 2px;
          font-weight: bold;
          cursor: pointer;
          border-radius: 3px;
          font-family: 'Futura PT', Futura, sans-serif;
        }
        .an-range-pill.active {
          background: ${T.blue};
          color: white;
        }
        .an-content {
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        .an-grid-4 {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
        }
        .an-grid-2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
          align-items: stretch;
        }
        .an-grid-3 {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
        }
        @media (max-width: 1100px) {
          .an-grid-2 { grid-template-columns: 1fr; }
        }
        @media (max-width: 900px) {
          .an-grid-4 { grid-template-columns: repeat(2, 1fr); }
          .an-grid-3 { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 500px) {
          .an-grid-4, .an-grid-3 { grid-template-columns: 1fr; }
        }
        .an-stat-card {
          padding: 16px;
          background: ${T.surface};
          border: 1px solid ${T.border};
          border-radius: 4px;
          border-top: 3px solid ${T.blue};
        }
        .an-stat-card.hero {
          padding: 22px;
          border-top-width: 4px;
        }
        .an-stat-label {
          font-size: 9px;
          letter-spacing: 3px;
          color: ${T.muted};
          font-weight: bold;
          margin-bottom: 8px;
        }
        .an-stat-value {
          font-size: 30px;
          font-weight: bold;
          font-family: monospace;
          color: ${T.text};
          letter-spacing: -1px;
          line-height: 1;
        }
        .an-stat-card.hero .an-stat-value {
          font-size: 38px;
        }
        .an-stat-sub {
          font-size: 10px;
          letter-spacing: 1px;
          color: ${T.muted};
          margin-top: 6px;
          font-family: monospace;
        }
        .an-section {
          background: ${T.surface};
          border: 1px solid ${T.border};
          border-radius: 4px;
          padding: 16px;
          display: flex;
          flex-direction: column;
        }
        .an-section-title {
          font-size: 10px;
          letter-spacing: 3px;
          color: ${T.muted};
          font-weight: bold;
          margin-bottom: 4px;
        }
        .an-section-sub {
          font-size: 10px;
          letter-spacing: 1px;
          color: ${T.muted};
          font-family: monospace;
          margin-bottom: 14px;
        }
        .an-user-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          padding: 10px 12px;
          background: ${T.bg};
          border: 1px solid ${T.border};
          border-radius: 3px;
          margin-bottom: 6px;
          text-decoration: none;
          transition: border-color 0.15s;
        }
        .an-user-row:hover {
          border-color: ${T.blue};
        }
        .an-user-row-name {
          font-size: 12px;
          font-weight: bold;
          color: ${T.text};
          font-family: monospace;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .an-user-row-email {
          font-size: 10px;
          color: ${T.muted};
          font-family: monospace;
          margin-top: 2px;
        }
        .an-user-row-stat {
          font-size: 11px;
          font-weight: bold;
          font-family: monospace;
          white-space: nowrap;
        }
        .an-empty {
          padding: 24px;
          text-align: center;
          color: ${T.muted};
          font-size: 11px;
          letter-spacing: 2px;
          font-family: monospace;
        }
        .an-heatmap-grid {
          display: grid;
          grid-template-columns: repeat(30, 1fr);
          gap: 3px;
        }
        .an-heat-cell {
          aspect-ratio: 1;
          border-radius: 2px;
          border: 1px solid ${T.border};
          cursor: default;
        }
        .an-custom-inputs {
          display: flex;
          gap: 8px;
          align-items: center;
          flex-wrap: wrap;
        }
        .an-custom-input {
          padding: 6px 10px;
          background: ${T.bg};
          border: 1px solid ${T.border};
          border-radius: 4px;
          font-family: monospace;
          font-size: 11px;
          color: ${T.text};
          outline: none;
        }
      `}</style>

      <div className="an-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, fontWeight: 'bold', letterSpacing: 4, color: T.blue }}>
            BUSINESS ANALYTICS
          </span>
          <span style={{ fontSize: 10, fontFamily: 'monospace', color: '#8888aa', letterSpacing: 1 }}>
            DIALERSEAT PERFORMANCE · {RANGE_LABELS[range]}
          </span>
        </div>

        <div className="an-range-pills">
          {(['7d', '30d', '90d', '1y', 'all', 'custom'] as Range[]).map(r => (
            <button
              key={r}
              className={`an-range-pill ${range === r ? 'active' : ''}`}
              onClick={() => setRange(r)}
            >
              {RANGE_LABELS[r]}
            </button>
          ))}
        </div>
      </div>

      {range === 'custom' && (
        <div style={{
          padding: '10px 20px',
          background: T.surface,
          borderBottom: `1px solid ${T.border}`,
        }}>
          <div className="an-custom-inputs">
            <span style={{ fontSize: 10, letterSpacing: 2, color: T.muted, fontWeight: 'bold' }}>FROM</span>
            <input
              type="date"
              className="an-custom-input"
              value={customStart}
              onChange={e => setCustomStart(e.target.value)}
            />
            <span style={{ fontSize: 10, letterSpacing: 2, color: T.muted, fontWeight: 'bold' }}>TO</span>
            <input
              type="date"
              className="an-custom-input"
              value={customEnd}
              onChange={e => setCustomEnd(e.target.value)}
            />
            {(!customStart || !customEnd) && (
              <span style={{ fontSize: 10, color: T.amber, letterSpacing: 1 }}>
                Select both dates to apply
              </span>
            )}
          </div>
        </div>
      )}

      <div className="an-content">
        {loading && (
          <div style={{ padding: 40, textAlign: 'center', fontSize: 11, letterSpacing: 3, color: T.muted }}>
            LOADING ANALYTICS...
          </div>
        )}

        {error && (
          <div style={{
            padding: 20, textAlign: 'center', fontSize: 12, letterSpacing: 2,
            color: T.red, background: '#f8e8e8',
            border: `1px solid ${T.red}`, borderRadius: 4,
          }}>
            {error}
          </div>
        )}

        {!loading && !error && data && (
          <>
            {/* HERO — the 4 numbers that matter at 8am */}
            <div className="an-grid-4">
              <div className="an-stat-card hero" style={{
                borderTopColor: data.summary.wowDelta >= 0 ? T.green : T.red,
              }}>
                <div className="an-stat-label">PAYING USERS</div>
                <div className="an-stat-value" style={{ color: T.green }}>
                  {data.summary.payingActiveSubs.toLocaleString()}
                </div>
                <div className="an-stat-sub" style={{
                  color: data.summary.wowDelta >= 0 ? T.green : T.red,
                }}>
                  {data.summary.wowDelta >= 0 ? '↑' : '↓'} {Math.abs(data.summary.wowDelta)} ({data.summary.wowPct >= 0 ? '+' : ''}{data.summary.wowPct}%) WoW
                </div>
              </div>

              <div className="an-stat-card hero" style={{ borderTopColor: T.accent }}>
                <div className="an-stat-label">EST. MRR</div>
                <div className="an-stat-value" style={{ color: T.accent }}>
                  {fmtMoney(data.summary.mrr)}
                </div>
                <div className="an-stat-sub">{fmtMoney(data.summary.wrr)} / WEEK</div>
              </div>

              <div className="an-stat-card hero" style={{
                borderTopColor: data.summary.netNewPaying >= 0 ? T.green : T.red,
              }}>
                <div className="an-stat-label">NET NEW · {RANGE_LABELS[range]}</div>
                <div className="an-stat-value" style={{
                  color: data.summary.netNewPaying >= 0 ? T.green : T.red,
                }}>
                  {data.summary.netNewPaying >= 0 ? '+' : ''}
                  {data.summary.netNewPaying}
                </div>
                <div className="an-stat-sub">
                  {data.summary.paidConversionsInRange} NEW · {data.summary.cancellationsInRange} CHURNED
                </div>
              </div>

              <div className="an-stat-card hero" style={{
                borderTopColor: data.summary.churnRate > 5 ? T.red : T.amber,
              }}>
                <div className="an-stat-label">CHURN RATE</div>
                <div className="an-stat-value" style={{
                  color: data.summary.churnRate > 5 ? T.red : T.amber,
                }}>
                  {data.summary.churnRate}%
                </div>
                <div className="an-stat-sub">
                  IN {RANGE_LABELS[range]}
                </div>
              </div>
            </div>

            {/* AT-RISK + HOT PROSPECTS — the two most actionable widgets */}
            <div className="an-grid-2">
              <div className="an-section">
                <div className="an-section-title" style={{ color: T.red }}>
                  ⚠ AT-RISK USERS · {data.atRiskUsers.length}
                </div>
                <div className="an-section-sub">
                  Paying users with no calls in 14+ days. Reach out before they cancel.
                </div>
                {data.atRiskUsers.length === 0 ? (
                  <div className="an-empty">NO AT-RISK USERS · ALL CLEAR</div>
                ) : (
                  <div style={{ maxHeight: 260, overflowY: 'auto' }}>
                    {data.atRiskUsers.slice(0, 20).map(u => (
                      <Link
                        key={u.clerk_id}
                        href="/dashboard/admin/overview"
                        className="an-user-row"
                      >
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div className="an-user-row-name">{fullName(u)}</div>
                          <div className="an-user-row-email">{u.email}</div>
                        </div>
                        <div className="an-user-row-stat" style={{
                          color: (u.days_silent ?? 999) > 30 ? T.red : T.amber,
                        }}>
                          {u.days_silent !== null
                            ? `${u.days_silent}D SILENT`
                            : 'NO CALLS YET'}
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              <div className="an-section">
                <div className="an-section-title" style={{ color: T.green }}>
                  🔥 HOT PROSPECTS · {data.hotProspects.length}
                </div>
                <div className="an-section-sub">
                  Non-paying users dialing in last 7 days. Most likely to convert.
                </div>
                {data.hotProspects.length === 0 ? (
                  <div className="an-empty">NO ACTIVE PROSPECTS</div>
                ) : (
                  <div style={{ maxHeight: 260, overflowY: 'auto' }}>
                    {data.hotProspects.slice(0, 20).map(u => (
                      <Link
                        key={u.clerk_id}
                        href="/dashboard/admin/overview"
                        className="an-user-row"
                      >
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div className="an-user-row-name">{fullName(u)}</div>
                          <div className="an-user-row-email">{u.email}</div>
                        </div>
                        <div className="an-user-row-stat" style={{ color: T.green }}>
                          {u.calls_7d.toLocaleString()} CALLS · 7D
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* SIGNUPS + REVENUE */}
            <div className="an-section">
              <div className="an-section-title">SIGNUPS & REVENUE OVER TIME</div>
              <div className="an-section-sub">
                {data.bucketSize === 'week' ? 'Weekly buckets' : 'Daily buckets'} · Revenue is paying subs only (excludes coupons).
              </div>
              <div style={{ width: '100%', height: 280 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.series} margin={{ top: 10, right: 16, left: -8, bottom: 0 }}>
                    <CartesianGrid stroke={T.border} strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10, fill: T.muted }}
                      tickFormatter={fmtDateTick}
                      tickLine={false}
                      axisLine={{ stroke: T.border }}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      yAxisId="left"
                      tick={{ fontSize: 10, fill: T.muted }}
                      tickLine={false}
                      axisLine={false}
                      allowDecimals={false}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      tick={{ fontSize: 10, fill: T.accent }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => '$' + v}
                    />
                    <Tooltip
                      contentStyle={{
                        background: T.dark,
                        border: `1px solid ${T.accent}`,
                        borderRadius: 4,
                        fontSize: 11,
                      }}
                      labelStyle={{ color: '#8888aa', fontFamily: 'monospace' }}
                      labelFormatter={fmtDateTick}
                      formatter={(value: any, name: any) => {
                        if (name === 'revenue') return [`$${value}`, 'WEEKLY REVENUE']
                        return [value, 'SIGNUPS']
                      }}
                    />
                    <Legend
                      wrapperStyle={{ fontSize: 10, letterSpacing: 2 }}
                      formatter={(v) => v === 'signups' ? 'SIGNUPS' : 'REVENUE'}
                    />
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="signups"
                      stroke={T.blue}
                      strokeWidth={2}
                      dot={{ r: 2, fill: T.blue }}
                      activeDot={{ r: 5 }}
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="revenue"
                      stroke={T.accent}
                      strokeWidth={2}
                      strokeDasharray="4 4"
                      dot={{ r: 2, fill: T.accent }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* PLATFORM ACTIVITY HEATMAP */}
            <div className="an-section">
              <div className="an-section-title">PLATFORM ACTIVITY · LAST 30 DAYS</div>
              <div className="an-section-sub">
                Total calls placed across all users per day. Hover for details.
              </div>
              <div className="an-heatmap-grid">
                {data.heatmap.map(h => (
                  <div
                    key={h.date}
                    className="an-heat-cell"
                    style={{
                      background: heatColor(h.calls, heatmapMax),
                    }}
                    title={`${fmtDateTick(h.date)} · ${h.calls} calls`}
                  />
                ))}
              </div>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginTop: 10,
                fontSize: 9,
                letterSpacing: 1,
                color: T.muted,
                fontFamily: 'monospace',
              }}>
                <span>30 DAYS AGO</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  LESS
                  <div style={{ display: 'flex', gap: 2 }}>
                    {[0, 0.25, 0.5, 0.75, 1].map(intensity => (
                      <div key={intensity} style={{
                        width: 10, height: 10, borderRadius: 2,
                        background: heatColor(intensity * heatmapMax, heatmapMax),
                        border: `1px solid ${T.border}`,
                      }} />
                    ))}
                  </div>
                  MORE
                </span>
                <span>TODAY</span>
              </div>
            </div>

            {/* TENURE COHORT + LIFETIME + TOTALS */}
            <div className="an-grid-3">
              <div className="an-stat-card" style={{ borderTopColor: T.blue }}>
                <div className="an-stat-label">NEW PAYING (≤30D)</div>
                <div className="an-stat-value" style={{ color: T.blue }}>
                  {data.summary.newPayingUsers.toLocaleString()}
                </div>
                <div className="an-stat-sub">FRESH SUBSCRIPTIONS</div>
              </div>
              <div className="an-stat-card" style={{ borderTopColor: T.green }}>
                <div className="an-stat-label">ESTABLISHED (&gt;30D)</div>
                <div className="an-stat-value" style={{ color: T.green }}>
                  {data.summary.establishedPayingUsers.toLocaleString()}
                </div>
                <div className="an-stat-sub">LOYAL CUSTOMERS</div>
              </div>
              <div className="an-stat-card" style={{ borderTopColor: T.accent }}>
                <div className="an-stat-label">AVG LIFETIME</div>
                <div className="an-stat-value" style={{ color: T.accent }}>
                  {data.summary.avgLifetimeWeeks > 0
                    ? `${data.summary.avgLifetimeWeeks} WK`
                    : '—'}
                </div>
                <div className="an-stat-sub">
                  {data.summary.avgLifetimeWeeks > 0
                    ? `≈ ${fmtMoney(Math.round(data.summary.avgLifetimeWeeks * 35))} LTV`
                    : 'NEED MORE CHURN DATA'}
                </div>
              </div>
            </div>

            {/* TOTALS FOOTER */}
            <div className="an-grid-3">
              <div className="an-stat-card">
                <div className="an-stat-label">TOTAL USERS</div>
                <div className="an-stat-value">{data.summary.totalUsers.toLocaleString()}</div>
                <div className="an-stat-sub">LIFETIME SIGNUPS</div>
              </div>
              <div className="an-stat-card">
                <div className="an-stat-label">SIGNUPS · {RANGE_LABELS[range]}</div>
                <div className="an-stat-value">{data.summary.signupsInRange.toLocaleString()}</div>
                <div className="an-stat-sub">NEW ACCOUNTS IN RANGE</div>
              </div>
              <div className="an-stat-card">
                <div className="an-stat-label">PAID CONVERSIONS · {RANGE_LABELS[range]}</div>
                <div className="an-stat-value" style={{ color: T.green }}>
                  {data.summary.paidConversionsInRange.toLocaleString()}
                </div>
                <div className="an-stat-sub">NEW PAYING SUBS IN RANGE</div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}