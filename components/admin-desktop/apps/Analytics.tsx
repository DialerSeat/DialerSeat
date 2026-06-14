'use client'
import { useEffect, useState } from 'react'
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from 'recharts'
import { useDesktopServices } from '../desktopServices'

// =============================================================================
// ANALYTICS APP — role-aware (admin = revenue, manager = performance)
// =============================================================================
// ONE app, TWO views, chosen by role from useDesktopServices():
//   - admin   → AdminRevenueView, hits /api/admin/analytics (unchanged income
//               dashboard: seats, revenue, churn).
//   - manager → ManagerPerformanceView, hits /api/manager/analytics (campaign
//               performance + teams + users + status — NO income).
// Keeping both in one file preserves "one Analytics app the manager picks up
// from the admin" while letting each role have a purpose-built UI.
// =============================================================================

const T = {
  bg: '#f0f1f4', surface: '#e2e4ea', border: '#c4c8d0', dark: '#1a1a2e',
  text: '#1a1c24', muted: '#5a5e6a', accent: '#2a4a8a', blue: '#4a9eff',
  green: '#1a6a1a', red: '#8a1a1a', amber: '#8a6a1a',
}

type Range = '7d' | '30d' | '90d' | '1y' | 'all' | 'custom'
const RANGE_LABELS: Record<Range, string> = {
  '7d': '7 DAYS', '30d': '30 DAYS', '90d': '90 DAYS', '1y': '1 YEAR', 'all': 'ALL TIME', 'custom': 'CUSTOM',
}
const fmtMoney = (n: number) => '$' + n.toLocaleString()
const fmtDateTick = (iso: any) => {
  const d = new Date(String(iso) + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function AnalyticsApp() {
  const services = useDesktopServices()
  const role = services?.role ?? 'admin'
  return role === 'manager' ? <ManagerPerformanceView /> : <AdminRevenueView />
}

// =============================================================================
// SHARED CHROME — header with range pills + custom date inputs
// =============================================================================
function Shell({
  title, subtitle, range, setRange, customStart, setCustomStart, customEnd, setCustomEnd, children,
}: {
  title: string; subtitle: string; range: Range; setRange: (r: Range) => void
  customStart: string; setCustomStart: (s: string) => void
  customEnd: string; setCustomEnd: (s: string) => void
  children: React.ReactNode
}) {
  return (
    <div style={{
      width: '100%', height: '100%', background: T.bg,
      display: 'flex', flexDirection: 'column', overflow: 'auto',
      fontFamily: 'Futura PT, Futura, sans-serif',
    }}>
      <style>{`
        .an-header { background: ${T.dark}; padding: 12px 20px; border-bottom: 2px solid ${T.accent};
          display: flex; align-items: center; gap: 16px; flex-wrap: wrap; justify-content: space-between; }
        .an-range-pills { display: flex; gap: 4px; background: rgba(255,255,255,0.05); border: 1px solid #2a2c34;
          border-radius: 4px; padding: 3px; flex-wrap: wrap; }
        .an-range-pill { padding: 5px 10px; border: none; background: transparent; color: #8888aa;
          font-size: 9px; letter-spacing: 2px; font-weight: bold; cursor: pointer; border-radius: 3px;
          font-family: 'Futura PT', Futura, sans-serif; }
        .an-range-pill.active { background: ${T.blue}; color: white; }
        .an-content { padding: 20px; display: flex; flex-direction: column; gap: 20px; }
        .an-grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
        .an-grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
        @media (max-width: 900px) { .an-grid-4 { grid-template-columns: repeat(2, 1fr); } .an-grid-3 { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 500px) { .an-grid-4, .an-grid-3 { grid-template-columns: 1fr; } }
        .an-stat-card { padding: 16px; background: ${T.surface}; border: 1px solid ${T.border}; border-radius: 4px; border-top: 3px solid ${T.blue}; }
        .an-stat-card.hero { padding: 22px; border-top-width: 4px; }
        .an-stat-label { font-size: 9px; letter-spacing: 3px; color: ${T.muted}; font-weight: bold; margin-bottom: 8px; }
        .an-stat-value { font-size: 30px; font-weight: bold; font-family: monospace; color: ${T.text}; letter-spacing: -1px; line-height: 1; }
        .an-stat-card.hero .an-stat-value { font-size: 38px; }
        .an-stat-sub { font-size: 10px; letter-spacing: 1px; color: ${T.muted}; margin-top: 6px; font-family: monospace; }
        .an-section { background: ${T.surface}; border: 1px solid ${T.border}; border-radius: 4px; padding: 16px; display: flex; flex-direction: column; }
        .an-section-title { font-size: 10px; letter-spacing: 3px; color: ${T.muted}; font-weight: bold; margin-bottom: 4px; }
        .an-section-sub { font-size: 10px; letter-spacing: 1px; color: ${T.muted}; font-family: monospace; margin-bottom: 14px; }
        .an-custom-inputs { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
        .an-custom-input { padding: 6px 10px; background: ${T.bg}; border: 1px solid ${T.border}; border-radius: 4px;
          font-family: monospace; font-size: 11px; color: ${T.text}; outline: none; }
        .an-table { width: 100%; border-collapse: collapse; }
        .an-th { padding: 8px 10px; font-size: 9px; letter-spacing: 2px; color: ${T.muted}; font-weight: bold; text-align: left; white-space: nowrap; border-bottom: 1px solid ${T.border}; }
        .an-td { padding: 8px 10px; font-size: 12px; color: ${T.text}; text-align: left; border-bottom: 1px solid ${T.border}; }
      `}</style>

      <div className="an-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, fontWeight: 'bold', letterSpacing: 4, color: T.blue }}>{title}</span>
          <span style={{ fontSize: 10, fontFamily: 'monospace', color: '#8888aa', letterSpacing: 1 }}>
            {subtitle} · {RANGE_LABELS[range]}
          </span>
        </div>
        <div className="an-range-pills">
          {(['7d', '30d', '90d', '1y', 'all', 'custom'] as Range[]).map(r => (
            <button key={r} className={`an-range-pill ${range === r ? 'active' : ''}`} onClick={() => setRange(r)}>
              {RANGE_LABELS[r]}
            </button>
          ))}
        </div>
      </div>

      {range === 'custom' && (
        <div style={{ padding: '10px 20px', background: T.surface, borderBottom: `1px solid ${T.border}` }}>
          <div className="an-custom-inputs">
            <span style={{ fontSize: 10, letterSpacing: 2, color: T.muted, fontWeight: 'bold' }}>FROM</span>
            <input type="date" className="an-custom-input" value={customStart} onChange={e => setCustomStart(e.target.value)} />
            <span style={{ fontSize: 10, letterSpacing: 2, color: T.muted, fontWeight: 'bold' }}>TO</span>
            <input type="date" className="an-custom-input" value={customEnd} onChange={e => setCustomEnd(e.target.value)} />
            {(!customStart || !customEnd) && (
              <span style={{ fontSize: 10, color: T.amber, letterSpacing: 1 }}>Select both dates to apply</span>
            )}
          </div>
        </div>
      )}

      <div className="an-content">{children}</div>
    </div>
  )
}

function useRangeState() {
  const [range, setRange] = useState<Range>('30d')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  return { range, setRange, customStart, setCustomStart, customEnd, setCustomEnd }
}

// =============================================================================
// MANAGER VIEW — campaign performance + teams + users + status
// =============================================================================
interface CampaignRow {
  id: string; name: string; status: string; ownerName: string
  totalLeads: number; calledLeads: number; dialerMode: string | null
  callsInRange: number; connects: number; connectRate: number
  topDispositions: { disposition: string; count: number }[]
}
interface TeamRow {
  id: string; name: string; ownerName: string
  memberCount: number; activeMembers: number; activeSeats: number; callsInRange: number
}
interface UserRow {
  clerkId: string; name: string; email: string | null; role: string
  callsInRange: number; lastSeenAt: string | null; status: string
}
interface ManagerData {
  range: Range; bucketSize: 'day' | 'week'
  summary: {
    totalCampaigns: number; activeCampaigns: number
    callsInRange: number; connectsInRange: number; connectRate: number
    teamCount: number; memberCount: number; activeMembers: number; userCount: number
  }
  campaigns: CampaignRow[]; teams: TeamRow[]; users: UserRow[]
  series: { date: string; calls: number; connects: number }[]
}

type MgrTab = 'campaigns' | 'teams' | 'users'

function ManagerPerformanceView() {
  const rs = useRangeState()
  const [data, setData] = useState<ManagerData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<MgrTab>('campaigns')

  useEffect(() => {
    setLoading(true); setError(null)
    const params = new URLSearchParams({ range: rs.range })
    if (rs.range === 'custom' && rs.customStart && rs.customEnd) {
      params.set('start', rs.customStart); params.set('end', rs.customEnd)
    }
    fetch(`/api/manager/analytics?${params}`)
      .then(async r => {
        if (r.status === 403) throw new Error('Forbidden — Manager+ owners only')
        if (r.status === 401) throw new Error('Not signed in')
        return r.json()
      })
      .then(d => { if (d.success) setData(d); else setError(d.error || 'Failed to load'); setLoading(false) })
      .catch(err => { setError(err.message); setLoading(false) })
  }, [rs.range, rs.customStart, rs.customEnd])

  return (
    <Shell title="TEAM PERFORMANCE" subtitle="CAMPAIGNS · TEAMS · USERS" {...rs}>
      {loading && <div style={{ padding: 40, textAlign: 'center', fontSize: 11, letterSpacing: 3, color: T.muted }}>LOADING PERFORMANCE...</div>}
      {error && (
        <div style={{ padding: 20, textAlign: 'center', fontSize: 12, letterSpacing: 2, color: T.red, background: '#f8e8e8', border: `1px solid ${T.red}`, borderRadius: 4 }}>{error}</div>
      )}
      {!loading && !error && data && (
        <>
          <div className="an-grid-4">
            <div className="an-stat-card hero" style={{ borderTopColor: T.blue }}>
              <div className="an-stat-label">CALLS · {RANGE_LABELS[data.range]}</div>
              <div className="an-stat-value" style={{ color: T.blue }}>{data.summary.callsInRange.toLocaleString()}</div>
              <div className="an-stat-sub">{data.summary.connectsInRange} CONNECTS</div>
            </div>
            <div className="an-stat-card hero" style={{ borderTopColor: T.green }}>
              <div className="an-stat-label">CONNECT RATE</div>
              <div className="an-stat-value" style={{ color: T.green }}>{data.summary.connectRate}%</div>
              <div className="an-stat-sub">LIVE ANSWERS / CALLS</div>
            </div>
            <div className="an-stat-card hero" style={{ borderTopColor: T.accent }}>
              <div className="an-stat-label">CAMPAIGNS</div>
              <div className="an-stat-value" style={{ color: T.accent }}>{data.summary.totalCampaigns}</div>
              <div className="an-stat-sub">{data.summary.activeCampaigns} ACTIVE</div>
            </div>
            <div className="an-stat-card hero" style={{ borderTopColor: T.amber }}>
              <div className="an-stat-label">TEAM</div>
              <div className="an-stat-value" style={{ color: T.amber }}>{data.summary.activeMembers}</div>
              <div className="an-stat-sub">{data.summary.userCount} TOTAL · {data.summary.teamCount} TEAMS</div>
            </div>
          </div>

          <div className="an-section">
            <div className="an-section-title">CALL VOLUME OVER TIME</div>
            <div className="an-section-sub">
              {data.bucketSize === 'week' ? 'Weekly buckets' : 'Daily buckets'} · Calls vs live connects.
            </div>
            <div style={{ width: '100%', height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.series} margin={{ top: 10, right: 16, left: -8, bottom: 0 }}>
                  <CartesianGrid stroke={T.border} strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: T.muted }} tickFormatter={fmtDateTick} tickLine={false} axisLine={{ stroke: T.border }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 10, fill: T.muted }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={{ background: T.dark, border: `1px solid ${T.accent}`, borderRadius: 4, fontSize: 11 }} labelStyle={{ color: '#8888aa', fontFamily: 'monospace' }} labelFormatter={fmtDateTick} />
                  <Legend wrapperStyle={{ fontSize: 10, letterSpacing: 2 }} formatter={(v) => v === 'calls' ? 'CALLS' : 'CONNECTS'} />
                  <Line type="monotone" dataKey="calls" stroke={T.blue} strokeWidth={2} dot={{ r: 2, fill: T.blue }} activeDot={{ r: 5 }} />
                  <Line type="monotone" dataKey="connects" stroke={T.green} strokeWidth={2} dot={{ r: 2, fill: T.green }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* TAB STRIP */}
          <div style={{ display: 'flex', gap: 4, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 4, padding: 4, alignSelf: 'flex-start' }}>
            {(['campaigns', 'teams', 'users'] as MgrTab[]).map(tb => (
              <button key={tb} onClick={() => setTab(tb)} style={{
                padding: '6px 14px', border: 'none', borderRadius: 3, cursor: 'pointer',
                background: tab === tb ? T.blue : 'transparent', color: tab === tb ? 'white' : T.muted,
                fontSize: 9, letterSpacing: 2, fontWeight: 'bold', fontFamily: 'Futura PT, Futura, sans-serif',
              }}>
                {tb.toUpperCase()}
                {tb === 'campaigns' && ` (${data.campaigns.length})`}
                {tb === 'teams' && ` (${data.teams.length})`}
                {tb === 'users' && ` (${data.users.length})`}
              </button>
            ))}
          </div>

          {tab === 'campaigns' && (
            <div className="an-section">
              {data.campaigns.length === 0 ? <Empty text="No campaigns yet." /> : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="an-table">
                    <thead><tr>
                      <th className="an-th">CAMPAIGN</th><th className="an-th">STATUS</th><th className="an-th">LEADS</th>
                      <th className="an-th">CALLS</th><th className="an-th">CONNECT %</th><th className="an-th">TOP DISPOSITIONS</th>
                    </tr></thead>
                    <tbody>
                      {data.campaigns.map(c => (
                        <tr key={c.id}>
                          <td className="an-td">
                            <div style={{ fontWeight: 'bold' }}>{c.name}</div>
                            <div style={{ fontSize: 10, color: T.muted, fontFamily: 'monospace' }}>{c.ownerName}{c.dialerMode ? ` · ${c.dialerMode}` : ''}</div>
                          </td>
                          <td className="an-td"><Badge color={c.status === 'active' ? T.green : T.muted}>{c.status.toUpperCase()}</Badge></td>
                          <td className="an-td" style={{ fontFamily: 'monospace' }}>{c.calledLeads}/{c.totalLeads}</td>
                          <td className="an-td" style={{ fontFamily: 'monospace' }}>{c.callsInRange}</td>
                          <td className="an-td" style={{ fontFamily: 'monospace', color: c.connectRate >= 20 ? T.green : T.text }}>{c.connectRate}%</td>
                          <td className="an-td" style={{ fontFamily: 'monospace', fontSize: 10, color: T.muted }}>
                            {c.topDispositions.length ? c.topDispositions.map(d => `${d.disposition} (${d.count})`).join(', ') : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {tab === 'teams' && (
            <div className="an-section">
              {data.teams.length === 0 ? <Empty text="No teams linked to your tenant yet." /> : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="an-table">
                    <thead><tr>
                      <th className="an-th">TEAM</th><th className="an-th">MEMBERS</th><th className="an-th">ACTIVE</th>
                      <th className="an-th">PAID SEATS</th><th className="an-th">CALLS</th>
                    </tr></thead>
                    <tbody>
                      {data.teams.map(t => (
                        <tr key={t.id}>
                          <td className="an-td">
                            <div style={{ fontWeight: 'bold' }}>{t.name}</div>
                            <div style={{ fontSize: 10, color: T.muted, fontFamily: 'monospace' }}>{t.ownerName}</div>
                          </td>
                          <td className="an-td" style={{ fontFamily: 'monospace' }}>{t.memberCount}</td>
                          <td className="an-td" style={{ fontFamily: 'monospace', color: T.green }}>{t.activeMembers}</td>
                          <td className="an-td" style={{ fontFamily: 'monospace' }}>{t.activeSeats}</td>
                          <td className="an-td" style={{ fontFamily: 'monospace' }}>{t.callsInRange}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {tab === 'users' && (
            <div className="an-section">
              {data.users.length === 0 ? <Empty text="No users in your tenant yet." /> : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="an-table">
                    <thead><tr>
                      <th className="an-th">USER</th><th className="an-th">ROLE</th><th className="an-th">STATUS</th>
                      <th className="an-th">CALLS</th><th className="an-th">LAST SEEN</th>
                    </tr></thead>
                    <tbody>
                      {data.users.map(u => (
                        <tr key={u.clerkId}>
                          <td className="an-td">
                            <div style={{ fontWeight: 'bold' }}>{u.name}</div>
                            {u.email && <div style={{ fontSize: 10, color: T.muted, fontFamily: 'monospace' }}>{u.email}</div>}
                          </td>
                          <td className="an-td"><Badge color={u.role === 'owner' ? T.accent : T.muted}>{u.role.toUpperCase()}</Badge></td>
                          <td className="an-td"><Badge color={u.status === 'active' ? T.green : T.amber}>{u.status.toUpperCase()}</Badge></td>
                          <td className="an-td" style={{ fontFamily: 'monospace' }}>{u.callsInRange}</td>
                          <td className="an-td" style={{ fontFamily: 'monospace', fontSize: 10, color: T.muted }}>
                            {u.lastSeenAt ? new Date(u.lastSeenAt).toLocaleDateString() : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </Shell>
  )
}

function Empty({ text }: { text: string }) {
  return <div style={{ fontSize: 11, color: T.muted, lineHeight: 1.5, padding: '16px', background: T.bg, border: `1px dashed ${T.border}`, borderRadius: 3, textAlign: 'center' }}>{text}</div>
}
function Badge({ color, children }: { color: string; children: React.ReactNode }) {
  return <span style={{ padding: '2px 8px', borderRadius: 3, fontSize: 9, fontWeight: 'bold', letterSpacing: 1.5, color, border: `1px solid ${color}`, background: 'transparent', whiteSpace: 'nowrap', fontFamily: 'monospace' }}>{children}</span>
}

// =============================================================================
// ADMIN VIEW — original revenue dashboard (unchanged behavior)
// =============================================================================
interface AdminData {
  range: Range; bucketSize: 'day' | 'week'
  summary: {
    totalUsers: number; payingActiveSubs: number; proSubs: number; wlSubs: number
    unknownPriceSubs: number; wrr: number; mrr: number; proWrr: number; wlWrr: number
    signupsInRange: number; paidConversionsInRange: number; cancellationsInRange: number
    netNewPaying: number; churnRate: number; avgLifetimeWeeks: number; wowDelta: number
    wowPct: number; newPayingUsers: number; establishedPayingUsers: number
  }
  series: { date: string; signups: number; revenue: number; calls: number }[]
}

function AdminRevenueView() {
  const rs = useRangeState()
  const [data, setData] = useState<AdminData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true); setError(null)
    const params = new URLSearchParams({ range: rs.range })
    if (rs.range === 'custom' && rs.customStart && rs.customEnd) {
      params.set('start', rs.customStart); params.set('end', rs.customEnd)
    }
    fetch(`/api/admin/analytics?${params}`)
      .then(async r => {
        if (r.status === 403) throw new Error('Forbidden — admin only')
        if (r.status === 401) throw new Error('Not signed in')
        return r.json()
      })
      .then(d => { if (d.success) setData(d); else setError(d.error || 'Failed to load'); setLoading(false) })
      .catch(err => { setError(err.message); setLoading(false) })
  }, [rs.range, rs.customStart, rs.customEnd])

  return (
    <Shell title="BUSINESS ANALYTICS" subtitle="DIALERSEAT PERFORMANCE" {...rs}>
      {loading && <div style={{ padding: 40, textAlign: 'center', fontSize: 11, letterSpacing: 3, color: T.muted }}>LOADING ANALYTICS...</div>}
      {error && (
        <div style={{ padding: 20, textAlign: 'center', fontSize: 12, letterSpacing: 2, color: T.red, background: '#f8e8e8', border: `1px solid ${T.red}`, borderRadius: 4 }}>{error}</div>
      )}
      {!loading && !error && data && (
        <>
          {data.summary.unknownPriceSubs > 0 && (
            <div style={{ padding: '10px 16px', fontSize: 11, letterSpacing: 1, color: T.amber, background: '#f5efdc', border: `1px solid ${T.amber}`, borderRadius: 4, fontFamily: 'monospace' }}>
              {data.summary.unknownPriceSubs} ACTIVE SUB{data.summary.unknownPriceSubs === 1 ? '' : 'S'} ON A PRICE THAT IS NEITHER $35 NOR $75/WK — counted at the Stripe-reported amount. Check STRIPE_PRICE_ID / STRIPE_PRICE_WL_BASE and the server logs.
            </div>
          )}
          <div className="an-grid-4">
            <div className="an-stat-card hero" style={{ borderTopColor: data.summary.wowDelta >= 0 ? T.green : T.red }}>
              <div className="an-stat-label">FILLED SEATS · NOW</div>
              <div className="an-stat-value" style={{ color: T.green }}>{data.summary.payingActiveSubs.toLocaleString()}</div>
              <div className="an-stat-sub">{data.summary.proSubs} PRO · {data.summary.wlSubs} MGR+</div>
              <div className="an-stat-sub" style={{ color: data.summary.wowDelta >= 0 ? T.green : T.red, marginTop: 3 }}>
                {data.summary.wowDelta >= 0 ? '↑' : '↓'} {Math.abs(data.summary.wowDelta)} ({data.summary.wowPct >= 0 ? '+' : ''}{data.summary.wowPct}%) WoW
              </div>
            </div>
            <div className="an-stat-card hero" style={{ borderTopColor: T.accent }}>
              <div className="an-stat-label">WEEKLY REVENUE · NOW</div>
              <div className="an-stat-value" style={{ color: T.accent }}>{fmtMoney(data.summary.wrr)}</div>
              <div className="an-stat-sub">PRO {fmtMoney(data.summary.proWrr)} · MGR+ {fmtMoney(data.summary.wlWrr)}</div>
              <div className="an-stat-sub" style={{ marginTop: 3 }}>{fmtMoney(data.summary.mrr)} / MONTH</div>
            </div>
            <div className="an-stat-card hero" style={{ borderTopColor: data.summary.netNewPaying >= 0 ? T.green : T.red }}>
              <div className="an-stat-label">NET NEW · {RANGE_LABELS[data.range]}</div>
              <div className="an-stat-value" style={{ color: data.summary.netNewPaying >= 0 ? T.green : T.red }}>
                {data.summary.netNewPaying >= 0 ? '+' : ''}{data.summary.netNewPaying}
              </div>
              <div className="an-stat-sub">{data.summary.paidConversionsInRange} NEW · {data.summary.cancellationsInRange} CHURNED</div>
            </div>
            <div className="an-stat-card hero" style={{ borderTopColor: data.summary.churnRate > 5 ? T.red : T.amber }}>
              <div className="an-stat-label">CHURN RATE</div>
              <div className="an-stat-value" style={{ color: data.summary.churnRate > 5 ? T.red : T.amber }}>{data.summary.churnRate}%</div>
              <div className="an-stat-sub">IN {RANGE_LABELS[data.range]}</div>
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
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: T.muted }} tickFormatter={fmtDateTick} tickLine={false} axisLine={{ stroke: T.border }} interval="preserveStartEnd" />
                  <YAxis yAxisId="left" tick={{ fontSize: 10, fill: T.muted }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: T.accent }} tickLine={false} axisLine={false} tickFormatter={(v) => '$' + v} />
                  <Tooltip contentStyle={{ background: T.dark, border: `1px solid ${T.accent}`, borderRadius: 4, fontSize: 11 }} labelStyle={{ color: '#8888aa', fontFamily: 'monospace' }} labelFormatter={fmtDateTick}
                    formatter={(value: any, name: any) => name === 'revenue' ? [`$${value}`, 'WEEKLY REVENUE'] : [value, 'SIGNUPS']} />
                  <Legend wrapperStyle={{ fontSize: 10, letterSpacing: 2 }} formatter={(v) => v === 'signups' ? 'SIGNUPS' : 'REVENUE'} />
                  <Line yAxisId="left" type="monotone" dataKey="signups" stroke={T.blue} strokeWidth={2} dot={{ r: 2, fill: T.blue }} activeDot={{ r: 5 }} />
                  <Line yAxisId="right" type="monotone" dataKey="revenue" stroke={T.accent} strokeWidth={2} strokeDasharray="4 4" dot={{ r: 2, fill: T.accent }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="an-grid-3">
            <div className="an-stat-card">
              <div className="an-stat-label">SIGNUPS · {RANGE_LABELS[data.range]}</div>
              <div className="an-stat-value">{data.summary.signupsInRange.toLocaleString()}</div>
              <div className="an-stat-sub">NEW ACCOUNTS IN RANGE</div>
            </div>
            <div className="an-stat-card">
              <div className="an-stat-label">TOTAL USERS</div>
              <div className="an-stat-value">{data.summary.totalUsers.toLocaleString()}</div>
              <div className="an-stat-sub">LIFETIME SIGNUPS</div>
            </div>
            <div className="an-stat-card" style={{ borderTopColor: T.green }}>
              <div className="an-stat-label">ESTABLISHED (&gt;30D)</div>
              <div className="an-stat-value" style={{ color: T.green }}>{data.summary.establishedPayingUsers.toLocaleString()}</div>
              <div className="an-stat-sub">LOYAL CUSTOMERS</div>
            </div>
          </div>
        </>
      )}
    </Shell>
  )
}