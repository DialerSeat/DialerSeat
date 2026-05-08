'use client'
import { useState, useEffect, useCallback } from 'react'
import { useUser } from '@clerk/nextjs'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'

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

type Range = 'today' | 'week' | 'month' | 'all'

interface TeamCampaignRow {
  campaignId: string
  accessMode: 'owner_pays' | 'agent_pays' | 'public'
  campaign: { id: string; name: string; total_leads: number; called_leads: number; status: string } | null
}
interface TeamDetail {
  id: string
  name: string
  description: string | null
  owner_id: string
  created_at: string
  viewerRole: 'owner' | 'member'
  viewerMembership: { id: string } | null
  members: any[]
  pendingMembers: any[]
  codes: any[]
  teamCampaigns: TeamCampaignRow[]
}

interface MemberStat {
  userId: string
  name: string
  email: string | null
  lastSeenAt: string | null
  isOwner: boolean
  calls: number
  connected: number
  conversions: number
  talkSeconds: number
}
interface RecentCall {
  id: string
  memberName: string
  leadName: string
  phone: string | null
  disposition: string | null
  duration: number
  createdAt: string
}
interface AnalyticsResponse {
  success: boolean
  range: Range
  viewerRole: 'owner' | 'member'
  team: { id: string; name: string }
  totals: { calls: number; connected: number; conversions: number; talkSeconds: number }
  leaderboard: MemberStat[]
  viewerStats: MemberStat
  recentCalls: RecentCall[]
}

const RANGE_OPTIONS: { v: Range; label: string }[] = [
  { v: 'today', label: 'TODAY' },
  { v: 'week', label: 'WEEK' },
  { v: 'month', label: 'MONTH' },
  { v: 'all', label: 'ALL' },
]

const ONLINE_THRESHOLD_MS = 5 * 60 * 1000 // 5 min

function fmtDuration(seconds: number): string {
  if (!seconds) return '0s'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

function fmtRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  if (ms < 60_000) return 'just now'
  if (ms < 3600_000) return `${Math.floor(ms / 60_000)}m ago`
  if (ms < 86400_000) return `${Math.floor(ms / 3600_000)}h ago`
  return `${Math.floor(ms / 86400_000)}d ago`
}

function isOnline(lastSeenAt: string | null): boolean {
  if (!lastSeenAt) return false
  return Date.now() - new Date(lastSeenAt).getTime() < ONLINE_THRESHOLD_MS
}

function dispoColor(d: string | null): string {
  switch (d) {
    case 'CLOSED': return T.green
    case 'APPOINTMENT': return T.blue
    case 'NOT INTERESTED': return T.amber
    case 'DO NOT CALL': return T.red
    case 'NO_ANSWER': return T.muted
    case 'SKIPPED': return T.muted
    default: return T.muted
  }
}

