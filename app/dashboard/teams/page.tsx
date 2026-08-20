'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import TeamsSidebar, {
  type SidebarTeam,
  type TeamsScope,
} from '@/components/teams/TeamsSidebar'
import TeamDetail, { type TeamDetailData } from '@/components/teams/TeamDetail'
import {
  CreateTeamModal,
  CreateCampaignModal,
  CreateCodeModal,
} from '@/components/teams/TeamModals'

// =============================================================================
// TEAMS — OVERVIEW, ALL USERS, REQUESTS
// =============================================================================
// This replaces TeamsManager (1,452 lines) and TeamOverview (320) as the Teams
// page. Both components still exist and are untouched, so anything else
// importing them keeps working.
//
// ONE SURFACE, ONE TREATMENT. Sidebar and panel are both dark. An agency runs
// this page all day beside the dialer, which is dark; a bright panel in the
// middle of it is a lamp pointed at the person reading it.
//
// THREE VIEWS, NOT THREE PAGES. Overview is the default. ALL USERS and
// REQUESTS replace the panel entirely and come back with one arrow, rather
// than routing away — the sidebar selection and the time range survive the
// trip, so leaving and returning does not cost the operator their place.
//
// RANGE AND SCOPE COMPOSE. They are the only two controls on the overview:
// range answers "when", the sidebar answers "who", and every tile and chart is
// that intersection. They sit in one pinned header instead of per-widget,
// because a dashboard where each panel carries its own filter is one where no
// two panels are guaranteed to agree.
// =============================================================================

interface ApiMember {
  id: string
  userId?: string
  user?: { email?: string | null; first_name?: string | null; last_name?: string | null }
  campaignAccess?: Array<{ campaignId: string }>
}
interface ApiTeamCampaign {
  campaignId: string
  accessMode?: string | null
  campaign?: { id: string; name?: string | null } | null
}
interface ApiTeam {
  id: string
  name: string
  isOwner?: boolean
  members?: ApiMember[]
  pendingMembers?: ApiMember[]
  campaigns?: ApiTeamCampaign[]
}

type RangeKey = 'today' | 'week' | 'month' | 'all' | 'custom'
type PanelView = 'overview' | 'all_users' | 'requests' | 'team'

/** What the tiles and charts are measuring. Scope answers WHO, range answers
 *  WHEN, and this answers WHICH NUMBERS — three independent questions that
 *  were previously collapsed into one fixed dashboard. */
type MetricView = 'activity' | 'conversion' | 'talk_time' | 'seats'

const RANGES: Array<{ key: RangeKey; label: string }> = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
  { key: 'all', label: 'All Time' },
  { key: 'custom', label: 'Custom' },
]

const METRIC_VIEWS: Array<{ key: MetricView; label: string; hint: string }> = [
  { key: 'activity', label: 'Activity', hint: 'Calls, hours, talk time' },
  { key: 'conversion', label: 'Conversion', hint: 'Contacts, closes, rate' },
  { key: 'talk_time', label: 'Talk Time', hint: 'Time on the phone per agent' },
  { key: 'seats', label: 'Seats & Billing', hint: 'Who is paying for whom' },
]

const BG = '#1e1f22'
const PANEL = '#232428'
const RAISED = '#2b2d31'
const HAIRLINE = '#1a1b1e'
const TEXT = '#f2f3f5'
const MUTED = '#949ba4'
const DIM = '#80848e'

function displayName(m: ApiMember): string {
  const full = `${m.user?.first_name?.trim() || ''} ${m.user?.last_name?.trim() || ''}`.trim()
  return full || m.user?.email || 'Unknown agent'
}

function toSidebarTeams(teams: ApiTeam[]): SidebarTeam[] {
  return teams.map(team => {
    const members = team.members || []
    return {
      id: team.id,
      name: team.name,
      isOwner: team.isOwner,
      campaigns: (team.campaigns || []).map(tc => {
        // accessMode 'free' opens a campaign to the whole team, so every member
        // may work it. Anything else means the roster is a grant list.
        const openToTeam = tc.accessMode === 'free'
        const eligible = openToTeam
          ? members
          : members.filter(m => (m.campaignAccess || []).some(a => a.campaignId === tc.campaignId))
        return {
          id: tc.campaignId,
          name: tc.campaign?.name || 'Untitled campaign',
          openToTeam,
          agents: eligible.map(m => ({ id: m.userId || m.id, name: displayName(m) })),
        }
      }),
    }
  })
}

