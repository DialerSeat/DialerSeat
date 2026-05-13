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

interface DeleteState {
  team: AdminTeam
  step: 1 | 2
  confirmText: string
  busy: boolean
  error: string | null
}

export default function AdminTeamsPage() {
  const [data, setData] = useState<Response | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('wrr')
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [deleting, setDeleting] = useState<DeleteState | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const loadTeams = async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/admin/teams')
      if (r.status === 403) throw new Error('Forbidden — admin only')
      const d = await r.json()
      if (d.success) setData(d)
      else setError(d.error || 'Failed to load')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

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

  const startDelete = (team: AdminTeam, e: React.MouseEvent) => {
    e.stopPropagation()
    setDeleting({ team, step: 1, confirmText: '', busy: false, error: null })
  }

  const cancelDelete = () => setDeleting(null)

  const confirmDeleteStep1 = () => {
    if (!deleting) return
    setDeleting({ ...deleting, step: 2 })
  }

  const executeDelete = async () => {
    if (!deleting) return
    if (deleting.confirmText.trim().toLowerCase() !== 'remove') {
      setDeleting({ ...deleting, error: 'Type "remove" exactly to confirm' })
      return
    }
    setDeleting({ ...deleting, busy: true, error: null })
    try {
      const res = await fetch('/api/admin/teams/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId: deleting.team.id, confirm: 'remove' }),
      })
      const d = await res.json()
      if (!d.success) {
        setDeleting({ ...deleting, busy: false, error: d.error || 'Delete failed' })
        return
      }
      const teamName = deleting.team.name
      setDeleting(null)
      setToast(`Deleted "${teamName}" — ${d.deleted.membersRemoved} members removed, ${d.deleted.campaignsDetached} campaigns detached`)
      setTimeout(() => setToast(null), 6000)
      await loadTeams()
    } catch (err: any) {
      setDeleting({ ...deleting, busy: false, error: err.message })
    }
  }

  return (
    <div style={{
      flex: 1, background: T.bg, minHeight: 'calc(100vh - 64px)',
      display: 'flex', flexDirection: 'column',
      fontFamily: 'Futura PT, Futura, sans-serif',
      position: 'relative',
    }}>
      {toast && (
        <div style={{
          position: 'fixed', top: 80, right: 20, zIndex: 200,
          padding: '12px 18px', background: T.dark, color: '#32ff7e',
          border: `1px solid ${T.green}`, borderRadius: 4,
          fontSize: 11, fontWeight: 'bold', letterSpacing: 1,
          fontFamily: 'monospace', boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
          maxWidth: 480,
        }}>
          ✓ {toast}
        </div>
      )}

      {deleting && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 300,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 20,
          }}
          onClick={(e) => { if (e.target === e.currentTarget && !deleting.busy) cancelDelete() }}
        >
          <div style={{
            width: '100%', maxWidth: 480,
            background: T.dark, border: `1px solid ${T.red}`,
            borderTop: `3px solid ${T.red}`, borderRadius: 4,
            padding: 24, color: '#e0e2ea', boxSizing: 'border-box',
          }}>
            <div style={{
              fontSize: 11, letterSpacing: 4, color: T.red,
              fontWeight: 'bold', marginBottom: 14,
            }}>
              {deleting.step === 1 ? '⚠ CONFIRM DELETE' : '⚠ FINAL CONFIRMATION'}
            </div>

            {deleting.step === 1 ? (
              <>
                <div style={{ fontSize: 13, lineHeight: 1.6, color: '#c0c2ca', marginBottom: 18 }}>
                  Permanently delete team <strong style={{ color: 'white' }}>&quot;{deleting.team.name}&quot;</strong>?
                </div>
                <div style={{
                  background: '#1a1c24', border: `1px solid #2a2c34`,
                  borderRadius: 3, padding: '10px 14px', marginBottom: 18,
                  fontSize: 11, lineHeight: 1.7, color: '#a0a2aa',
                  fontFamily: 'monospace',
                }}>
                  <div>OWNER: <span style={{ color: 'white' }}>{deleting.team.owner.name}</span></div>
                  <div>MEMBERS: <span style={{ color: 'white' }}>{deleting.team.memberCount}</span></div>
                  <div>CAMPAIGNS ATTACHED: <span style={{ color: 'white' }}>{deleting.team.campaignCount}</span></div>
                  <div>ACTIVE PAID SEATS: <span style={{
                    color: deleting.team.activeSeats > 0 ? '#ff6464' : 'white',
                    fontWeight: deleting.team.activeSeats > 0 ? 'bold' : 'normal',
                  }}>{deleting.team.activeSeats}</span></div>
                  <div>WEEKLY REVENUE: <span style={{
                    color: deleting.team.wrr_cents > 0 ? '#ffaa3e' : 'white',
                    fontWeight: deleting.team.wrr_cents > 0 ? 'bold' : 'normal',
                  }}>{fmtMoney(deleting.team.wrr_cents)}</span></div>
                </div>

                {deleting.team.activeSeats > 0 && (
                  <div style={{
                    background: 'rgba(138,26,26,0.2)',
                    border: `1px solid ${T.red}`,
                    borderLeft: `3px solid ${T.red}`,
                    borderRadius: 3, padding: '10px 12px', marginBottom: 18,
                    fontSize: 11, lineHeight: 1.6, color: '#ffaaaa',
                  }}>
                    <strong>⚠ This team has {deleting.team.activeSeats} active paid seat(s).</strong>
                    {' '}Stripe charges will NOT be auto-cancelled. The owner will keep getting billed unless you cancel their subscriptions in Stripe manually.
                  </div>
                )}

                <div style={{
                  fontSize: 10, color: '#888a92', letterSpacing: 1, lineHeight: 1.5,
                  marginBottom: 20,
                }}>
                  This will permanently remove the team, all member associations, and detach all campaigns. Seat charge history will be preserved for audit. This cannot be undone.
                </div>

                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  <button onClick={cancelDelete} style={modalBtnSecondary}>CANCEL</button>
                  <button onClick={confirmDeleteStep1} style={modalBtnDanger}>YES, CONTINUE</button>
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 13, lineHeight: 1.6, color: '#c0c2ca', marginBottom: 18 }}>
                  Type <strong style={{ color: T.red, fontFamily: 'monospace' }}>remove</strong> below to permanently destroy <strong style={{ color: 'white' }}>&quot;{deleting.team.name}&quot;</strong>.
                </div>

                <input
                  autoFocus
                  type="text"
                  placeholder="type: remove"
                  value={deleting.confirmText}
                  onChange={e => setDeleting({ ...deleting, confirmText: e.target.value, error: null })}
                  onKeyDown={e => { if (e.key === 'Enter' && !deleting.busy) executeDelete() }}
                  disabled={deleting.busy}
                  style={{
                    width: '100%', padding: '12px 14px',
                    background: '#1a1c24', border: `1px solid ${T.red}`,
                    borderRadius: 3, fontFamily: 'monospace', fontSize: 14,
                    color: 'white', outline: 'none', letterSpacing: 2,
                    marginBottom: 12, boxSizing: 'border-box',
                  }}
                />

                {deleting.error && (
                  <div style={{
                    padding: '8px 12px', background: 'rgba(138,26,26,0.2)',
                    border: `1px solid ${T.red}`, borderRadius: 3,
                    fontSize: 11, color: '#ffaaaa', marginBottom: 14,
                  }}>{deleting.error}</div>
                )}

                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  <button onClick={cancelDelete} disabled={deleting.busy} style={modalBtnSecondary}>CANCEL</button>
                  <button
                    onClick={executeDelete}
                    disabled={deleting.busy || deleting.confirmText.trim().toLowerCase() !== 'remove'}
                    style={{
                      ...modalBtnDanger,
                      opacity: (deleting.busy || deleting.confirmText.trim().toLowerCase() !== 'remove') ? 0.5 : 1,
                      cursor: (deleting.busy || deleting.confirmText.trim().toLowerCase() !== 'remove') ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {deleting.busy ? 'DELETING...' : '■ DESTROY TEAM'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

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
                        <button
                          onClick={(e) => startDelete(team, e)}
                          style={{
                            padding: '6px 12px',
                            background: 'transparent', color: T.red,
                            border: `1px solid ${T.red}`, borderRadius: 3,
                            fontSize: 9, letterSpacing: 2, fontWeight: 'bold',
                            cursor: 'pointer', fontFamily: 'Futura PT, Futura, sans-serif',
                            whiteSpace: 'nowrap',
                          }}
                          title="Delete this team permanently"
                        >■ DELETE</button>
                      </div>

                      {isExpanded && (
                        <div style={{ padding: '14px 18px' }}>
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

const modalBtnSecondary: React.CSSProperties = {
  padding: '10px 18px',
  background: 'transparent', color: '#a0a2aa',
  border: '1px solid #4a4a5e', borderRadius: 3,
  fontSize: 10, letterSpacing: 3, fontWeight: 'bold',
  cursor: 'pointer', fontFamily: 'Futura PT, Futura, sans-serif',
}

const modalBtnDanger: React.CSSProperties = {
  padding: '10px 18px',
  background: '#8a1a1a', color: 'white',
  border: 'none', borderRadius: 3,
  fontSize: 10, letterSpacing: 3, fontWeight: 'bold',
  cursor: 'pointer', fontFamily: 'Futura PT, Futura, sans-serif',
}