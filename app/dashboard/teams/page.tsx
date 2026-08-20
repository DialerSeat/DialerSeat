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

// Only one view exists so far. The others were listed before they were built,
// which promises reports that are not there — worse than a short menu.
const METRIC_VIEWS: Array<{ key: MetricView; label: string; hint: string }> = [
  { key: 'activity', label: 'All Users', hint: 'Everyone across every team' },
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
          // memberId is the team_members ROW id, which is what
          // /api/teams/members/remove addresses. The user id identifies a
          // person; the member id identifies their place in this team, and
          // those are not the same thing.
          agents: eligible.map(m => ({
            id: m.userId || m.id,
            memberId: m.id,
            name: displayName(m),
          })),
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
  const [myPending, setMyPending] = useState<Array<{
    id: string; teamId: string; teamName: string; requestedAt?: string
  }>>([])
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
  // Set when the code is being minted from a specific campaign row, so the
  // dialog opens already answering "which campaign".
  const [codeCampaignId, setCodeCampaignId] = useState<string | undefined>()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [myCampaigns, setMyCampaigns] =
    useState<Array<{ id: string; name: string }>>([])
  const [joining, setJoining] = useState(false)
  const [joinMessage, setJoinMessage] =
    useState<{ kind: 'error' | 'success'; text: string } | null>(null)

  // One loader, called on mount and after every mutation. Anything that
  // changes teams, campaigns or codes re-reads the same source rather than
  // patching local state — the list endpoint already assembles the joins, and
  // two code paths building the same tree is how they drift apart.
  const refresh = useCallback(async () => {
    try {
      // ── detail=owned IS NOT OPTIONAL HERE ────────────────────────────────
      // Without it the endpoint returns teams and nothing else: no campaigns,
      // no members, no codes, no pending requests. Every one of those is
      // loaded inside `if (detail && owned.length > 0)`, so omitting the param
      // gave a sidebar of bare team names — which is why an attached campaign
      // never showed up, the roster was always empty, and the codes list in a
      // team looked like it had none.
      const res = await fetch('/api/teams/list?detail=owned')
      const data = await res.json()
      // The endpoint nests these under `teams` and calls the second list
      // `member`, not `joined`. Reading data.owned/data.joined silently gave
      // two empty arrays — which is why the sidebar stayed empty, creating a
      // team looked like it did nothing, and the campaign dialog reported no
      // teams to attach to. One wrong key, three symptoms.
      const owned: ApiTeam[] = (data.teams?.owned || []).map((t: any) => ({
        ...t,
        isOwner: true,
      }))
      const member: ApiTeam[] = (data.teams?.member || []).map((t: any) => ({
        ...t,
        isOwner: t.viewerRole === 'owner',
      }))
      const all: ApiTeam[] = [...owned, ...member]
      setRawTeams(all)
      setTeams(toSidebarTeams(all))
      const mine = data.myPending || []
      setMyPending(mine)
      // The badge counts BOTH directions: requests an owner has to decide, and
      // requests this agent is waiting on. One number, because to the person
      // looking at it the question is the same — is there something in
      // Requests for me.
      const incoming = all.reduce((n, t) => n + (t.pendingMembers?.length || 0), 0)
      setPending(incoming + mine.length)
    } catch {
      setTeams([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void refresh() }, [refresh])

  // The owner's own campaigns, so one can be attached to a team instead of
  // creating a duplicate. Loaded once and after any create — this is a short
  // list per account, not something worth re-fetching on every render.
  const loadMyCampaigns = useCallback(async () => {
    try {
      const data = await fetch('/api/campaigns/list').then(r => r.json())
      const rows = (data.campaigns || []).map((c: any) => ({
        id: c.id, name: c.name || 'Untitled campaign',
      }))
      setMyCampaigns(rows)
    } catch {
      setMyCampaigns([])
    }
  }, [])

  useEffect(() => { void loadMyCampaigns() }, [loadMyCampaigns])

  // Errors retire on their own. Requiring a click to clear one means a stale
  // failure sits over the UI long after the thing it described stopped being
  // true — which is exactly what happened with the attach error.
  useEffect(() => {
    if (!error) return
    const t = setTimeout(() => setError(null), 7000)
    return () => clearTimeout(t)
  }, [error])

  // Same for the join result under the code field.
  useEffect(() => {
    if (!joinMessage) return
    const t = setTimeout(() => setJoinMessage(null), 8000)
    return () => clearTimeout(t)
  }, [joinMessage])

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
    // memberId, not user id: accept and reject both address the team_members
    // row, because a decision is about this person's place in THIS team.
    const out: Array<{ id: string; memberId: string; name: string; team: string }> = []
    for (const t of rawTeams) {
      for (const m of t.pendingMembers || []) {
        out.push({
          id: m.userId || m.id,
          memberId: m.id,
          name: displayName(m),
          team: t.name,
        })
      }
    }
    return out
  }, [rawTeams])

  /**
   * Approve or decline one join request.
   *
   * Approving is the expensive direction — it activates the membership and, on
   * an owner-paid code, starts a seat charge. So the result is surfaced rather
   * than assumed: a failure says so instead of the row silently staying put.
   */
  const decideRequest = useCallback(async (memberId: string, action: 'accept' | 'reject') => {
    setBusy(true)
    try {
      const res = await fetch(`/api/teams/members/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId }),
      }).then(r => r.json()).catch(() => null)

      if (!res?.success) {
        throw new Error(res?.error || `Could not ${action === 'accept' ? 'approve' : 'decline'} that request`)
      }
      await refresh()
    } catch (e: any) {
      setError(e.message || 'Could not update that request')
    } finally {
      setBusy(false)
    }
  }, [refresh])

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
      <style>{`
        /* ── DESKTOP: A COLUMN. MOBILE: A DRAWER. ─────────────────────────────
           The sidebar is 300px of permanent furniture on a wide screen and the
           whole screen on a phone, so on mobile it slides in over the panel
           rather than competing with it for width.

           Driven by a checkbox and a label, exactly as the dashboard's own
           drawer is, and for the same reason: a label's association with its
           checkbox is browser behaviour, so it works the instant the HTML
           paints. A button's onClick does not exist until React hydrates, and
           that gap is precisely when taps get swallowed on a slow phone. */
        .ts-drawer-checkbox { position: absolute; opacity: 0; width: 0; height: 0; pointer-events: none; }
        .ts-side { width: 300px; flex-shrink: 0; }
        .ts-fab, .ts-overlay { display: none; }

        @media (max-width: 900px) {
          .ts-side {
            position: fixed; top: 0; right: 0; bottom: 0;
            width: min(88vw, 340px); z-index: 60;
            transform: translateX(100%);
            transition: transform 0.22s ease;
            box-shadow: -8px 0 28px rgba(0,0,0,0.45);
          }
          .ts-drawer-checkbox:checked ~ .ts-side { transform: translateX(0); }

          .ts-overlay {
            display: block; position: fixed; inset: 0; z-index: 55;
            background: rgba(0,0,0,0.5);
            opacity: 0; pointer-events: none;
            transition: opacity 0.22s ease;
          }
          .ts-drawer-checkbox:checked ~ .ts-overlay { opacity: 1; pointer-events: auto; }

          /* Mirrors the dashboard hamburger — same 40x40, same border and
             surface tokens, same three bars — but on the right, because it
             opens the right-hand drawer. Putting it top-left would sit on top
             of the nav hamburger and open the wrong thing. */
          .ts-fab {
            display: flex; position: fixed; z-index: 65;
            top: max(14px, env(safe-area-inset-top, 14px));
            right: max(14px, env(safe-area-inset-right, 14px));
            width: 40px; height: 40px; border-radius: 8px;
            border: 1px solid var(--brand-sidebar-active-bg, #35373c);
            background: var(--brand-header-bg, #111214);
            flex-direction: column; align-items: center; justify-content: center;
            gap: 4px; cursor: pointer; padding: 0;
          }
          .ts-fab span {
            width: 18px; height: 2px; border-radius: 1px;
            background: var(--brand-on-header, #f2f3f5);
          }
          /* Once the drawer is open the button is under the overlay, so it
             moves with the drawer instead of being stranded behind it. */
          .ts-drawer-checkbox:checked ~ .ts-fab { opacity: 0; pointer-events: none; }

          /* The panel keeps the full width — the drawer floats over it rather
             than squeezing it, so nothing reflows when it opens. */
          .ts-main { padding-right: 0 !important; }
        }
      `}</style>

      {/* Uncontrolled on purpose: the browser must be free to toggle this
          before React exists. Placed first so the `~` rules above can reach
          the drawer, overlay and button, since that selector only looks
          forward. */}
      <input
        type="checkbox"
        id="ts-drawer-toggle"
        className="ts-drawer-checkbox"
        defaultChecked={false}
        aria-label="Open teams menu"
      />

      <label
        className="ts-fab"
        htmlFor="ts-drawer-toggle"
        role="button"
        aria-label="Open teams menu"
        aria-controls="ts-side"
      >
        <span aria-hidden />
        <span aria-hidden />
        <span aria-hidden />
      </label>

      {/* A label, not a div with onClick, so tapping away closes the drawer
          pre-hydration too. */}
      <label
        className="ts-overlay"
        htmlFor="ts-drawer-toggle"
        aria-hidden="true"
      />

      <main className="ts-main" style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
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

              {/* ── WHAT YOU ARE WAITING ON ──────────────────────────────────
                  An agent who joined with a review code previously saw nothing
                  at all afterwards — no team, no request, no sign the code had
                  worked. From their side the join had silently failed. This is
                  the only place that tells them otherwise, so it comes first:
                  their own status matters more to them than anyone else's. */}
              {myPending.length > 0 && (
                <div style={{ marginBottom: 26 }}>
                  <h3 style={{
                    margin: '0 0 10px', fontSize: 11, letterSpacing: 1.4,
                    textTransform: 'uppercase', color: MUTED, fontWeight: 600,
                  }}>Waiting On Approval</h3>
                  <div style={{ display: 'grid', gap: 8 }}>
                    {myPending.map(p => (
                      <div key={p.id} style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        background: PANEL, border: `1px solid ${HAIRLINE}`,
                        borderLeft: '3px solid #b45309',
                        borderRadius: 4, padding: '12px 14px',
                      }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 500 }}>{p.teamName}</div>
                          <div style={{ fontSize: 11.5, color: DIM, marginTop: 2 }}>
                            Your request is with the team owner
                          </div>
                        </div>
                        <span style={{
                          fontSize: 10, letterSpacing: 0.8, textTransform: 'uppercase',
                          color: '#fbbf24', border: '1px solid #78350f',
                          background: '#2a1a05', borderRadius: 3, padding: '3px 8px',
                        }}>Pending</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {pendingList.length > 0 && (
                <h3 style={{
                  margin: '0 0 10px', fontSize: 11, letterSpacing: 1.4,
                  textTransform: 'uppercase', color: MUTED, fontWeight: 600,
                }}>Awaiting Your Decision</h3>
              )}

              {pendingList.length === 0 ? (
                myPending.length === 0 && (
                  <div style={{ color: DIM, fontSize: 13 }}>
                    {loading ? 'Loading…' : 'No pending requests.'}
                  </div>
                )
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
                      {/* Decline first, Approve last and emphasised. Approve is
                          the one that costs money — it starts a seat charge —
                          so it gets the deliberate position rather than the one
                          the cursor lands on by accident. */}
                      <button
                        disabled={busy}
                        onClick={() => decideRequest(r.memberId, 'reject')}
                        style={{
                          padding: '7px 12px', borderRadius: 4, cursor: 'pointer',
                          border: `1px solid ${HAIRLINE}`, background: RAISED,
                          color: MUTED, fontSize: 12, fontFamily: 'inherit',
                        }}
                      >Decline</button>
                      <button
                        disabled={busy}
                        onClick={() => decideRequest(r.memberId, 'accept')}
                        style={{
                          padding: '7px 14px', borderRadius: 4, cursor: 'pointer',
                          border: '1px solid #16a34a', background: '#16a34a',
                          color: '#fff', fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
                        }}
                      >Approve</button>
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
                    {/* The METRIC, not the sidebar selection. A team or
                        campaign picked in the tree opens its own view, so
                        naming it here as well said the same thing twice and
                        implied the dropdown could change it, which it cannot. */}
                    {(METRIC_VIEWS.find(m => m.key === metric)?.label || 'All Users').toUpperCase()}
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
                onNewCode={(id, campaignId) => {
                  setCodeTeamId(id)
                  setCodeCampaignId(campaignId)
                  setShowCodeModal(true)
                }}
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

      <div className="ts-side" id="ts-side">
        <TeamsSidebar
          teams={teams}
          scope={scope}
          onScopeChange={handleScope}
          pendingRequests={pending}
          onCreateTeam={() => setShowTeamModal(true)}
          onCreateCampaign={() => { setCampaignTeamId(undefined); setShowCampaignModal(true) }}
          joining={joining}
          joinMessage={joinMessage}
          activeUserCount={allMembers.length}
          onDeleteSelection={async sel => {
            setBusy(true)
            const failures: string[] = []
            try {
              // Sequential rather than parallel: these hit different endpoints
              // with different side effects (billing, access revocation), and a
              // burst of them failing halfway leaves a state nobody can read.
              for (const item of sel) {
                let res: any = null
                // Every one of these endpoints requires confirm: 'remove'.
                // The dialog already made the agent type DELETE; this is the
                // server's own guard against an unconfirmed call, not a second
                // question for the user.
                if (item.kind === 'team') {
                  res = await fetch(`/api/teams/${item.teamId}/delete`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ confirm: 'remove' }),
                  }).then(r => r.json()).catch(() => null)
                } else if (item.kind === 'campaign') {
                  // Detach from the team, not delete the campaign itself — the
                  // leads and history belong to the campaign and outlive its
                  // membership of any one team.
                  res = await fetch('/api/teams/campaigns/detach', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      teamId: item.teamId, campaignId: item.campaignId, confirm: 'remove',
                    }),
                  }).then(r => r.json()).catch(() => null)
                } else {
                  res = await fetch('/api/teams/members/remove', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ memberId: item.memberId, confirm: 'remove' }),
                  }).then(r => r.json()).catch(() => null)
                }
                if (!res?.success) failures.push(item.label)
              }
              await refresh()
              if (failures.length > 0) {
                setError(`Could not remove: ${failures.join(', ')}`)
              }
            } finally {
              setBusy(false)
            }
          }}
          onJoinWithCode={async code => {
            setJoining(true)
            setJoinMessage(null)
            try {
              const r = await fetch('/api/teams/redeem', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code }),
              }).then(x => x.json())

              if (!r.success) {
                setJoinMessage({ kind: 'error', text: r.error || 'That code did not work.' })
                return
              }

              // Refresh BEFORE reporting success, so the team is already in the
              // tree by the time the message appears. Saying "joined" while the
              // sidebar still looks empty reads as a failure.
              await refresh()

              // The endpoint reports pending on the member row, not at the top
              // level. A code that needs approval has not granted anything yet,
              // and saying "joined" would be a lie the agent discovers later.
              const teamName = r.team?.name || 'the team'
              const isPending = r.member?.status === 'pending'
              const grants = Number(r.newAccessGrants || 0)

              setJoinMessage({
                kind: 'success',
                text: isPending
                  ? `Request sent to ${teamName}. You get access once the owner approves.`
                  : grants > 0
                    ? `Joined ${teamName} — ${grants} campaign${grants === 1 ? '' : 's'} unlocked.`
                    : `Joined ${teamName}.`,
              })
            } catch {
              setJoinMessage({ kind: 'error', text: 'Could not reach the server. Try again.' })
            } finally {
              setJoining(false)
            }
          }}
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
          existingCampaigns={myCampaigns}
          onCreate={async ({ teamId, name, dialerMode, accessMode, existingCampaignId }) => {
            setBusy(true)
            try {
              // Either bring an existing campaign in, or make one first. Both
              // end at the same place: attach, which is what writes access_mode
              // and is now an upsert so a first attach actually creates the
              // link rather than failing to update a row that was never there.
              let campaignId = existingCampaignId

              if (!campaignId) {
                const created = await fetch('/api/campaigns/create', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    name,
                    // 'agent_choice' is a UI concept: the campaign keeps the
                    // platform default and the agent picks per session.
                    dialer_mode: dialerMode === 'agent_choice' ? 'progressive' : dialerMode,
                  }),
                }).then(r => r.json())
                if (!created.success || !created.campaign?.id) {
                  throw new Error(created.error || 'Could not create campaign')
                }
                campaignId = created.campaign.id
              }

              const attached = await fetch('/api/teams/campaigns/attach', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ teamId, campaignId, accessMode }),
              }).then(r => r.json())
              if (!attached.success) {
                throw new Error(attached.error || 'Could not add the campaign to this team')
              }

              setShowCampaignModal(false)
              await refresh()
              await loadMyCampaigns()
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
          defaultCampaignId={codeCampaignId}
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

      {/* ── ERRORS CLEAR THEMSELVES, AND SIT CLEAR OF THE PROFILE ───────────
          This was pinned to bottom-left with no timeout, so it landed on top
          of the Clerk profile widget and stayed there until clicked — an error
          you have to dismiss by hand, covering a control, is worse than the
          failure it reports.
          Raised above the profile rather than over it, and it retires on its
          own after a few seconds. Clicking still dismisses it early. */}
      {error && (
        <div
          onClick={() => setError(null)}
          role="alert"
          style={{
            position: 'fixed', bottom: 96, left: 18, zIndex: 70, cursor: 'pointer',
            background: '#7f1d1d', border: '1px solid #b91c1c', color: '#fee2e2',
            padding: '11px 15px', borderRadius: 5, fontSize: 13, maxWidth: 380,
            boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
          }}
        >{error}</div>
      )}
    </div>
  )
}
