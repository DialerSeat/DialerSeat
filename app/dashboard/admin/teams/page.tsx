'use client'
import { useState, useEffect, useMemo } from 'react'

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

interface Member {
  id: string
  userId: string
  name: string
  email: string | null
  status: 'active' | 'pending' | 'removed'
  acceptedAt: string | null
  removedAt: string | null
}

interface Seat {
  id: string
  agentId: string
  agentName: string
  agentEmail: string | null
  amountCents: number
  status: 'paid' | 'pending' | 'failed' | 'voided'
  periodStart: string
  periodEnd: string
  stripeSubscriptionId: string | null
}

interface AdminTeam {
  id: string
  name: string
  description: string | null
  createdAt: string
  owner: { id: string; name: string; email: string | null }
  memberCount: number
  pendingMemberCount: number
  activeSeats: number
  pendingSeats: number
  failedSeats: number
  voidedSeats: number
  campaignCount: number
  wrr_cents: number
  mrr_cents: number
  members: Member[]
  seats: Seat[]
}

interface Response {
  success: boolean
  teams: AdminTeam[]
  platformTotals: {
    teams: number
    activeSeats: number
    pendingSeats: number
    mrr_cents: number
    wrr_cents: number
  }
}

type SortKey = 'wrr' | 'members' | 'seats' | 'created' | 'name'