export default function TeamDetailPage() {
  const { user } = useUser()
  const router = useRouter()
  const params = useParams()
  const teamId = params?.teamId as string

  const [team, setTeam] = useState<TeamDetail | null>(null)
  const [analytics, setAnalytics] = useState<AnalyticsResponse | null>(null)
  const [range, setRange] = useState<Range>('week')

  const [loading, setLoading] = useState(true)
  const [analyticsLoading, setAnalyticsLoading] = useState(false)
  const [notFound, setNotFound] = useState(false)
  const [forbidden, setForbidden] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  // Edit team modal
  const [showEditModal, setShowEditModal] = useState(false)
  const [editName, setEditName] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [editSubmitting, setEditSubmitting] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  // Generic typed-confirm
  const [confirmState, setConfirmState] = useState<{
    title: string
    body: string
    confirmWord: string
    danger: boolean
    onConfirm: () => Promise<void>
  } | null>(null)
  const [confirmInput, setConfirmInput] = useState('')
  const [confirmSubmitting, setConfirmSubmitting] = useState(false)

  const loadTeam = useCallback(async () => {
    if (!teamId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/teams/${teamId}/get`)
      if (res.status === 404) { setNotFound(true); return }
      if (res.status === 403) { setForbidden(true); return }
      const data = await res.json()
      if (data.success) {
        setTeam(data.team)
      }
    } catch (err) {
      console.error('Load team error:', err)
    } finally {
      setLoading(false)
    }
  }, [teamId])

  const loadAnalytics = useCallback(async (r: Range) => {
    if (!teamId) return
    setAnalyticsLoading(true)
    try {
      const res = await fetch(`/api/teams/${teamId}/analytics?range=${r}`)
      const data: AnalyticsResponse = await res.json()
      if (data.success) setAnalytics(data)
    } catch (err) {
      console.error('Load analytics error:', err)
    } finally {
      setAnalyticsLoading(false)
    }
  }, [teamId])

  useEffect(() => {
    if (user) loadTeam()
  }, [user, loadTeam])

  useEffect(() => {
    if (team) loadAnalytics(range)
  }, [team, range, loadAnalytics])

  const openEditModal = () => {
    if (!team) return
    setEditName(team.name)
    setEditDesc(team.description || '')
    setEditError(null)
    setShowEditModal(true)
  }

  const submitEdit = async () => {
    if (!team) return
    setEditSubmitting(true)
    setEditError(null)
    try {
      const res = await fetch(`/api/teams/${team.id}/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName.trim(), description: editDesc.trim() || null }),
      })
      const data = await res.json()
      if (!data.success) {
        setEditError(data.error || 'Failed to update')
        return
      }
      setShowEditModal(false)
      await loadTeam()
    } catch (err: any) {
      setEditError(err.message || 'Failed to update')
    } finally {
      setEditSubmitting(false)
    }
  }

  const deleteTeam = () => {
    if (!team) return
    setConfirmState({
      title: 'DELETE TEAM',
      body: `Permanently delete "${team.name}"? All members lose access. Owner-paid seat subscriptions will be canceled at end of period (no refunds). This cannot be undone. Type "remove" to confirm.`,
      confirmWord: 'remove',
      danger: true,
      onConfirm: async () => {
        const res = await fetch(`/api/teams/${team.id}/delete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ confirm: 'remove' }),
        })
        const data = await res.json()
        if (!data.success) throw new Error(data.error || 'Failed to delete')
        router.push('/dashboard/teams')
      },
    })
  }

  const leaveTeam = () => {
    if (!team || !team.viewerMembership) return
    setConfirmState({
      title: 'LEAVE TEAM',
      body: `Leave "${team.name}"? You'll lose access to its campaigns. If your seat is owner-paid, the owner's billing will end at period close (no refunds to anyone). Type "leave" to confirm.`,
      confirmWord: 'leave',
      danger: true,
      onConfirm: async () => {
        const res = await fetch('/api/teams/members/remove', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ memberId: team.viewerMembership!.id, confirm: 'remove' }),
        })
        const data = await res.json()
        if (!data.success) throw new Error(data.error || 'Failed to leave')
        router.push('/dashboard/teams')
      },
    })
  }

  const submitConfirm = async () => {
    if (!confirmState) return
    if (confirmInput.trim().toLowerCase() !== confirmState.confirmWord.toLowerCase()) return
    setConfirmSubmitting(true)
    setActionError(null)
    try {
      await confirmState.onConfirm()
      setConfirmState(null)
      setConfirmInput('')
    } catch (err: any) {
      setActionError(err.message || 'Action failed')
    } finally {
      setConfirmSubmitting(false)
    }
  }

  // ── Loading / error states ───────────────────────────────────────────────

  if (loading) {
    return (
      <div style={pageWrap}>
        <Header title={teamId ? 'TEAM' : ''} />
        <div style={{ flex: 1, padding: 40, textAlign: 'center', color: T.muted, fontSize: 12, letterSpacing: 2 }}>
          LOADING TEAM...
        </div>
      </div>
    )
  }

  if (notFound) {
    return (
      <div style={pageWrap}>
        <Header title="TEAM NOT FOUND" />
        <div style={{ flex: 1, padding: 40, textAlign: 'center' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>⚠</div>
          <div style={{ fontSize: 13, fontWeight: 'bold', letterSpacing: 3, color: T.muted, marginBottom: 18 }}>
            THIS TEAM DOESN&apos;T EXIST
          </div>
          <Link href="/dashboard/teams" style={btnLink}>← BACK TO TEAMS</Link>
        </div>
      </div>
    )
  }

  if (forbidden) {
    return (
      <div style={pageWrap}>
        <Header title="ACCESS DENIED" />
        <div style={{ flex: 1, padding: 40, textAlign: 'center' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>🔒</div>
          <div style={{ fontSize: 13, fontWeight: 'bold', letterSpacing: 3, color: T.muted, marginBottom: 18 }}>
            YOU&apos;RE NOT A MEMBER OF THIS TEAM
          </div>
          <Link href="/dashboard/teams" style={btnLink}>← BACK TO TEAMS</Link>
        </div>
      </div>
    )
  }

  if (!team) return null

  const isOwner = team.viewerRole === 'owner'

  return (
    <div style={pageWrap}>
      {/* HEADER STRIP */}
      <div style={{
        background: T.dark,
        padding: '12px 20px',
        borderBottom: `2px solid ${T.accent}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
          <Link
            href="/dashboard/teams"
            style={{
              fontSize: 11, color: T.muted, letterSpacing: 2, textDecoration: 'none',
              fontWeight: 'bold', whiteSpace: 'nowrap',
            }}
          >‹ TEAMS</Link>
          <span style={{ color: '#3a3a4e' }}>·</span>
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <span style={{
              fontSize: 12, fontWeight: 'bold', letterSpacing: 2, color: T.blue,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>{team.name.toUpperCase()}</span>
            {team.description && (
              <span style={{
                fontSize: 10, color: '#8888aa', letterSpacing: 0.5,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 360,
              }}>{team.description}</span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Badge color={isOwner ? T.blue : T.accent} solidBg>
            {isOwner ? 'OWNER' : 'MEMBER'}
          </Badge>
          {isOwner && (
            <>
              <button onClick={openEditModal} style={headerBtn}>EDIT</button>
              <button onClick={deleteTeam} style={{ ...headerBtn, borderColor: T.red, color: T.red }}>DELETE</button>
            </>
          )}
        </div>
      </div>

      <div style={{ flex: 1, padding: '16px 20px', maxWidth: 1100, width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>

        {actionError && (
          <ErrorBanner text={actionError} onClose={() => setActionError(null)} />
        )}

        {/* RANGE PICKER */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: 14, gap: 12, flexWrap: 'wrap',
        }}>
          <div style={{ fontSize: 10, letterSpacing: 3, color: T.muted, fontWeight: 'bold' }}>
            ▸ {isOwner ? 'TEAM PERFORMANCE' : 'YOUR PERFORMANCE'}
          </div>
          <div style={{
            display: 'flex', gap: 0, background: T.surface,
            border: `1px solid ${T.border}`, borderRadius: 3, overflow: 'hidden',
          }}>
            {RANGE_OPTIONS.map(opt => {
              const active = range === opt.v
              return (
                <button
                  key={opt.v}
                  onClick={() => setRange(opt.v)}
                  style={{
                    padding: '6px 14px',
                    background: active ? T.dark : 'transparent',
                    border: 'none',
                    color: active ? T.blue : T.muted,
                    fontSize: 10,
                    fontWeight: 'bold',
                    letterSpacing: 2,
                    cursor: 'pointer',
                    fontFamily: 'Futura PT, Futura, sans-serif',
                  }}
                >{opt.label}</button>
              )
            })}
          </div>
        </div>

        {/* STAT CARDS */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: 10,
          marginBottom: 18,
        }}>
          {(() => {
            const stats = isOwner ? analytics?.totals : analytics?.viewerStats
            const calls = stats?.calls ?? 0
            const connected = stats?.connected ?? 0
            const conversions = ('conversions' in (stats || {}) ? (stats as any).conversions : 0) ?? 0
            const talkSeconds = ('talkSeconds' in (stats || {}) ? (stats as any).talkSeconds : 0) ?? 0
            const connectRate = calls > 0 ? Math.round((connected / calls) * 100) : 0
            const convRate = connected > 0 ? Math.round((conversions / connected) * 100) : 0
            return (
              <>
                <StatCard label="CALLS" value={calls} sub={null} accent={T.blue} loading={analyticsLoading} />
                <StatCard label="CONNECTED" value={connected} sub={`${connectRate}% rate`} accent={T.accent} loading={analyticsLoading} />
                <StatCard label="CONVERSIONS" value={conversions} sub={`${convRate}% of connects`} accent={T.green} loading={analyticsLoading} />
                <StatCard label="TALK TIME" value={fmtDuration(talkSeconds)} sub={null} accent={T.amber} loading={analyticsLoading} />
              </>
            )
          })()}
        </div>

        {/* LEADERBOARD (owner only) */}
        {isOwner && (
          <div style={panelStyle}>
            <PanelHeader title="LEADERBOARD" subtitle={`${analytics?.leaderboard.length || 0} ACTIVE`} />
            {analyticsLoading && !analytics ? (
              <SkeletonRows count={4} />
            ) : (analytics?.leaderboard.length || 0) === 0 ? (
              <EmptyHint text="No member activity yet for this range. Once your members start dialing, their stats appear here." />
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={tableStyle}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${T.border}` }}>
                      <th style={thStyle}>#</th>
                      <th style={{ ...thStyle, textAlign: 'left' }}>MEMBER</th>
                      <th style={thStyle}>STATUS</th>
                      <th style={thStyle}>CALLS</th>
                      <th style={thStyle}>CONNECTED</th>
                      <th style={thStyle}>CONVERSIONS</th>
                      <th style={thStyle}>TALK</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics!.leaderboard.map((m, i) => {
                      const online = isOnline(m.lastSeenAt)
                      return (
                        <tr key={m.userId} style={{
                          borderBottom: `1px solid ${T.border}`,
                          background: i % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.015)',
                        }}>
                          <td style={tdStyle}>
                            <span style={{
                              fontSize: 10, fontWeight: 'bold', color: i < 3 ? T.blue : T.muted,
                              fontFamily: 'monospace',
                            }}>
                              {i === 0 ? '★' : i + 1}
                            </span>
                          </td>
                          <td style={{ ...tdStyle, textAlign: 'left' }}>
                            <div style={{ fontSize: 12, fontWeight: 'bold', color: T.text }}>
                              {m.name}
                              {m.isOwner && (
                                <span style={{ marginLeft: 6, fontSize: 8, color: T.blue, letterSpacing: 1 }}>· OWNER</span>
                              )}
                            </div>
                            {m.email && m.email !== m.name && (
                              <div style={{ fontSize: 10, color: T.muted, fontFamily: 'monospace', marginTop: 1 }}>{m.email}</div>
                            )}
                          </td>
                          <td style={tdStyle}>
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: 4,
                              fontSize: 9, letterSpacing: 1, fontFamily: 'monospace',
                              color: online ? T.green : T.muted,
                            }}>
                              <span style={{
                                width: 6, height: 6, borderRadius: '50%',
                                background: online ? T.green : '#bbb',
                              }} />
                              {online ? 'ONLINE' : 'OFFLINE'}
                            </span>
                          </td>
                          <td style={{ ...tdStyle, fontWeight: 'bold' }}>{m.calls}</td>
                          <td style={tdStyle}>{m.connected}</td>
                          <td style={{ ...tdStyle, color: T.green, fontWeight: 'bold' }}>{m.conversions}</td>
                          <td style={{ ...tdStyle, color: T.muted, fontFamily: 'monospace', fontSize: 11 }}>
                            {fmtDuration(m.talkSeconds)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ACCESSIBLE CAMPAIGNS */}
        <div style={panelStyle}>
          <PanelHeader
            title="CAMPAIGNS"
            subtitle={`${team.teamCampaigns.length} ATTACHED`}
          />
          {team.teamCampaigns.length === 0 ? (
            <EmptyHint text={
              isOwner
                ? 'No campaigns attached to this team yet. Attach a campaign from /dashboard/teams to give members access to leads.'
                : 'No campaigns are accessible to this team yet. Check back after the owner attaches one.'
            } />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {team.teamCampaigns.map(tc => {
                if (!tc.campaign) {
                  return (
                    <div key={tc.campaignId} style={campaignRowStyle}>
                      <div style={{ flex: 1, fontSize: 12, color: T.muted, fontStyle: 'italic' }}>
                        (deleted campaign)
                      </div>
                    </div>
                  )
                }
                const remaining = tc.campaign.total_leads - tc.campaign.called_leads
                const pct = tc.campaign.total_leads > 0
                  ? Math.round((tc.campaign.called_leads / tc.campaign.total_leads) * 100)
                  : 0
                return (
                  <div key={tc.campaignId} style={campaignRowStyle}>
                    <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                      <div style={{
                        fontSize: 13, fontWeight: 'bold', color: T.text, letterSpacing: 0.5,
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>{tc.campaign.name}</div>
                      <div style={{ fontSize: 10, color: T.muted, fontFamily: 'monospace', marginTop: 2 }}>
                        {tc.campaign.called_leads.toLocaleString()} / {tc.campaign.total_leads.toLocaleString()} called · {remaining.toLocaleString()} remaining
                      </div>
                    </div>
                    <div style={{
                      flex: '0 0 120px', height: 6, borderRadius: 3,
                      background: T.bg, overflow: 'hidden',
                      border: `1px solid ${T.border}`,
                    }}>
                      <div style={{
                        width: `${pct}%`, height: '100%',
                        background: pct >= 80 ? T.amber : T.blue,
                      }} />
                    </div>
                    <Badge color={
                      tc.accessMode === 'owner_pays' ? T.green :
                      tc.accessMode === 'agent_pays' ? T.amber :
                      T.accent
                    }>
                      {tc.accessMode === 'owner_pays' ? 'OWNER PAYS' :
                       tc.accessMode === 'agent_pays' ? 'AGENT PAYS' : 'PUBLIC'}
                    </Badge>
                    <button
                      onClick={() => router.push(`/dashboard/dialer?teamId=${team.id}&campaignId=${tc.campaignId}`)}
                      style={dialBtn}
                    >▶ DIAL</button>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* RECENT CALLS — owner only */}
        {isOwner && (
          <div style={panelStyle}>
            <PanelHeader
              title="RECENT TEAM ACTIVITY"
              subtitle={`LAST ${Math.min(50, analytics?.recentCalls.length || 0)}`}
            />
            {(analytics?.recentCalls.length || 0) === 0 ? (
              <EmptyHint text="No call activity in this range yet." />
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={tableStyle}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${T.border}` }}>
                      <th style={{ ...thStyle, textAlign: 'left' }}>WHEN</th>
                      <th style={{ ...thStyle, textAlign: 'left' }}>MEMBER</th>
                      <th style={{ ...thStyle, textAlign: 'left' }}>LEAD</th>
                      <th style={thStyle}>DURATION</th>
                      <th style={thStyle}>DISPOSITION</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics!.recentCalls.map((c, i) => (
                      <tr key={c.id} style={{
                        borderBottom: `1px solid ${T.border}`,
                        background: i % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.015)',
                      }}>
                        <td style={{ ...tdStyle, textAlign: 'left', fontFamily: 'monospace', fontSize: 11, color: T.muted }}>
                          {fmtRelative(c.createdAt)}
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'left', fontSize: 12, color: T.text }}>{c.memberName}</td>
                        <td style={{ ...tdStyle, textAlign: 'left' }}>
                          <div style={{ fontSize: 12, color: T.text }}>{c.leadName}</div>
                          {c.phone && (
                            <div style={{ fontSize: 10, color: T.muted, fontFamily: 'monospace' }}>{c.phone}</div>
                          )}
                        </td>
                        <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: 11, color: T.muted }}>
                          {fmtDuration(c.duration)}
                        </td>
                        <td style={tdStyle}>
                          {c.disposition ? (
                            <Badge color={dispoColor(c.disposition)}>{c.disposition}</Badge>
                          ) : (
                            <span style={{ fontSize: 10, color: T.muted }}>—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* MEMBER FOOTER ACTIONS */}
        {!isOwner && (
          <div style={{
            background: T.surface,
            border: `1px solid ${T.border}`,
            borderLeft: `3px solid ${T.red}`,
            borderRadius: 3,
            padding: '14px 18px',
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 14,
            flexWrap: 'wrap',
          }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontSize: 11, fontWeight: 'bold', letterSpacing: 2, color: T.text, marginBottom: 2 }}>
                LEAVE THIS TEAM
              </div>
              <div style={{ fontSize: 11, color: T.muted, lineHeight: 1.4 }}>
                You&apos;ll lose access to its campaigns immediately. No refunds for partial periods.
              </div>
            </div>
            <button onClick={leaveTeam} style={{
              padding: '8px 16px',
              background: 'transparent',
              border: `1px solid ${T.red}`,
              borderRadius: 3,
              color: T.red,
              fontSize: 11,
              fontWeight: 'bold',
              letterSpacing: 2,
              cursor: 'pointer',
              fontFamily: 'Futura PT, Futura, sans-serif',
            }}>LEAVE TEAM</button>
          </div>
        )}
      </div>

      {/* EDIT TEAM MODAL */}
      {showEditModal && (
        <ModalShell onClose={() => !editSubmitting && setShowEditModal(false)} accent={T.blue} title="EDIT TEAM">
          <FieldLabel>NAME</FieldLabel>
          <input
            type="text"
            value={editName}
            onChange={e => setEditName(e.target.value)}
            disabled={editSubmitting}
            autoFocus
            style={modalInput}
          />
          <div style={{ height: 12 }} />
          <FieldLabel>DESCRIPTION</FieldLabel>
          <textarea
            value={editDesc}
            onChange={e => setEditDesc(e.target.value)}
            disabled={editSubmitting}
            rows={3}
            style={{ ...modalInput, resize: 'vertical', fontSize: 12 }}
          />

          {editError && <ErrorInline text={editError} />}

          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button onClick={() => setShowEditModal(false)} disabled={editSubmitting} style={modalCancelBtn(editSubmitting)}>CANCEL</button>
            <button
              onClick={submitEdit}
              disabled={editSubmitting || !editName.trim()}
              style={modalConfirmBtn(editSubmitting || !editName.trim(), T.blue)}
            >{editSubmitting ? '...' : '▶ SAVE'}</button>
          </div>
        </ModalShell>
      )}

      {/* TYPED CONFIRM MODAL */}
      {confirmState && (
        <ModalShell
          onClose={() => !confirmSubmitting && (setConfirmState(null), setConfirmInput(''))}
          accent={confirmState.danger ? T.red : T.blue}
          title={confirmState.title}
        >
          <p style={{ fontSize: 13, lineHeight: 1.6, color: T.text, margin: '0 0 14px 0' }}>
            {confirmState.body}
          </p>
          <input
            type="text"
            value={confirmInput}
            onChange={e => setConfirmInput(e.target.value)}
            placeholder={`type "${confirmState.confirmWord}"`}
            autoFocus
            disabled={confirmSubmitting}
            style={modalInput}
          />
          {actionError && <ErrorInline text={actionError} />}
          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <button
              onClick={() => { setConfirmState(null); setConfirmInput('') }}
              disabled={confirmSubmitting}
              style={modalCancelBtn(confirmSubmitting)}
            >CANCEL</button>
            <button
              onClick={submitConfirm}
              disabled={
                confirmSubmitting ||
                confirmInput.trim().toLowerCase() !== confirmState.confirmWord.toLowerCase()
              }
              style={modalConfirmBtn(
                confirmSubmitting ||
                confirmInput.trim().toLowerCase() !== confirmState.confirmWord.toLowerCase(),
                confirmState.danger ? T.red : T.blue
              )}
            >{confirmSubmitting ? '...' : '▶ CONFIRM'}</button>
          </div>
        </ModalShell>
      )}
    </div>
  )
}

// ── Layout helpers ──────────────────────────────────────────────────────────

const pageWrap: React.CSSProperties = {
  flex: 1,
  background: T.bg,
  minHeight: 'calc(100vh - 64px)',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'auto',
  fontFamily: 'Futura PT, Futura, sans-serif',
}

function Header({ title }: { title: string }) {
  return (
    <div style={{
      background: T.dark,
      padding: '12px 20px',
      borderBottom: `2px solid ${T.accent}`,
      display: 'flex',
      alignItems: 'center',
      gap: 16,
    }}>
      <Link href="/dashboard/teams" style={{ fontSize: 11, color: T.muted, letterSpacing: 2, textDecoration: 'none', fontWeight: 'bold' }}>‹ TEAMS</Link>
      <span style={{ color: '#3a3a4e' }}>·</span>
      <span style={{ fontSize: 11, fontWeight: 'bold', letterSpacing: 4, color: T.blue }}>{title}</span>
    </div>
  )
}

function StatCard({
  label, value, sub, accent, loading,
}: {
  label: string
  value: React.ReactNode
  sub: string | null
  accent: string
  loading: boolean
}) {
  return (
    <div style={{
      background: T.surface,
      border: `1px solid ${T.border}`,
      borderTop: `2px solid ${accent}`,
      borderRadius: 3,
      padding: '12px 14px',
      opacity: loading ? 0.6 : 1,
      transition: 'opacity 0.15s',
    }}>
      <div style={{
        fontSize: 9, letterSpacing: 2, color: T.muted, fontWeight: 'bold', marginBottom: 6,
      }}>{label}</div>
      <div style={{
        fontSize: 22, fontWeight: 'bold', color: T.text, lineHeight: 1, fontFamily: 'monospace',
      }}>{value}</div>
      {sub && (
        <div style={{ fontSize: 10, color: T.muted, marginTop: 4, fontFamily: 'monospace' }}>{sub}</div>
      )}
    </div>
  )
}

const panelStyle: React.CSSProperties = {
  background: T.surface,
  border: `1px solid ${T.border}`,
  borderLeft: `3px solid ${T.accent}`,
  borderRadius: 3,
  padding: 16,
  marginBottom: 14,
}

function PanelHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
      marginBottom: 12, gap: 10,
    }}>
      <div style={{
        fontSize: 11, letterSpacing: 3, color: T.text, fontWeight: 'bold',
      }}>▸ {title}</div>
      {subtitle && (
        <div style={{ fontSize: 9, letterSpacing: 2, color: T.muted, fontFamily: 'monospace' }}>{subtitle}</div>
      )}
    </div>
  )
}

const tableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontFamily: 'Futura PT, Futura, sans-serif',
}

const thStyle: React.CSSProperties = {
  padding: '8px 10px',
  fontSize: 9,
  letterSpacing: 2,
  color: T.muted,
  fontWeight: 'bold',
  textAlign: 'center',
  whiteSpace: 'nowrap',
}

const tdStyle: React.CSSProperties = {
  padding: '8px 10px',
  fontSize: 12,
  color: T.text,
  textAlign: 'center',
}

const campaignRowStyle: React.CSSProperties = {
  background: T.bg,
  border: `1px solid ${T.border}`,
  borderRadius: 3,
  padding: '10px 12px',
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  flexWrap: 'wrap',
}

const dialBtn: React.CSSProperties = {
  padding: '8px 14px',
  background: T.dark,
  border: 'none',
  borderRadius: 3,
  borderTop: `2px solid ${T.blue}`,
  color: T.blue,
  fontSize: 11,
  fontWeight: 'bold',
  letterSpacing: 2,
  cursor: 'pointer',
  fontFamily: 'Futura PT, Futura, sans-serif',
  whiteSpace: 'nowrap',
}

const headerBtn: React.CSSProperties = {
  padding: '5px 12px',
  background: 'transparent',
  border: `1px solid ${T.muted}`,
  borderRadius: 3,
  color: T.muted,
  fontSize: 10,
  fontWeight: 'bold',
  letterSpacing: 2,
  cursor: 'pointer',
  fontFamily: 'Futura PT, Futura, sans-serif',
  whiteSpace: 'nowrap',
}

const btnLink: React.CSSProperties = {
  display: 'inline-block',
  padding: '8px 16px',
  background: 'transparent',
  border: `1px solid ${T.border}`,
  borderRadius: 3,
  color: T.muted,
  fontSize: 11,
  fontWeight: 'bold',
  letterSpacing: 2,
  textDecoration: 'none',
  fontFamily: 'Futura PT, Futura, sans-serif',
}

function Badge({ color, children, solidBg }: { color: string; children: React.ReactNode; solidBg?: boolean }) {
  return (
    <span style={{
      padding: '3px 9px',
      borderRadius: 3,
      fontSize: 9,
      fontWeight: 'bold',
      letterSpacing: 1.5,
      color,
      border: `1px solid ${color}`,
      background: solidBg ? `${color}1f` : 'transparent',
      whiteSpace: 'nowrap',
      fontFamily: 'monospace',
    }}>{children}</span>
  )
}

function EmptyHint({ text }: { text: string }) {
  return (
    <div style={{
      background: T.bg,
      border: `1px dashed ${T.border}`,
      borderRadius: 3,
      padding: '14px 16px',
      fontSize: 11,
      color: T.muted,
      letterSpacing: 0.5,
      lineHeight: 1.5,
    }}>{text}</div>
  )
}

function SkeletonRows({ count }: { count: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{
          height: 36, borderRadius: 3, background: T.bg,
          opacity: 0.7 - i * 0.1,
        }} />
      ))}
    </div>
  )
}

