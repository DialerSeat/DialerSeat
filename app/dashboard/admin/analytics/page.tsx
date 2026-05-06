'use client'
import { useEffect, useState } from 'react'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts'

type Range = '30d' | '90d' | '1y' | 'all' | 'custom'

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
    conversionRate: number
    activeRatio: number
  }
  funnel: {
    signedUp: number
    everSubscribed: number
    stillActive: number
  }
  statusBreakdown: Record<string, number>
  series: { date: string; signups: number; revenue: number }[]
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

const STATUS_COLORS: Record<string, string> = {
  active: T.green,
  trialing: T.blue,
  past_due: T.amber,
  canceled: '#999999',
  incomplete: T.amber,
  incomplete_expired: T.red,
  unpaid: T.red,
  coupon: '#a06ad4',
  none: '#cfd0d6',
}

const STATUS_LABELS: Record<string, string> = {
  active: 'ACTIVE',
  trialing: 'TRIALING',
  past_due: 'PAST DUE',
  canceled: 'CANCELED',
  incomplete: 'INCOMPLETE',
  incomplete_expired: 'EXPIRED',
  unpaid: 'UNPAID',
  coupon: 'COUPON (FREE)',
  none: 'NO SUBSCRIPTION',
}

const RANGE_LABELS: Record<Range, string> = {
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

  const pieData = data
    ? Object.entries(data.statusBreakdown)
        .filter(([_, n]) => n > 0)
        .map(([status, count]) => ({
          name: STATUS_LABELS[status] || status.toUpperCase(),
          value: count,
          status,
        }))
    : []

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
        .an-grid-3 {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
        }
        .an-grid-2 {
          display: grid;
          grid-template-columns: 2fr 1fr;
          gap: 16px;
          align-items: stretch;
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
        .an-funnel-row {
          display: grid;
          grid-template-columns: 110px 1fr 60px;
          gap: 12px;
          align-items: center;
          margin-bottom: 8px;
        }
        .an-funnel-name {
          font-size: 10px;
          letter-spacing: 2px;
          color: ${T.text};
          font-weight: bold;
        }
        .an-funnel-track {
          height: 22px;
          background: ${T.bg};
          border: 1px solid ${T.border};
          border-radius: 3px;
          overflow: hidden;
          position: relative;
        }
        .an-funnel-fill {
          height: 100%;
          transition: width 0.4s;
          display: flex;
          align-items: center;
          padding-left: 10px;
          font-size: 10px;
          font-weight: bold;
          font-family: monospace;
          color: white;
          letter-spacing: 1px;
        }
        .an-funnel-count {
          text-align: right;
          font-family: monospace;
          font-size: 13px;
          font-weight: bold;
          color: ${T.text};
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
          {(['30d', '90d', '1y', 'all', 'custom'] as Range[]).map(r => (
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
            {/* HERO STATS — the 4 numbers I'd glance at first thing every morning */}
            <div className="an-grid-4">
              <div className="an-stat-card hero" style={{ borderTopColor: T.green }}>
                <div className="an-stat-label">PAYING USERS</div>
                <div className="an-stat-value" style={{ color: T.green }}>
                  {data.summary.payingActiveSubs.toLocaleString()}
                </div>
                <div className="an-stat-sub">
                  {data.summary.couponSubsCount > 0
                    ? `+ ${data.summary.couponSubsCount} ON COUPON`
                    : 'NONE ON COUPON'}
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
                  {data.summary.cancellationsInRange} CANCELED IN RANGE
                </div>
              </div>
            </div>

            {/* CONVERSION FUNNEL */}
            <div className="an-section">
              <div className="an-section-title">CONVERSION FUNNEL · ALL TIME</div>
              <div className="an-section-sub">
                Where your users are in the journey from sign-up to paying customer.
              </div>
              {(() => {
                const max = Math.max(data.funnel.signedUp, 1)
                const stages = [
                  { name: 'SIGNED UP', value: data.funnel.signedUp, color: T.muted },
                  { name: 'SUBSCRIBED', value: data.funnel.everSubscribed, color: T.blue },
                  { name: 'STILL PAYING', value: data.funnel.stillActive, color: T.green },
                ]
                return stages.map((s, i) => {
                  const prev = i > 0 ? stages[i - 1].value : null
                  const dropPct = prev !== null && prev > 0
                    ? Math.round(((prev - s.value) / prev) * 100)
                    : null
                  const widthPct = (s.value / max) * 100
                  return (
                    <div key={s.name} className="an-funnel-row">
                      <span className="an-funnel-name">{s.name}</span>
                      <div className="an-funnel-track">
                        <div
                          className="an-funnel-fill"
                          style={{
                            width: `${Math.max(widthPct, 4)}%`,
                            background: s.color,
                          }}
                        >
                          {widthPct >= 25 && `${Math.round(widthPct)}%`}
                        </div>
                      </div>
                      <span className="an-funnel-count">
                        {s.value.toLocaleString()}
                        {dropPct !== null && dropPct > 0 && (
                          <span style={{ fontSize: 9, color: T.red, marginLeft: 4 }}>
                            -{dropPct}%
                          </span>
                        )}
                      </span>
                    </div>
                  )
                })
              })()}
            </div>

            {/* SIGNUPS + REVENUE CHART (left) + STATUS PIE (right) */}
            <div className="an-grid-2">
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

              <div className="an-section">
                <div className="an-section-title">USER STATUS BREAKDOWN</div>
                <div className="an-section-sub">
                  All-time. {data.summary.totalUsers.toLocaleString()} users total.
                </div>
                <div style={{ width: '100%', height: 280 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={90}
                        paddingAngle={2}
                        stroke="none"
                      >
                        {pieData.map(entry => (
                          <Cell
                            key={entry.status}
                            fill={STATUS_COLORS[entry.status] || T.muted}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          background: T.dark,
                          border: `1px solid ${T.accent}`,
                          borderRadius: 4,
                          fontSize: 11,
                        }}
                        labelStyle={{ color: '#8888aa' }}
                      />
                      <Legend
                        wrapperStyle={{ fontSize: 9, letterSpacing: 2 }}
                        layout="vertical"
                        verticalAlign="middle"
                        align="right"
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* RETENTION & CONVERSION ROW */}
            <div className="an-grid-3">
              <div className="an-stat-card" style={{ borderTopColor: T.blue }}>
                <div className="an-stat-label">CONVERSION RATE</div>
                <div className="an-stat-value" style={{ color: T.blue }}>
                  {data.summary.conversionRate}%
                </div>
                <div className="an-stat-sub">SIGNUPS WHO EVER PAID</div>
              </div>
              <div className="an-stat-card" style={{ borderTopColor: T.green }}>
                <div className="an-stat-label">ACTIVE RATIO</div>
                <div className="an-stat-value" style={{ color: T.green }}>
                  {data.summary.activeRatio}%
                </div>
                <div className="an-stat-sub">SIGNUPS PAYING NOW</div>
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

            {/* SIGNUPS-IN-RANGE STAT */}
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