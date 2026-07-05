'use client'
import { use, useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

const T = {
  bg: 'var(--brand-page-bg)',
  surface: 'var(--brand-card-surface)',
  border: 'var(--brand-card-border)',
  dark: 'var(--brand-sidebar-bg)',
  text: 'var(--brand-on-page-bg)',
  muted: 'var(--brand-muted-text)',
  accent: '#2a4a8a',
  blue: 'var(--brand-primary)',
  green: '#1a8a4a',
  red: '#c94f4f',
  amber: '#c98a1a',
}

const FUTURA = `'Futura PT', Futura, 'Helvetica Neue', Helvetica, Arial, sans-serif`

type Range = 'today' | 'week' | 'month' | 'custom'

interface MemberStat {
  userId: string
  name: string
  email: string | null
  isOwner: boolean
  calls: number
  connected: number
  conversions: number
  talkSeconds: number
}

interface TeamCampaign {
  campaignId: string
  accessMode: 'owner_pays' | 'agent_pays' | 'public' | 'free'
  name: string | null
}

interface TeamMemberRef {
  userId: string
  name: string
  isOwner: boolean
}

interface RecentCall {
  id: string
  memberName: string
  leadName: string
  phone: string | null
  disposition: string | null
  duration: number
  createdAt: string
  campaignId: string
}

interface AnalyticsResponse {
  success: boolean
  error?: string
  range: Range | 'all'
  viewerRole: 'owner' | 'member'
  team: { id: string; name: string }
  campaigns: TeamCampaign[]
  members: TeamMemberRef[]
  totals: { calls: number; connected: number; conversions: number; talkSeconds: number }
  leaderboard: MemberStat[]
  viewerStats: MemberStat
  recentCalls: RecentCall[]
}

function fmtTime(s: number): string {
  if (s <= 0) return '0s'
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  const sec = s % 60
  if (m < 60) return sec > 0 ? `${m}m ${sec}s` : `${m}m`
  const h = Math.floor(m / 60)
  const mm = m % 60
  return mm > 0 ? `${h}h ${mm}m` : `${h}h`
}

function fmtDateTime(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleString('en-US', {
      month: 'short', day: 'numeric',
      hour: 'numeric', minute: '2-digit',
    })
  } catch {
    return iso
  }
}

function relTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const m = Math.floor(ms / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return fmtDateTime(iso)
}

function dispColor(disp: string | null): string {
  switch (disp) {
    case 'CLOSED': return T.green
    case 'APPOINTMENT': return T.blue
    case 'NOT INTERESTED': return T.amber
    case 'DO NOT CALL': return T.red
    default: return T.muted
  }
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

function rankAccent(i: number): string | null {
  if (i === 0) return '#d4af37' // gold
  if (i === 1) return '#a3a7b3' // silver
  if (i === 2) return '#c07a3e' // bronze
  return null
}

function Awaiting() {
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 8px',
      background: 'color-mix(in srgb, var(--brand-on-page-bg) 12%, transparent)',
      color: T.muted,
      fontSize: 9,
      letterSpacing: 1.5,
      fontWeight: 'bold',
      borderRadius: 3,
      fontFamily: FUTURA,
      whiteSpace: 'nowrap',
    }}>AWAITING DATA</span>
  )
}

/** Small radial progress ring — used for connect-rate visuals. Pure SVG,
 * no chart dependency, themes via the same CSS vars as everything else. */
function Ring({ pct, size = 56, stroke = 6, color = T.blue }: {
  pct: number | null; size?: number; stroke?: number; color?: string
}) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const clamped = Math.max(0, Math.min(100, pct ?? 0))
  const offset = c - (clamped / 100) * c
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke="var(--brand-card-border)" strokeWidth={stroke} />
        {pct !== null && (
          <circle cx={size / 2} cy={size / 2} r={r} fill="none"
            stroke={color} strokeWidth={stroke} strokeLinecap="round"
            strokeDasharray={c} strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 0.4s ease' }} />
        )}
      </svg>
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{ fontSize: size > 48 ? 14 : 11, fontWeight: 800, color: T.text, fontFamily: FUTURA }}>
          {pct !== null ? `${Math.round(pct)}%` : '—'}
        </span>
      </div>
    </div>
  )
}