function ErrorBanner({ text, onClose }: { text: string; onClose: () => void }) {
  return (
    <div style={{
      background: '#f8e8e8',
      border: `1px solid ${T.red}`,
      color: T.red,
      padding: '10px 14px',
      borderRadius: 3,
      fontSize: 12,
      letterSpacing: 1,
      marginBottom: 14,
      display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
    }}>
      <span>{text}</span>
      <button onClick={onClose} style={{
        background: 'transparent', border: 'none', color: T.red,
        cursor: 'pointer', fontSize: 16, fontFamily: 'inherit',
      }}>×</button>
    </div>
  )
}

function ErrorInline({ text }: { text: string }) {
  return (
    <div style={{
      background: '#f8e8e8',
      border: `1px solid ${T.red}`,
      color: T.red,
      padding: '8px 12px',
      borderRadius: 3,
      fontSize: 11,
      letterSpacing: 1,
      marginTop: 12,
    }}>{text}</div>
  )
}

function ModalShell({
  onClose, accent, title, children,
}: {
  onClose: () => void
  accent: string
  title: string
  children: React.ReactNode
}) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 100, padding: 20,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: T.bg,
          border: `1px solid ${T.border}`,
          borderTop: `3px solid ${accent}`,
          borderRadius: 4,
          padding: 26,
          maxWidth: 460,
          width: '100%',
          fontFamily: 'Futura PT, Futura, sans-serif',
        }}
      >
        <div style={{
          fontSize: 12, fontWeight: 'bold', letterSpacing: 4, color: accent, marginBottom: 14,
        }}>{title}</div>
        {children}
      </div>
    </div>
  )
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label style={{
      display: 'block', fontSize: 9, letterSpacing: 2, color: T.muted,
      fontWeight: 'bold', marginBottom: 6,
    }}>{children}</label>
  )
}

const modalInput: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  background: T.surface,
  border: `1px solid ${T.border}`,
  borderRadius: 3,
  fontFamily: 'monospace',
  fontSize: 13,
  color: T.text,
  outline: 'none',
  boxSizing: 'border-box',
}

function modalCancelBtn(disabled: boolean): React.CSSProperties {
  return {
    flex: 1,
    padding: '10px',
    background: 'transparent',
    border: `1px solid ${T.border}`,
    borderRadius: 3,
    color: T.muted,
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 2,
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontFamily: 'Futura PT, Futura, sans-serif',
  }
}

function modalConfirmBtn(disabled: boolean, accent: string): React.CSSProperties {
  return {
    flex: 2,
    padding: '10px',
    background: T.dark,
    border: 'none',
    borderRadius: 3,
    borderTop: `3px solid ${accent}`,
    color: accent,
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 2,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    fontFamily: 'Futura PT, Futura, sans-serif',
  }
}