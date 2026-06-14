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
  Legend,
} from 'recharts'
import { useDesktopServices } from '../desktopServices'

// =============================================================================
// ANALYTICS APP — embedded in admin AND manager desktops (role-aware)
// =============================================================================
// Role change (this revision):
// - Reads `role` from useDesktopServices(). On the ADMIN desktop it hits
//   /api/admin/analytics (sitewide, unchanged). On the MANAGER desktop it hits
//   /api/manager/analytics, which returns the SAME response shape scoped to the
//   owner's tenant (their team's seats, signups, calls, revenue). The component
//   below renders identically — only the data source and a couple of labels
//   change with role. This is why there's ONE Analytics app, not two.
//
// Prior (Phase D3) behavior is otherwise preserved verbatim: per-plan seat and
// revenue breakdown, the unknown-price banner (manager API returns 0 there so
// it simply never shows), and the signups+revenue chart.
// =============================================================================

type Range = '7d' | '30d' | '90d' | '1y' | 'all' | 'custom'

interface AnalyticsData {
  range: Range
  bucketSize: 'day' | 'week'
  summary: {
    totalUsers: number
    payingActiveSubs: number
    proSubs: number
    wlSubs: number
    unknownPriceSubs: number
    wrr: number
    mrr: number
    proWrr: number
    wlWrr: number
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
  series: { date: string; signups: number; revenue: number; calls: number }[]
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

export default function AnalyticsApp() {
  const services = useDesktopServices()
  const role = services?.role ?? 'admin'
  // Endpoint by role: admin → sitewide, manager → their tenant (same shape).
  const endpoint = role === 'manager' ? '/api/manager/analytics' : '/api/admin/analytics'
  const headerTitle = role === 'manager' ? 'TEAM ANALYTICS' : 'BUSINESS ANALYTICS'
  const headerSub = role === 'manager' ? 'YOUR TEAM PERFORMANCE' : 'DIALERSEAT PERFORMANCE'

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
    fetch(`${endpoint}?${params}`)
      .then(async r => {
        if (r.status === 403) throw new Error(role === 'manager' ? 'Forbidden — Manager+ owners only' : 'Forbidden — admin only')
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
  }, [range, customStart, customEnd, endpoint, role])

  return (
    <div style={{
      width: '100%',
      height: '100%',
      background: T.bg,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'auto',
      fontFamily: 'Futura PT, Futura, sans-serif',
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
        .an-grid-3 {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
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
            {headerTitle}
          </span>
          <span style={{ fontSize: 10, fontFamily: 'monospace', color: '#8888aa', letterSpacing: 1 }}>
            {headerSub} · {RANGE_LABELS[range]}
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
            {data.summary.unknownPriceSubs > 0 && (
              <div style={{
                padding: '10px 16px', fontSize: 11, letterSpacing: 1,
                color: T.amber, background: '#f5efdc',
                border: `1px solid ${T.amber}`, borderRadius: 4,
                fontFamily: 'monospace',
              }}>
                {data.summary.unknownPriceSubs} ACTIVE SUB{data.summary.unknownPriceSubs === 1 ? '' : 'S'} ON A PRICE THAT IS NEITHER $35 NOR $75/WK — counted at the Stripe-reported amount. Check STRIPE_PRICE_ID / STRIPE_PRICE_WL_BASE and the server logs.
              </div>
            )}

            <div className="an-grid-4">
              <div className="an-stat-card hero" style={{
                borderTopColor: data.summary.wowDelta >= 0 ? T.green : T.red,
              }}>
                <div className="an-stat-label">FILLED SEATS · NOW</div>
                <div className="an-stat-value" style={{ color: T.green }}>
                  {data.summary.payingActiveSubs.toLocaleString()}
                </div>
                <div className="an-stat-sub">
                  {data.summary.proSubs} PRO · {data.summary.wlSubs} MGR+
                </div>
                <div className="an-stat-sub" style={{
                  color: data.summary.wowDelta >= 0 ? T.green : T.red,
                  marginTop: 3,
                }}>
                  {data.summary.wowDelta >= 0 ? '↑' : '↓'} {Math.abs(data.summary.wowDelta)} ({data.summary.wowPct >= 0 ? '+' : ''}{data.summary.wowPct}%) WoW
                </div>
              </div>

              <div className="an-stat-card hero" style={{ borderTopColor: T.accent }}>
                <div className="an-stat-label">WEEKLY REVENUE · NOW</div>
                <div className="an-stat-value" style={{ color: T.accent }}>
                  {fmtMoney(data.summary.wrr)}
                </div>
                <div className="an-stat-sub">
                  PRO {fmtMoney(data.summary.proWrr)} · MGR+ {fmtMoney(data.summary.wlWrr)}
                </div>
                <div className="an-stat-sub" style={{ marginTop: 3 }}>
                  {fmtMoney(data.summary.mrr)} / MONTH
                </div>
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

            <div className="an-section">
              <div className="an-section-title">SIGNUPS & REVENUE OVER TIME</div>
              <div className="an-section-sub">
                {data.bucketSize === 'week' ? 'Weekly buckets' : 'Daily buckets'} · Revenue is paying subs only (excludes coupons) · Pro $35/wk · Manager+ $75/wk.
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

            <div className="an-grid-3">
              <div className="an-stat-card">
                <div className="an-stat-label">SIGNUPS · {RANGE_LABELS[range]}</div>
                <div className="an-stat-value">{data.summary.signupsInRange.toLocaleString()}</div>
                <div className="an-stat-sub">NEW ACCOUNTS IN RANGE</div>
              </div>
              <div className="an-stat-card">
                <div className="an-stat-label">TOTAL USERS</div>
                <div className="an-stat-value">{data.summary.totalUsers.toLocaleString()}</div>
                <div className="an-stat-sub">{role === 'manager' ? 'YOUR TEAM SIZE' : 'LIFETIME SIGNUPS'}</div>
              </div>
              <div className="an-stat-card" style={{ borderTopColor: T.green }}>
                <div className="an-stat-label">ESTABLISHED (&gt;30D)</div>
                <div className="an-stat-value" style={{ color: T.green }}>
                  {data.summary.establishedPayingUsers.toLocaleString()}
                </div>
                <div className="an-stat-sub">LOYAL CUSTOMERS</div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}