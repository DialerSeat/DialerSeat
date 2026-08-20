'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import TeamsSidebar, {
  type SidebarTeam,
  type TeamsScope,
} from '@/components/teams/TeamsSidebar'
import TeamDetail, { type TeamDetailData } from '@/components/teams/TeamDetail'
import CampaignDetail from '@/components/teams/CampaignDetail'
import FloorView from '@/components/teams/FloorView'
import {
  VolumeChart, ConversionChart, DispositionChart, CampaignChart,
} from '@/components/teams/AnalyticsCharts'
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
  // payer travels with each grant, not with the membership: one person can
  // hold an owner-paid seat on one campaign and a self-paid one elsewhere.
  campaignAccess?: Array<{ campaignId: string; payer?: string | null }>
  billing_override?: string | null
  seat_suspended_at?: string | null
  /** Set when the owner absorbed this seat automatically because the agent
   *  stopped paying for it. Shown so a seat the owner does not remember
   *  agreeing to is never a mystery line on a statement. */
  billing_takeover_at?: string | null
  seat_suspend_reason?: string | null
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
type PanelView = 'overview' | 'all_users' | 'requests' | 'team' | 'campaign' | 'floor'

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
/** A dash, not a zero, when there is nothing to report. They are different
 *  facts and a reader who cannot tell them apart will trust the wrong one. */
function fmtNum(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—'
  return n.toLocaleString()
}

function fmtPct(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—'
  return `${n}%`
}

