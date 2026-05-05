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
} from 'recharts'

interface AnalyticsData {
  summary: {
    totalUsers: number
    activeSubs: number
    mrr: number
    wrr: number
    signupsLast7: number
    signupsLast30: number
    cancelledLast30: number
    churnRate: number
  }
  statusBreakdown: Record<string, number>
  dailySignups: { date: string; count: number }[]
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
  canceled: T.muted,
  incomplete: T.amber,
  incomplete_expired: T.red,
  unpaid: T.red,
  none: '#aaaaaa',
}

const STATUS_LABELS: Record<string, string> = {
  active: 'ACTIVE',
  trialing: 'TRIALING',
  past_due: 'PAST DUE',
  canceled: 'CANCELED',
  incomplete: 'INCOMPLETE',
  incomplete_expired: 'EXPIRED',
  unpaid: 'UNPAID',
  none: 'NO SUBSCRIPTION',
}

function fmtMoney(n: number) {
  return '$' + n.toLocaleString()
}

function fmtDateTick(iso: string) {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function AdminAnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin/analytics')
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
  }, [])

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
        }
        .an-content {
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        .an-stats-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
        }
        @media (max-width: 900px) {
          .an-stats-grid { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 500px) {
          .an-stats-grid { grid-template-columns: 1fr; }
        }
        .an-stat-card {
          padding: 16px;
          background: ${T.surface};
          border: 1px solid ${T.border};
          border-radius: 4px;
          border-top: 3px solid ${T.blue};
        }
        .an-stat-label {
          font-size: 9px;
          letter-spacing: 3px;
          color: ${T.muted};
          font-weight: bold;
          margin-bottom: 8px;
        }
        .an-stat-value {
          font-size: 28px;
          font-weight: bold;
          font-family: monospace;
          color: ${T.text};
          letter-spacing: -1px;
          line-height: 1;
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
        }
        .an-section-title {
          font-size: 10px;
          letter-spacing: 3px;
          color: ${T.muted};
          font-weight: bold;
          margin-bottom: 16px;
        }
        .an-status-bar {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .an-status-row {
          display: grid;
          grid-template-columns: 140px 1fr 60px;
          align-items: center;
          gap: 12px;
        }
        .an-status-name {
          font-size: 10px;
          letter-spacing: 2px;
          color: ${T.text};
          font-weight: bold;
        }
        .an-status-track {
          height: 12px;
          background: ${T.bg};
          border: 1px solid ${T.border};
          border-radius: 2px;
          overflow: hidden;
        }
        .an-status-fill {
          height: 100%;
          transition: width 0.4s;
        }
        .an-status-count {
          text-align: right;
          font-family: monospace;
          font-size: 13px;
          font-weight: bold;
          color: ${T.text};
        }
      `}</style>

      <div className="an-header">
        <span style={{ fontSize: 11, fontWeight: 'bold', letterSpacing: 4, color: T.blue }}>
          BUSINESS ANALYTICS
        </span>
        <span style={{ fontSize: 10, fontFamily: 'monospace', color: '#8888aa', letterSpacing: 1 }}>
          DIALERSEAT PERFORMANCE
        </span>
      </div>

      <div className="an-content">
        {loading && (
          <div style={{ padding: 40, textAlign: 'center', fontSize: 11, letterSpacing: 3, color: T.muted }}>
            LOADING ANALYTICS...
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

        {!loading && !error && data && (
          <>
            {/* HEADLINE STATS */}
            <div className="an-stats-grid">
              <div className="an-stat-card">
                <div className="an-stat-label">TOTAL USERS</div>
                <div className="an-stat-value">{data.summary.totalUsers.toLocaleString()}</div>
                <div className="an-stat-sub">LIFETIME SIGNUPS</div>
              </div>
              <div className="an-stat-card" style={{ borderTopColor: T.green }}>
                <div className="an-stat-label">ACTIVE SUBS</div>
                <div className="an-stat-value" style={{ color: T.green }}>
                  {data.summary.activeSubs.toLocaleString()}
                </div>
                <div className="an-stat-sub">PAYING NOW</div>
              </div>
              <div className="an-stat-card" style={{ borderTopColor: T.accent }}>
                <div className="an-stat-label">WEEKLY REVENUE</div>
                <div className="an-stat-value" style={{ color: T.accent }}>
                  {fmtMoney(data.summary.wrr)}
                </div>
                <div className="an-stat-sub">RECURRING WEEKLY</div>
              </div>
              <div className="an-stat-card" style={{ borderTopColor: T.accent }}>
                <div className="an-stat-label">MONTHLY REVENUE</div>
                <div className="an-stat-value" style={{ color: T.accent }}>
                  {fmtMoney(data.summary.mrr)}
                </div>
                <div className="an-stat-sub">EST. MRR @ 4.33 WK/MO</div>
              </div>
            </div>

            <div className="an-stats-grid">
              <div className="an-stat-card">
                <div className="an-stat-label">SIGNUPS · 7D</div>
                <div className="an-stat-value">{data.summary.signupsLast7.toLocaleString()}</div>
                <div className="an-stat-sub">LAST 7 DAYS</div>
              </div>
              <div className="an-stat-card">
                <div className="an-stat-label">SIGNUPS · 30D</div>
                <div className="an-stat-value">{data.summary.signupsLast30.toLocaleString()}</div>
                <div className="an-stat-sub">LAST 30 DAYS</div>
              </div>
              <div className="an-stat-card" style={{ borderTopColor: T.red }}>
                <div className="an-stat-label">CHURN · 30D</div>
                <div className="an-stat-value" style={{ color: T.red }}>
                  {data.summary.cancelledLast30}
                </div>
                <div className="an-stat-sub">{data.summary.churnRate}% CHURN RATE</div>
              </div>
              <div className="an-stat-card" style={{ borderTopColor: T.amber }}>
                <div className="an-stat-label">NET · 30D</div>
                <div className="an-stat-value" style={{
                  color: data.summary.signupsLast30 - data.summary.cancelledLast30 >= 0 ? T.green : T.red
                }}>
                  {data.summary.signupsLast30 - data.summary.cancelledLast30 >= 0 ? '+' : ''}
                  {data.summary.signupsLast30 - data.summary.cancelledLast30}
                </div>
                <div className="an-stat-sub">SIGNUPS MINUS CHURN</div>
              </div>
            </div>

            {/* SIGNUPS CHART */}
            <div className="an-section">
              <div className="an-section-title">SIGNUPS · LAST 30 DAYS</div>
              <div style={{ width: '100%', height: 240 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={data.dailySignups}
                    margin={{ top: 10, right: 16, left: -16, bottom: 0 }}
                  >
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
                      tick={{ fontSize: 10, fill: T.muted }}
                      tickLine={false}
                      axisLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip
                      contentStyle={{
                        background: T.dark,
                        border: `1px solid ${T.accent}`,
                        borderRadius: 4,
                        fontSize: 11,
                      }}
                      labelStyle={{ color: '#8888aa', fontFamily: 'monospace' }}
                      itemStyle={{ color: T.blue }}
                      labelFormatter={fmtDateTick}
                    />
                    <Line
                      type="monotone"
                      dataKey="count"
                      stroke={T.blue}
                      strokeWidth={2}
                      dot={{ r: 3, fill: T.blue }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* STATUS BREAKDOWN */}
            <div className="an-section">
              <div className="an-section-title">SUBSCRIPTION STATUS BREAKDOWN</div>
              <div className="an-status-bar">
                {Object.entries(data.statusBreakdown)
                  .filter(([_, n]) => n > 0)
                  .sort((a, b) => b[1] - a[1])
                  .map(([status, count]) => {
                    const pct = data.summary.totalUsers > 0
                      ? (count / data.summary.totalUsers) * 100
                      : 0
                    const color = STATUS_COLORS[status] || T.muted
                    return (
                      <div key={status} className="an-status-row">
                        <span className="an-status-name">
                          {STATUS_LABELS[status] || status.toUpperCase()}
                        </span>
                        <div className="an-status-track">
                          <div
                            className="an-status-fill"
                            style={{ width: `${Math.max(pct, 2)}%`, background: color }}
                          />
                        </div>
                        <span className="an-status-count">{count.toLocaleString()}</span>
                      </div>
                    )
                  })}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}