/** The value carries full weight; label and comparison drop to context.
 *  Rendering all three at the same size is what makes a dashboard read as noise. */
function StatTile({ label, value, sub, accent }: {
  label: string; value: string; sub?: string; accent: string
}) {
  return (
    <div style={{
      background: PANEL, border: `1px solid ${HAIRLINE}`, borderTop: `3px solid ${accent}`,
      borderRadius: 4, padding: '14px 16px 16px', minWidth: 0,
    }}>
      <div style={{
        fontSize: 10, letterSpacing: 1.2, textTransform: 'uppercase', color: MUTED,
        marginBottom: 8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700, color: TEXT, lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: DIM, marginTop: 6 }}>{sub}</div>}
    </div>
  )
}

/** Holds its own height so the grid does not reflow when real data lands —
 *  a placeholder that resizes on load makes the whole page jump. */
function ChartCard({ title }: { title: string }) {
  return (
    <div style={{
      background: PANEL, border: `1px solid ${HAIRLINE}`, borderRadius: 4,
      padding: '12px 14px 16px', minWidth: 0,
    }}>
      <div style={{
        fontSize: 10, letterSpacing: 1.2, textTransform: 'uppercase',
        color: MUTED, marginBottom: 12,
      }}>▾ {title}</div>
      <div style={{ height: 200, display: 'grid', placeItems: 'center', color: DIM, fontSize: 12 }}>
        No data for this range
      </div>
    </div>
  )
}

/** Shared header for the two views that replace the panel. The arrow is the
 *  only way back, and it is always in the same place. */
function ViewHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 22 }}>
      <button
        onClick={onBack}
        aria-label="Back to overview"
        style={{
          display: 'grid', placeItems: 'center', width: 34, height: 34,
          borderRadius: 4, border: `1px solid ${HAIRLINE}`, background: PANEL,
          color: TEXT, cursor: 'pointer', fontSize: 18, lineHeight: 1,
        }}
      >←</button>
      <span style={{ fontSize: 22, fontWeight: 600, color: TEXT }}>{title}</span>
    </div>
  )
}