const fmtMoney = (cents: number) => `$${(cents / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })

export default function AdminTeamsPage() {
  const [data, setData] = useState<Response | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('wrr')
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  useEffect(() => {
    let cancelled = false
    fetch('/api/admin/teams')
      .then(async r => {
        if (r.status === 403) throw new Error('Forbidden — admin only')
        return r.json()
      })
      .then(d => {
        if (cancelled) return
        if (d.success) setData(d)
        else setError(d.error || 'Failed to load')
        setLoading(false)
      })
      .catch(err => {
        if (cancelled) return
        setError(err.message)
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  const teams = useMemo(() => {
    if (!data) return []
    let list = [...data.teams]
    const s = search.trim().toLowerCase()
    if (s) {
      list = list.filter(t =>
        t.name.toLowerCase().includes(s) ||
        t.owner.name.toLowerCase().includes(s) ||
        (t.owner.email || '').toLowerCase().includes(s)
      )
    }
    switch (sortKey) {
      case 'wrr': list.sort((a, b) => b.wrr_cents - a.wrr_cents); break
      case 'members': list.sort((a, b) => b.memberCount - a.memberCount); break
      case 'seats': list.sort((a, b) => b.activeSeats - a.activeSeats); break
      case 'created': list.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)); break
      case 'name': list.sort((a, b) => a.name.localeCompare(b.name)); break
    }
    return list
  }, [data, search, sortKey])

  const toggle = (id: string) => setExpanded(p => ({ ...p, [id]: !p[id] }))

  return (
    <div style={{
      flex: 1, background: T.bg, minHeight: 'calc(100vh - 64px)',
      display: 'flex', flexDirection: 'column',
      fontFamily: 'Futura PT, Futura, sans-serif',
    }}>
      {/* HEADER */}
      <div style={{
        background: T.dark, padding: '12px 20px',
        borderBottom: `2px solid ${T.accent}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 16, flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontSize: 11, fontWeight: 'bold', letterSpacing: 4, color: T.blue }}>TEAMS</span>
          {data && (
            <span style={{ fontSize: 10, fontFamily: 'monospace', color: '#8888aa', letterSpacing: 1 }}>
              {data.platformTotals.teams} TEAMS · {data.platformTotals.activeSeats} ACTIVE SEATS · {fmtMoney(data.platformTotals.wrr_cents)}/WK
            </span>
          )}
        </div>
      </div>

      <div style={{ flex: 1, padding: '16px 20px', maxWidth: 1200, width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>

        {loading && (
          <div style={{ padding: 40, textAlign: 'center', fontSize: 11, letterSpacing: 3, color: T.muted }}>
            LOADING TEAMS...
          </div>
        )}

        {error && (
          <div style={{
            padding: 16, fontSize: 12, color: T.red, background: '#f8e8e8',
            border: `1px solid ${T.red}`, borderRadius: 4,
          }}>{error}</div>
        )}

        {!loading && !error && data && (
          <>
            {/* PLATFORM TOTALS */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: 10, marginBottom: 18,
            }}>
              <PlatformStat label="TOTAL TEAMS" value={data.platformTotals.teams.toString()} accent={T.blue} />
              <PlatformStat label="ACTIVE SEATS" value={data.platformTotals.activeSeats.toString()} accent={T.green} />
              <PlatformStat label="PENDING SEATS" value={data.platformTotals.pendingSeats.toString()} accent={T.amber} />
              <PlatformStat label="WEEKLY RECURRING" value={fmtMoney(data.platformTotals.wrr_cents)} accent={T.accent} />
              <PlatformStat label="EST. MONTHLY" value={fmtMoney(data.platformTotals.mrr_cents)} accent={T.accent} />
            </div>

            {/* CONTROLS */}
            <div style={{
              display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap',
            }}>
              <input
                type="text"
                placeholder="Search team or owner..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{
                  flex: '1 1 200px', minWidth: 0,
                  padding: '8px 12px',
                  background: T.surface, border: `1px solid ${T.border}`, borderRadius: 3,
                  fontFamily: 'monospace', fontSize: 12, color: T.text, outline: 'none',
                }}
              />
              <select
                value={sortKey}
                onChange={e => setSortKey(e.target.value as SortKey)}
                style={{
                  padding: '8px 12px',
                  background: T.surface, border: `1px solid ${T.border}`, borderRadius: 3,
                  fontFamily: 'monospace', fontSize: 11, color: T.text,
                  letterSpacing: 1, cursor: 'pointer',
                }}
              >
                <option value="wrr">SORT: REVENUE ↓</option>
                <option value="members">SORT: MEMBERS ↓</option>
                <option value="seats">SORT: ACTIVE SEATS ↓</option>
                <option value="created">SORT: NEWEST</option>
                <option value="name">SORT: NAME A-Z</option>
              </select>
            </div>

            {/* TEAM LIST */}
            {teams.length === 0 ? (
              <div style={{
                background: T.surface, border: `1px dashed ${T.border}`, borderRadius: 4,
                padding: '32px 24px', textAlign: 'center',
              }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>🏢</div>
                <div style={{ fontSize: 13, fontWeight: 'bold', letterSpacing: 3, color: T.muted, marginBottom: 6 }}>
                  {search ? 'NO TEAMS MATCH' : 'NO TEAMS ON PLATFORM YET'}
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {teams.map(team => {
                  const isExpanded = !!expanded[team.id]
                  return (
                    <div key={team.id} style={{
                      background: T.surface, border: `1px solid ${T.border}`,
                      borderLeft: `3px solid ${team.activeSeats > 0 ? T.green : T.muted}`,
                      borderRadius: 3, overflow: 'hidden',
                    }}>
                      <div
                        onClick={() => toggle(team.id)}
                        style={{
                          padding: '12px 16px', cursor: 'pointer', userSelect: 'none',
                          display: 'flex', alignItems: 'center', gap: 12,
                          background: isExpanded ? '#dde0e8' : T.surface,
                          borderBottom: isExpanded ? `1px solid ${T.border}` : 'none',
                          flexWrap: 'wrap',
                        }}
                      >
                        <div style={{
                          fontSize: 14, color: T.muted,
                          transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                          transition: 'transform 0.15s',
                        }}>›</div>
                        <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                          <div style={{
                            fontSize: 13, fontWeight: 'bold', color: T.text, letterSpacing: 0.5,
                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                          }}>{team.name}</div>
                          <div style={{ fontSize: 10, color: T.muted, fontFamily: 'monospace', marginTop: 2 }}>
                            {team.owner.name}{team.owner.email ? ` · ${team.owner.email}` : ''}
                          </div>
                        </div>
                        <Stat label="MEMBERS" value={team.memberCount.toString()} muted={team.memberCount === 0} />
                        <Stat label="SEATS" value={team.activeSeats.toString()} accent={team.activeSeats > 0 ? T.green : undefined} />
                        <Stat label="WRR" value={fmtMoney(team.wrr_cents)} accent={team.wrr_cents > 0 ? T.accent : undefined} />
                      </div>

                      {isExpanded && (
                        <div style={{ padding: '14px 18px' }}>
                          {/* Inline metadata row */}
                          <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                            gap: 8, marginBottom: 14,
                          }}>
                            <DetailCell label="CREATED" value={fmtDate(team.createdAt)} />
                            <DetailCell label="CAMPAIGNS" value={team.campaignCount.toString()} />
                            <DetailCell label="PENDING SEATS" value={team.pendingSeats.toString()} accent={team.pendingSeats > 0 ? T.amber : undefined} />
                            <DetailCell label="FAILED" value={team.failedSeats.toString()} accent={team.failedSeats > 0 ? T.red : undefined} />
                            <DetailCell label="EST. MRR" value={fmtMoney(team.mrr_cents)} />
                          </div>

                          {team.description && (
                            <div style={{
                              fontSize: 11, color: T.muted, lineHeight: 1.5,
                              padding: '8px 12px', background: T.bg, borderRadius: 3, marginBottom: 14,
                            }}>{team.description}</div>
                          )}

                          {/* MEMBERS */}
                          <div style={{ marginBottom: 14 }}>
                            <SectionTitle text={`MEMBERS (${team.members.length})`} />
                            {team.members.length === 0 ? (
                              <Empty text="No members on this team yet." />
                            ) : (
                              <div style={{ overflowX: 'auto' }}>
                                <table style={tableStyle}>
                                  <thead>
                                    <tr style={{ borderBottom: `1px solid ${T.border}` }}>
                                      <th style={thStyle}>NAME</th>
                                      <th style={thStyle}>STATUS</th>
                                      <th style={thStyle}>JOINED</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {team.members.map(m => (
                                      <tr key={m.id} style={{ borderBottom: `1px solid ${T.border}` }}>
                                        <td style={tdStyle}>
                                          <div style={{ fontSize: 12, color: T.text }}>{m.name}</div>
                                          {m.email && m.email !== m.name && (
                                            <div style={{ fontSize: 10, color: T.muted, fontFamily: 'monospace' }}>{m.email}</div>
                                          )}
                                        </td>
                                        <td style={tdStyle}>
                                          <Badge color={
                                            m.status === 'active' ? T.green :
                                            m.status === 'pending' ? T.amber : T.muted
                                          }>{m.status.toUpperCase()}</Badge>
                                        </td>
                                        <td style={{ ...tdStyle, fontSize: 11, color: T.muted, fontFamily: 'monospace' }}>
                                          {m.acceptedAt ? fmtDate(m.acceptedAt) : '—'}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>

                          {/* SEAT CHARGES */}
                          <div>
                            <SectionTitle text={`SEAT CHARGES (${team.seats.length})`} />
                            {team.seats.length === 0 ? (
                              <Empty text="No seat subscriptions yet." />
                            ) : (
                              <div style={{ overflowX: 'auto' }}>
                                <table style={tableStyle}>
                                  <thead>
                                    <tr style={{ borderBottom: `1px solid ${T.border}` }}>
                                      <th style={thStyle}>AGENT</th>
                                      <th style={thStyle}>STATUS</th>
                                      <th style={thStyle}>$/WEEK</th>
                                      <th style={thStyle}>PERIOD</th>
                                      <th style={thStyle}>STRIPE SUB</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {team.seats.map(s => (
                                      <tr key={s.id} style={{ borderBottom: `1px solid ${T.border}` }}>
                                        <td style={tdStyle}>
                                          <div style={{ fontSize: 12, color: T.text }}>{s.agentName}</div>
                                          {s.agentEmail && s.agentEmail !== s.agentName && (
                                            <div style={{ fontSize: 10, color: T.muted, fontFamily: 'monospace' }}>{s.agentEmail}</div>
                                          )}
                                        </td>
                                        <td style={tdStyle}>
                                          <Badge color={
                                            s.status === 'paid' ? T.green :
                                            s.status === 'pending' ? T.amber :
                                            s.status === 'failed' ? T.red : T.muted
                                          }>{s.status.toUpperCase()}</Badge>
                                        </td>
                                        <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: 11 }}>
                                          {fmtMoney(s.amountCents)}
                                        </td>
                                        <td style={{ ...tdStyle, fontSize: 10, color: T.muted, fontFamily: 'monospace' }}>
                                          {fmtDate(s.periodStart)} → {fmtDate(s.periodEnd)}
                                        </td>
                                        <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: 10, color: T.muted }}>
                                          {s.stripeSubscriptionId
                                            ? <span title={s.stripeSubscriptionId}>{s.stripeSubscriptionId.slice(0, 14)}…</span>
                                            : <span style={{ color: T.amber }}>NOT WIRED</span>
                                          }
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function PlatformStat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div style={{
      padding: '12px 14px',
      background: T.surface, border: `1px solid ${T.border}`,
      borderTop: `3px solid ${accent}`, borderRadius: 3,
    }}>
      <div style={{ fontSize: 9, letterSpacing: 2, color: T.muted, fontWeight: 'bold', marginBottom: 6 }}>
        {label}
      </div>
      <div style={{
        fontSize: 22, fontWeight: 'bold', color: accent, lineHeight: 1, fontFamily: 'monospace',
      }}>{value}</div>
    </div>
  )
}

function Stat({ label, value, accent, muted }: { label: string; value: string; accent?: string; muted?: boolean }) {
  return (
    <div style={{
      padding: '4px 12px', background: T.bg,
      border: `1px solid ${T.border}`, borderRadius: 3,
      minWidth: 70, textAlign: 'center',
    }}>
      <div style={{ fontSize: 8, letterSpacing: 2, color: T.muted, fontWeight: 'bold' }}>{label}</div>
      <div style={{
        fontSize: 13, fontWeight: 'bold', fontFamily: 'monospace',
        color: muted ? T.muted : (accent || T.text),
      }}>{value}</div>
    </div>
  )
}

function DetailCell({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div style={{
      padding: '8px 10px', background: T.bg,
      border: `1px solid ${T.border}`, borderRadius: 3,
    }}>
      <div style={{ fontSize: 8, letterSpacing: 2, color: T.muted, fontWeight: 'bold', marginBottom: 4 }}>
        {label}
      </div>
      <div style={{
        fontSize: 12, fontWeight: 'bold', fontFamily: 'monospace',
        color: accent || T.text,
      }}>{value}</div>
    </div>
  )
}

function SectionTitle({ text }: { text: string }) {
  return (
    <div style={{
      fontSize: 10, letterSpacing: 3, color: T.muted, fontWeight: 'bold', marginBottom: 8,
    }}>▸ {text}</div>
  )
}

function Empty({ text }: { text: string }) {
  return (
    <div style={{
      fontSize: 11, color: T.muted, lineHeight: 1.5,
      padding: '10px 12px', background: T.bg,
      border: `1px dashed ${T.border}`, borderRadius: 3,
    }}>{text}</div>
  )
}

function Badge({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span style={{
      padding: '2px 8px', borderRadius: 3,
      fontSize: 9, fontWeight: 'bold', letterSpacing: 1.5,
      color, border: `1px solid ${color}`, background: 'transparent',
      whiteSpace: 'nowrap', fontFamily: 'monospace',
    }}>{children}</span>
  )
}

const tableStyle: React.CSSProperties = {
  width: '100%', borderCollapse: 'collapse',
  fontFamily: 'Futura PT, Futura, sans-serif',
}

const thStyle: React.CSSProperties = {
  padding: '8px 10px',
  fontSize: 9, letterSpacing: 2,
  color: T.muted, fontWeight: 'bold',
  textAlign: 'left', whiteSpace: 'nowrap',
}

const tdStyle: React.CSSProperties = {
  padding: '8px 10px',
  fontSize: 12, color: T.text, textAlign: 'left',
}