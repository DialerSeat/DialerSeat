'use client'
import { useState, useEffect } from 'react'
import { useUser } from '@clerk/nextjs'

const T = {
  bg: '#f0f1f4',
  surface: '#e2e4ea',
  border: '#c4c8d0',
  dark: '#1a1a2e',
  text: '#1a1c24',
  muted: '#5a5e6a',
  accent: '#2a4a8a',
  blue: 'var(--brand-primary)',
  green: '#1a6a1a',
  red: '#8a1a1a',
  amber: '#8a6a1a',
}

interface Stats {
  totalCalls: number
  totalTalkTime: number
  totalLeads: number
  closedLeads: number
  appointmentLeads: number
  notInterestedLeads: number
  dncLeads: number
  uncalledLeads: number
  conversionRate: number
  avgTalkTime: number
  callsToday: number
  callsThisWeek: number
  topCampaign: { name: string; closes: number } | null
  dailyActivity: { date: string; calls: number; closes: number }[]
}

function formatDuration(seconds: number) {
  if (!seconds) return '0m'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

function formatNumber(n: number) {
  return n.toLocaleString()
}

export default function AnalyticsPage() {
  const { user } = useUser()
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d')

  useEffect(() => {
    if (!user) return
    const params = new URLSearchParams({
      user_id: user.id,
      range: dateRange,
    })
    setLoading(true)
    fetch(`/api/analytics/stats?${params}`)
      .then(r => r.json())
      .then(d => {
        if (d.success) setStats(d.stats)
      })
      .finally(() => setLoading(false))
  }, [user, dateRange])

  if (loading) {
    return (
      <div style={{
        flex: 1,
        background: T.bg,
        minHeight: 'calc(100vh - 64px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'Futura PT, Futura, sans-serif',
        fontSize: 11,
        letterSpacing: 2,
        color: T.muted,
      }}>
        LOADING ANALYTICS...
      </div>
    )
  }

  if (!stats) {
    return (
      <div style={{
        flex: 1,
        background: T.bg,
        minHeight: 'calc(100vh - 64px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'Futura PT, Futura, sans-serif',
        fontSize: 12,
        color: T.muted,
        flexDirection: 'column',
        gap: 8,
      }}>
        <div style={{ fontSize: 36, opacity: 0.4 }}>📊</div>
        <div style={{ letterSpacing: 2 }}>NO DATA YET</div>
        <div style={{ fontSize: 11 }}>Make some calls to see analytics here.</div>
      </div>
    )
  }

  return (
    <div style={{
      flex: 1,
      background: T.bg,
      minHeight: 'calc(100vh - 64px)',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: 'Futura PT, Futura, sans-serif',
      color: T.text,
    }}>
      {/* HEADER */}
      <div style={{
        background: T.dark,
        padding: '12px 20px',
        borderBottom: `2px solid ${T.accent}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{
            fontSize: 11,
            fontWeight: 'bold',
            letterSpacing: 4,
            color: T.blue,
          }}>ANALYTICS</span>
          <span style={{
            fontSize: 10,
            fontFamily: 'monospace',
            color: '#8888aa',
            letterSpacing: 1,
          }}>
            {formatNumber(stats.totalCalls)} TOTAL CALLS · {formatDuration(stats.totalTalkTime)} TALK TIME
          </span>
        </div>

        <div style={{ display: 'flex', gap: 6 }}>
          {(['7d', '30d', '90d', 'all'] as const).map(range => (
            <button
              key={range}
              onClick={() => setDateRange(range)}
              style={{
                padding: '5px 10px',
                background: dateRange === range ? T.blue : 'transparent',
                border: `1px solid ${T.blue}`,
                borderRadius: 3,
                color: dateRange === range ? '#fff' : T.blue,
                fontSize: 9,
                letterSpacing: 2,
                fontWeight: 'bold',
                cursor: 'pointer',
                fontFamily: 'Futura PT, Futura, sans-serif',
              }}
            >
              {range === '7d' ? '7 DAYS' :
               range === '30d' ? '30 DAYS' :
               range === '90d' ? '90 DAYS' : 'ALL TIME'}
            </button>
          ))}
        </div>
      </div>

      <div style={{
        flex: 1,
        padding: 20,
        overflow: 'auto',
      }}>
        {/* KPI GRID */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: 10,
          marginBottom: 16,
        }}>
          <KPICard label="TOTAL LEADS" value={formatNumber(stats.totalLeads)} accent={T.blue} />
          <KPICard label="CALLS MADE" value={formatNumber(stats.totalCalls)} accent={T.accent} />
          <KPICard label="CLOSES" value={formatNumber(stats.closedLeads)} accent={T.green} />
          <KPICard label="APPOINTMENTS" value={formatNumber(stats.appointmentLeads)} accent={T.blue} />
          <KPICard
            label="CONVERSION"
            value={`${(stats.conversionRate * 100).toFixed(1)}%`}
            accent={stats.conversionRate >= 0.05 ? T.green : T.amber}
          />
          <KPICard label="AVG TALK TIME" value={formatDuration(stats.avgTalkTime)} accent={T.muted} />
        </div>

        {/* DISPOSITION BREAKDOWN */}
        <div style={{
          background: T.surface,
          border: `1px solid ${T.border}`,
          borderLeft: `3px solid ${T.blue}`,
          borderRadius: 3,
          padding: 16,
          marginBottom: 16,
        }}>
          <div style={{
            fontSize: 10,
            letterSpacing: 3,
            color: T.muted,
            fontWeight: 'bold',
            marginBottom: 14,
          }}>▸ DISPOSITION BREAKDOWN</div>

          <DispBar
            label="CLOSED"
            count={stats.closedLeads}
            total={stats.totalLeads}
            color={T.green}
          />
          <DispBar
            label="APPOINTMENT"
            count={stats.appointmentLeads}
            total={stats.totalLeads}
            color="#1a4a8a"
          />
          <DispBar
            label="NOT INTERESTED"
            count={stats.notInterestedLeads}
            total={stats.totalLeads}
            color={T.amber}
          />
          <DispBar
            label="DO NOT CALL"
            count={stats.dncLeads}
            total={stats.totalLeads}
            color={T.red}
          />
          <DispBar
            label="UNCALLED"
            count={stats.uncalledLeads}
            total={stats.totalLeads}
            color={T.muted}
          />
        </div>

        {/* ACTIVITY + TOP CAMPAIGN */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 12,
        }}>
          {/* Daily activity */}
          <div style={{
            background: T.surface,
            border: `1px solid ${T.border}`,
            borderLeft: `3px solid ${T.accent}`,
            borderRadius: 3,
            padding: 16,
          }}>
            <div style={{
              fontSize: 10,
              letterSpacing: 3,
              color: T.muted,
              fontWeight: 'bold',
              marginBottom: 14,
            }}>▸ ACTIVITY OVERVIEW</div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <ActivityRow
                label="TODAY"
                calls={stats.callsToday}
                color={T.blue}
              />
              <ActivityRow
                label="THIS WEEK"
                calls={stats.callsThisWeek}
                color={T.accent}
              />
              <ActivityRow
                label="DAILY ACTIVITY"
                calls={
                  stats.dailyActivity.length > 0
                    ? Math.round(
                        stats.dailyActivity.reduce((s, d) => s + d.calls, 0) /
                        stats.dailyActivity.length
                      )
                    : 0
                }
                color={T.muted}
                suffix="AVG/DAY"
              />
            </div>
          </div>

          {/* Top campaign */}
          <div style={{
            background: T.surface,
            border: `1px solid ${T.border}`,
            borderLeft: `3px solid ${T.green}`,
            borderRadius: 3,
            padding: 16,
          }}>
            <div style={{
              fontSize: 10,
              letterSpacing: 3,
              color: T.muted,
              fontWeight: 'bold',
              marginBottom: 14,
            }}>▸ TOP CAMPAIGN</div>

            {stats.topCampaign ? (
              <div>
                <div style={{
                  fontSize: 18,
                  fontWeight: 'bold',
                  color: T.text,
                  letterSpacing: 1,
                  marginBottom: 6,
                  fontFamily: 'monospace',
                }}>{stats.topCampaign.name}</div>
                <div style={{
                  fontSize: 11,
                  color: T.muted,
                  letterSpacing: 1,
                }}>
                  <span style={{ color: T.green, fontWeight: 'bold' }}>
                    {formatNumber(stats.topCampaign.closes)}
                  </span>{' '}
                  CLOSES THIS PERIOD
                </div>
              </div>
            ) : (
              <div style={{
                fontSize: 11,
                color: T.muted,
                letterSpacing: 1,
                padding: '12px 0',
              }}>
                NO CLOSES YET. KEEP DIALING.
              </div>
            )}
          </div>
        </div>

        {/* Daily chart */}
        {stats.dailyActivity.length > 0 && (
          <div style={{
            background: T.surface,
            border: `1px solid ${T.border}`,
            borderLeft: `3px solid ${T.muted}`,
            borderRadius: 3,
            padding: 16,
            marginTop: 12,
          }}>
            <div style={{
              fontSize: 10,
              letterSpacing: 3,
              color: T.muted,
              fontWeight: 'bold',
              marginBottom: 14,
            }}>▸ DAILY CALLS</div>

            <div style={{
              display: 'flex',
              alignItems: 'flex-end',
              gap: 3,
              height: 100,
              borderBottom: `1px solid ${T.border}`,
              paddingBottom: 4,
            }}>
              {stats.dailyActivity.map((day, i) => {
                const max = Math.max(...stats.dailyActivity.map(d => d.calls), 1)
                const heightPct = (day.calls / max) * 100
                return (
                  <div
                    key={i}
                    title={`${day.date}: ${day.calls} calls, ${day.closes} closes`}
                    style={{
                      flex: 1,
                      minWidth: 4,
                      height: `${heightPct}%`,
                      background: day.closes > 0 ? T.green : T.blue,
                      opacity: 0.7,
                      borderRadius: '2px 2px 0 0',
                      cursor: 'help',
                    }}
                  />
                )
              })}
            </div>
            <div style={{
              fontSize: 9,
              letterSpacing: 1,
              color: T.muted,
              marginTop: 6,
              fontFamily: 'monospace',
              display: 'flex',
              justifyContent: 'space-between',
            }}>
              <span>{stats.dailyActivity[0]?.date}</span>
              <span>{stats.dailyActivity[stats.dailyActivity.length - 1]?.date}</span>
            </div>
            <div style={{
              fontSize: 9,
              letterSpacing: 1,
              color: T.muted,
              marginTop: 8,
              display: 'flex',
              gap: 12,
              alignItems: 'center',
            }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 8, height: 8, background: T.blue, borderRadius: 1 }}></span>
                CALLS ONLY
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 8, height: 8, background: T.green, borderRadius: 1 }}></span>
                CALLS + CLOSES
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// KPI CARD
function KPICard({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div style={{
      background: '#e2e4ea',
      border: `1px solid #c4c8d0`,
      borderTop: `3px solid ${accent}`,
      borderRadius: 3,
      padding: 14,
    }}>
      <div style={{
        fontSize: 9,
        letterSpacing: 2,
        color: '#5a5e6a',
        fontWeight: 'bold',
        marginBottom: 6,
      }}>{label}</div>
      <div style={{
        fontSize: 22,
        fontWeight: 'bold',
        color: accent,
        fontFamily: 'monospace',
        letterSpacing: 1,
      }}>{value}</div>
    </div>
  )
}

// DISPOSITION BAR
function DispBar({ label, count, total, color }: {
  label: string; count: number; total: number; color: string
}) {
  const pct = total > 0 ? (count / total) * 100 : 0
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: 10,
        letterSpacing: 1,
        marginBottom: 3,
        color: '#1a1c24',
      }}>
        <span style={{ fontWeight: 'bold' }}>{label}</span>
        <span style={{ color: '#5a5e6a', fontFamily: 'monospace' }}>
          {count.toLocaleString()} ({pct.toFixed(1)}%)
        </span>
      </div>
      <div style={{
        height: 6,
        background: '#f0f1f4',
        border: `1px solid #c4c8d0`,
        borderRadius: 2,
        overflow: 'hidden',
      }}>
        <div style={{
          height: '100%',
          width: `${Math.min(pct, 100)}%`,
          background: color,
          borderRadius: 1,
          transition: 'width 0.3s',
        }} />
      </div>
    </div>
  )
}

// ACTIVITY ROW
function ActivityRow({ label, calls, color, suffix }: {
  label: string; calls: number; color: string; suffix?: string
}) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '8px 10px',
      background: '#f0f1f4',
      border: `1px solid #c4c8d0`,
      borderLeft: `3px solid ${color}`,
      borderRadius: 2,
    }}>
      <span style={{
        fontSize: 10,
        letterSpacing: 1,
        color: '#5a5e6a',
        fontWeight: 'bold',
      }}>{label}</span>
      <span style={{
        fontSize: 14,
        fontWeight: 'bold',
        color,
        fontFamily: 'monospace',
        letterSpacing: 1,
      }}>
        {calls.toLocaleString()} {suffix && <span style={{
          fontSize: 9,
          color: '#5a5e6a',
          fontWeight: 'normal',
          letterSpacing: 0.5,
        }}>{suffix}</span>}
      </span>
    </div>
  )
}