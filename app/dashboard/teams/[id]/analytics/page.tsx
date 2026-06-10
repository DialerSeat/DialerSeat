'use client'
import { use, useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

// =============================================================================
// /dashboard/teams/[id]/analytics — TEAM ANALYTICS DASHBOARD
// =============================================================================
// Replaces the old /dashboard/teams/[id] 404. The API used to live at
// /dashboard/teams/[id]/route.ts, which conflicted with the page URL —
// it's been moved to /api/teams/[id]/analytics. This page consumes that.
//
// Layout:
//   - Page header strip (var(--brand-header-bg)) with team name + back link
//   - Controls strip: range buttons (TODAY / 7-DAY / 30-DAY / CUSTOM),
//     campaign filter dropdown, member filter dropdown (owner only)
//   - KPI tiles: calls / connect rate / conversions / talk time
//   - Owner: leaderboard table + recent calls feed
//   - Member: own stats only (no peer data exposure)
// =============================================================================

const T = {
  bg: 'var(--brand-page-bg)',
  surface: 'var(--brand-card-surface)',
  border: 'var(--brand-card-border)',
  dark: 'var(--brand-sidebar-bg)',
  text: 'var(--brand-on-page-bg)',
  muted: 'var(--brand-muted-text)',
  accent: '#2a4a8a',
  blue: 'var(--brand-primary)',
  green: '#1a6a1a',
  red: '#8a1a1a',
  amber: '#8a6a1a',
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

function dispColor(disp: string | null): string {
  switch (disp) {
    case 'CLOSED': return T.green
    case 'APPOINTMENT': return '#1a4a8a'
    case 'NOT INTERESTED': return T.amber
    case 'DO NOT CALL': return T.red
    default: return T.muted
  }
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
    // Skip the fetch if custom range chosen but dates not filled in yet
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
        // end-of-day on custom end so the picker feels inclusive
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

  const connectRate = data && data.totals.calls > 0
    ? `${Math.round((data.totals.connected / data.totals.calls) * 100)}%`
    : '—'

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
          padding: 12px 20px;
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
        .ta-controls {
          padding: 12px 20px;
          background: ${T.surface};
          border-bottom: 1px solid ${T.border};
          display: flex; flex-wrap: wrap; gap: 14px;
          align-items: end;
        }
        .ta-range-group { display: flex; gap: 4px; flex-shrink: 0; }
        .ta-range-btn {
          padding: 6px 12px;
          background: transparent;
          border: 1px solid ${T.border};
          border-radius: 3px;
          color: ${T.muted};
          font-size: 10px; font-weight: bold; letter-spacing: 2px;
          cursor: pointer;
          font-family: ${FUTURA};
        }
        .ta-range-btn.active {
          background: ${T.blue};
          border-color: ${T.blue};
          color: white;
        }
        .ta-custom-inputs {
          display: flex; gap: 6px; align-items: center;
        }
        .ta-custom-inputs input {
          padding: 5px 8px;
          background: ${T.bg};
          border: 1px solid ${T.border};
          border-radius: 3px;
          font-size: 11px; color: ${T.text};
          font-family: monospace;
        }
        .ta-filter-field {
          display: flex; flex-direction: column; gap: 3px;
        }
        .ta-filter-field label {
          font-size: 9px; letter-spacing: 2px; color: ${T.muted};
          font-weight: bold;
        }
        .ta-filter-field select {
          padding: 5px 8px;
          background: ${T.bg};
          border: 1px solid ${T.border};
          border-radius: 3px;
          font-size: 11px; color: ${T.text};
          font-family: monospace;
          min-width: 180px; cursor: pointer;
        }
        .ta-body {
          flex: 1; padding: 16px 20px;
          max-width: 1200px; width: 100%; margin: 0 auto;
          box-sizing: border-box;
        }
        .ta-error {
          padding: 14px 18px;
          background: #f8e8e8;
          border: 1px solid ${T.red};
          color: ${T.red};
          border-radius: 4px;
          font-size: 12px; letter-spacing: 1px;
          margin-bottom: 14px;
        }
        .ta-kpi-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 10px; margin-bottom: 18px;
        }
        .ta-kpi {
          padding: 14px 16px;
          background: ${T.surface};
          border: 1px solid ${T.border};
          border-top: 3px solid ${T.blue};
          border-radius: 4px;
        }
        .ta-kpi-label {
          font-size: 9px; letter-spacing: 2px;
          color: ${T.muted}; font-weight: bold;
          margin-bottom: 5px;
        }
        .ta-kpi-value {
          font-size: 24px; font-weight: bold;
          font-family: monospace;
          color: ${T.text}; letter-spacing: 1px;
        }
        .ta-section {
          background: ${T.surface};
          border: 1px solid ${T.border};
          border-radius: 4px;
          margin-bottom: 14px;
          overflow: hidden;
        }
        .ta-section-head {
          padding: 10px 14px;
          border-bottom: 1px solid ${T.border};
          font-size: 10px; letter-spacing: 3px;
          color: ${T.muted}; font-weight: bold;
        }
        .ta-table {
          width: 100%; border-collapse: collapse;
        }
        .ta-table th {
          padding: 8px 12px; text-align: left;
          font-size: 9px; letter-spacing: 2px;
          color: ${T.muted}; font-weight: bold;
          background: ${T.bg};
          border-bottom: 1px solid ${T.border};
        }
        .ta-table td {
          padding: 9px 12px;
          font-size: 11px; font-family: monospace;
          color: ${T.text};
          border-bottom: 1px solid ${T.border};
        }
        .ta-table tr:last-child td { border-bottom: none; }
        .ta-table tr:hover td { background: ${T.bg}; }
        .ta-empty {
          padding: 32px 20px; text-align: center;
          font-size: 11px; letter-spacing: 3px;
          color: ${T.muted}; font-weight: bold;
        }
        .ta-disp-badge {
          display: inline-block;
          padding: 2px 8px;
          border-radius: 3px;
          font-size: 9px; letter-spacing: 1px;
          font-weight: bold;
          font-family: ${FUTURA};
        }

        @media (max-width: 768px) {
          .ta-kpi-grid { grid-template-columns: repeat(2, 1fr); }
          .ta-controls { padding: 12px; }
          .ta-body { padding: 12px; }
          .ta-table th, .ta-table td { padding: 7px 8px; font-size: 10px; }
          .ta-filter-field select { min-width: 140px; }
          .ta-kpi-value { font-size: 20px; }
        }
      `}</style>

      <div className="ta-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <Link href="/dashboard/teams" className="ta-back">← TEAMS</Link>
          <span style={{
            fontSize: 11, fontWeight: 'bold', letterSpacing: 4, color: T.blue,
          }}>
            {data?.team.name?.toUpperCase() || 'TEAM'} · ANALYTICS
          </span>
          {data && (
            <span style={{
              fontSize: 9, color: 'var(--brand-on-header-muted)',
              letterSpacing: 1, fontFamily: 'monospace',
            }}>
              {data.viewerRole.toUpperCase()}
            </span>
          )}
        </div>
      </div>

      <div className="ta-controls">
        <div className="ta-range-group">
          {(['today', 'week', 'month', 'custom'] as const).map(r => (
            <button
              key={r}
              className={`ta-range-btn ${range === r ? 'active' : ''}`}
              onClick={() => setRange(r)}
            >
              {r === 'today' ? 'TODAY'
                : r === 'week' ? '7-DAY'
                : r === 'month' ? '30-DAY'
                : 'CUSTOM'}
            </button>
          ))}
        </div>
        {range === 'custom' && (
          <div className="ta-custom-inputs">
            <input
              type="date"
              value={customStart}
              onChange={e => setCustomStart(e.target.value)}
            />
            <span style={{ fontSize: 10, color: T.muted }}>→</span>
            <input
              type="date"
              value={customEnd}
              onChange={e => setCustomEnd(e.target.value)}
            />
          </div>
        )}
        <div className="ta-filter-field">
          <label>CAMPAIGN</label>
          <select
            value={campaignFilter}
            onChange={e => setCampaignFilter(e.target.value)}
          >
            <option value="all">[ ALL CAMPAIGNS ]</option>
            {(data?.campaigns || []).map(c => (
              <option key={c.campaignId} value={c.campaignId}>
                {c.name || c.campaignId.slice(0, 8)}
              </option>
            ))}
          </select>
        </div>
        {showMemberFilter && (
          <div className="ta-filter-field">
            <label>MEMBER</label>
            <select
              value={memberFilter}
              onChange={e => setMemberFilter(e.target.value)}
            >
              <option value="all">[ ALL MEMBERS ]</option>
              {(data?.members || []).map(m => (
                <option key={m.userId} value={m.userId}>
                  {m.name}{m.isOwner ? ' (OWNER)' : ''}
                </option>
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
                <div className="ta-kpi-label">TOTAL CALLS</div>
                <div className="ta-kpi-value">{data.totals.calls.toLocaleString()}</div>
              </div>
              <div className="ta-kpi">
                <div className="ta-kpi-label">CONNECT RATE</div>
                <div className="ta-kpi-value">{connectRate}</div>
              </div>
              <div className="ta-kpi">
                <div className="ta-kpi-label">CONVERSIONS</div>
                <div className="ta-kpi-value" style={{
                  color: data.totals.conversions > 0 ? T.green : T.text,
                }}>
                  {data.totals.conversions.toLocaleString()}
                </div>
              </div>
              <div className="ta-kpi">
                <div className="ta-kpi-label">TALK TIME</div>
                <div className="ta-kpi-value">{fmtTime(data.totals.talkSeconds)}</div>
              </div>
            </div>

            {isOwner && (
              <div className="ta-section">
                <div className="ta-section-head">
                  ▸ LEADERBOARD
                  {memberFilter !== 'all' && <span style={{ color: T.amber, marginLeft: 8 }}>· FILTERED</span>}
                  {campaignFilter !== 'all' && <span style={{ color: T.amber, marginLeft: 8 }}>· CAMPAIGN FILTERED</span>}
                </div>
                {data.leaderboard.length === 0 ? (
                  <div className="ta-empty">NO DATA IN THIS RANGE</div>
                ) : (
                  <table className="ta-table">
                    <thead>
                      <tr>
                        <th>MEMBER</th>
                        <th style={{ textAlign: 'right' }}>CALLS</th>
                        <th style={{ textAlign: 'right' }}>CONNECTED</th>
                        <th style={{ textAlign: 'right' }}>CONV</th>
                        <th style={{ textAlign: 'right' }}>TALK</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.leaderboard.map(m => {
                        const cr = m.calls > 0
                          ? `${Math.round((m.connected / m.calls) * 100)}%`
                          : '—'
                        return (
                          <tr key={m.userId}>
                            <td>
                              <span style={{ fontWeight: 'bold' }}>{m.name}</span>
                              {m.isOwner && (
                                <span style={{
                                  marginLeft: 6, fontSize: 8, letterSpacing: 1,
                                  color: T.blue,
                                  padding: '1px 5px',
                                  border: `1px solid ${T.blue}`,
                                  borderRadius: 2,
                                }}>OWNER</span>
                              )}
                            </td>
                            <td style={{ textAlign: 'right' }}>{m.calls.toLocaleString()}</td>
                            <td style={{ textAlign: 'right' }}>
                              {m.connected.toLocaleString()}{' '}
                              <span style={{ color: T.muted }}>({cr})</span>
                            </td>
                            <td style={{
                              textAlign: 'right',
                              color: m.conversions > 0 ? T.green : T.muted,
                              fontWeight: 'bold',
                            }}>
                              {m.conversions.toLocaleString()}
                            </td>
                            <td style={{ textAlign: 'right' }}>{fmtTime(m.talkSeconds)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {!isOwner && (
              <div className="ta-section">
                <div className="ta-section-head">▸ YOUR STATS</div>
                <table className="ta-table">
                  <tbody>
                    <tr>
                      <td style={{ width: 200, color: T.muted, fontSize: 10, letterSpacing: 1.5 }}>
                        CALLS
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                        {data.viewerStats.calls.toLocaleString()}
                      </td>
                    </tr>
                    <tr>
                      <td style={{ color: T.muted, fontSize: 10, letterSpacing: 1.5 }}>
                        CONNECTED
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                        {data.viewerStats.connected.toLocaleString()}
                      </td>
                    </tr>
                    <tr>
                      <td style={{ color: T.muted, fontSize: 10, letterSpacing: 1.5 }}>
                        CONVERSIONS
                      </td>
                      <td style={{
                        textAlign: 'right', fontWeight: 'bold',
                        color: data.viewerStats.conversions > 0 ? T.green : T.text,
                      }}>
                        {data.viewerStats.conversions.toLocaleString()}
                      </td>
                    </tr>
                    <tr>
                      <td style={{ color: T.muted, fontSize: 10, letterSpacing: 1.5 }}>
                        TALK TIME
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                        {fmtTime(data.viewerStats.talkSeconds)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {isOwner && data.recentCalls.length > 0 && (
              <div className="ta-section">
                <div className="ta-section-head">
                  ▸ RECENT CALLS (LAST {data.recentCalls.length})
                </div>
                <table className="ta-table">
                  <thead>
                    <tr>
                      <th>WHEN</th>
                      <th>MEMBER</th>
                      <th>LEAD</th>
                      <th>DISPOSITION</th>
                      <th style={{ textAlign: 'right' }}>DURATION</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recentCalls.map(c => (
                      <tr key={c.id}>
                        <td>{fmtDateTime(c.createdAt)}</td>
                        <td style={{ fontWeight: 'bold' }}>{c.memberName}</td>
                        <td>
                          {c.leadName}
                          {c.phone && (
                            <span style={{ color: T.muted, marginLeft: 6 }}>{c.phone}</span>
                          )}
                        </td>
                        <td>
                          {c.disposition ? (
                            <span className="ta-disp-badge" style={{
                              color: dispColor(c.disposition),
                              border: `1px solid ${dispColor(c.disposition)}`,
                            }}>
                              {c.disposition}
                            </span>
                          ) : (
                            <span style={{ color: T.muted, fontSize: 9, letterSpacing: 1 }}>—</span>
                          )}
                        </td>
                        <td style={{ textAlign: 'right' }}>{fmtTime(c.duration)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {isOwner && data.recentCalls.length === 0 && data.totals.calls === 0 && (
              <div className="ta-section">
                <div className="ta-section-head">▸ RECENT CALLS</div>
                <div className="ta-empty">NO CALLS YET IN THIS RANGE</div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}