function Avatar({ name, accent }: { name: string; accent?: string | null }) {
  return (
    <div style={{
      width: 38, height: 38, borderRadius: 11, flexShrink: 0,
      background: accent ? `${accent}26` : 'var(--brand-primary-soft)',
      color: accent || T.blue,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 12, fontWeight: 800, letterSpacing: 0.5, fontFamily: FUTURA,
      border: accent ? `1px solid ${accent}55` : '1px solid transparent',
    }}>
      {initials(name)}
    </div>
  )
}

export default function TeamAnalyticsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: teamId } = use(params)

  const [range, setRange] = useState<Range>('week')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [campaignFilter, setCampaignFilter] = useState<string>('all')
  const [memberFilter, setMemberFilter] = useState<string>('all')
  const [data, setData] = useState<AnalyticsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchAnalytics = useCallback(async () => {
    if (range === 'custom' && (!customStart || !customEnd)) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const qs = new URLSearchParams({ range })
      if (range === 'custom') {
        qs.set('start', new Date(customStart).toISOString())
        const endDate = new Date(customEnd)
        endDate.setHours(23, 59, 59, 999)
        qs.set('end', endDate.toISOString())
      }
      if (campaignFilter !== 'all') qs.set('campaign_id', campaignFilter)
      if (memberFilter !== 'all') qs.set('user_id', memberFilter)

      const res = await fetch(`/api/teams/${teamId}/analytics?${qs}`)
      const json: AnalyticsResponse = await res.json()
      if (!json.success) {
        setError(json.error || 'Failed to load analytics')
        return
      }
      setData(json)
    } catch (err: any) {
      setError(err.message || 'Failed to load analytics')
    } finally {
      setLoading(false)
    }
  }, [teamId, range, customStart, customEnd, campaignFilter, memberFilter])

  useEffect(() => { fetchAnalytics() }, [fetchAnalytics])

  const isOwner = data?.viewerRole === 'owner'
  const showMemberFilter = isOwner && (data?.members?.length || 0) > 1

  const connectPct = data && data.totals.calls > 0
    ? (data.totals.connected / data.totals.calls) * 100
    : null

  const leaderboardRows = isOwner ? (data?.leaderboard || []) : []
  const viewerConnectPct = data && data.viewerStats.calls > 0
    ? (data.viewerStats.connected / data.viewerStats.calls) * 100
    : null

  return (
    <div className="ta-root" style={{
      flex: 1,
      background: T.bg,
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'auto',
      fontFamily: FUTURA,
      color: T.text,
    }}>
      <style>{`
        .ta-root * { box-sizing: border-box; }
        .ta-header {
          background: var(--brand-header-bg);
          padding: 16px 24px;
          border-bottom: 2px solid var(--brand-header-top-accent);
          display: flex; align-items: center; justify-content: space-between;
          gap: 16px; flex-wrap: wrap;
        }
        .ta-back {
          font-size: 10px; letter-spacing: 2px;
          color: var(--brand-on-header-muted);
          text-decoration: none;
        }
        .ta-back:hover { color: ${T.blue}; }
        .ta-role-pill {
          font-size: 9px; letter-spacing: 1.5px; font-weight: 800;
          padding: 3px 9px; border-radius: 20px;
          background: var(--brand-primary-soft); color: ${T.blue};
          font-family: ${FUTURA};
        }

        .ta-toolbar {
          padding: 16px 24px;
          display: flex; flex-wrap: wrap; gap: 12px; align-items: flex-end;
          max-width: 1180px; width: 100%; margin: 0 auto;
        }
        .ta-segmented {
          display: inline-flex; background: color-mix(in srgb, var(--brand-on-page-bg) 6%, transparent);
          border-radius: 10px; padding: 3px; gap: 2px; flex-shrink: 0;
        }
        .ta-seg-btn {
          padding: 8px 14px; border-radius: 8px; border: none; background: transparent;
          color: ${T.muted}; font-size: 10.5px; font-weight: 800; letter-spacing: 1.5px;
          cursor: pointer; font-family: ${FUTURA}; transition: background 0.12s, color 0.12s;
        }
        .ta-seg-btn.active { background: ${T.blue}; color: white; }
        .ta-custom-inputs { display: flex; gap: 6px; align-items: center; }
        .ta-custom-inputs input {
          padding: 7px 10px; background: ${T.surface}; border: 1px solid ${T.border};
          border-radius: 8px; font-size: 11px; color: ${T.text}; font-family: monospace;
        }
        .ta-filter-field { display: flex; flex-direction: column; gap: 4px; }
        .ta-filter-field label {
          font-size: 9px; letter-spacing: 2px; color: ${T.muted}; font-weight: 800;
        }
        .ta-filter-field select {
          padding: 7px 10px; background: ${T.surface}; border: 1px solid ${T.border};
          border-radius: 8px; font-size: 11px; color: ${T.text}; font-family: ${FUTURA};
          min-width: 170px; cursor: pointer;
        }

        .ta-body {
          flex: 1; padding: 4px 24px 32px;
          max-width: 1180px; width: 100%; margin: 0 auto;
          box-sizing: border-box;
        }
        .ta-error {
          padding: 14px 18px; background: color-mix(in srgb, ${T.red} 12%, transparent);
          border: 1px solid ${T.red}; color: ${T.red}; border-radius: 10px;
          font-size: 12px; letter-spacing: 0.5px; margin-bottom: 16px;
        }
        .ta-empty {
          padding: 48px 20px; text-align: center;
          font-size: 11px; letter-spacing: 3px; color: ${T.muted}; font-weight: bold;
        }

        .ta-kpi-grid {
          display: grid; grid-template-columns: repeat(4, 1fr);
          gap: 12px; margin-bottom: 20px;
        }
        .ta-kpi {
          padding: 18px; background: ${T.surface}; border: 1px solid ${T.border};
          border-radius: 14px; display: flex; align-items: center; justify-content: space-between; gap: 10px;
        }
        .ta-kpi-label {
          font-size: 9.5px; letter-spacing: 1.8px; color: ${T.muted}; font-weight: 800; margin-bottom: 7px;
        }
        .ta-kpi-value {
          font-size: 25px; font-weight: 800; font-family: ${FUTURA};
          color: ${T.text}; letter-spacing: -0.5px; min-height: 30px; display: flex; align-items: center;
        }

        .ta-section {
          background: ${T.surface}; border: 1px solid ${T.border};
          border-radius: 16px; margin-bottom: 16px; overflow: hidden;
        }
        .ta-section-head {
          padding: 14px 18px; border-bottom: 1px solid ${T.border};
          font-size: 10.5px; letter-spacing: 2.5px; color: ${T.muted}; font-weight: 800;
          display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
        }
        .ta-list { display: flex; flex-direction: column; }
        .ta-row {
          padding: 14px 18px; border-bottom: 1px solid ${T.border};
          display: flex; align-items: center; gap: 12px;
        }
        .ta-row:last-child { border-bottom: none; }

        .ta-lb-metrics { display: flex; gap: 20px; margin-left: auto; flex-wrap: wrap; }
        .ta-lb-metric { text-align: right; min-width: 56px; }
        .ta-lb-metric-val { font-size: 14px; font-weight: 800; font-family: monospace; color: ${T.text}; }
        .ta-lb-metric-key { font-size: 8.5px; letter-spacing: 1.2px; color: ${T.muted}; font-weight: 700; margin-top: 1px; }

        .ta-personal-grid {
          display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px;
          padding: 18px; flex: 1;
        }
        .ta-personal-cell { display: flex; flex-direction: column; gap: 4px; }
        .ta-personal-key { font-size: 9.5px; letter-spacing: 1.5px; color: ${T.muted}; font-weight: 800; }
        .ta-personal-val { font-size: 22px; font-weight: 800; font-family: ${FUTURA}; color: ${T.text}; }

        .ta-call-row { display: flex; align-items: center; gap: 12px; }
        .ta-call-main { flex: 1; min-width: 0; }
        .ta-call-lead { font-size: 12.5px; font-weight: 700; color: ${T.text}; }
        .ta-call-meta { font-size: 10.5px; color: ${T.muted}; margin-top: 2px; }
        .ta-disp-badge {
          display: inline-block; padding: 3px 9px; border-radius: 20px;
          font-size: 9px; letter-spacing: 1px; font-weight: 800; font-family: ${FUTURA};
        }
        .ta-call-right { text-align: right; flex-shrink: 0; }
        .ta-call-time { font-size: 10px; color: ${T.muted}; }
        .ta-call-dur { font-size: 12px; font-weight: 700; font-family: monospace; color: ${T.text}; margin-top: 3px; }

        @media (max-width: 860px) {
          .ta-kpi-grid { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 720px) {
          .ta-header, .ta-toolbar, .ta-body { padding-left: 16px; padding-right: 16px; }
          .ta-filter-field select { min-width: 130px; }
          .ta-lb-metrics { gap: 12px; }
          .ta-personal-grid { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 480px) {
          .ta-kpi-grid { grid-template-columns: 1fr 1fr; }
          .ta-kpi-value { font-size: 20px; }
          .ta-row { flex-wrap: wrap; }
          .ta-lb-metrics { width: 100%; margin-left: 50px; justify-content: flex-start; gap: 16px; }
          .ta-call-row { flex-wrap: wrap; }
          .ta-call-right { margin-left: auto; }
        }
      `}</style>

      <div className="ta-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <Link href="/dashboard/teams" className="ta-back">← TEAMS</Link>
          <span style={{ fontSize: 15, fontWeight: 800, letterSpacing: 0.5, color: 'var(--brand-on-header)' }}>
            {data?.team.name || 'Team'}
          </span>
          {data && <span className="ta-role-pill">{data.viewerRole.toUpperCase()}</span>}
        </div>
      </div>

      <div className="ta-toolbar">
        <div className="ta-segmented">
          {(['today', 'week', 'month', 'custom'] as const).map(r => (
            <button
              key={r}
              className={`ta-seg-btn ${range === r ? 'active' : ''}`}
              onClick={() => setRange(r)}
            >
              {r === 'today' ? 'TODAY' : r === 'week' ? '7-DAY' : r === 'month' ? '30-DAY' : 'CUSTOM'}
            </button>
          ))}
        </div>
        {range === 'custom' && (
          <div className="ta-custom-inputs">
            <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} />
            <span style={{ fontSize: 10, color: T.muted }}>→</span>
            <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} />
          </div>
        )}
        <div className="ta-filter-field">
          <label>CAMPAIGN</label>
          <select value={campaignFilter} onChange={e => setCampaignFilter(e.target.value)}>
            <option value="all">All campaigns</option>
            {(data?.campaigns || []).map(c => (
              <option key={c.campaignId} value={c.campaignId}>{c.name || c.campaignId.slice(0, 8)}</option>
            ))}
          </select>
        </div>
        {showMemberFilter && (
          <div className="ta-filter-field">
            <label>MEMBER</label>
            <select value={memberFilter} onChange={e => setMemberFilter(e.target.value)}>
              <option value="all">All members</option>
              {(data?.members || []).map(m => (
                <option key={m.userId} value={m.userId}>{m.name}{m.isOwner ? ' (Owner)' : ''}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="ta-body">
        {error && <div className="ta-error">{error}</div>}

        {range === 'custom' && (!customStart || !customEnd) && (
          <div className="ta-empty">PICK A START AND END DATE TO LOAD DATA</div>
        )}

        {loading && !data && range !== 'custom' && (
          <div className="ta-empty">LOADING ANALYTICS…</div>
        )}

        {data && (
          <>
            <div className="ta-kpi-grid">
              <div className="ta-kpi">
                <div>
                  <div className="ta-kpi-label">TOTAL CALLS</div>
                  <div className="ta-kpi-value">
                    {data.totals.calls > 0 ? data.totals.calls.toLocaleString() : <Awaiting />}
                  </div>
                </div>
              </div>
              <div className="ta-kpi">
                <div>
                  <div className="ta-kpi-label">CONNECT RATE</div>
                  <div className="ta-kpi-value">
                    {connectPct !== null ? `${Math.round(connectPct)}%` : <Awaiting />}
                  </div>
                </div>
                {connectPct !== null && <Ring pct={connectPct} size={44} stroke={5} color={T.blue} />}
              </div>
              <div className="ta-kpi">
                <div>
                  <div className="ta-kpi-label">CONVERSIONS</div>
                  <div className="ta-kpi-value" style={{ color: data.totals.conversions > 0 ? T.green : T.text }}>
                    {data.totals.conversions > 0 ? data.totals.conversions.toLocaleString() : <Awaiting />}
                  </div>
                </div>
              </div>
              <div className="ta-kpi">
                <div>
                  <div className="ta-kpi-label">TALK TIME</div>
                  <div className="ta-kpi-value">
                    {data.totals.talkSeconds > 0 ? fmtTime(data.totals.talkSeconds) : <Awaiting />}
                  </div>
                </div>
              </div>
            </div>

            {/* LEADERBOARD — owner only — ranked cards instead of a table */}
            {isOwner && (
              <div className="ta-section">
                <div className="ta-section-head">
                  ▸ LEADERBOARD
                  {memberFilter !== 'all' && <span style={{ color: T.amber }}>· MEMBER FILTERED</span>}
                  {campaignFilter !== 'all' && <span style={{ color: T.amber }}>· CAMPAIGN FILTERED</span>}
                </div>
                <div className="ta-list">
                  {leaderboardRows.length === 0 ? (
                    <div className="ta-empty">NO ACTIVE MEMBERS YET</div>
                  ) : (
                    leaderboardRows.map((m, i) => {
                      const cr = m.calls > 0 ? (m.connected / m.calls) * 100 : null
                      const accent = rankAccent(i)
                      return (
                        <div key={m.userId} className="ta-row">
                          <span style={{
                            width: 22, textAlign: 'center', fontSize: 12, fontWeight: 800,
                            color: accent || T.muted, flexShrink: 0,
                          }}>
                            {i + 1}
                          </span>
                          <Avatar name={m.name} accent={accent} />
                          <div style={{ minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ fontSize: 13, fontWeight: 700, color: T.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {m.name}
                              </span>
                              {m.isOwner && (
                                <span style={{
                                  fontSize: 8, letterSpacing: 1, color: T.blue, padding: '1px 6px',
                                  border: `1px solid ${T.blue}`, borderRadius: 20, flexShrink: 0,
                                }}>OWNER</span>
                              )}
                            </div>
                            {cr !== null && (
                              <div style={{
                                marginTop: 5, width: 90, height: 4, borderRadius: 4,
                                background: 'color-mix(in srgb, var(--brand-on-page-bg) 10%, transparent)', overflow: 'hidden',
                              }}>
                                <div style={{ width: `${cr}%`, height: '100%', background: T.blue, borderRadius: 4 }} />
                              </div>
                            )}
                          </div>
                          <div className="ta-lb-metrics">
                            <div className="ta-lb-metric">
                              <div className="ta-lb-metric-val">{m.calls > 0 ? m.calls.toLocaleString() : '—'}</div>
                              <div className="ta-lb-metric-key">CALLS</div>
                            </div>
                            <div className="ta-lb-metric">
                              <div className="ta-lb-metric-val">{m.calls > 0 ? `${Math.round(cr!)}%` : '—'}</div>
                              <div className="ta-lb-metric-key">CONNECT</div>
                            </div>
                            <div className="ta-lb-metric">
                              <div className="ta-lb-metric-val" style={{ color: m.conversions > 0 ? T.green : T.text }}>
                                {m.conversions > 0 ? m.conversions.toLocaleString() : '—'}
                              </div>
                              <div className="ta-lb-metric-key">CONV</div>
                            </div>
                            <div className="ta-lb-metric">
                              <div className="ta-lb-metric-val">{m.talkSeconds > 0 ? fmtTime(m.talkSeconds) : '—'}</div>
                              <div className="ta-lb-metric-key">TALK</div>
                            </div>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            )}

            {/* YOUR STATS — member view — one personal scoreboard card */}
            {!isOwner && (
              <div className="ta-section">
                <div className="ta-section-head">▸ YOUR STATS</div>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <div className="ta-personal-grid">
                    <div className="ta-personal-cell">
                      <span className="ta-personal-key">CALLS</span>
                      <span className="ta-personal-val">
                        {data.viewerStats.calls > 0 ? data.viewerStats.calls.toLocaleString() : <Awaiting />}
                      </span>
                    </div>
                    <div className="ta-personal-cell">
                      <span className="ta-personal-key">CONNECTED</span>
                      <span className="ta-personal-val">
                        {data.viewerStats.connected > 0 ? data.viewerStats.connected.toLocaleString() : <Awaiting />}
                      </span>
                    </div>
                    <div className="ta-personal-cell">
                      <span className="ta-personal-key">CONVERSIONS</span>
                      <span className="ta-personal-val" style={{ color: data.viewerStats.conversions > 0 ? T.green : T.text }}>
                        {data.viewerStats.conversions > 0 ? data.viewerStats.conversions.toLocaleString() : <Awaiting />}
                      </span>
                    </div>
                    <div className="ta-personal-cell">
                      <span className="ta-personal-key">TALK TIME</span>
                      <span className="ta-personal-val">
                        {data.viewerStats.talkSeconds > 0 ? fmtTime(data.viewerStats.talkSeconds) : <Awaiting />}
                      </span>
                    </div>
                  </div>
                  {viewerConnectPct !== null && (
                    <div style={{ paddingRight: 22, flexShrink: 0 }}>
                      <Ring pct={viewerConnectPct} size={64} stroke={6} color={T.blue} />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* RECENT CALLS — owner only — activity feed instead of a table */}
            {isOwner && (
              <div className="ta-section">
                <div className="ta-section-head">
                  ▸ RECENT CALLS{data.recentCalls.length > 0 && ` (LAST ${data.recentCalls.length})`}
                </div>
                <div className="ta-list">
                  {data.recentCalls.length > 0 ? (
                    data.recentCalls.map(c => (
                      <div key={c.id} className="ta-row ta-call-row">
                        <Avatar name={c.memberName} />
                        <div className="ta-call-main">
                          <div className="ta-call-lead">
                            {c.leadName}
                            {c.phone && <span style={{ color: T.muted, fontWeight: 400 }}> · {c.phone}</span>}
                          </div>
                          <div className="ta-call-meta">{c.memberName}</div>
                        </div>
                        {c.disposition ? (
                          <span className="ta-disp-badge" style={{
                            color: dispColor(c.disposition),
                            background: `${dispColor(c.disposition)}1f`,
                          }}>
                            {c.disposition}
                          </span>
                        ) : (
                          <span style={{ color: T.muted, fontSize: 9, letterSpacing: 1 }}>—</span>
                        )}
                        <div className="ta-call-right">
                          <div className="ta-call-time">{relTime(c.createdAt)}</div>
                          <div className="ta-call-dur">{fmtTime(c.duration)}</div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="ta-empty">NO CALLS LOGGED YET</div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