export default function TeamsPage() {
  const [teams, setTeams] = useState<SidebarTeam[]>([])
  const [rawTeams, setRawTeams] = useState<ApiTeam[]>([])
  const [pending, setPending] = useState(0)
  const [loading, setLoading] = useState(true)

  const [scope, setScope] = useState<TeamsScope>({ kind: 'all' })
  const [range, setRange] = useState<RangeKey>('all')
  const [metric, setMetric] = useState<MetricView>('activity')
  const [metricOpen, setMetricOpen] = useState(false)
  const [view, setView] = useState<PanelView>('overview')
  const [showTeamModal, setShowTeamModal] = useState(false)
  const [showCampaignModal, setShowCampaignModal] = useState(false)
  const [campaignTeamId, setCampaignTeamId] = useState<string | undefined>()
  const [showCodeModal, setShowCodeModal] = useState(false)
  const [codeTeamId, setCodeTeamId] = useState<string | undefined>()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // One loader, called on mount and after every mutation. Anything that
  // changes teams, campaigns or codes re-reads the same source rather than
  // patching local state — the list endpoint already assembles the joins, and
  // two code paths building the same tree is how they drift apart.
  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/teams/list')
      const data = await res.json()
      const all: ApiTeam[] = [...(data.owned || []), ...(data.joined || [])]
      setRawTeams(all)
      setTeams(toSidebarTeams(all))
      setPending(all.reduce((n, t) => n + (t.pendingMembers?.length || 0), 0))
    } catch {
      setTeams([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void refresh() }, [refresh])

  // The header names the scope in the same words the sidebar used to select
  // it. The sidebar and the panel must never disagree about where you are.
  const scopeLabel = useMemo(() => {
    if (scope.kind === 'all') return 'ALL USERS'
    if (scope.kind === 'requests') return 'REQUESTS'
    const team = teams.find(t => t.id === (scope as any).teamId)
    if (scope.kind === 'team') return (team?.name || 'Team').toUpperCase()
    const campaign = team?.campaigns.find(c => c.id === (scope as any).campaignId)
    if (scope.kind === 'campaign') return (campaign?.name || 'Campaign').toUpperCase()
    const agent = campaign?.agents.find(a => a.id === (scope as any).userId)
    return (agent?.name || 'Agent').toUpperCase()
  }, [scope, teams])

  const allMembers = useMemo(() => {
    const seen = new Map<string, { id: string; name: string; team: string }>()
    for (const t of rawTeams) {
      for (const m of t.members || []) {
        const id = m.userId || m.id
        if (!seen.has(id)) seen.set(id, { id, name: displayName(m), team: t.name })
      }
    }
    return Array.from(seen.values())
  }, [rawTeams])

  const pendingList = useMemo(() => {
    const out: Array<{ id: string; name: string; team: string }> = []
    for (const t of rawTeams) {
      for (const m of t.pendingMembers || []) {
        out.push({ id: m.userId || m.id, name: displayName(m), team: t.name })
      }
    }
    return out
  }, [rawTeams])

  // ALL USERS and REQUESTS are sidebar scopes AND full views. Selecting either
  // swaps the panel; the back arrow returns to the overview without disturbing
  // the range or the tree.
  // ── PUSH BUTTONS, NOT A PERMANENT SELECTION ────────────────────────────
  // All Users and Requests toggle: pressing the one you are already in returns
  // you to the overview. Nothing in this footer is a mode you get stuck in,
  // which is what "highlighted at all times" was.
  const handleScope = (next: TeamsScope) => {
    if (next.kind === 'all') {
      const leaving = view === 'all_users'
      setView(leaving ? 'overview' : 'all_users')
      setScope(next)
      return
    }
    if (next.kind === 'requests') {
      const leaving = view === 'requests'
      setView(leaving ? 'overview' : 'requests')
      setScope(next)
      return
    }
    setScope(next)
    // Clicking a team opens the team itself — its stats, campaigns and people.
    // A campaign or agent scopes the overview instead.
    setView(next.kind === 'team' ? 'team' : 'overview')
  }

  const openTeam: TeamDetailData | null = useMemo(() => {
    if (view !== 'team' || scope.kind !== 'team') return null
    const raw = rawTeams.find(t => t.id === scope.teamId)
    const side = teams.find(t => t.id === scope.teamId)
    if (!raw || !side) return null
    return {
      id: raw.id,
      name: raw.name,
      isOwner: raw.isOwner,
      codes: ((raw as any).codes || []) as any[],
      campaigns: side.campaigns.map(c => {
        const rc = (raw.campaigns || []).find(x => x.campaignId === c.id)
        return {
          id: c.id,
          name: c.name,
          openToTeam: c.openToTeam,
          agentCount: c.agents.length,
          totalLeads: (rc?.campaign as any)?.total_leads,
          calledLeads: (rc?.campaign as any)?.called_leads,
        }
      }),
      members: (raw.members || []).map(m => ({
        id: m.userId || m.id,
        name: displayName(m),
        email: m.user?.email ?? null,
        campaignCount: (m.campaignAccess || []).length,
      })),
    }
  }, [view, scope, rawTeams, teams])

  return (
    <div style={{ display: 'flex', height: '100vh', minHeight: 0, background: BG, color: TEXT }}>
      <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        {view === 'overview' && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
            padding: '10px 20px', background: '#111214',
            borderBottom: `1px solid ${HAIRLINE}`, flexShrink: 0,
          }}>
            <span style={{
              fontSize: 12, letterSpacing: 2, textTransform: 'uppercase',
              color: '#93c5fd', fontWeight: 600, marginRight: 8,
            }}>Teams Overview</span>
            {RANGES.map(r => (
              <button
                key={r.key}
                onClick={() => setRange(r.key)}
                style={{
                  padding: '5px 12px', borderRadius: 3, cursor: 'pointer',
                  border: '1px solid transparent',
                  background: range === r.key ? '#2563eb' : 'transparent',
                  color: range === r.key ? '#fff' : MUTED,
                  fontSize: 11, letterSpacing: 1, textTransform: 'uppercase',
                  fontWeight: 600, fontFamily: 'inherit',
                }}
              >{r.label}</button>
            ))}
          </div>
        )}

        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '24px 28px 40px' }}>
          {view === 'all_users' && (
            <>
              <ViewHeader title="All Users" onBack={() => setView('overview')} />
              {allMembers.length === 0 ? (
                <div style={{ color: DIM, fontSize: 13 }}>
                  {loading ? 'Loading…' : 'No members yet.'}
                </div>
              ) : (
                <div style={{ display: 'grid', gap: 8 }}>
                  {allMembers.map(m => (
                    <div key={m.id} style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      background: PANEL, border: `1px solid ${HAIRLINE}`,
                      borderRadius: 4, padding: '12px 14px',
                    }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 500 }}>{m.name}</div>
                        <div style={{ fontSize: 11.5, color: DIM, marginTop: 2 }}>{m.team}</div>
                      </div>
                      <span style={{ fontSize: 11, color: DIM }}>Seat details to come</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {view === 'requests' && (
            <>
              <ViewHeader title="Requests" onBack={() => setView('overview')} />
              {pendingList.length === 0 ? (
                <div style={{ color: DIM, fontSize: 13 }}>
                  {loading ? 'Loading…' : 'No pending requests.'}
                </div>
              ) : (
                <div style={{ display: 'grid', gap: 8 }}>
                  {pendingList.map(r => (
                    <div key={r.id} style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      background: PANEL, border: `1px solid ${HAIRLINE}`,
                      borderRadius: 4, padding: '12px 14px',
                    }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 500 }}>{r.name}</div>
                        <div style={{ fontSize: 11.5, color: DIM, marginTop: 2 }}>
                          wants to join {r.team}
                        </div>
                      </div>
                      <span style={{ fontSize: 11, color: DIM }}>Approve / decline to come</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {view === 'overview' && (
            <>
              {/* ── WHAT YOU ARE LOOKING AT, AND AT WHICH NUMBERS ───────────
                  The scope chip is a dropdown because "who" and "which metrics"
                  are separate questions and the page should not need reloading
                  to change the second one. */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 22, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 24, color: TEXT }}>Viewing:</span>
                <div style={{ position: 'relative' }}>
                  <button
                    onClick={() => setMetricOpen(o => !o)}
                    aria-expanded={metricOpen}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      fontSize: 20, fontWeight: 600, color: TEXT,
                      background: '#111214', border: `1px solid ${HAIRLINE}`,
                      padding: '6px 14px', borderRadius: 3, cursor: 'pointer',
                      fontFamily: 'inherit', letterSpacing: 0.5,
                    }}
                  >
                    {scopeLabel}
                    <span style={{ fontSize: 12, color: MUTED }}>▾</span>
                  </button>
                  {metricOpen && (
                    <>
                      <div onClick={() => setMetricOpen(false)}
                        style={{ position: 'fixed', inset: 0, zIndex: 20 }} />
                      <div style={{
                        position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 21,
                        minWidth: 240, padding: 6, background: '#111214',
                        border: `1px solid ${HAIRLINE}`, borderRadius: 6,
                        boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
                        display: 'flex', flexDirection: 'column', gap: 2,
                      }}>
                        {METRIC_VIEWS.map(mv => (
                          <button
                            key={mv.key}
                            onClick={() => { setMetric(mv.key); setMetricOpen(false) }}
                            style={{
                              display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                              gap: 2, width: '100%', border: 0, cursor: 'pointer',
                              padding: '8px 10px', borderRadius: 4, textAlign: 'left',
                              background: metric === mv.key ? '#2563eb' : 'transparent',
                              color: TEXT, fontFamily: 'inherit', fontSize: 13.5, fontWeight: 500,
                            }}
                          >
                            {mv.label}
                            <span style={{
                              fontSize: 11, fontWeight: 400,
                              color: metric === mv.key ? 'rgba(255,255,255,0.78)' : DIM,
                            }}>{mv.hint}</span>
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div style={{
                display: 'grid', gap: 12, marginBottom: 20,
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              }}>
                <StatTile label="Total Calls" value="—" sub="Today —" accent="#2563eb" />
                <StatTile label="Hours Dialed" value="—" sub="Today —" accent="#2563eb" />
                <StatTile label="Conversions" value="—" sub="Today —" accent="#16a34a" />
                <StatTile label="Closed" value="—" sub="Today —" accent="#16a34a" />
                <StatTile label="Talk Time" value="—" sub="avg — /call" accent="#2563eb" />
                <StatTile label="Best Campaign" value="—" sub="need 5+ calls" accent="#b45309" />
              </div>

              <div style={{
                display: 'grid', gap: 14, marginBottom: 14,
                gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
              }}>
                <ChartCard title="Call Volume Over Time" />
                <ChartCard title="Conversion Rate Over Time" />
              </div>
              <div style={{
                display: 'grid', gap: 14,
                gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
              }}>
                <ChartCard title="Disposition Breakdown" />
                <ChartCard title="Campaign Performance" />
              </div>

            </>
          )}

          {view === 'team' && openTeam && (
            <>
              <ViewHeader title={openTeam.name} onBack={() => setView('overview')} />
              <TeamDetail
                team={openTeam}
                onNewCampaign={id => { setCampaignTeamId(id); setShowCampaignModal(true) }}
                onNewCode={id => { setCodeTeamId(id); setShowCodeModal(true) }}
                onRegenerateCode={async codeId => {
                  setBusy(true)
                  try {
                    const r = await fetch('/api/teams/codes/regenerate', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ codeId }),
                    }).then(x => x.json())
                    if (!r.success) throw new Error(r.error || 'Could not regenerate')
                    await refresh()
                  } catch (e: any) {
                    setError(e.message || 'Could not regenerate code')
                  } finally { setBusy(false) }
                }}
              />
            </>
          )}
        </div>
      </main>

      <div style={{ width: 300, flexShrink: 0 }}>
        <TeamsSidebar
          teams={teams}
          scope={scope}
          onScopeChange={handleScope}
          pendingRequests={pending}
          onCreateTeam={() => setShowTeamModal(true)}
          onCreateCampaign={() => { setCampaignTeamId(undefined); setShowCampaignModal(true) }}
        />
      </div>

      {showTeamModal && (
        <CreateTeamModal
          busy={busy}
          onClose={() => setShowTeamModal(false)}
          onCreate={async (name, description) => {
            setBusy(true)
            try {
              const res = await fetch('/api/teams/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, description }),
              })
              const data = await res.json()
              if (!data.success) throw new Error(data.error || 'Could not create team')
              setShowTeamModal(false)
              await refresh()
            } catch (e: any) {
              setError(e.message || 'Could not create team')
            } finally {
              setBusy(false)
            }
          }}
        />
      )}
      {showCampaignModal && (
        <CreateCampaignModal
          busy={busy}
          teams={teams.map(t => ({ id: t.id, name: t.name }))}
          defaultTeamId={campaignTeamId}
          onClose={() => setShowCampaignModal(false)}
          onCreate={async ({ teamId, name, dialerMode, accessMode }) => {
            setBusy(true)
            try {
              // Two steps, because a campaign exists on its own before it
              // belongs to a team: create it, then attach it with the access
              // and billing mode the owner picked. Attach is what writes
              // access_mode, so a failure there leaves an unattached campaign
              // rather than a half-configured one — recoverable, and visible.
              const created = await fetch('/api/campaigns/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  name,
                  // 'agent_choice' is a UI concept: the campaign simply keeps
                  // the platform default and the agent picks per session.
                  dialer_mode: dialerMode === 'agent_choice' ? 'progressive' : dialerMode,
                }),
              }).then(r => r.json())
              if (!created.success || !created.campaign?.id) {
                throw new Error(created.error || 'Could not create campaign')
              }

              const attached = await fetch('/api/teams/campaigns/attach', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ teamId, campaignId: created.campaign.id, accessMode }),
              }).then(r => r.json())
              if (!attached.success) {
                throw new Error(attached.error || 'Campaign created but not attached to the team')
              }

              setShowCampaignModal(false)
              await refresh()
            } catch (e: any) {
              setError(e.message || 'Could not create campaign')
            } finally {
              setBusy(false)
            }
          }}
        />
      )}

      {showCodeModal && codeTeamId && (
        <CreateCodeModal
          busy={busy}
          teamName={teams.find(t => t.id === codeTeamId)?.name || 'this team'}
          campaigns={(teams.find(t => t.id === codeTeamId)?.campaigns || [])
            .map(c => ({ id: c.id, name: c.name }))}
          onClose={() => setShowCodeModal(false)}
          onCreate={async ({ codeType, campaignId, payer, maxUses }) => {
            setBusy(true)
            try {
              const r = await fetch('/api/teams/codes/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  teamId: codeTeamId,
                  codeType,
                  campaignId,
                  payer,
                  maxUses,
                  singleUse: maxUses === 1,
                }),
              }).then(x => x.json())
              if (!r.success) throw new Error(r.error || 'Could not create code')
              setShowCodeModal(false)
              await refresh()
            } catch (e: any) {
              setError(e.message || 'Could not create code')
            } finally { setBusy(false) }
          }}
        />
      )}

      {/* Failures surface here rather than in a console. Dismissed by clicking,
          because an error you cannot get rid of is its own problem. */}
      {error && (
        <div
          onClick={() => setError(null)}
          style={{
            position: 'fixed', bottom: 18, left: 18, zIndex: 70, cursor: 'pointer',
            background: '#7f1d1d', border: '1px solid #b91c1c', color: '#fee2e2',
            padding: '11px 15px', borderRadius: 5, fontSize: 13, maxWidth: 420,
            boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
          }}
        >{error}</div>
      )}
    </div>
  )
}