/** Hours only once there are hours. "0h 4m" reads as a rounding error. */
function fmtDuration(seconds: number | null | undefined): string {
  if (!seconds) return '—'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const sec = seconds % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${sec}s`
  return `${sec}s`
}

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


// ─────────────────────────────────────────────────────────────────────────
// THINGS YOU SHOULD KNOW
//
// Written for the people actually using this: lead vendors and agencies who
// sell or share seats, not hobbyists poking at settings. It opens by naming
// them, because someone who has just sold twenty-five seats needs to recognise
// themselves in the first sentence or they will close it.
//
// Deliberately short on mechanics. Explaining that regenerating a code changes
// the code, or that members cannot see the owner's billing, buries the three
// things that genuinely surprise people: how campaigns are shared without being
// given away, what happens when somebody stops paying, and what volume earns.
//
// Anything involving money says weekly, because seats bill weekly.
// ─────────────────────────────────────────────────────────────────────────
function HelpModal({ onClose }: { onClose: () => void }) {
  const H = ({ children }: { children: React.ReactNode }) => (
    <div style={{
      fontSize: 12, letterSpacing: 1.2, textTransform: 'uppercase',
      color: MUTED, fontWeight: 700, marginTop: 22, marginBottom: 8,
    }}>{children}</div>
  )
  const P = ({ children }: { children: React.ReactNode }) => (
    <p style={{ fontSize: 13.5, color: DIM, lineHeight: 1.75, margin: '0 0 10px' }}>{children}</p>
  )
  const B = ({ children }: { children: React.ReactNode }) => (
    <strong style={{ color: TEXT, fontWeight: 600 }}>{children}</strong>
  )

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.62)', display: 'flex',
        alignItems: 'center', justifyContent: 'center', padding: 20,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 620, maxHeight: '86vh', overflowY: 'auto',
          background: BG, border: `1px solid ${HAIRLINE}`, borderRadius: 6,
          padding: '26px 30px 34px', color: TEXT,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 22, fontWeight: 600 }}>Things you should know</div>
            <div style={{ fontSize: 12.5, color: DIM, marginTop: 4 }}>
              Running a floor, selling seats, and what you earn at volume.
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              background: 'transparent', border: `1px solid ${HAIRLINE}`,
              color: MUTED, borderRadius: 4, width: 28, height: 28,
              cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, lineHeight: 1,
            }}
          >×</button>
        </div>

        <P>
          Teams is for running a floor. Whether you have sold twenty-five seats to
          an agency, staffed one room yourself, or you are a vendor handing lists
          to closers you do not employ — this is where you decide who dials what,
          and who pays for the privilege.
        </P>

        <H>Sharing or selling your campaigns</H>
        <P>
          Your leads stay yours. Putting a campaign on a team does not give it
          away — it lets people you choose dial it, and you can pull that back at
          any time.
        </P>
        <P>
          You hand out access with a code. A <B>team code</B> puts someone on your
          roster and nothing more, so you can vet them before pointing them at a
          list. A <B>campaign code</B> puts them on the roster and straight onto
          that one campaign, which is what you want when you are staffing a
          specific list.
        </P>
        <P>
          Every code says who pays for the seat: <B>you</B>, or <B>them</B>. That is
          how you sell a seat — hand out a code set to &quot;they pay&quot;, and
          their own checkout covers it. Set it to &quot;you pay&quot; when the seat
          is part of what you are providing.
        </P>
        <P>
          Once somebody has a seat, adding them to more of your campaigns is{' '}
          <B>free</B> — to you and to them. The seat is what gets billed, not the
          list. Select people under All Users and use Add to campaign; forty agents
          onto a new list is one click, not forty seats.
        </P>

        <H>When somebody stops paying</H>
        <P>
          If an agent who was paying for their own seat cancels, <B>you pick it up
          automatically</B> and they keep dialing. Your floor does not lose a chair
          mid-shift because somebody&apos;s card expired. We tell you it happened,
          and you decide when to stop — pause or remove them, and the billing stops
          with it.
        </P>
        <P>
          If your card is the one that fails, nobody gets thrown out. You have a
          week to sort it out while your people keep working.
        </P>

        <H>What you earn at volume</H>
        <P>
          Seats bill weekly and cancel anytime. Ten seats <B>you pay for</B> earns
          5% off your weekly seat cost, twenty-five earns 10% — counted across
          every team you own, not per team.
        </P>
        <P>
          It only counts seats you fund, because it is a reduction of your bill —
          a seat an agent pays for themselves costs you nothing to begin with.
        </P>
        <P>
          Once you are past fifty people, rates stop being a formula: email{' '}
          <B>sales@dialerseat.com</B> and we will build something around how you
          actually run.
        </P>
      </div>
    </div>
  )
}

export default function TeamsPage() {
  const [teams, setTeams] = useState<SidebarTeam[]>([])
  const [rawTeams, setRawTeams] = useState<ApiTeam[]>([])
  const [pending, setPending] = useState(0)
  const [helpOpen, setHelpOpen] = useState(false)
  const [myDecisions, setMyDecisions] = useState<Array<{
    id: string; teamId: string; teamName: string
    outcome: 'accepted' | 'declined'; decidedAt: string | null
  }>>([])

  // Real numbers, counted from call rows. Null until the first load finishes so
  // the tiles show a dash rather than a zero — "0 calls" and "not loaded yet"
  // are different facts and must not look the same.
  const [stats, setStats] = useState<any>(null)
  const [statsLoading, setStatsLoading] = useState(true)

  // Volume standing across every team this person owns. Null for anyone who
  // owns none — they have no bill, so there is no tier to be on.
  const [seatTier, setSeatTier] = useState<any>(null)
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
  /**
   * Reload everything this page shows.
   *
   * `quiet` exists for the background poll. Without it every tick would set
   * loading true and blank the panel to "Loading…" for a moment, which is a
   * far worse experience than the stale data the poll exists to fix.
   */
  const refresh = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true)
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
      // ── NORMALISE THE SHAPE ONCE, HERE ──────────────────────────────────
      // The endpoint calls an owned team's campaigns `teamCampaigns` and the
      // member branch calls them `campaigns`. Reading one name meant attached
      // campaigns never appeared — the third time this response's naming has
      // silently produced an empty list rather than an error.
      //
      // Both are accepted at the boundary so nothing downstream has to know or
      // care which branch a team came from.
      const normalise = (t: any, isOwner: boolean): ApiTeam => ({
        ...t,
        isOwner,
        campaigns: t.teamCampaigns ?? t.campaigns ?? [],
      })
      const owned: ApiTeam[] = (data.teams?.owned || []).map((t: any) => normalise(t, true))
      const member: ApiTeam[] = (data.teams?.member || [])
        .map((t: any) => normalise(t, t.viewerRole === 'owner'))
      const all: ApiTeam[] = [...owned, ...member]
      setRawTeams(all)
      setTeams(toSidebarTeams(all))
      const mine = data.myPending || []
      setMyPending(mine)
      const decisions = data.myDecisions || []
      setMyDecisions(decisions)
      setSeatTier(data.seatTier || null)
      // ── ONLY COUNT WHAT SOMEBODY HAS TO ACT ON ───────────────────────
      // The badge used to include the viewer's OWN pending requests, so an
      // agent who joined with an approval code carried a permanent red dot for
      // something they could do nothing about. A badge that cannot be cleared
      // by any action is not a notification, it is decoration, and it teaches
      // people to ignore the real ones.
      //
      // An owner's incoming requests are different: those are decisions waiting
      // on them, and the count goes away when they decide. The agent's own
      // request still shows inside the Requests view — they can go and look at
      // it — it just does not shout.
      const incoming = all.reduce((n, t) => n + (t.pendingMembers?.length || 0), 0)
      // Two things badge, and both clear by acting: an owner's incoming
      // requests clear when they decide, and an agent's unseen decision clears
      // when they read it. The agent's own PENDING request still does not
      // badge — nothing has happened and there is nothing they can do.
      setPending(incoming + decisions.length)
    } catch {
      // A failed background tick must not wipe the page. Blanking the tree
      // because one poll hit a blip would be the sync making things worse than
      // the staleness it exists to fix.
      if (!quiet) setTeams([])
    } finally {
      if (!quiet) setLoading(false)
    }
  }, [])

  useEffect(() => { void refresh() }, [refresh])

  // ── QUIET BACKGROUND SYNC ──────────────────────────────────────────────
  // Requests and notifications arrive while somebody is looking at this page,
  // and until now the only way to see one was to reload. An owner watching for
  // a join request should not have to keep pressing refresh to find out
  // whether anybody knocked.
  //
  // Deliberately invisible: no spinner, no flash, no "syncing" text. A silent
  // poll that quietly keeps the page true is useful; one that announces itself
  // every five seconds is a distraction wearing the costume of a feature.
  // refresh() replaces state wholesale, and React will not re-render rows whose
  // props are unchanged, so a tick where nothing happened costs nothing visible.
  //
  // Scoped to this page only — mounted with the Teams route and torn down when
  // it unmounts. A sitewide five-second poll would be a permanent load on every
  // page for a benefit only this one has.
  //
  // Paused while the tab is hidden. Polling a page nobody is looking at is
  // spend with no reader, and a laptop left open on Teams overnight would
  // otherwise make seventeen thousand requests.
  useEffect(() => {
    const tick = () => {
      if (typeof document !== 'undefined' && document.hidden) return
      void refresh(true)
    }
    const id = setInterval(tick, 5000)
    return () => clearInterval(id)
  }, [refresh])

  // ── ONE REQUEST PER (SCOPE, RANGE) ─────────────────────────────────────
  // Both are questions the endpoint already answers, so changing either
  // re-asks rather than re-deriving anything on the client. Nothing here is
  // computed from a cached payload, which is how two views of the same period
  // end up disagreeing.
  const loadStats = useCallback(async () => {
    setStatsLoading(true)
    try {
      const params = new URLSearchParams({ range })
      if (scope.kind === 'team') { params.set('scope', 'team'); params.set('scopeId', scope.teamId) }
      else if (scope.kind === 'campaign') { params.set('scope', 'campaign'); params.set('scopeId', scope.campaignId) }
      else if (scope.kind === 'agent') { params.set('scope', 'agent'); params.set('scopeId', scope.userId) }
      const r = await fetch(`/api/teams/analytics?${params}`).then(x => x.json())
      setStats(r.success ? r : null)
    } catch {
      setStats(null)
    } finally {
      setStatsLoading(false)
    }
  }, [range, scope])

  useEffect(() => { void loadStats() }, [loadStats])

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

  // One row per MEMBERSHIP, not per person. Somebody on two of your teams
  // appears twice, named by team — which is right, because everything an owner
  // does from this list (add to a campaign, pause a seat) is a decision about
  // one place on one team, not about the human in general.
  const allMembers = useMemo(() => {
    const out: Array<{
      id: string
      memberId: string
      userId: string
      name: string
      team: string
      teamId: string
      isOwner: boolean
      payer: 'owner' | 'agent' | 'free' | null
      campaignCount: number
      suspended: boolean
      pickedUp: boolean
    }> = []
    const seen = new Set<string>()
    for (const t of rawTeams) {
      for (const m of t.members || []) {
        const key = `${t.id}:${m.id}`
        if (seen.has(key)) continue
        seen.add(key)
        const access: any[] = m.campaignAccess || []
        const payer: 'owner' | 'agent' | 'free' | null =
          m.billing_override === 'owner' || m.billing_override === 'agent'
            ? m.billing_override
            : access.some((a: any) => a.payer === 'owner')
            ? 'owner'
            : access.some((a: any) => a.payer === 'agent')
            ? 'agent'
            : null
        out.push({
          id: `${t.id}:${m.id}`,
          memberId: m.id,
          userId: m.userId || m.id,
          name: displayName(m),
          team: t.name,
          teamId: t.id,
          isOwner: !!t.isOwner,
          payer,
          campaignCount: access.length,
          suspended: !!m.seat_suspended_at,
          pickedUp: !!m.billing_takeover_at,
        })
      }
    }
    return out
  }, [rawTeams])

  const distinctUserCount = useMemo(
    () => new Set(allMembers.map(m => m.userId)).size,
    [allMembers]
  )

  // ── SELECT PEOPLE, PUT THEM ON A CAMPAIGN ──────────────────────────────
  // An owner with a floor of agents and a new list should not be opening fifty
  // member panels. Nothing here charges anybody: the seat is the billable unit
  // and these people already hold one, so another campaign on the same seat is
  // free to the owner and free to the agent.
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set())
  const [assigning, setAssigning] = useState(false)
  const [assignTo, setAssignTo] = useState('')
  const [assignResult, setAssignResult] = useState<string | null>(null)

  const toggleMember = (id: string) => {
    setAssignResult(null)
    setSelectedMembers(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Only campaigns on teams you OWN, and only those belonging to a team that
  // is actually represented in the selection — offering a campaign that would
  // silently skip everyone selected is worse than not offering it.
  const assignableCampaigns = useMemo(() => {
    const selectedTeamIds = new Set(
      allMembers.filter(m => selectedMembers.has(m.id)).map(m => m.teamId)
    )
    const out: Array<{ id: string; name: string; team: string }> = []
    for (const t of rawTeams) {
      if (!t.isOwner) continue
      if (selectedTeamIds.size > 0 && !selectedTeamIds.has(t.id)) continue
      for (const tc of t.campaigns || []) {
        const c = (tc as any).campaign || tc
        const cid = (tc as any).campaignId || c?.id
        if (!cid) continue
        out.push({ id: cid, name: c?.name || 'Campaign', team: t.name })
      }
    }
    return out
  }, [rawTeams, allMembers, selectedMembers])

  const assignSelectedToCampaign = async () => {
    if (!assignTo || selectedMembers.size === 0 || assigning) return
    setAssigning(true)
    setAssignResult(null)
    try {
      const memberIds = allMembers
        .filter(m => selectedMembers.has(m.id))
        .map(m => m.memberId)
      const res = await fetch('/api/teams/access/grant-bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId: assignTo, memberIds }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data?.success) {
        setAssignResult(data?.error || 'Could not add those members.')
      } else {
        const parts: string[] = []
        if (data.granted) parts.push(`${data.granted} added`)
        if (data.alreadyHad) parts.push(`${data.alreadyHad} already had access`)
        if (data.skipped?.length) parts.push(`${data.skipped.length} skipped`)
        setAssignResult(parts.join(' · ') || 'Nothing to do.')
        setSelectedMembers(new Set())
        setAssignTo('')
        void refresh()
      }
    } catch (e: any) {
      setAssignResult(e?.message || 'Something went wrong.')
    } finally {
      setAssigning(false)
    }
  }

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
  /**
   * Leave a full-panel view.
   *
   * Clears the scope as well as the view. The sidebar marks a row as selected
   * from `scope`, so returning from a team while scope still pointed at it left
   * that row lit up as though you were still inside — the highlight outlived
   * the thing it described.
   */
  const goOverview = useCallback(() => {
    setView('overview')
    setScope({ kind: 'all' })
  }, [])

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
      // Opening the view IS reading the decision. Marked on the way in rather
      // than behind a dismiss button, because asking somebody to acknowledge
      // that they have been told something they can already see is a click
      // that buys nothing.
      if (!leaving && myDecisions.length > 0) {
        void fetch('/api/teams/members/seen-decision', { method: 'POST' })
          .then(() => { setMyDecisions([]); void refresh(true) })
          .catch(() => {})
      }
      return
    }
    setScope(next)
    // A campaign in the tree now opens the campaign, for the same reason a team
    // opens the team: it is a thing you manage, not a filter you apply. It used
    // to quietly re-scope the overview, which looked identical to nothing
    // happening.
    setView(
      next.kind === 'team' ? 'team'
      : next.kind === 'campaign' ? 'campaign'
      : 'overview'
    )
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
          status: (rc?.campaign as any)?.status,
        }
      }),
      members: (raw.members || []).map(m => ({
        id: m.userId || m.id,
        name: displayName(m),
        email: m.user?.email ?? null,
        campaignCount: (m.campaignAccess || []).length,
      })),
      // Only meaningful for a team this person joined rather than owns. An
      // owner reaches every campaign on their own team by definition.
      myCampaignIds: (raw as any).myCampaignIds || [],
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

            /* ── FIT THE ACTUAL VIEWPORT ─────────────────────────────────
               100vh on iOS is the height of the screen WITHOUT the browser
               chrome, so a drawer sized to it runs underneath the address bar
               and the home indicator — which is why the join-code field at the
               bottom was half off the screen. 100dvh is the space actually
               visible right now.

               The insets go on this element and not on a child: it is the
               position:fixed one, and a child's padding cannot move a fixed
               parent out from under the notch. "My Teams" and the ⋮ / + buttons
               were sitting under the status bar for exactly that reason. */
            height: 100dvh;
            box-sizing: border-box;
            padding-top: env(safe-area-inset-top, 0px);
            padding-bottom: env(safe-area-inset-bottom, 0px);
            overflow: hidden;
          }
          .ts-drawer-checkbox:checked ~ .ts-side { transform: translateX(0); }

          .ts-overlay {
            display: block; position: fixed; inset: 0; z-index: 55;
            background: rgba(0,0,0,0.5);
            opacity: 0; pointer-events: none;
            transition: opacity 0.22s ease;
          }
          .ts-drawer-checkbox:checked ~ .ts-overlay { opacity: 1; pointer-events: auto; }

          /* ── THE SAME TAB AS THE DIALER ──────────────────────────────
             A hamburger in the top-right competed with the nav hamburger in the
             top-left: two identical controls, inches apart, opening different
             things. The dialer already solved this with an arrow tab on the
             right edge, and a right-hand drawer should be opened by a control
             attached to the right-hand edge — the gesture and the result point
             the same way.

             Geometry copied from .dialer-right-toggle so the two pages feel
             like one product: 22x64, hinged at the edge, sitting at 73% down
             the screen where a thumb rests rather than where the eye starts. */
          .ts-fab {
            display: flex; position: fixed; z-index: 65;
            right: 0;
            top: 73%;
            transform: translateY(-50%);
            width: 22px; height: 64px;
            border-radius: 8px 0 0 8px;
            border: 1px solid var(--brand-sidebar-active-bg, #35373c);
            border-right: none;
            background: var(--brand-header-bg, #111214);
            color: var(--brand-primary, #4a9eff);
            align-items: center; justify-content: center;
            cursor: pointer; padding: 0;
            font-size: 18px; font-weight: bold; line-height: 1;
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
      >‹</label>

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
          {view === 'floor' && <FloorView onBack={goOverview} />}

          {view === 'campaign' && scope.kind === 'campaign' && (
            <CampaignDetail
              campaignId={scope.campaignId}
              onBack={goOverview}
              onChanged={() => { void refresh() }}
            />
          )}

          {view === 'all_users' && (
            <>
              <ViewHeader title="All Users" onBack={goOverview} />
              {allMembers.length === 0 ? (
                <div style={{ color: DIM, fontSize: 13 }}>
                  {loading ? 'Loading…' : 'No members yet.'}
                </div>
              ) : (
                <>
                  {/* ── ACTION BAR ────────────────────────────────────────
                      Appears only once something is selected. An owner just
                      reading the roster should not be looking at controls for
                      an action they have not started. */}
                  {selectedMembers.size > 0 && (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
                      background: '#12141a', border: `1px solid ${HAIRLINE}`,
                      borderRadius: 4, padding: '10px 12px', marginBottom: 12,
                    }}>
                      <span style={{ fontSize: 12, color: TEXT }}>
                        {selectedMembers.size} selected
                      </span>
                      <select
                        value={assignTo}
                        onChange={e => setAssignTo(e.target.value)}
                        style={{
                          background: '#0d0f13', color: TEXT, fontSize: 12,
                          border: `1px solid ${HAIRLINE}`, borderRadius: 3,
                          padding: '6px 8px', fontFamily: 'inherit',
                        }}
                      >
                        <option value="">Add to campaign…</option>
                        {assignableCampaigns.map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                      <button
                        onClick={assignSelectedToCampaign}
                        disabled={!assignTo || assigning}
                        style={{
                          background: !assignTo || assigning ? '#1b1e25' : '#4a9eff',
                          color: !assignTo || assigning ? DIM : '#06080c',
                          border: 'none', borderRadius: 3, padding: '7px 14px',
                          fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
                          cursor: !assignTo || assigning ? 'not-allowed' : 'pointer',
                        }}
                      >
                        {assigning ? 'Adding…' : 'Add'}
                      </button>
                      <button
                        onClick={() => { setSelectedMembers(new Set()); setAssignTo(''); setAssignResult(null) }}
                        style={{
                          background: 'transparent', color: DIM, border: 'none',
                          fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                        }}
                      >
                        Clear
                      </button>
                      {/* Said plainly, and before the click rather than after:
                          an owner about to add forty agents to a list needs to
                          know this is not forty new seats. */}
                      <span style={{ fontSize: 11, color: DIM, width: '100%' }}>
                        No extra charge — these seats are already paid for.
                      </span>
                    </div>
                  )}

                  {assignResult && (
                    <div style={{ fontSize: 12, color: DIM, marginBottom: 10 }}>{assignResult}</div>
                  )}

                  <div style={{ display: 'grid', gap: 8 }}>
                    {allMembers.map(m => {
                      const checked = selectedMembers.has(m.id)
                      return (
                        <div key={m.id} style={{
                          display: 'flex', alignItems: 'center', gap: 12,
                          background: PANEL,
                          border: `1px solid ${checked ? '#4a9eff' : HAIRLINE}`,
                          borderRadius: 4, padding: '12px 14px',
                          opacity: m.suspended ? 0.55 : 1,
                        }}>
                          {/* Only an owner can put someone on a campaign, so
                              only an owner gets a checkbox. */}
                          {m.isOwner && (
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleMember(m.id)}
                              disabled={m.suspended}
                              style={{ accentColor: '#4a9eff', cursor: m.suspended ? 'not-allowed' : 'pointer' }}
                            />
                          )}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 14, fontWeight: 500 }}>{m.name}</div>
                            <div style={{ fontSize: 11.5, color: DIM, marginTop: 2 }}>{m.team}</div>
                          </div>
                          <span style={{ fontSize: 11, color: DIM, textAlign: 'right' }}>
                            {m.suspended
                              ? 'Seat paused'
                              : m.pickedUp
                              ? 'You picked this seat up'
                              : m.payer === 'owner'
                              ? 'You pay this seat'
                              : m.payer === 'agent'
                              ? 'Pays their own seat'
                              : 'Seat active'}
                            <span style={{ display: 'block', color: '#5a6070' }}>
                              {m.campaignCount === 0
                                ? 'No campaigns yet'
                                : m.campaignCount === 1
                                ? '1 campaign'
                                : `${m.campaignCount} campaigns`}
                            </span>
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </>
              )}
            </>
          )}

          {view === 'requests' && (
            <>
              <ViewHeader title="Requests" onBack={goOverview} />

              {/* ── WHAT CAME BACK ───────────────────────────────────────────
                  Above everything, because an answer to a question you asked
                  outranks a list of questions other people asked you. Declines
                  are stated plainly rather than softened — somebody who was
                  turned down needs to know that, not to be left wondering
                  whether the request is still in flight. */}
              {myDecisions.length > 0 && (
                <div style={{ display: 'grid', gap: 8, marginBottom: 18 }}>
                  {myDecisions.map(d => {
                    const ok = d.outcome === 'accepted'
                    return (
                      <div key={d.id} style={{
                        background: PANEL,
                        border: `1px solid ${ok ? '#16a34a' : '#b45309'}`,
                        borderRadius: 4, padding: '12px 14px',
                      }}>
                        <div style={{ fontSize: 13.5, color: TEXT }}>
                          {ok ? (
                            <>You were accepted onto <strong>{d.teamName}</strong>.</>
                          ) : (
                            <><strong>{d.teamName}</strong> declined your request.</>
                          )}
                        </div>
                        <div style={{ fontSize: 11.5, color: DIM, marginTop: 3 }}>
                          {ok
                            ? 'Their campaigns are in your sidebar now.'
                            : 'Ask whoever sent you the code if you think this was a mistake.'}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

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

                {/* ── THINGS YOU SHOULD KNOW ────────────────────────────────
                    Far right, out of the way of the controls. Teams carries a
                    lot of rules that are invisible until one of them surprises
                    you — who pays for a seat, what a team code actually grants,
                    why a discount is counted the way it is. An owner should be
                    able to look them up without asking, rather than learning
                    each one from a bill or a locked-out agent. */}
                <div style={{ marginLeft: 'auto', position: 'relative' }}>
                  <button
                    onClick={() => setHelpOpen(true)}
                    aria-label="Things you should know"
                    title="Things you should know"
                    style={{
                      width: 30, height: 30, borderRadius: '50%',
                      background: '#111214', border: `1px solid ${HAIRLINE}`,
                      color: MUTED, fontSize: 15, fontWeight: 700,
                      cursor: 'pointer', fontFamily: 'inherit', lineHeight: 1,
                    }}
                  >?</button>
                </div>
              </div>

              <div style={{
                display: 'grid', gap: 12, marginBottom: 20,
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              }}>
                {/* A dash means no data, never a stand-in for a number we did
                    not fetch. Every value below is counted from call rows. */}
                <StatTile
                  label="Total Calls"
                  value={statsLoading ? '—' : fmtNum(stats?.tiles?.totalCalls)}
                  sub={RANGES.find(r => r.key === range)?.label || ''}
                  accent="#2563eb"
                />
                <StatTile
                  label="Contact Rate"
                  value={statsLoading ? '—' : fmtPct(stats?.tiles?.contactRate)}
                  sub="reached a person"
                  accent="#2563eb"
                />
                <StatTile
                  label="Conversions"
                  value={statsLoading ? '—' : fmtNum(stats?.tiles?.conversions)}
                  sub={fmtPct(stats?.tiles?.conversionRate) + ' of calls'}
                  accent="#16a34a"
                />
                <StatTile
                  label="Talk Time"
                  value={statsLoading ? '—' : fmtDuration(stats?.tiles?.talkSecondsTotal)}
                  sub={stats?.tiles?.avgTalkSeconds
                    ? `avg ${fmtDuration(stats.tiles.avgTalkSeconds)} /call`
                    : 'avg — /call'}
                  accent="#2563eb"
                />
                <StatTile
                  label="Best Campaign"
                  value={statsLoading ? '—' : (stats?.tiles?.bestCampaign?.name || '—')}
                  sub={stats?.tiles?.bestCampaign
                    ? `${stats.tiles.bestCampaign.rate}% of ${stats.tiles.bestCampaign.calls} calls`
                    : `need ${stats?.tiles?.minCallsToRank ?? 5}+ calls`}
                  accent="#b45309"
                />
                <StatTile
                  label="Active Seats"
                  value={String(distinctUserCount || 0)}
                  sub={seatTier?.percentOff > 0 ? `${seatTier.percentOff}% off weekly` : 'across your teams'}
                  accent="#b45309"
                />
              </div>

              <div style={{
                display: 'grid', gap: 14, marginBottom: 14,
                gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
              }}>
                <VolumeChart points={stats?.charts?.volume || []} />
                <ConversionChart points={stats?.charts?.conversionRate || []} />
              </div>
              <div style={{
                display: 'grid', gap: 14,
                gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
              }}>
                <DispositionChart points={stats?.charts?.dispositions || []} />
                <CampaignChart points={stats?.charts?.byCampaign || []} />
              </div>

            </>
          )}

          {view === 'team' && openTeam && (
            <>
              <ViewHeader title={openTeam.name} onBack={goOverview} />
              <TeamDetail
                seatTier={seatTier}
                onOpenCampaign={campaignId => {
                  setScope({ kind: 'campaign', teamId: openTeam.id, campaignId })
                  setView('campaign')
                }}
                team={openTeam}
                onNewCampaign={id => { setCampaignTeamId(id); setShowCampaignModal(true) }}
                onToggleCampaign={async (campaignId, nextStatus) => {
                  setBusy(true)
                  try {
                    const r = await fetch('/api/campaigns/update', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ id: campaignId, status: nextStatus }),
                    }).then(x => x.json())
                    if (!r.success) throw new Error(r.error || 'Could not change the campaign')
                    await refresh()
                  } catch (e: any) {
                    setError(e.message || 'Could not change the campaign')
                  } finally { setBusy(false) }
                }}
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

      {helpOpen && <HelpModal onClose={() => setHelpOpen(false)} />}

      <div className="ts-side" id="ts-side">
        <TeamsSidebar
          onOpenFloor={() => { setScope({ kind: 'all' }); setView('floor') }}
          teams={teams}
          scope={scope}
          onScopeChange={handleScope}
          pendingRequests={pending}
          onCreateTeam={() => setShowTeamModal(true)}
          onCreateCampaign={() => { setCampaignTeamId(undefined); setShowCampaignModal(true) }}
          joining={joining}
          joinMessage={joinMessage}
          activeUserCount={distinctUserCount}
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
          onCreate={async ({ codeType, campaignId, payer, joinMode, maxUses }) => {
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
                  joinMode,
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
