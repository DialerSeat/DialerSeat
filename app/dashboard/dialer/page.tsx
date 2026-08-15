'use client'
import { useState, useEffect, useRef, useCallback, Suspense } from 'react'
import { useUser } from '@clerk/nextjs'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { normalizeState } from '@/lib/normalizeState'
import { isDialableLead } from '@/lib/dialableLead'
import type { QueueDiagnosis } from '@/lib/queueDiagnosis'
import { phoneToState } from '@/lib/areaCode'

/**
 * Whole seconds since a start timestamp, 0 when never started.
 *
 * Module scope on purpose: React's compiler lint treats a bare Date.now() in
 * the component body as an impure render-time call, even inside an event
 * handler where it is perfectly correct. Keeping the clock read out here
 * expresses the same thing without tripping it.
 */
function elapsedSecondsSince(startMs: number): number {
  if (!startMs) return 0
  return Math.max(0, Math.floor((Date.now() - startMs) / 1000))
}

/** Current time as an ISO string. Module scope for the same lint reason. */
function nowIso(): string {
  return new Date().toISOString()
}

// =============================================================================
// DIALER PAGE — Pass 2 Phase C9 (mobile fixes on top of C8)
// =============================================================================
// C9 changes vs C8 (mobile-only, inside the @media (max-width:768px) block):
//   1. .dialer-right-toggle  top: 66% -> 80%  (right-edge arrow sits lower,
//      between vertical center and the bottom of the screen).
//   2. .dialer-right-sidebar gains  padding-top: env(safe-area-inset-top, 0px)
//      and  box-sizing: border-box  so "TODAY'S METRICS" clears the iOS
//      status bar / notch instead of hiding behind it. The inset MUST be on
//      the position:fixed; top:0 element itself (this sidebar), not a child —
//      a child's padding can't move the fixed parent out from under the notch.
//      On non-notch devices the inset resolves to 0, so nothing changes there.
//
// Everything else is byte-for-byte C8.
// =============================================================================

type CallStatus = 'idle' | 'calling' | 'connected' | 'ended' | 'preview_ready'
type AccessTier = 'active' | 'lapsed' | 'new' | null
type DialerMode = 'preview' | 'power' | 'progressive' | 'predictive'
type AgentState = 'ready' | 'dialing' | 'on_call' | 'wrapping' | 'paused'

interface Lead {
  id: string
  first_name: string
  last_name: string
  phone: string
  city: string
  state: string
  campaign_id: string
  dial_attempts?: number
  extra_data: Record<string, any>
}

interface Campaign {
  id: string
  name: string
  status: string
  total_leads: number
  script?: string
  // sort_order comes from campaign_script_links — the order the user sets by
  // dragging the script chips on the campaign. Carried per-script so the
  // dialer can sort explicitly instead of trusting array position.
  scripts?: { id: string; name: string; body: string; sort_order?: number }[]
  dialer_mode?: DialerMode
  amd_enabled?: boolean
  // Already returned by /api/campaigns/list (it selects *) — typed here so the
  // header's REC indicator can start in the right state. A campaign with
  // recording on is ALREADY recording from answer, so showing "REC OFF" on
  // such a call would be a lie the agent might act on.
  recording_enabled?: boolean
  predictive_lines_per_agent?: number
  dial_repeat_count?: number
}

interface TeamScopeCampaign {
  campaignId: string
  accessMode: 'owner_pays' | 'agent_pays' | 'public'
  campaign: { id: string; name: string; total_leads: number; called_leads: number; status: string } | null
}

interface TeamScope {
  id: string
  name: string
  viewerRole: 'owner' | 'member'
  teamCampaigns: TeamScopeCampaign[]
}

interface PacingInfo {
  activeAgents: number
  readyAgents: number
  dialingAgents: number
  onCallAgents: number
  abandonRate: number
  isDegraded: boolean
  isPredictiveTeam: boolean
  configuredLines: number
  effectiveLines: number
}

interface LinesPrefInfo {
  effective_lines: number
  preferred_lines: number | null
  campaign_default: number
  campaign_min: number
  campaign_max: number
  hard_cap: number
}

interface HeartbeatControllerSummary {
  fired: number
  desired: number
  inFlight: number
  effectiveLines: number
  degraded: boolean
  reason: string
  callSids?: string[]
  dialedPhones?: string[]
  inFlightPhones?: string[]
  /** Lead ids in flight — what row highlighting keys off. Phone numbers are
   *  not unique per lead, so they can't identify a row. */
  inFlightLeadIds?: string[]
  /** Lead ids placed on THIS tick only. Drives queue rotation. Distinct from
   *  inFlightLeadIds, which is cumulative and would re-stamp a lead on every
   *  beat it stayed up. */
  dialedLeadIds?: string[]
  skipped?: number
  released?: number
  dedupedPhones?: number
}

interface IncomingRouteResponse {
  incoming: boolean
  reason?: string
  call?: {
    id: string
    sid: string
    lead_id: string | null
    phone_number: string
    started_at: string
    room_name: string | null
  }
  lead?: Lead | null
  session_state?: string
  session_id?: string
}

interface SessionStats {
  calls: number
  connected: number
  appointments: number
  closed: number
  dnc: number
  notInterested: number
}

const ZERO_STATS: SessionStats = {
  calls: 0, connected: 0, appointments: 0, closed: 0, dnc: 0, notInterested: 0,
}

const PERSONAL_SCOPE = '__personal__'
const ALL_ACTIVE = '__all_active__'
const LS_LAST_CAMPAIGN = 'dialer:lastCampaign'
const LS_LAST_SCOPE = 'dialer:lastScope'
const LS_SESSION_STATS = 'dialer:sessionStats'
const LS_ALL_ACTIVE_MODE = 'dialer:allActiveMode'

const VALID_MODES: DialerMode[] = ['preview', 'power', 'progressive', 'predictive']

const MODE_OPTIONS: { value: DialerMode; label: string; color: string }[] = [
  { value: 'preview', label: 'PREVIEW', color: '#5a5e6a' },
  { value: 'power', label: 'POWER', color: '#2a4a8a' },
  { value: 'progressive', label: 'PROGRESSIVE', color: '#1a6a1a' },
  { value: 'predictive', label: 'PREDICTIVE', color: '#8a1a1a' },
]

const HEARTBEAT_INTERVAL_MS = 5_000
const PACING_POLL_INTERVAL_MS = 10_000
const INCOMING_POLL_INTERVAL_MS = 2_000

const LINES_OPTIONS = [1, 2, 3, 4, 5]

// ── HOW MUCH OF THE PANEL'S ORDER THE SERVER ACTUALLY NEEDS ─────────────────
// The dial path is told the queue panel's displayed order so it dials top-down
// through any filter or shuffle. That order used to be sent in FULL, on every
// heartbeat — every five seconds, forever.
//
// A uuid costs 37 characters. At 848 leads that is a ~31KB request, which is
// what took production down: PostgREST rejected the resulting query string with
// a bare 400 and every mode stopped dialing. At 10,000 leads it is ~370KB every
// five seconds per agent, and lists run larger than that.
//
// Nothing needs the whole list. The server picks the NEXT lead to dial, and
// predictive claims at most five lines — so the top of the order is the only
// part that can ever be selected from. The window is re-sent on every beat and
// the panel rotates dialed rows to the bottom, so it always describes the rows
// that are actually next up.
const DIAL_ORDER_WINDOW = 300

// ── HOW MANY LEADS THE PANEL HOLDS AT ONCE ──────────────────────────────────
// The panel used to load every lead in the campaign, always. At 831 that was 17
// sequential requests; at 100,000 it is a tab that never finishes.
//
// So it loads a large first slab and then doubles on demand: 2,000 → 4,000 →
// 8,000, each time the agent asks for more at the bottom of the list. Doubling
// rather than a fixed page because the agent who wants more than 2,000 rows on
// screen usually wants far more, and making them click eleven times to reach
// 24,000 is its own kind of broken.
const QUEUE_INITIAL_LOAD = 2000

const FUTURA = `'Futura PT', Futura, 'Helvetica Neue', Helvetica, Arial, sans-serif`

function todayKey(): string {
  return new Date().toISOString().split('T')[0]
}

function DialerPageInner() {
  const { user } = useUser()
  const searchParams = useSearchParams()
  const [notes, setNotes] = useState('')
  const [tier, setTier] = useState<AccessTier>(null)
  const [tierLoaded, setTierLoaded] = useState(false)

  const [clockTick, setClockTick] = useState(0)

  const [status, setStatus] = useState<CallStatus>('idle')
  // The heartbeat runs on an interval, so reading `status` from its closure
  // gives whatever the value was when that interval was created. That exact
  // staleness is what made predictive_armed report false for two days. Any
  // heartbeat-side decision reads this instead.
  const statusRef = useRef<CallStatus>('idle')
  useEffect(() => { statusRef.current = status }, [status])
  const [manualNumber, setManualNumber] = useState('')
  const [seconds, setSeconds] = useState(0)
  const [available, setAvailable] = useState(false)

  // ─── PREDICTIVE ENGINE — explicit "started" flag ──────────────────────────
  const [predictiveEngineStarted, setPredictiveEngineStarted] = useState(false)

  const [disposition, setDisposition] = useState('')
  const [showDisposition, setShowDisposition] = useState(false)
  const [currentLead, setCurrentLead] = useState<Lead | null>(null)
  const [previewLead, setPreviewLead] = useState<Lead | null>(null)
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [selectedCampaign, setSelectedCampaign] = useState<string>('')
  const [campaignsLoaded, setCampaignsLoaded] = useState(false)
  const [showSelectCampaignMsg, setShowSelectCampaignMsg] = useState(false)
  const [callStart, setCallStart] = useState(0)
  // Live ref mirror of callStart. The poll callbacks that fire the disposition
  // sheet are closures created BEFORE the call connected, so they capture a
  // stale callStart (0) — which made "CALL LASTED" always read 0s. Reading the
  // ref instead gives the real start time.
  const callStartRef = useRef(0)
  // Final whole-second duration of the call that just ended, shown on the
  // lead profile / disposition sheet after hangup.
  const [lastCallDuration, setLastCallDuration] = useState<number | null>(null)
  const [noLeads, setNoLeads] = useState(false)
  const [activeCallSid, setActiveCallSid] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  const [swReady, setSwReady] = useState(false)
  const [micGranted, setMicGranted] = useState(false)
  const [rightSidebarOpen, setRightSidebarOpen] = useState(false)
  const [dialZoomed, setDialZoomed] = useState(false)

  const [sessionStats, setSessionStats] = useState<SessionStats>(ZERO_STATS)
  const [sessionStatsLoaded, setSessionStatsLoaded] = useState(false)
  const [sessionDate, setSessionDate] = useState<string>(todayKey())

  const [teamScopes, setTeamScopes] = useState<TeamScope[]>([])
  const [selectedScope, setSelectedScope] = useState<string>(PERSONAL_SCOPE)
  const [scopesLoaded, setScopesLoaded] = useState(false)

  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [pacingInfo, setPacingInfo] = useState<PacingInfo | null>(null)
  const [amdActivity, setAmdActivity] = useState<string[]>([])
  // Currently-ringing numbers for the live-activity panel (predictive: all
  // lines in flight right now, so they can be shown highlighted together as
  // a group — distinct from amdActivity's historical scrollback log, which
  // only ever shows what already happened). Cleared/replaced each
  // heartbeat tick with whatever's actually in flight that moment.
  const [activeDialingNumbers, setActiveDialingNumbers] = useState<string[]>([])
  // Lead ids currently in flight, straight from the controller. Row
  // highlighting keys off THIS, not phone numbers — see activeQueueLeadIds.
  const [activeDialingLeadIds, setActiveDialingLeadIds] = useState<string[]>([])
  // The previous heartbeat's in-flight lead ids. Diffing against the current
  // set is what tells us which predictive lines FINISHED, which is when a row
  // should sink — see the heartbeat handler.
  const prevInFlightLeadIdsRef = useRef<string[]>([])
  // Leads queued for this campaign, fetched once the agent goes available
  // (predictiveView transitions to 'available') and shown in the lead
  // profile slot so they can see what's about to be worked, before they
  // click Initiate Dial Sequence. Once dialing starts, entries matching
  // activeDialingNumbers get visually highlighted rather than replaced —
  // the list itself stays visible throughout.
  interface QueuedLead {
    id: string
    phone: string
    first_name?: string | null
    last_name?: string | null
    city?: string | null
    state?: string | null
    // Not shown as a visible column (the panel intentionally doesn't
    // surface campaign identity — see LeadQueuePanel), but required
    // internally: when scoped to "All Active Campaigns" the queue merges
    // leads from multiple campaigns, and campaign_id is how a lead is
    // correctly attributed back to its own campaign when dialed.
    campaign_id?: string | null
    created_at?: string | null
    dial_attempts?: number | null
    disposition?: string | null
    // Already returned by /api/leads/list (it selects *). Typed here because
    // it drives queue ROTATION — see visibleQueuedLeads. Null means never
    // dialed, which is what puts fresh leads at the top.
    last_called_at?: string | null
  }
  const [queuedLeads, setQueuedLeads] = useState<QueuedLead[]>([])
  const [queuedLeadsLoading, setQueuedLeadsLoading] = useState(false)
  // How many leads the panel is currently willing to hold. Doubles each time
  // the agent asks for more at the bottom of the list — see QUEUE_INITIAL_LOAD.
  const [queueLoadCap, setQueueLoadCap] = useState(QUEUE_INITIAL_LOAD)
  // True when the server still had pages left after the cap was reached, i.e.
  // there genuinely are more leads to show. False means the panel is holding
  // the entire book and the list can say so.
  const [queueHasMore, setQueueHasMore] = useState(false)
  // FILTER control on the queue panel — a real, server-backed name/phone
  // search (reuses /api/leads/list's existing `search` param) plus a sort
  // toggle (existing `sort` param: created_asc/created_desc). No client-side
  // fake filters — both of these are genuine query params the backend
  // already supports for this exact table.
  const [queueSearch, setQueueSearch] = useState('')
  const [queueSortDesc, setQueueSortDesc] = useState(false)
  const [queueFilterOpen, setQueueFilterOpen] = useState(false)
  // Client-side STATE filter — /api/leads/list has no state param (it only
  // searches name/phone server-side), so this narrows the already-fetched
  // page client-side against the real `state` field on each lead. Combined
  // with queueSearch (name/phone, server-side) via the FILTER control.
  // Declared here (not down near fetchNextLead, where it originally lived)
  // because the filter/shuffle derivation block that uses it now sits
  // early in the file too — see right after the click-outside effect below
  // — since the heartbeat effect's dependency array references
  // visibleQueuedLeads/isQueueFiltered and is itself declared before that
  // point in the component body.
  const [queueStateFilter, setQueueStateFilter] = useState('')
  // Ref on the filter dropdown's outer wrapper (button + panel together) —
  // used by the click-outside effect below to close the dropdown when a
  // click lands anywhere else on the page, instead of requiring the FILTER
  // button itself to be clicked again to toggle it shut.
  const queueFilterRef = useRef<HTMLDivElement>(null)
  // Guards against a real race condition: fetchQueuedLeadsFor paginates
  // through potentially many pages per campaign, and there was previously
  // no way to tell a late-arriving response from an OLD selection apart
  // from the current one. Switching from a specific campaign to "All
  // Active Campaigns" (or between campaigns) while a slow fetch for the
  // PREVIOUS selection was still in flight could let that old fetch finish
  // AFTER the new one and silently overwrite it with stale data — matching
  // the reported "switching doesn't update, I have to refresh" symptom
  // exactly. Each fetchQueuedLeads call captures the current generation
  // number; only the response matching the CURRENT (latest) generation is
  // ever applied to state.
  const queueFetchGenerationRef = useRef(0)
  // Shuffle — a seeded randomization of the currently-visible (post-filter)
  // row order, living in the filter dropdown rather than as its own
  // button per instruction. This NOW genuinely affects dial order, not
  // just display: fetchNextLead sends the shuffled order to /api/leads/next
  // as an ordered lead_ids allowlist, and the predictive controller
  // receives the same ordering via the heartbeat — both prioritize dialing
  // in this order when a shuffle is active. See the filter/shuffle
  // derivation block below for the actual reorder logic.
  const [queueShuffleSeed, setQueueShuffleSeed] = useState(0)
  // How many times a lead should be dialed in a row before moving to the
  // next one, per user selection (1x/2x/3x, hard-capped at 3). Preview mode
  // is forced to 1 regardless of this value — see the UI and handleDial.
  const [dialRepeatCount, setDialRepeatCount] = useState<1 | 2 | 3>(1)
  // Tracks how many times the CURRENT lead has actually been dialed in this
  // back-to-back sequence. A ref (not state) because it's read/written
  // inside the async call-status poll callback in startCallPolling, which
  // would otherwise see a stale value from whatever render captured it as a
  // closure. Reset to 1 whenever a genuinely NEW lead starts (see
  // handleDial); incremented on each same-lead redial.
  const leadAttemptCountRef = useRef(1)
  // Transient per-lead outcome text shown briefly in the queue row right
  // after a dial resolves without connecting (e.g. "Sorry, couldn't
  // answer…"), mirroring the reference UX. Populated ONLY from real dial
  // resolutions in startCallPolling/startHangupPolling — never invented —
  // and auto-cleared a few seconds later once the lead has actually dropped
  // out of the uncalled queue on the next fetch.
  const [queueOutcomeByLeadId, setQueueOutcomeByLeadId] = useState<Record<string, string>>({})

  // Closes the filter dropdown when a click lands anywhere outside it —
  // previously the only way to close it was clicking the FILTER button a
  // second time. 'mousedown' (not 'click') so this fires before any click
  // handler on whatever was actually clicked, and checks
  // queueFilterRef.current.contains(...) so clicks genuinely inside the
  // dropdown (the search input, the state input, the checkbox, RESET
  // FILTERS) don't immediately close it.
  useEffect(() => {
    if (!queueFilterOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      if (queueFilterRef.current && !queueFilterRef.current.contains(e.target as Node)) {
        setQueueFilterOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [queueFilterOpen])

  // ── QUEUE FILTER/SHUFFLE DERIVATION ──────────────────────────────────────
  // Deliberately placed here (early in the component body) rather than down
  // near where it's mainly consumed (LeadQueuePanel/fetchNextLead) — the
  // heartbeat effect further down references visibleQueuedLeads and
  // isQueueFiltered in its dependency array, and effect dependency arrays
  // are evaluated during the synchronous render pass (unlike the effect
  // body itself, which only runs after render commits) — so these have to
  // be declared before that effect in source order, not just be "available
  // by the time it matters" the way a plain closure reference would be.
  //
  // Real lead data is wildly inconsistent about how state is written — the
  // same state can appear as "HI", "hawaii", "Hawaii", "FL", "florida",
  // "fla", even "Fl orida" (a stray space typo, seen in real campaign
  // data). An exact lowercase-string match against queueStateFilter missed
  // all of these — searching "HI" would only match rows literally
  // containing "HI", not "hawaii". normalizeState (the same function
  // driving real TCPA state detection elsewhere in this app) maps both
  // sides to a canonical 2-letter code before comparing, so "HI" and
  // "hawaii" are correctly recognized as the same state. Falls back to a
  // loose case-insensitive substring match if normalizeState can't
  // recognize either value (e.g. a genuinely malformed state field) rather
  // than silently excluding it.
  const stateFilteredQueuedLeads = queueStateFilter.trim()
    ? queuedLeads.filter(l => {
        const filterNorm = normalizeState(queueStateFilter)
        const leadNorm = normalizeState(l.state)
        if (filterNorm && leadNorm) return filterNorm === leadNorm
        // Either side didn't normalize cleanly — fall back to a loose
        // substring match rather than excluding the lead outright.
        return (l.state || '').toLowerCase().includes(queueStateFilter.trim().toLowerCase())
      })
    : queuedLeads

  // Shuffle — a seeded, deterministic reorder of the currently-visible
  // (post-filter) rows. Seeded rather than re-randomized on every render:
  // queueShuffleSeed only changes when the user explicitly clicks Shuffle,
  // so the order stays STABLE across re-renders in between (a fresh Math.
  // random() sort on every render would make rows visibly jitter/reorder
  // constantly, which would look broken rather than like a deliberate
  // shuffle action). seed===0 means "never shuffled" — original
  // (created_at-sorted) order is preserved in that case. This order is now
  // also what actually gets dialed (see fetchNextLead and the heartbeat's
  // lead_ids, both further down) — not just a display reorder.
  const seededRandom = (seed: number) => {
    // Small deterministic PRNG (mulberry32) — same seed always produces
    // the same shuffle order, good enough for a display-only reorder with
    // no security/statistical requirements.
    let t = seed + 0x6D2B79F5
    return () => {
      t = (t + 0x6D2B79F5) | 0
      let r = Math.imul(t ^ (t >>> 15), 1 | t)
      r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296
    }
  }
  const orderedQueuedLeads = queueShuffleSeed === 0
    ? stateFilteredQueuedLeads
    : (() => {
        const rand = seededRandom(queueShuffleSeed)
        const shuffled = [...stateFilteredQueuedLeads]
        // Fisher-Yates, using the seeded PRNG instead of Math.random() so
        // the result is reproducible for a given seed.
        for (let i = shuffled.length - 1; i > 0; i--) {
          const j = Math.floor(rand() * (i + 1))
          ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
        }
        return shuffled
      })()

  // ── DIALABLE FIRST ───────────────────────────────────────────────────────
  // Two requirements that pull in opposite directions, reconciled by sorting
  // rather than by filtering:
  //
  //   1. A lead disappears from this panel ONLY when it gets a terminal
  //      disposition (do-not-call, not interested, closed). Being dialed is
  //      not a reason to vanish — the agent needs to see the lead they just
  //      worked, and the outcome text that appears on its row.
  //   2. Dialing runs top-to-bottom, and the highlighted row is the one
  //      actually being dialed.
  //
  // An earlier attempt satisfied (2) by filtering the panel down to dialable
  // leads only. That broke (1) outright: dialing a lead moves its status to
  // 'called'/'maxed', so it dropped off the list the moment it was dialed.
  //
  // Sorting satisfies both. Everything stays visible, and leads that can't be
  // dialed right now (attempts exhausted, already worked) sink below the ones
  // that can — so the top row is always genuinely the next lead up, and
  // /api/leads/next (which walks this same order and skips undialable rows)
  // lands on it. Stable within each group, so the created_at order and any
  // active shuffle are preserved inside the groups.
  // Populated immediately below the computation. See the comment there for
  // why the dial path must read this rather than a captured value.
  const visibleQueuedLeadsRef = useRef<typeof orderedQueuedLeads>([])

  const visibleQueuedLeads = (() => {
    const dialable: typeof orderedQueuedLeads = []
    const exhausted: typeof orderedQueuedLeads = []
    for (const lead of orderedQueuedLeads) {
      if (isDialableLead(lead)) dialable.push(lead)
      else exhausted.push(lead)
    }

    // ── ROTATION: A DIALED LEAD SINKS, IT DOES NOT VANISH ─────────────────
    // The queue is worked top-down, so "what have I already tried" has to be
    // expressed as POSITION. Without this, a lead that was dialed and
    // released back as no_answer kept its original created_at position at
    // the top of the list and was simply dialed again, forever — the whole
    // queue was one lead deep.
    //
    // Sorting by last_called_at ascending, nulls first, gives exactly the
    // intended behavior with no extra state:
    //   - never dialed (null)  -> top, in whatever order the panel is
    //                             showing (created_at, or a shuffle)
    //   - dialed before        -> below those, least-recently-dialed first
    //   - just dialed          -> bottom
    //
    // Crucially this does NOT disturb a 1x/2x/3x repeat sequence. Those
    // redials happen client-side against the same lead object without
    // consulting the queue, and last_called_at is only written when the lead
    // is finally dispositioned — i.e. once its attempts are exhausted. So the
    // lead genuinely stays put at the top for all 2 or 3 attempts, and only
    // then sinks to the bottom and hands over to the next one.
    //
    // Stable sort, so the incoming order (created_at or an active shuffle) is
    // preserved among leads that share a last_called_at — including all the
    // never-dialed ones.
    const rotated = [...dialable].sort((a, b) => {
      const at = a.last_called_at ? Date.parse(a.last_called_at) : 0
      const bt = b.last_called_at ? Date.parse(b.last_called_at) : 0
      return at - bt
    })

    return rotated.concat(exhausted)
  })()

  // ── THE ORDER AS IT IS *NOW*, NOT AS IT WAS WHEN THE TIMER WAS SET ──────
  // fetchNextLead sends this list to the server as an ordered allowlist, and
  // the server dials the first dialable entry in it. But fetchNextLead is
  // reached through scheduleDial -> setTimeout -> handleDial, all of which are
  // plain functions closing over the render that scheduled them. That render
  // happened BEFORE the just-dialed lead sank to the bottom.
  //
  // So the timer fired with the pre-rotation order, the server was told the
  // lead it had only just finished was still top of the list, and dialed it
  // again. On the next pass state had caught up and it dialed the real top —
  // producing the observed top, bottom, top, bottom alternation, and on 1x
  // dialing every lead twice.
  //
  // A ref is read at call time rather than capture time, which is the whole
  // point. Synced in an effect rather than during render: the dial chain waits
  // 600-800ms before firing and effects run within a frame, so the margin is
  // roughly forty-fold — and updating a ref mid-render is a genuine
  // correctness hazard under concurrent rendering, not just a lint preference.

  const isQueueFiltered = !!(queueSearch.trim() || queueStateFilter.trim())

  const [linesPref, setLinesPref] = useState<LinesPrefInfo | null>(null)
  const [linesPrefSaving, setLinesPrefSaving] = useState(false)

  const [lastControllerSummary, setLastControllerSummary] =
    useState<HeartbeatControllerSummary | null>(null)

  const [shouldYield, setShouldYield] = useState(false)
  const [tcpaBlockedAll, setTcpaBlockedAll] = useState(false)
  // The SERVER's reason for the block. The banner used to hardcode an
  // 8AM-9PM message, which told an agent to wait until morning for leads that
  // were actually unreachable — bad area codes, malformed numbers, a Sunday
  // restriction. Those never resolve by waiting.
  const [tcpaBlockedReason, setTcpaBlockedReason] = useState<string | null>(null)
  // Full per-reason breakdown from /api/leads/next. The banner used to show
  // one reason — whichever refusal the scan happened to meet first — so a
  // queue of unusable phone numbers was reported as a time-of-day problem and
  // the agent was told to wait for a window that would never help.
  const [queueDiagnosis, setQueueDiagnosis] = useState<QueueDiagnosis | null>(null)
  // The real, specific reason /api/leads/next gave for why no lead was
  // returned (e.g. "Too early in TX (6:30 local, window starts 8:00)",
  // "Unknown state — cannot determine calling window", "Not a member of
  // this team", "No leads match the current filter") — previously this
  // was discarded entirely and every non-success response collapsed into
  // either a hardcoded "ALL LEADS OUTSIDE 8AM-9PM WINDOW" string (if
  // tcpaBlocked was true) or a generic "upload more leads" message,
  // regardless of what actually went wrong server-side.
  const [noLeadsReason, setNoLeadsReason] = useState<string | null>(null)
  // HTTP status that came with noLeadsReason — lets the UI tell a real
  // permission problem (403: not a team member, campaign not in team) apart
  // from an ordinary "nothing to dial right now" state (404), since those
  // need different visual urgency and, eventually, different next actions.
  const [noLeadsStatus, setNoLeadsStatus] = useState<number | null>(null)

  const [modeDropdownOpen, setModeDropdownOpen] = useState(false)
  const [modeSaving, setModeSaving] = useState(false)

  const [allActiveOverrideMode, setAllActiveOverrideMode] = useState<DialerMode>('power')

  const [scriptIdx, setScriptIdx] = useState(0)
  // Draggable script-tab ordering. Holds a custom order of tab keys (campaign
  // id, or '__manual__'/'__single__' for the personal-single-script case).
  // Tabs not present in this list fall back to natural order, so new campaigns
  // appear at the end until the user drags them.
  const [scriptOrder, setScriptOrder] = useState<string[]>([])
  const [scriptDragKey, setScriptDragKey] = useState<string | null>(null)
  // Full-screen lead profile (mobile): expands the profile/script card to fill
  // the screen under the header so long scripts are fully visible.
  const [profileFullscreen, setProfileFullscreen] = useState(false)

  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const activePollRef = useRef<NodeJS.Timeout | null>(null)
  const swClientRef = useRef<any>(null)
  const swCallRef = useRef<any>(null)
  // ── GHOST-DIALING LOCKDOWN ────────────────────────────────────────────────
  // The browser is a SIP endpoint. To guarantee it can NEVER be bridged to a
  // call the user didn't initiate, we keep two things:
  //   1. callIntentRef — true ONLY while the user has actively armed dialing
  //      (pressed dial / started predictive / dialing a preview lead / manual
  //      dial). onInvite REJECTS any INVITE when this is false.
  //   2. registererRef — the SIP registration handle, so we can unregister when
  //      idle and re-register when armed. While unregistered, SignalWire has no
  //      route to this browser at all.
  const callIntentRef = useRef<boolean>(false)
  // ── AGENT-LEG EXPECTATION WINDOW ──────────────────────────────────────────
  // Timestamp (ms) until which this browser is expecting its own agent leg to
  // ring, opened immediately before POSTing to /api/calls/outbound.
  //
  // WHY THIS EXISTS — this is the bug that produced silent calls:
  // call_events showed EVERY agent leg dying ~300ms after creation with
  // hangup_cause 'user_busy', which is SIP 486 Busy Here — the exact code
  // onInvite's ghost-dialing guard sends when it considers a call unarmed. So
  // the browser was hanging up on itself on every single dial: the lead
  // answered, AMD ran on the lead leg, and there was no agent in the call at
  // all. No audio in either direction, and nothing in the UI to suggest why.
  //
  // callIntentRef alone was too fragile to be the sole gate. It is a single
  // boolean shared by every path that ends a call (hangup, AMD-machine skip,
  // redial teardown, disposition), each of which disarms — so any ordering or
  // remount that leaves it false when the INVITE lands rejects a call the
  // user very much did ask for, permanently and silently.
  //
  // This window is a second, positive signal with a bounded lifetime: it is
  // only ever opened by an outbound dial this browser itself initiated, it
  // expires on its own, and it cannot be left dangling by a teardown path
  // that forgot to re-arm. Ghost protection is preserved — an INVITE arriving
  // outside both the window and an armed intent is still rejected.
  const sipInstanceCounterRef = useRef<number>(0)
  const expectingAgentLegRef = useRef<boolean>(false)
  const expectAgentLegTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // How long after initiating a dial an agent-leg INVITE is still expected.
  // Comfortably longer than the agent leg's own 30s Telnyx ring timeout, so a
  // slow round trip can never fall outside it.
  const AGENT_LEG_EXPECT_MS = 45_000
  const registererRef = useRef<any>(null)

  const sessionHeartbeatRef = useRef<NodeJS.Timeout | null>(null)
  const sessionIdRef = useRef<string | null>(null)

  const heartbeatRef = useRef<NodeJS.Timeout | null>(null)
  const pacingPollRef = useRef<NodeJS.Timeout | null>(null)

  const incomingPollRef = useRef<NodeJS.Timeout | null>(null)
  const lastIncomingCallSidRef = useRef<string | null>(null)

  const urlParamsConsumedRef = useRef(false)
  const currentLeadRef = useRef<Lead | null>(null)
  const lsRestoredRef = useRef(false)
  const activeCallSidRef = useRef<string | null>(null)

  // ── GHOST-DIAL PREVENTION ───────────────────────────────────────────────
  // availableRef always holds the LIVE value of `available`. setTimeout/async
  // callbacks capture stale closure values of state; a ref does not. Every
  // dial path reads this ref at the moment of execution so a dial scheduled
  // while you were available cannot fire after you've gone unavailable.
  const availableRef = useRef(false)
  // Tracks every pending auto-chain setTimeout(handleDial) so we can cancel
  // them all the instant you go unavailable (the kill switch).
  const dialChainTimeoutsRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set())

  useEffect(() => setMounted(true), [])
  useEffect(() => { currentLeadRef.current = currentLead }, [currentLead])
  // See the block comment above visibleQueuedLeads — the dial chain must read
  // the CURRENT order, not the one captured when its timer was scheduled.
  useEffect(() => { visibleQueuedLeadsRef.current = visibleQueuedLeads })
  useEffect(() => { activeCallSidRef.current = activeCallSid }, [activeCallSid])
  // Keep availableRef in lock-step with the available state.
  useEffect(() => { availableRef.current = available }, [available])
  const predictiveEngineStartedRef = useRef(false)

  /**
   * Tell the SERVER the predictive sequence started or stopped.
   *
   * This is now the only thing that gates fan-out. The armed flag used to be
   * recomputed in the browser on every heartbeat and was wrong in three
   * different ways before anyone could see it — see app/api/dialer/arm.
   *
   * Disarming is fire-and-forget and must never block the UI: the client stops
   * dialing on its own and /api/dialer/abort sweeps the lines regardless.
   * Arming is awaited, because nothing should show as started until the server
   * agrees it is.
   */
  /**
   * The campaign/scope this session was armed against.
   *
   * The disarm-on-change effects fire on mount and whenever their dependency
   * is reassigned — including when an async campaign refresh sets the SAME id
   * again. Production caught the consequence exactly: armed at 15:30:16.903,
   * disarmed at 15:30:19.328, with nobody pressing stop. Two and a half
   * seconds, every time, which is why every earlier fix appeared to do
   * nothing.
   *
   * Recording what we armed against turns "this effect ran" into "the agent
   * actually moved to a different campaign", which is the only version of that
   * event worth disarming for.
   */
  const armedAgainstRef = useRef<string | null>(null)

  /**
   * Disarm ONLY if the engine is armed against a different campaign than the
   * one now selected. A re-render, a mount, or an async campaign refresh that
   * reassigns the same id must not touch a running engine.
   *
   * Passing null means "no campaign selected", which genuinely does invalidate
   * an armed engine — predictive fans out against a resolved lead set.
   */
  const disarmIfArmedElsewhere = (nowSelected: string | null) => {
    const armedAgainst = armedAgainstRef.current
    if (armedAgainst === null) return          // not armed — nothing to undo
    if (armedAgainst === nowSelected) return   // same campaign — leave it running
    armedAgainstRef.current = null
    void setServerArmed(false)
  }

  const setServerArmed = async (armed: boolean): Promise<boolean> => {
    try {
      const res = await fetch('/api/dialer/arm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ armed }),
      })
      const data = await res.json().catch(() => null)
      return data?.ok === true
    } catch (err) {
      console.error('[arm] failed to set armed =', armed, err)
      return false
    }
  }
  // Diagnostic counters for the arming path — see startDialSequence.
  const armClicksRef = useRef(0)
  const armReachedRef = useRef(0)
  const armSetRef = useRef(0)
  // ── DELIBERATELY NOT MIRRORED FROM STATE ──────────────────────────────────
  // This used to be `ref.current = predictiveEngineStarted` on every change of
  // that state, which quietly re-created the bug the ref exists to avoid: the
  // state is cleared by effects on campaign change, scope change and going
  // offline, so any of them would wipe arming a beat after the agent set it —
  // and the ref would faithfully copy the wipe.
  //
  // The ref is now owned by the two events that genuinely mean something:
  // handleDial sets it true when the agent starts the sequence, and the
  // explicit disarm sites below set it false. Nothing else touches it.
  // On unmount (navigating away from the dialer), cancel any pending auto-chain
  // dials so a queued timer can't fire a call after you've left the page.
  useEffect(() => {
    return () => {
      for (const id of dialChainTimeoutsRef.current) clearTimeout(id)
      dialChainTimeoutsRef.current.clear()
    }
  }, [])

  useEffect(() => {
    if (!user) return
    fetch('/api/stripe/status')
      .then(r => r.json())
      .then(d => {
        setTier(d.tier || null)
        setTierLoaded(true)
      })
      .catch(() => {
        setTier(null)
        setTierLoaded(true)
      })
  }, [user])

  const isActive = tier === 'active'

  const isAllActive = selectedCampaign === ALL_ACTIVE
  const isSpecificCampaign = !!selectedCampaign && !isAllActive

  const currentCampaign: Campaign | undefined =
    isSpecificCampaign
      ? campaigns.find(c => c.id === selectedCampaign)
      : undefined

  const dialerMode: DialerMode =
    isSpecificCampaign
      ? ((currentCampaign?.dialer_mode as DialerMode) || 'power')
      : isAllActive
        ? allActiveOverrideMode
        : 'power'

  // Load the selected campaign's persisted dial-repeat-count whenever the
  // campaign selection changes, so the 1x/2x/3x selector reflects that
  // specific campaign's real saved setting rather than always defaulting
  // to 1x. Only relevant for a specific campaign — "All Active Campaigns"
  // has no single campaign to read from, so it's left at whatever was last
  // selected (each specific campaign's own value still applies correctly
  // once you switch to it individually, since predictive's server-side cap
  // reads the LEAD's own campaign, not this UI selector, when actually
  // enforcing the limit).
  useEffect(() => {
    if (isSpecificCampaign && currentCampaign) {
      const persisted = currentCampaign.dial_repeat_count
      if (persisted === 1 || persisted === 2 || persisted === 3) {
        setDialRepeatCount(persisted)
      } else {
        setDialRepeatCount(1)
      }
    }
  }, [isSpecificCampaign, currentCampaign?.id, currentCampaign?.dial_repeat_count])

  const isPredictive = dialerMode === 'predictive'
  const isProgressive = dialerMode === 'progressive'
  const isPreview = dialerMode === 'preview'
  const isPower = dialerMode === 'power'

  // ── THE MODE AS IT IS NOW, NOT WHEN THE TIMER WAS SET ───────────────────
  // handleDial and scheduleDial are plain render-closure functions, and the
  // auto-chain runs through setTimeout. So a chain that STARTED in power or
  // progressive keeps running in that mode after the agent switches to
  // predictive: nothing in the chain re-reads it.
  //
  // The consequence was on a predictive campaign, dialing single-line
  // user_dial calls in a continuous auto-chain — 25 of them to the same
  // number, 10-19 seconds apart, until abort was pressed. It looked like a
  // predictive runaway and was the exact opposite: the controller never fired
  // at all, and every call came from the path predictive is supposed to skip.
  //
  // Read at call time, so a mode switch takes effect on the very next link of
  // the chain instead of the next full remount.
  const dialerModeRef = useRef<DialerMode>(dialerMode)
  useEffect(() => { dialerModeRef.current = dialerMode }, [dialerMode])

  // Continuous-dialing modes auto-advance to the next lead when a call ends
  // WITHOUT a human (machine drop, no-answer, busy, failed). Power and
  // progressive both keep the agent moving; preview is one-at-a-time by design
  // and predictive is server-driven, so neither auto-chains here.
  // (A HUMAN answer never auto-skips — that always shows the disposition sheet.)
  const autoChainOnFailure = isProgressive || isPower

  const modeRequiresSpecific = false

  const modeTileInteractive = isSpecificCampaign || isAllActive

  const agentState: AgentState = (() => {
    if (!available) return 'paused'
    if (status === 'connected') return 'on_call'
    if (status === 'calling') return 'dialing'
    if (showDisposition) return 'wrapping'
    return 'ready'
  })()

  type PredictiveView = 'offline' | 'available' | 'on_call' | 'wrapping'
  const predictiveView: PredictiveView = (() => {
    if (!available) return 'offline'
    if (showDisposition) return 'wrapping'
    if (status === 'connected' && currentLead) return 'on_call'
    return 'available'
  })()


  // ── SESSION METRICS PERSISTENCE ─────────────────────────────────────────
  useEffect(() => {
    if (!user) return
    try {
      const today = todayKey()
      const raw = localStorage.getItem(`${LS_SESSION_STATS}:${user.id}`)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (parsed.date === today && parsed.stats) {
          setSessionStats({ ...ZERO_STATS, ...parsed.stats })
        } else {
          setSessionStats(ZERO_STATS)
        }
      }
      setSessionDate(today)
    } catch {}
    setSessionStatsLoaded(true)
  }, [user])

  useEffect(() => {
    if (!user || !sessionStatsLoaded) return
    try {
      localStorage.setItem(
        `${LS_SESSION_STATS}:${user.id}`,
        JSON.stringify({ date: sessionDate, stats: sessionStats })
      )
    } catch {}
  }, [sessionStats, sessionDate, user, sessionStatsLoaded])

  useEffect(() => {
    if (!user) return
    const id = setInterval(() => {
      const today = todayKey()
      if (today !== sessionDate) {
        setSessionStats(ZERO_STATS)
        setSessionDate(today)
      }
    }, 60_000)
    return () => clearInterval(id)
  }, [sessionDate, user])

  useEffect(() => {
    if (!user || !lsRestoredRef.current) return
    if (selectedCampaign) {
      try { localStorage.setItem(`${LS_LAST_CAMPAIGN}:${user.id}`, selectedCampaign) } catch {}
    } else {
      try { localStorage.removeItem(`${LS_LAST_CAMPAIGN}:${user.id}`) } catch {}
    }
  }, [selectedCampaign, user])

  useEffect(() => {
    if (!user || !lsRestoredRef.current) return
    try { localStorage.setItem(`${LS_LAST_SCOPE}:${user.id}`, selectedScope) } catch {}
  }, [selectedScope, user])

  useEffect(() => {
    if (!user || !lsRestoredRef.current) return
    try { localStorage.setItem(`${LS_ALL_ACTIVE_MODE}:${user.id}`, allActiveOverrideMode) } catch {}
  }, [allActiveOverrideMode, user])

  useEffect(() => {
    if (!user || !isActive) return
    let cancelled = false
    fetch('/api/teams/list?detail=owned')
      .then(r => r.json())
      .then(async data => {
        if (cancelled || !data.success) {
          setScopesLoaded(true)
          return
        }
        const scopes: TeamScope[] = []
        for (const t of data.teams.owned || []) {
          if ((t.teamCampaigns || []).length > 0) {
            scopes.push({
              id: t.id,
              name: t.name,
              viewerRole: 'owner',
              teamCampaigns: t.teamCampaigns,
            })
          }
        }
        const memberTeams = data.teams.member || []
        if (memberTeams.length > 0) {
          await Promise.all(memberTeams.map(async (t: any) => {
            try {
              const r = await fetch(`/api/teams/${t.id}/get`)
              const d = await r.json()
              if (d.success && d.team.teamCampaigns?.length > 0) {
                scopes.push({
                  id: t.id,
                  name: t.name,
                  viewerRole: 'member',
                  teamCampaigns: d.team.teamCampaigns,
                })
              }
            } catch {}
          }))
        }
        if (!cancelled) {
          setTeamScopes(scopes)
          setScopesLoaded(true)
        }
      })
      .catch(() => {
        if (!cancelled) setScopesLoaded(true)
      })
    return () => { cancelled = true }
  }, [user, isActive])

  useEffect(() => {
    if (!user || !campaignsLoaded || !scopesLoaded || lsRestoredRef.current) return

    const teamIdParam = searchParams.get('teamId')
    const campaignIdParam = searchParams.get('campaignId')

    if (teamIdParam && teamScopes.find(s => s.id === teamIdParam)) {
      setSelectedScope(teamIdParam)
    } else {
      try {
        const lastScope = localStorage.getItem(`${LS_LAST_SCOPE}:${user.id}`)
        if (lastScope && (lastScope === PERSONAL_SCOPE || teamScopes.find(s => s.id === lastScope))) {
          setSelectedScope(lastScope)
        }
      } catch {}
    }

    if (campaignIdParam && campaigns.find(c => c.id === campaignIdParam && c.status === 'active')) {
      setSelectedCampaign(campaignIdParam)
    } else {
      try {
        const lastCampaign = localStorage.getItem(`${LS_LAST_CAMPAIGN}:${user.id}`)
        if (
          lastCampaign === ALL_ACTIVE ||
          (lastCampaign && campaigns.find(c => c.id === lastCampaign && c.status === 'active'))
        ) {
          setSelectedCampaign(lastCampaign)
        }
      } catch {}
    }

    try {
      const lastAllActiveMode = localStorage.getItem(`${LS_ALL_ACTIVE_MODE}:${user.id}`)
      if (lastAllActiveMode && VALID_MODES.includes(lastAllActiveMode as DialerMode)) {
        setAllActiveOverrideMode(lastAllActiveMode as DialerMode)
      }
    } catch {}

    lsRestoredRef.current = true
    urlParamsConsumedRef.current = true
  }, [user, campaignsLoaded, scopesLoaded, teamScopes, campaigns, searchParams])

  // ── DEEP-LINK: "Dial Lead" from the leads/recordings pages ──────────────
  // ?leadId=<id> loads that SPECIFIC lead into the existing preview-ready
  // flow (same one used by Preview mode's "load next lead" step) rather
  // than dialing immediately. This deliberately does NOT bypass the
  // Set-Available / explicit-confirm gating — the agent still sees the
  // lead on screen and has to press the existing dial-confirm action
  // (dialPreviewLead) themselves. dialLeadCall's own availableRef guard is
  // the final backstop either way. Runs once per leadId value (a ref, not
  // state, so re-navigating to the same URL doesn't re-trigger it if the
  // agent has since moved on to a different call).
  const dialLeadDeepLinkConsumedRef = useRef<string | null>(null)
  useEffect(() => {
    if (!user) return
    const leadIdParam = searchParams.get('leadId')
    if (!leadIdParam) return
    if (dialLeadDeepLinkConsumedRef.current === leadIdParam) return
    // Don't clobber an already-in-progress or already-loaded call.
    if (status !== 'idle') return

    dialLeadDeepLinkConsumedRef.current = leadIdParam
    ;(async () => {
      try {
        const res = await fetch(`/api/leads/list?id=${encodeURIComponent(leadIdParam)}`)
        const data = await res.json()
        if (data.success && data.lead) {
          setPreviewLead(data.lead)
          setStatus('preview_ready')
          setNoLeads(false)
        } else {
          setAmdActivity(prev => [`DIAL LEAD FAILED — lead not found or not yours`, ...prev].slice(0, 5))
        }
      } catch {
        setAmdActivity(prev => [`DIAL LEAD FAILED — network error`, ...prev].slice(0, 5))
      }
    })()
  }, [user, searchParams, status])

  useEffect(() => {
    if (user && isActive) fetchCampaigns()
  }, [user, isActive])

  useEffect(() => {
    if (!lsRestoredRef.current) return
    setSelectedCampaign('')
    setPredictiveEngineStarted(false)
    predictiveEngineStartedRef.current = false
    disarmIfArmedElsewhere(null)
  }, [selectedScope])

  useEffect(() => {
    setPredictiveEngineStarted(false)
    predictiveEngineStartedRef.current = false
    // ── ONLY DISARM FOR A REAL MOVE ─────────────────────────────────────────
    // This used to call setServerArmed(false) unconditionally. The effect runs
    // on mount, and again whenever selectedCampaign is reassigned — including
    // by the scope effect above, which clears it to '' on every one of its own
    // spurious runs. Production showed the result precisely: armed at
    // 15:30:16.903, disarmed at 15:30:19.328, with nobody touching stop.
    //
    // Two and a half seconds after every arm, every time. That is why arming
    // "never worked" — it worked, and was immediately undone.
    disarmIfArmedElsewhere(selectedCampaign || null)
    // Reset script tab state when switching campaigns — a previous campaign's
    // custom order keys don't apply here and could otherwise hide tabs.
    setScriptOrder([])
    setScriptIdx(0)
    setScriptDragKey(null)
  }, [selectedCampaign])

  useEffect(() => {
    if (!isActive) return
    const interval = setInterval(() => setClockTick(t => t + 1), 1000)
    return () => clearInterval(interval)
  }, [isActive])

  useEffect(() => {
    if (!isActive) return
    // Browsers only allow audio to start inside a user gesture, so the first
    // click or keypress creates the context and plays one silent sample to
    // unlock it.
    //
    // These listeners USED TO REMOVE THEMSELVES after firing once. A context
    // can be suspended again later — switching tabs, a phone locking, an iOS
    // audio interruption — and once that happened there was nothing left to
    // wake it, so the dialer went quiet for the rest of the shift. They now
    // stay attached and re-resume on any interaction, which is cheap: the
    // body is a no-op once the context is already running.
    const warmUp = () => {
      if (!audioCtxRef.current) {
        const Ctor = resolveAudioContextCtor()
        if (!Ctor) return
        audioCtxRef.current = new Ctor()
        const buffer = audioCtxRef.current!.createBuffer(1, 1, 22050)
        const source = audioCtxRef.current!.createBufferSource()
        source.buffer = buffer
        source.connect(audioCtxRef.current!.destination)
        source.start()
        return
      }
      if (audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume().catch(() => {})
      }
    }
    window.addEventListener('pointerdown', warmUp)
    window.addEventListener('click', warmUp)
    window.addEventListener('keydown', warmUp)
    window.addEventListener('touchstart', warmUp, { passive: true })
    return () => {
      window.removeEventListener('pointerdown', warmUp)
      window.removeEventListener('click', warmUp)
      window.removeEventListener('keydown', warmUp)
      window.removeEventListener('touchstart', warmUp)
    }
  }, [isActive])

  useEffect(() => {
    if (!isActive) return

    // ── ZOMBIE REGISTRATION GUARD ──────────────────────────────────────────
    // This effect had NO cleanup. Every time isActive toggled — or this
    // component remounted, which Next's client-side navigation does freely —
    // it built a brand new UserAgent and registered it with the SAME SIP
    // credentials, leaving the previous one registered forever.
    //
    // Telnyx then holds several contacts for one SIP user and forks the
    // agent-leg INVITE to all of them. The zombies' onInvite closes over refs
    // belonging to a dead render, so callIntentRef/expectingAgentLegRef are
    // permanently false there and they answer with 486 Busy Here — killing
    // the agent leg of a call the live instance is legitimately placing.
    //
    // This is what call_events showed: the agent leg dying ~150-300ms after
    // creation with hangup_cause 'user_busy', on call after call, with no
    // audio in either direction. It also explains why it later became
    // intermittent rather than total — which registration wins the race
    // varies, so some calls survived and some were cut down the moment they
    // were answered.
    //
    // `cancelled` covers the async gap too: initSW awaits several times, so
    // the effect can be torn down mid-setup, and without this the half-built
    // UserAgent would finish registering after cleanup had already run.
    let cancelled = false
    let localUserAgent: import('sip.js').UserAgent | null = null
    let localRegisterer: import('sip.js').Registerer | null = null

    // Identifies THIS effect run in the logs. If an INVITE is ever handled by
    // an instance whose id isn't the newest one printed at registration, a
    // zombie is still alive and the cleanup above didn't cover some path —
    // which is the difference between "fixed" and "looks fixed", and is not
    // something to infer from call audio.
    sipInstanceCounterRef.current += 1
    const sipInstanceId = sipInstanceCounterRef.current

    const initSW = async () => {
      try {
        // SECURITY: fetch SIP credentials from an authenticated server endpoint
        // instead of NEXT_PUBLIC_* env vars (which are inlined into the public
        // bundle and were removed). If this fetch is skipped, SIP never
        // registers and there is NO call audio in either direction.
        let sipUsername: string | undefined
        let sipPassword: string | undefined
        let sipDomain: string | undefined
        let sipWssUrl: string | undefined
        let iceServers: RTCIceServer[] | undefined
        try {
          const credRes = await fetch('/api/calls/sip-credentials')
          if (!credRes.ok) {
            console.error('SIP credentials fetch failed:', credRes.status)
            return
          }
          const cred = await credRes.json()
          if (!cred?.success) {
            console.error('SIP credentials unavailable:', cred?.error, cred?.detail || '')
            return
          }
          sipUsername = cred.sipUsername
          sipPassword = cred.sipPassword
          sipDomain = cred.sipDomain
          sipWssUrl = cred.sipWssUrl
          iceServers = cred.iceServers
        } catch (credErr) {
          console.error('SIP credentials request error:', credErr)
          return
        }

        if (!sipUsername || !sipPassword || !sipDomain) return

        const { UserAgent, Registerer, SessionState } = await import('sip.js')
        // SIP URI identity stays port-free — sip:user@domain is the correct
        // standard SIP URI format, this is not a network address.
        const uri = UserAgent.makeURI(`sip:${sipUsername}@${sipDomain}`)
        if (!uri) return

        // TRANSPORT ADDRESS — Telnyx serves SIP over WebSocket on port 7443
        // (wss://sip.telnyx.com:7443). This is NOT the same as sipDomain,
        // which correctly stays bare/port-free for the URI above: the URI
        // is an identity, this is a network address. The server now builds
        // it (lib/telnyxConfig.ts) and hands it over, so the port and the
        // regional domain stay defined in exactly one place. Fall back to
        // composing it locally if an older server response lacks the field.
        const wssServer = sipWssUrl || `wss://${sipDomain}:7443`

        // ── RTCP-MUX: THE ACTUAL CAUSE OF THE SILENT CALLS ─────────────────
        // Telnyx relays the agent leg from a plain UDP SIP leg and its SDP
        // offer contains no `a=rtcp-mux`. Since Chrome 57 the default
        // rtcpMuxPolicy is "require", so Chrome REFUSES that offer outright:
        //
        //   setRemoteDescription failed: The m= section with mid='0' is
        //   invalid. RTCP-MUX is not enabled when it is required.
        //
        // accept() then throws, sip.js answers 480 Temporarily Unavailable,
        // and the call dies the instant the lead picks up. Every other
        // symptom chased for hours — the 486s, the silence, the drop on
        // answer — was downstream of this one missing SDP attribute.
        //
        // "negotiate" is the documented workaround for exactly this
        // SIP-gateway case (it is how Chrome-to-Asterisk was solved when the
        // default flipped). It is also DEPRECATED and Chrome has long
        // intended to remove it, so it is feature-detected rather than
        // assumed: probing with a throwaway RTCPeerConnection means a browser
        // that has dropped the value leaves us on "require" instead of
        // throwing on every single UserAgent construction and taking the
        // whole softphone down with it.
        //
        // The durable fix is server-side — Telnyx offering rtcp-mux for
        // WebRTC endpoints — but that is an account/connection concern, and
        // this keeps calls working regardless of it.
        // Typed loosely on purpose: TypeScript's DOM lib has already removed
        // "negotiate" from RTCRtcpMuxPolicy, so the value cannot be expressed
        // in the standard type even where the browser still honours it. The
        // runtime probe below — not the type — is what decides whether it is
        // used.
        let rtcpMuxPolicy: string | undefined
        try {
          const probe = new RTCPeerConnection(
            { rtcpMuxPolicy: 'negotiate' } as unknown as RTCConfiguration
          )
          probe.close()
          rtcpMuxPolicy = 'negotiate'
          console.log('[sip] rtcpMuxPolicy=negotiate supported — will accept non-muxed SDP from Telnyx')
        } catch {
          console.warn(
            '[sip] this browser no longer supports rtcpMuxPolicy "negotiate". If calls fail with ' +
            '"RTCP-MUX is not enabled when it is required", Telnyx must be configured to offer ' +
            'rtcp-mux for WebRTC endpoints — it cannot be worked around from the browser.'
          )
        }

        // Tracked locally so cleanup can tear down THIS instance specifically,
        // rather than whatever happens to be in the ref by then.
        const userAgent: import('sip.js').UserAgent = new UserAgent({
          uri,
          authorizationUsername: sipUsername,
          authorizationPassword: sipPassword,
          transportOptions: { server: wssServer },
          sessionDescriptionHandlerFactoryOptions: {
            // peerConnectionConfiguration.iceServers is THE audio-path fix.
            // Without STUN/TURN the browser can't find a reachable media path
            // across NAT and you get dead air after the lead picks up. Fall back
            // to public STUN if the server didn't return any (so audio still
            // works even if the endpoint shape changes).
            peerConnectionConfiguration: {
              iceServers:
                iceServers && iceServers.length > 0
                  ? iceServers
                  // Leftover stun.signalwire.com here outlived the migration
                  // — on a Telnyx account that host is just a hostname that
                  // may or may not resolve, and a dead STUN server in the
                  // list costs ICE gathering time before it's given up on.
                  : [{ urls: ['stun:stun.telnyx.com:3478', 'stun:stun.l.google.com:19302'] }],
              // Pool a candidate ahead of time so gathering doesn't add latency
              // at answer. Small but helps the "pickup = hear" goal.
              iceCandidatePoolSize: 1,
              // Only set when the browser still accepts it — see the probe above.
              ...((rtcpMuxPolicy ? { rtcpMuxPolicy } : {}) as unknown as RTCConfiguration),
            },
            constraints: { audio: true, video: false },
          },
        })

        userAgent.delegate = {
          onInvite: async (invitation: any) => {
            // ── NO GATE. THE REGISTRATION IS THE GATE. ─────────────────────
            // Every version of a conditional guard here has silently broken
            // calls, and each one cost a debugging cycle:
            //
            //   callIntentRef        every path that ends a call disarms it,
            //                        so any ordering/remount/auto-chain gap
            //                        left it false and killed the next call.
            //   + expectation window same problem, just narrower.
            //   availableRef         false at INVITE time during a dial the
            //                        agent themselves started. Rejected it.
            //
            // The thing they were all protecting against no longer exists.
            // The guard was written when every agent shared ONE SIP identity,
            // so an INVITE really might have belonged to someone else. Now
            // each agent has their own Telnyx credential and this UserAgent
            // is registered as that credential alone — the only thing that
            // dials this URI is our server placing an agent leg for THIS
            // user, and the controller already checks availability server
            // side before routing anyone a call.
            //
            // So the correct SIP-native control is REGISTRATION, not
            // rejection: if this agent shouldn't take calls, we unregister
            // (see the effect cleanup) and Telnyx cannot route to them at
            // all. While registered, an INVITE is by construction theirs.
            //
            // Rejecting is also the worst possible failure shape — it is
            // invisible. The lead answers, AMD runs, the UI shows a normal
            // connected call, and there is simply no audio and no error.
            console.log(
              `[sip #${sipInstanceId}] accepting agent leg ` +
              `(available=${availableRef.current}, armed=${callIntentRef.current}, ` +
              `expectingAgentLeg=${expectingAgentLegRef.current})`
            )
            try {
              invitation.stateChange.addListener((state: any) => {
                if (state === SessionState.Established) {
                  swCallRef.current = invitation
                  attachSIPAudio(invitation)
                } else if (state === SessionState.Terminated) {
                  if (swCallRef.current === invitation) swCallRef.current = null
                }
              })
              await invitation.accept({
                sessionDescriptionHandlerOptions: { constraints: { audio: true, video: false } },
              })
              // Attach immediately as well — don't wait only on the Established
              // event. The SDH/peer connection exists right after accept(), so
              // wiring audio now shaves the gap to first sound.
              swCallRef.current = invitation
              attachSIPAudio(invitation)
            } catch (err) {
              // sip.js calls getUserMedia while building the answer, so a
              // blocked/denied microphone surfaces HERE — as a failed accept,
              // not as anything that mentions permissions. Left generic, this
              // reads as a mysterious silent call, which is the same dead end
              // every other cause of "no audio" produced tonight. Name it.
              const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err)
              const micBlocked =
                err instanceof Error &&
                ['NotAllowedError', 'NotFoundError', 'NotReadableError', 'SecurityError'].includes(err.name)
              console.error(`[sip #${sipInstanceId}] FAILED to accept agent leg — ${msg}`)
              if (micBlocked) {
                console.error(
                  '[sip] ^ that is a MICROPHONE problem, not a SIP problem. The browser refused ' +
                  'or could not open the mic, so no answer could be built and this call has no ' +
                  'audio. Allow the microphone for this site and reload.'
                )
                setAmdActivity(prev =>
                  ['⚠ MICROPHONE BLOCKED — allow mic access, no audio until then', ...prev].slice(0, 5)
                )
              }
            }
          },
        }

        localUserAgent = userAgent
        if (cancelled) return // torn down while constructing — cleanup handles it

        await userAgent.start()
        if (cancelled) return

        // Keep the registerer handle so we can register/unregister with the
        // user's dialing intent (see armDialing/disarmDialing). We register now
        // so the endpoint is reachable the instant the user arms a call, but the
        // onInvite guard above still blocks anything they didn't initiate.
        const registerer = new Registerer(userAgent)
        localRegisterer = registerer
        registererRef.current = registerer
        await registerer.register()
        if (cancelled) return

        swClientRef.current = userAgent
        setSwReady(true)
        console.log(`[sip] registered as instance #${sipInstanceId} (${sipUsername})`)
      } catch (err: any) {
        console.error('SIP init error:', err?.message || err)
      }
    }
    initSW()

    return () => {
      cancelled = true
      // Unregister BEFORE stopping: unregistering removes this contact from
      // Telnyx so no further INVITE can be forked to it. Stopping without
      // unregistering can leave the registration alive on Telnyx's side until
      // it expires, which is exactly the window in which a dead instance
      // answers 486 and kills a live call.
      void (async () => {
        try {
          if (localRegisterer) await localRegisterer.unregister()
        } catch (err) {
          console.warn('[sip] unregister during cleanup failed:', err)
        }
        try {
          if (localUserAgent) await localUserAgent.stop()
        } catch (err) {
          console.warn('[sip] userAgent.stop during cleanup failed:', err)
        }
      })()

      // Only clear the shared refs if they still point at THIS instance — a
      // newer effect run may have already replaced them.
      if (registererRef.current === localRegisterer) registererRef.current = null
      if (swClientRef.current === localUserAgent) {
        swClientRef.current = null
        setSwReady(false)
      }
    }
  }, [isActive])

  const attachSIPAudio = (session: any) => {
    // Ensure the AudioContext is running (autoplay policies can suspend it).
    try {
      if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume().catch(() => {})
      }
    } catch {}

    const getAudioEl = (): HTMLAudioElement => {
      let audioEl = document.getElementById('sip-audio') as HTMLAudioElement | null
      if (!audioEl) {
        audioEl = document.createElement('audio')
        audioEl.id = 'sip-audio'
        audioEl.autoplay = true
        ;(audioEl as any).playsInline = true
        document.body.appendChild(audioEl)
      }
      return audioEl
    }

    const tryAttach = () => {
      try {
        const sdh = session.sessionDescriptionHandler
        if (!sdh) return false
        const pc = sdh.peerConnection
        if (!pc) return false

        // ── MEDIA-PATH DIAGNOSTICS ────────────────────────────────────────
        // "Call connects, nobody hears anything" has several possible causes
        // that look identical from the UI — SIP signalling succeeds either
        // way. These two lines distinguish them without guessing:
        //
        //   iceConnectionState 'failed'       -> no reachable media path.
        //                                        STUN wasn't enough and no
        //                                        TURN server is configured
        //                                        (see /api/calls/sip-
        //                                        credentials — TURN is only
        //                                        added when its env vars are
        //                                        present).
        //   ICE 'connected' but no audio      -> media path is fine and the
        //                                        two sides disagreed on a
        //                                        media profile, e.g. Telnyx
        //                                        offering SDES-SRTP to a
        //                                        browser that only speaks
        //                                        DTLS-SRTP.
        //
        // Cheap, only attached during a live call, and the difference
        // between a five-minute answer and another round of speculation.
        // tryAttach is called several times per call (immediately, then on a
        // few timers), so guard against stacking duplicate handlers on the
        // same peer connection.
        const taggedPc = pc as RTCPeerConnection & { __dsIceLoggingAttached?: boolean }
        if (!taggedPc.__dsIceLoggingAttached) {
          taggedPc.__dsIceLoggingAttached = true
          pc.oniceconnectionstatechange = () => {
            const state = pc.iceConnectionState
            if (state === 'failed' || state === 'disconnected') {
              console.error(
                `[sip] ICE ${state} — no media path to Telnyx, so this call has no audio. ` +
                `STUN alone did not work from this network; a TURN server is needed ` +
                `(TELNYX_TURN_URLS / TELNYX_TURN_USERNAME / TELNYX_TURN_CREDENTIAL).`
              )
            } else {
              console.log(`[sip] ICE ${state}`)
            }
          }
        }

        pc.ontrack = (event: RTCTrackEvent) => {
          if (event.streams && event.streams[0]) {
            const audioEl = getAudioEl()
            audioEl.srcObject = event.streams[0]
            audioEl.play().catch(console.error)
          }
        }

        pc.getReceivers().forEach((receiver: RTCRtpReceiver) => {
          if (receiver.track && receiver.track.kind === 'audio') {
            const stream = new MediaStream([receiver.track])
            const audioEl = getAudioEl()
            audioEl.srcObject = stream
            audioEl.play().catch(console.error)
          }
        })
        return true
      } catch (err) {
        return false
      }
    }

    if (!tryAttach()) {
      setTimeout(() => tryAttach(), 500)
      setTimeout(() => tryAttach(), 1500)
      setTimeout(() => tryAttach(), 3000)
    } else {
      setTimeout(() => tryAttach(), 1000)
    }
  }

  const startSession = useCallback(async (campaignId: string) => {
    try {
      const teamId = selectedScope !== PERSONAL_SCOPE ? selectedScope : undefined
      const res = await fetch('/api/dialer/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId, teamId }),
      })
      const data = await res.json()
      if (data.success) {
        setCurrentSessionId(data.sessionId)
        sessionIdRef.current = data.sessionId
      }
    } catch (err) {
      console.error('startSession error:', err)
    }
  }, [selectedScope])

  const endSession = useCallback(async () => {
    const sid = sessionIdRef.current
    if (!sid) return
    try {
      await fetch('/api/dialer/session', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: sid }),
      })
    } catch {}
    setCurrentSessionId(null)
    sessionIdRef.current = null
  }, [])

  useEffect(() => {
    if (!isActive) return
    const shouldHaveSession = available && isSpecificCampaign && currentCampaign

    if (shouldHaveSession) {
      if (!sessionIdRef.current) {
        startSession(selectedCampaign)
      }
      if (!sessionHeartbeatRef.current) {
        sessionHeartbeatRef.current = setInterval(() => {
          if (isSpecificCampaign) startSession(selectedCampaign)
        }, 30000)
      }
    } else {
      if (sessionIdRef.current) endSession()
      if (sessionHeartbeatRef.current) {
        clearInterval(sessionHeartbeatRef.current)
        sessionHeartbeatRef.current = null
      }
    }

    return () => {
      if (sessionHeartbeatRef.current) {
        clearInterval(sessionHeartbeatRef.current)
        sessionHeartbeatRef.current = null
      }
    }
  }, [available, selectedCampaign, currentCampaign, isActive, isSpecificCampaign, startSession, endSession])

  useEffect(() => {
    if (!isActive) return

    const sendHeartbeat = async () => {
      try {
        const res = await fetch('/api/dialer/heartbeat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            state: agentState,
            campaign_id: isSpecificCampaign ? selectedCampaign : null,
            dialer_mode: dialerMode,
            current_call_id: activeCallSid || null,
            // Server-side ghost guard: the controller only fans out lines when
            // the agent has explicitly started the predictive engine.
            // Read from the ref — see the arming site in handleDial for why
            // the state version could not be trusted here.
            // ── BOTH HALVES FROM REFS ─────────────────────────────────────
            // This read `isPredictive`, a value captured by the heartbeat
            // interval's closure. The instrumentation caught it red-handed: a
            // single payload reported arm_set 1 and arm_mode_ref 'predictive'
            // — both from refs, both correct — while predictive_armed came out
            // false, because the closure still held isPredictive from before
            // the campaign finished loading and the mode was still 'power'.
            //
            // dialerModeRef is the same value read through a ref, and it was
            // reporting correctly on every beat. Refs cannot go stale in an
            // interval; captured values can and did.
            predictive_armed:
              dialerModeRef.current === 'predictive' &&
              predictiveEngineStartedRef.current,
            // Diagnostic only — see startDialSequence.
            arm_clicks: armClicksRef.current,
            arm_reached: armReachedRef.current,
            arm_set: armSetRef.current,
            arm_mode_ref: dialerModeRef.current,
            // Always send the current displayed order to the predictive
            // controller too, matching fetchNextLead's behavior — dialing
            // must always follow the queue panel's top-down order in every
            // mode, not just when a filter/shuffle is explicitly active.
            // Same load-race guard as fetchNextLead: skip only while the
            // queue's first load hasn't produced any leads yet.
            // Through the ref for the same reason fetchNextLead does: this
            // runs on an interval, so the closure predates whatever rotation
            // has happened since the effect was created. Predictive would
            // otherwise claim against a stale order and re-dial leads it had
            // just finished, exactly as the single-line path did.
            // Windowed — see DIAL_ORDER_WINDOW. Sending the full order here is
            // what broke dialing on an 848-lead import, and does not survive a
            // 100,000-lead All Active book at all.
            lead_ids: !(queuedLeadsLoading && visibleQueuedLeadsRef.current.length === 0)
              ? visibleQueuedLeadsRef.current.slice(0, DIAL_ORDER_WINDOW).map(l => l.id).join(',')
              : undefined,
          }),
        })
        if (!res.ok) return
        const data = await res.json()
        if (typeof data.should_yield === 'boolean') {
          setShouldYield(data.should_yield)
        }

        // ── PREDICTIVE: THE SERVER SAYS YOU ARE ON A CALL ────────────────────
        // Every other mode dials from the client, keeps the call id, polls it
        // and flips to the lead profile itself. Predictive's lines are placed
        // SERVER-side, so the browser has no id to poll and nothing ever told
        // it that a prospect had answered — the agent sat on the queue panel
        // through a live, bridged, talking call.
        //
        // active_call is the session's own current_call_id with the lead
        // attached, so this renders the profile immediately rather than making
        // another round trip while someone is already on the line.
        //
        // Deliberately switches at PICKUP, before any AMD verdict — a
        // voicemail opens the profile exactly like a human does, and the
        // verdict decides what happens next. A machine verdict clears
        // current_call_id server-side, active_call goes null, and the else
        // branch puts the agent back on the queue panel as though nothing had
        // happened.
        //
        // Predictive only: every other mode owns its own call state and must
        // not have it written from here.
        if (isPredictive) {
          const ac = data.active_call
          if (ac?.call_id && statusRef.current !== 'connected') {
            if (ac.lead) setCurrentLead(ac.lead as Lead)
            setActiveCallSid(ac.call_control_id || null)
            activeCallSidRef.current = ac.call_control_id || null
            setStatus('connected')
            setShowDisposition(false)
            if (!callStartRef.current) callStartRef.current = Date.now()
            setAmdActivity(prev => {
              const line = 'LINE CONNECTED — AWAITING AMD VERDICT'
              return prev[0] === line ? prev : [line, ...prev].slice(0, 5)
            })
          } else if (!ac?.call_id && statusRef.current === 'connected' && !showDisposition) {
            // Released — machine verdict, or the call ended. Back to the queue
            // exactly as it was.
            setStatus('idle')
            setCurrentLead(null)
            setActiveCallSid(null)
            activeCallSidRef.current = null
            callStartRef.current = 0
            setSeconds(0)
          }
        }
        // The engine is armed but the server declined to fan out. Say so.
        // This was silent, and silence is why predictive could sit "started"
        // indefinitely without placing a call. Deduped against the last line
        // so a persistent condition doesn't flood the feed every 5 seconds.
        if (data.controller_skipped_reason) {
          const line = `PREDICTIVE IDLE — ${String(data.controller_skipped_reason).toUpperCase()}`
          setAmdActivity(prev => (prev[0] === line ? prev : [line, ...prev].slice(0, 5)))
        }

        if (data.controller_invoked && data.controller) {
          setLastControllerSummary(data.controller as HeartbeatControllerSummary)
          const summary = data.controller as HeartbeatControllerSummary
          // inFlightPhones is a real, live snapshot of what's actually still
          // ringing/connected RIGHT NOW, refreshed unconditionally on every
          // single heartbeat (see predictiveController.ts) — this is the
          // correct source for row highlighting. dialedPhones only ever
          // reflected numbers placed on the specific tick they fired, with
          // nothing to refresh or clear it on the many ticks in between
          // where predictive isn't firing anything NEW but previously-fired
          // calls are still very much active — so highlighting was going
          // stale/blank almost immediately during real operation.
          setActiveDialingNumbers(summary.inFlightPhones || [])
          const liveIds = summary.inFlightLeadIds || []
          setActiveDialingLeadIds(liveIds)

          // ── SINK A LINE WHEN IT FINISHES, NOT WHEN IT STARTS ─────────────
          // A lead that has LEFT the in-flight set is a line that is over —
          // rang out, hit voicemail and got skipped, or was talked to and hung
          // up. That is the moment it has been "tried", and the moment it
          // should drop to the bottom.
          //
          // This replaces stamping the leads the tick just FIRED, which sank
          // all three the instant they lit up: the rows highlighted correctly
          // and were immediately moved away from the top, so the top three
          // never appeared to be the ones dialing. Exactly the same mistake as
          // the single-line path earlier — rotating on dial rather than on
          // outcome — and it looks identical from the agent's seat.
          const previouslyLive = prevInFlightLeadIdsRef.current
          if (previouslyLive.length > 0) {
            const stillLive = new Set(liveIds)
            const finished = previouslyLive.filter(id => !stillLive.has(id))
            if (finished.length > 0) {
              const stamp = nowIso()
              const finishedSet = new Set(finished)
              setQueuedLeads(prev =>
                prev.map(l => (finishedSet.has(l.id) ? { ...l, last_called_at: stamp } : l))
              )
            }
          }
          prevInFlightLeadIdsRef.current = liveIds

          if (summary.fired > 0) {
            // ── SINK WHAT WAS JUST FIRED ─────────────────────────────────
            // Three lines takes the top three, stamps them so they drop to the
            // bottom, and the next tick highlights the new top three. Without
            // this the dialed rows stayed at the top and the panel never
            // appeared to advance.
            //
            // Stamped inline rather than via markLeadDialedLocally, which is
            // declared below this effect and would be in its temporal dead
            // zone. Same write either way: last_called_at is the sort key.
            // Rotation happens when a line LEAVES the in-flight set, above —
            // not here. Stamping on fire sank every row the instant it started
            // ringing.

            // Predictive places its lines SERVER-side, so it never passes
            // through handleDial and never reached the dial tone there. The
            // agent got no audible signal that a batch had gone out — the one
            // mode where they are least likely to be watching the screen.
            playInitiateBlip()
            const numbers = summary.dialedPhones && summary.dialedPhones.length > 0
              ? summary.dialedPhones
              : []
            setAmdActivity(prev => [
              numbers.length > 0
                ? `DIALING ${numbers.length} LINE${numbers.length === 1 ? '' : 'S'} — ${numbers.join(', ')}`
                : `CONTROLLER FIRED ${summary.fired} LINE${summary.fired === 1 ? '' : 'S'} (${summary.effectiveLines}x target)`,
              ...prev,
            ].slice(0, 5))
          } else if (summary.degraded) {
            setAmdActivity(prev => [
              `⚠ AUTO-DEGRADED — abandon rate trigger`,
              ...prev,
            ].slice(0, 5))
          }
        }
      } catch {
        // Network blip — next heartbeat will retry
      }
    }

    sendHeartbeat()
    heartbeatRef.current = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS)

    return () => {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current)
        heartbeatRef.current = null
      }
    }
  }, [
    isActive,
    agentState,
    isSpecificCampaign,
    selectedCampaign,
    dialerMode,
    activeCallSid,
    isPredictive,
    predictiveEngineStarted,
    isQueueFiltered,
    queueShuffleSeed,
    // visibleQueuedLeads itself is a new array reference every render (it's
    // derived via .filter()/.sort(), never memoized) — depending on the
    // array directly would tear down and recreate this interval on nearly
    // every render. A joined id signature only changes when the actual
    // filtered/shuffled SET or ORDER changes, matching the same pattern
    // already used elsewhere in this file (activeScopeCampaigns) for the
    // identical problem.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    visibleQueuedLeads.map(l => l.id).join(','),
  ])

  useEffect(() => {
    if (
      !isActive ||
      !isPredictive ||
      predictiveView !== 'available' ||
      !predictiveEngineStarted
    ) {
      if (incomingPollRef.current) {
        clearInterval(incomingPollRef.current)
        incomingPollRef.current = null
      }
      return
    }

    // The predictive engine is running and we're available — stay armed for the
    // whole duration so incoming-route humans can be bridged. The effect's deps
    // ensure this only holds while predictiveEngineStarted && available.
    armDialing()

    const pollIncoming = async () => {
      try {
        // Live guard: if you've gone unavailable since this interval was set,
        // do not attach any routed call. Prevents a predictive ghost-connect.
        if (!availableRef.current) return

        const res = await fetch('/api/calls/incoming-route')
        if (!res.ok) return
        const data = (await res.json()) as IncomingRouteResponse
        if (!data.incoming || !data.call) return

        if (lastIncomingCallSidRef.current === data.call.sid) return

        // Re-check after the await — availability may have changed while the
        // request was in flight. Never auto-attach audio to an offline agent.
        if (!availableRef.current) return

        lastIncomingCallSidRef.current = data.call.sid
        armDialing() // a human is being routed to us right now — allow the bridge

        setAmdActivity(prev => [
          `HUMAN ROUTED — ${data.lead?.first_name || ''} ${data.lead?.last_name || ''}`.trim(),
          ...prev,
        ].slice(0, 5))

        playPickup()
        setActiveCallSid(data.call.sid)
        if (data.lead) {
          setCurrentLead(data.lead)
        }
        setStatus('connected')
        setSessionStats(s => ({ ...s, calls: s.calls + 1, connected: s.connected + 1 }))

        startHangupPolling(data.call.sid)
      } catch {
        // Network blip — next poll will retry
      }
    }

    pollIncoming()
    incomingPollRef.current = setInterval(pollIncoming, INCOMING_POLL_INTERVAL_MS)

    return () => {
      if (incomingPollRef.current) {
        clearInterval(incomingPollRef.current)
        incomingPollRef.current = null
      }
    }
  }, [isActive, isPredictive, predictiveView, predictiveEngineStarted])

  // The LINES preference effect and its save handler used to live here. They
  // moved below activeScopeCampaigns' declaration — they now resolve a primary
  // campaign for the ALL ACTIVE case, and reading that list during render from
  // above its own `const` is a temporal-dead-zone error.

  useEffect(() => {
    const handleUnload = () => {
      // Disarm immediately and tear down SIP so a refresh/close can't leave a
      // registered endpoint that auto-answers a ghost call after reload.
      disarmDialing({ force: true })
      try { registererRef.current?.unregister?.() } catch {}
      try { swClientRef.current?.stop?.() } catch {}
      // /api/dialer/session-end was removed along with the session writes
      // nobody read, but this beacon was left pointing at it — 404ing on every
      // unload since. The heartbeat below is what actually marks the agent
      // gone, and it is the one Live Ops reads.
      if (navigator.sendBeacon) {
        try {
          const blob = new Blob(
            [JSON.stringify({ state: 'paused' })],
            { type: 'application/json' }
          )
          navigator.sendBeacon('/api/dialer/heartbeat', blob)
        } catch {}
      }
      const callSid = activeCallSidRef.current
      if (callSid && navigator.sendBeacon) {
        try {
          const blob = new Blob(
            [JSON.stringify({ sid: callSid })],
            { type: 'application/json' }
          )
          navigator.sendBeacon('/api/calls/hangup', blob)
        } catch {}
      }
    }
    window.addEventListener('beforeunload', handleUnload)
    window.addEventListener('pagehide', handleUnload)
    return () => {
      window.removeEventListener('beforeunload', handleUnload)
      window.removeEventListener('pagehide', handleUnload)
      endSession()
    }
  }, [endSession])

  useEffect(() => {
    if (!isActive || !isPredictive || !available || !isSpecificCampaign) {
      setPacingInfo(null)
      if (pacingPollRef.current) {
        clearInterval(pacingPollRef.current)
        pacingPollRef.current = null
      }
      return
    }

    const fetchPacing = async () => {
      try {
        const res = await fetch(`/api/dialer/active-agents?campaign_id=${selectedCampaign}`)
        if (!res.ok) return
        const data = await res.json()
        const cp = data.campaign_pacing
        if (!cp) {
          setPacingInfo(null)
          return
        }

        const configuredLines = linesPref?.effective_lines || currentCampaign?.predictive_lines_per_agent || 3
        const abandonRateDecimal = (cp.abandon_rate_pct ?? 0) / 100
        const isDegraded = abandonRateDecimal >= 0.025

        setPacingInfo({
          activeAgents: cp.active_agents,
          readyAgents: cp.ready_agents,
          dialingAgents: cp.dialing_agents,
          onCallAgents: cp.on_call_agents,
          abandonRate: abandonRateDecimal,
          isDegraded,
          isPredictiveTeam: cp.is_predictive_team,
          configuredLines,
          effectiveLines: isDegraded ? 1.0 : configuredLines,
        })
      } catch {}
    }

    fetchPacing()
    pacingPollRef.current = setInterval(fetchPacing, PACING_POLL_INTERVAL_MS)
    return () => {
      if (pacingPollRef.current) {
        clearInterval(pacingPollRef.current)
        pacingPollRef.current = null
      }
    }
  }, [isActive, isPredictive, available, isSpecificCampaign, selectedCampaign, currentCampaign, linesPref])

  const handleSetAvailable = async () => {
    let granted = micGranted
    if (!granted) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        stream.getTracks().forEach(track => track.stop())
        setMicGranted(true)
        granted = true
      } catch (err) {
        console.warn('Microphone permission denied:', err)
        return
      }
    }

    const goingOffline = availableRef.current
    if (!goingOffline) {
      // Going AVAILABLE (online): this is the explicit, deliberate action that
      // re-enables dialing after an abort. Clear the abort latch here — and only
      // here — so a prior ABORT/TERMINATE stays in full effect until the user
      // themselves chooses to start dialing again.
      abortDialingRef.current = false
    }
    if (goingOffline) {
      // ── KILL SWITCH ───────────────────────────────────────────────────────
      // Going offline must stop everything immediately: disarm dialing so no
      // INVITE can ever connect, cancel every pending auto-chain dial, and hang
      // up any call currently attached. This is what makes "unavailable" mean it.
      disarmDialing({ force: true })
      cancelAllPendingDials()
      // Local hangup covers the one call this client holds an id for. The
      // server sweep covers the rest — predictive places lines server-side
      // that the client never sees, and without this they carried on ringing
      // the lead's phone after the agent had gone offline.
      //
      // scope 'all' here, unlike abort: clocking off SHOULD release claimed
      // leads back to the pool and pause the session so the controller stops
      // filling lines. Abort deliberately does not, because the agent is
      // still working.
      await Promise.all([
        activeCallSidRef.current
          ? hangupCall(activeCallSidRef.current).catch(() => {})
          : Promise.resolve(),
        fetch('/api/dialer/abort', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ scope: 'all' }),
        }).catch(err => console.error('[offline] server sweep failed:', err)),
      ])
      setStatus('idle')
      setCurrentLead(null)
      setPreviewLead(null)
      setShowDisposition(false)
      setDisposition('')
      setSeconds(0)
      setPredictiveEngineStarted(false)
      predictiveEngineStartedRef.current = false
      // Clocking off must disarm on the SERVER too. The abort sweep below
      // pauses the session, but leaving the row armed means the engine is
      // still armed the moment the agent comes back — before they have asked
      // for it. That is the ghost dialing this flag exists to prevent.
      void setServerArmed(false)
      lastIncomingCallSidRef.current = null
    }

    setAvailable(prev => !prev)
  }

  // ── TONES ────────────────────────────────────────────────────────────────
  // WHY THESE WENT SILENT: every tone here used to be scheduled against
  // ctx.currentTime the instant it was requested, on a context that might be
  // SUSPENDED. resume() is asynchronous, and a suspended context's currentTime
  // does not advance — so the gain envelope and the oscillator's start/stop
  // were all pinned to a timestamp that was already in the past by the time
  // audio actually started flowing. The notes were scheduled, then thrown
  // away. No error, no sound.
  //
  // Everything now goes through playTones, which waits for the context to be
  // RUNNING and only then reads currentTime.
  const getAudioCtx = (): AudioContext | null => {
    if (typeof window === 'undefined') return null
    if (!audioCtxRef.current) {
      const Ctor = resolveAudioContextCtor()
      if (!Ctor) return null
      audioCtxRef.current = new Ctor()
    }
    return audioCtxRef.current
  }

  interface Tone {
    freq: number
    /** Seconds from now. */
    at: number
    dur: number
    gain?: number
    type?: OscillatorType
  }

  const playTones = async (tones: Tone[]) => {
    const ctx = getAudioCtx()
    if (!ctx) return

    if (ctx.state === 'suspended') {
      try {
        await ctx.resume()
      } catch {
        return // Blocked by autoplay policy — no gesture yet. Nothing to do.
      }
    }
    // Still not running (an interrupted context on iOS, say). Scheduling here
    // would silently discard the notes, so don't.
    if (ctx.state !== 'running') return

    // Read AFTER the await: the clock only advances while running, and this is
    // the whole point of the rewrite.
    const t0 = ctx.currentTime

    for (const tone of tones) {
      const start = t0 + tone.at
      const peak = tone.gain ?? 0.12

      const gain = ctx.createGain()
      gain.gain.setValueAtTime(0.0001, start)
      gain.gain.linearRampToValueAtTime(peak, start + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.001, start + tone.dur)
      gain.connect(ctx.destination)

      const osc = ctx.createOscillator()
      osc.type = tone.type ?? 'sine'
      osc.frequency.value = tone.freq
      osc.connect(gain)
      osc.start(start)
      osc.stop(start + tone.dur)
    }
  }

  /** Dialing has started. One short mid tone. */
  const playInitiateBlip = () => {
    void playTones([{ freq: 660, at: 0, dur: 0.18 }])
  }

  /** Someone picked up. A rising two-note figure — deliberately unlike the
   *  dial blip, because the whole job of this sound is to pull an agent's
   *  attention back to the screen. */
  const playPickup = () => {
    void playTones([
      { freq: 1046, at: 0,    dur: 0.3, gain: 0.2 },
      { freq: 1318, at: 0.11, dur: 0.3, gain: 0.2 },
    ])
  }

  const playDTMF = (key: string) => {
    const freqs: Record<string, [number, number]> = {
      '1': [697, 1209], '2': [697, 1336], '3': [697, 1477],
      '4': [770, 1209], '5': [770, 1336], '6': [770, 1477],
      '7': [852, 1209], '8': [852, 1336], '9': [852, 1477],
      '*': [941, 1209], '0': [941, 1336], '#': [941, 1477],
    }
    const pair = freqs[key]
    if (!pair) return
    void playTones(pair.map(freq => ({ freq, at: 0, dur: 0.4, gain: 0.12 })))
  }

  // ── GHOST-DIALING ARM / DISARM ────────────────────────────────────────────
  // armDialing() must be called RIGHT BEFORE any action that legitimately causes
  // SignalWire to bridge a call to this browser (placing an outbound dial,
  // starting the predictive engine, dialing a preview lead, manual dial).
  // disarmDialing() is called whenever the user is no longer expecting audio
  // (call ended, terminated, skipped to no call, went offline). While disarmed,
  // onInvite rejects everything, so no ghost call can connect.
  const armDialing = () => { callIntentRef.current = true }
  /**
   * Open the agent-leg expectation window. Call immediately BEFORE any request
   * that causes this browser's own agent leg to be dialed — the server places
   * that leg first, so its INVITE can land while the request is still in
   * flight. Self-closing, so no teardown path can leave it stuck open.
   */
  const openAgentLegWindow = () => {
    expectingAgentLegRef.current = true
    if (expectAgentLegTimerRef.current) clearTimeout(expectAgentLegTimerRef.current)
    expectAgentLegTimerRef.current = setTimeout(() => {
      expectingAgentLegRef.current = false
      expectAgentLegTimerRef.current = null
    }, AGENT_LEG_EXPECT_MS)
  }
  const closeAgentLegWindow = () => {
    expectingAgentLegRef.current = false
    if (expectAgentLegTimerRef.current) {
      clearTimeout(expectAgentLegTimerRef.current)
      expectAgentLegTimerRef.current = null
    }
  }
  // disarmDialing({ force }): normally we keep the browser armed while the
  // predictive engine is running, because humans route in continuously and a
  // brief disarm between calls could reject an in-flight human. The explicit
  // kill paths (Stop engine, go offline, page unload) pass force:true after
  // they've already turned the engine off.
  const disarmDialing = (opts?: { force?: boolean }) => {
    const keepForPredictive =
      !opts?.force && isPredictive && predictiveEngineStartedRef.current
    if (keepForPredictive) {
      // Engine still running — tear down the just-ended leg but stay armed so
      // the next routed human can connect.
      if (swCallRef.current) {
        try {
          if (swCallRef.current.bye) swCallRef.current.bye()
          else if (swCallRef.current.hangup) swCallRef.current.hangup()
        } catch {}
        swCallRef.current = null
      }
      return
    }
    callIntentRef.current = false
    // Close the agent-leg expectation window too. A force disarm means the
    // user has genuinely stopped (terminated, went offline, page unload), so
    // a late INVITE from a dial that was already in flight must NOT be
    // accepted on the strength of that window — otherwise the window would
    // reintroduce exactly the ghost-audio case the guard exists to prevent.
    if (opts?.force) closeAgentLegWindow()
    // Proactively tear down any SIP session that may still be up so a lingering
    // leg can't keep audio flowing after the user expects silence.
    if (swCallRef.current) {
      try {
        if (swCallRef.current.bye) swCallRef.current.bye()
        else if (swCallRef.current.reject) swCallRef.current.reject()
        else if (swCallRef.current.hangup) swCallRef.current.hangup()
      } catch {}
      swCallRef.current = null
    }
  }

  // `reason` decides whether the server holds the lead's line briefly after
  // the agent has gone. Only 'skip' does; terminate and abort stay instant,
  // because those mean "get me off this now" and a delay would be felt.
  const hangupCall = async (sid: string | null, reason?: 'skip') => {
    // Any hangup means the user is no longer on a call they initiated — disarm
    // so a follow-on INVITE can't reconnect audio behind their back.
    disarmDialing()
    if (!sid) return
    if (activePollRef.current) clearInterval(activePollRef.current)
    activePollRef.current = null
    if (swCallRef.current) {
      try {
        if (swCallRef.current.bye) await swCallRef.current.bye()
        else if (swCallRef.current.hangup) await swCallRef.current.hangup()
      } catch {}
      swCallRef.current = null
    }
    // NOT awaited when skipping. The server may hold the lead's line for a few
    // seconds to clear the short-duration threshold, and the agent must not
    // wait on that — they are already meant to be on the next lead. The
    // browser's own audio is torn down above, so nothing here is user-visible.
    const hangupRequest = fetch('/api/calls/hangup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sid, reason }),
    })
    if (reason !== 'skip') await hangupRequest
    else hangupRequest.catch(() => {})
    setActiveCallSid(null)
  }

  const fetchCampaigns = async () => {
    const res = await fetch(`/api/campaigns/list?user_id=${user?.id}`)
    const data = await res.json()
    if (data.success) {
      setCampaigns(data.campaigns)
    }
    setCampaignsLoaded(true)
  }

  const isPersonalScope = selectedScope === PERSONAL_SCOPE
  const currentScope = teamScopes.find(s => s.id === selectedScope) || null

  const scopeCampaigns: { id: string; name: string; total_leads: number; status: string }[] = isPersonalScope
    ? campaigns.map(c => ({ id: c.id, name: c.name, total_leads: c.total_leads, status: c.status }))
    : (currentScope?.teamCampaigns
        .filter(tc => tc.campaign)
        .map(tc => ({
          id: tc.campaign!.id,
          name: tc.campaign!.name,
          total_leads: tc.campaign!.total_leads,
          status: tc.campaign!.status,
        })) || [])

  const activeScopeCampaigns = scopeCampaigns.filter(c => c.status === 'active')
  const activeCampaignsCount = activeScopeCampaigns.length

  // ── HOW MANY LINES THIS AGENT DIALS ──────────────────────────────────────
  // On ALL ACTIVE there is no single selected campaign, so the preference is
  // stored against the first campaign in scope. The controller reads this
  // preference across EVERY campaign it is dialing and takes the most recently
  // set one, so it does not matter which of them holds the row — deliberately,
  // so the client and the server never have to agree on which campaign is
  // "primary". Lives here rather than with the other predictive effects
  // because it reads activeScopeCampaigns, declared just above.
  const linesPrefCampaignId = isSpecificCampaign
    ? selectedCampaign
    : activeScopeCampaigns[0]?.id

  useEffect(() => {
    if (!isActive || !isPredictive || !linesPrefCampaignId) {
      setLinesPref(null)
      return
    }

    let cancelled = false
    fetch(`/api/predictive/prefs?campaign_id=${linesPrefCampaignId}`)
      .then(r => r.json())
      .then(d => {
        if (cancelled) return
        if (d.error) {
          setLinesPref(null)
          return
        }
        setLinesPref(d as LinesPrefInfo)
      })
      .catch(() => {
        if (!cancelled) setLinesPref(null)
      })
    return () => { cancelled = true }
  }, [isActive, isPredictive, linesPrefCampaignId])

  const handleLinesChange = async (newLines: number) => {
    if (!linesPrefCampaignId || !isPredictive) return
    setLinesPrefSaving(true)
    try {
      const res = await fetch('/api/predictive/prefs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaign_id: linesPrefCampaignId,
          preferred_lines: newLines,
        }),
      })
      const data = await res.json()
      if (!data.error) {
        setLinesPref(data as LinesPrefInfo)
        setAmdActivity(prev => [
          `LINES PREFERENCE → ${data.effective_lines}`,
          ...prev,
        ].slice(0, 5))
      }
    } catch (err) {
      console.error('lines pref save failed:', err)
    } finally {
      setLinesPrefSaving(false)
    }
  }

  // ── QUEUED LEADS LIST — fetched the moment the agent goes available ─────
  // Shows "what's about to be worked" before Initiate Dial Sequence is
  // clicked. Reuses the existing /api/leads/list route (disposition=uncalled
  // filter, + search/sort passthrough for the panel's FILTER control)
  // rather than a new endpoint — this is the same data source the leads
  // page itself already reads from.
  //
  // WORKS FOR ANY SCOPE, INCLUDING "ALL ACTIVE CAMPAIGNS": /api/leads/list
  // only accepts a single campaign_id, so when the agent is scoped to
  // ALL_ACTIVE this fires one request per active campaign in parallel and
  // merges the results client-side (tagging each lead with its own
  // campaign_id from the raw row, since a merged queue needs to know which
  // campaign each lead actually belongs to for dialing/attribution).
  // Previously this sent campaign_id=__all_active__ literally, which matched
  // no real campaign and silently returned zero leads whenever "All Active
  // Campaigns" was selected.
  //
  // DELIBERATELY SHOWS LEADS REGARDLESS OF TCPA CALLING HOURS: leads/list
  // has no calling-window filter at all (confirmed — only
  // placeOutboundCall.ts's isCallableNow() enforces that, at the moment a
  // call is actually placed, not when leads are listed). So the agent can
  // set available and see their full queue at any hour. The existing
  // tcpaBlockedAll banner (already shown elsewhere on this page when
  // fetchNextLead reports every lead is outside the window) is reused
  // below to make clear WHY nothing is actually dialing yet, even though
  // the queue itself is fully visible.
  const fetchQueuedLeadsFor = useCallback(async (campaignIds: string[]): Promise<QueuedLead[]> => {
    if (campaignIds.length === 0) return []

    // Fully paginate through EVERY page for EVERY campaign — /api/leads/list
    // only returns PAGE_SIZE (50) leads per request and hands back a
    // nextCursor when more exist. The previous version only ever fetched
    // page 1, so any campaign with more than 50 uncalled leads silently lost
    // everything past the 50th (sorted by created_at, so — as reported —
    // 50 duplicate/early-created test rows could fill the entire visible
    // queue and hide real leads created later, e.g. Hawaii leads added
    // after a batch of NC test rows). All leads in the campaign should be
    // searchable at all times, so this now follows nextCursor until the
    // server reports there isn't one, for every campaign in scope.
    //
    // SAFETY_PAGE_CEILING is not a "how many leads to show" limit — it's a
    // circuit breaker against an infinite loop if the server ever returned
    // a malformed/non-advancing cursor. At PAGE_SIZE=50 that's 50,000 leads
    // per campaign before it would ever stop early; any real account is
    // expected to finish long before that.
    const SAFETY_PAGE_CEILING = 1000

    // Per-campaign share of the cap. On All Active the cap is the whole panel's
    // budget, so splitting it keeps one enormous campaign from crowding every
    // other one out of the list entirely.
    const loadCap = Math.max(
      500,
      Math.ceil(queueLoadCap / Math.max(1, campaignIds.length))
    )
    let sawMore = false

    const fetchAllPagesFor = async (campaignId: string): Promise<QueuedLead[]> => {
      const all: QueuedLead[] = []
      let cursor: number | null = 0
      let pages = 0
      while (cursor !== null && pages < SAFETY_PAGE_CEILING) {
        const cursorValue: number = cursor
        const paramEntries: Record<string, string> = {
          campaign_id: campaignId,
          // 'dialable' = everything except the terminal dispositions
          // (do-not-call, not interested, closed). Deliberately NOT filtered
          // down to what is dialable *right now* — a lead must not vanish
          // from the queue just because it was dialed. The top-of-list
          // ordering requirement is handled by sorting instead, in
          // visibleQueuedLeads above.
          disposition: 'dialable',
          sort: queueSortDesc ? 'created_desc' : 'created_asc',
          cursor: String(cursorValue),
          // 500 a page instead of the default 50. An 831-lead campaign was 17
          // sequential round-trips to assemble and a 10,000-lead one is 200 —
          // every one a chance to fail partway and leave the panel silently
          // short. At 500 the same lists are 2 and 20.
          page_size: '500',
        }
        if (queueSearch.trim()) paramEntries.search = queueSearch.trim()
        const params = new URLSearchParams(paramEntries)
        try {
          // ── RETRY, DON'T SILENTLY TRUNCATE ──────────────────────────────
          // A failed page used to break the loop and return whatever had
          // arrived so far. That is a queue panel quietly missing leads with
          // nothing on screen saying so — the agent believes they are working
          // the whole book and they are not.
          //
          // One retry covers the transient case, which is nearly all of them.
          let data: any = null
          for (let attempt = 0; attempt < 2; attempt++) {
            try {
              const res = await fetch(`/api/leads/list?${params.toString()}`)
              data = await res.json()
              if (data?.success) break
            } catch {
              if (attempt === 1) throw new Error('page fetch failed')
            }
          }
          if (!data?.success) throw new Error('page fetch failed')
          if (Array.isArray(data.leads)) {
            all.push(...(data.leads as QueuedLead[]))
          }
          cursor = typeof data.nextCursor === 'number' ? data.nextCursor : null

          // ── STOP AT THE CAP, AND REMEMBER THERE WAS MORE ──────────────────
          // The cap is what keeps a 100,000-lead book from being pulled into a
          // browser tab. Reaching it with a cursor still outstanding is the
          // signal the panel uses to offer LOAD MORE; running out of cursor
          // first means this IS the whole list.
          if (all.length >= loadCap) {
            if (cursor !== null) sawMore = true
            break
          }
        } catch {
          console.error(
            `[queue] pagination failed for campaign ${campaignId} after ${all.length} leads — ` +
            `the panel is SHORT of the full list`
          )
          break // return what we have rather than lose everything
        }
        pages++
      }
      return all
    }

    const results = await Promise.all(campaignIds.map(fetchAllPagesFor))
    // Reported after every campaign has been walked, so LOAD MORE appears when
    // ANY campaign in scope still has leads behind the cap.
    setQueueHasMore(sawMore)
    return results.flat()
  }, [queueSearch, queueSortDesc, queueLoadCap])

  const fetchQueuedLeads = useCallback((opts?: { silent?: boolean }) => {
    const myGeneration = ++queueFetchGenerationRef.current
    const campaignIds = isSpecificCampaign
      ? [selectedCampaign]
      : activeScopeCampaigns.map(c => c.id)
    if (campaignIds.length === 0) {
      // Still respect generation here — an empty-scope "fetch" is
      // effectively instant, but if a slower real fetch from a moment ago
      // is still in flight it should still win once IT lands, not be
      // clobbered by this synchronous empty-state clear.
      if (myGeneration === queueFetchGenerationRef.current) setQueuedLeads([])
      return Promise.resolve()
    }
    if (!opts?.silent) setQueuedLeadsLoading(true)
    return fetchQueuedLeadsFor(campaignIds)
      .then(leads => {
        // Discard this result if a newer fetch has started since this one
        // began — this is exactly the "stale response wins the race"
        // scenario. Only the response from the MOST RECENT fetch call is
        // ever allowed to update state.
        if (myGeneration !== queueFetchGenerationRef.current) return
        // Merge, sort consistently (fetching per-campaign in parallel means
        // results arrive in campaign order, not the requested created_at
        // order). No slice/cap here — every uncalled lead across the
        // selected scope is kept, since the panel is meant to be a
        // complete, searchable view of the queue at all times, not a
        // preview of the first N.
        const sorted = [...leads].sort((a, b) => {
          const at = a.created_at ? new Date(a.created_at).getTime() : 0
          const bt = b.created_at ? new Date(b.created_at).getTime() : 0
          return queueSortDesc ? bt - at : at - bt
        })
        setQueuedLeads(sorted)
      })
      .finally(() => {
        if (myGeneration === queueFetchGenerationRef.current) setQueuedLeadsLoading(false)
      })
  }, [isSpecificCampaign, selectedCampaign, activeScopeCampaigns, fetchQueuedLeadsFor, queueSortDesc])

  // Refetch campaigns AND the queue whenever this tab/page becomes visible
  // again — Next.js's client-side navigation can keep this page's
  // component instance alive in the background (rather than truly
  // unmounting it) when you navigate away to create/edit a campaign and
  // come back, so the original mount-only fetchCampaigns() effect never
  // refires and the campaign list (lead counts, newly added campaigns)
  // goes stale until a hard browser refresh. This covers that case and the
  // literal switch-tabs-and-back case, matching the reported "have to
  // refresh the page" symptom.
  useEffect(() => {
    if (!user || !isActive) return
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchCampaigns()
        fetchQueuedLeads({ silent: true })
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [user, isActive, fetchQueuedLeads])

  // Internal refresh trigger — no longer exposed as a button (removed per
  // instruction), but still needed: it's what actually re-syncs the
  // visible queue against real server-side disposition state after a
  // dial resolves. See disposeLead below, which calls this after every
  // real disposition write.
  const refreshQueue = useCallback(() => { fetchQueuedLeads() }, [fetchQueuedLeads])

  // Debounced so several dispositions firing in quick succession (e.g. fast
  // Power-mode dialing, or predictive's multi-line fanout resolving several
  // calls close together) coalesce into a single refetch shortly after the
  // last one, instead of one full paginated refetch per disposition.
  const refreshQueueDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const refreshQueueDebounced = useCallback(() => {
    if (refreshQueueDebounceRef.current) clearTimeout(refreshQueueDebounceRef.current)
    refreshQueueDebounceRef.current = setTimeout(() => {
      refreshQueueDebounceRef.current = null
      refreshQueue()
    }, 600)
  }, [refreshQueue])

  // ── SHARED DISPOSE WRAPPER ────────────────────────────────────────────
  // Every /api/leads/dispose call in this file now routes through here.
  // Why this exists: leads used to be stripped from the visible queue
  // OPTIMISTICALLY the instant they were dialed (see dialLeadCall below),
  // with no periodic background refetch to ever bring them back — so any
  // lead that was dialed but never actually received a terminal
  // disposition (call failed before disposing, still ringing, etc.) was
  // permanently hidden from the queue for the rest of the session. Per
  // instruction: a lead should only leave the visible queue when a REAL
  // disposition changes its server-side status away from "uncalled" — not
  // merely because it was dialed once. Routing every dispose call through
  // one place guarantees that a real refetch always follows a real
  // disposition, consistently, regardless of which of the several dispose
  // call sites in this file triggered it.
  interface DisposeLeadParams {
    lead_id: string
    campaign_id?: string | null
    user_id?: string | null
    disposition: string
    duration: number
    notes?: string
    source?: string
  }
  /**
   * Stamp a lead as just-dialed in local queue state so it rotates to the
   * bottom immediately.
   *
   * The server is the source of truth for last_called_at, but waiting for a
   * refetch is not good enough here: the next dial is scheduled within
   * ~600ms, and it sends the CURRENT visible order to /api/leads/next as the
   * allowlist. If the just-dialed lead is still sitting at the top of that
   * list, the server dutifully picks it again — which is exactly how the
   * queue ended up re-dialing the first lead forever instead of advancing.
   *
   * Stamping locally makes rotation immediate and race-free; the debounced
   * refetch then confirms it against the server a moment later.
   */
  const markLeadDialedLocally = useCallback((leadId?: string | null) => {
    if (!leadId) return
    const stamp = nowIso()
    setQueuedLeads(prev =>
      prev.map(l => (l.id === leadId ? { ...l, last_called_at: stamp } : l))
    )
  }, [])

  const disposeLead = useCallback(async (params: DisposeLeadParams) => {
    // Rotate it out of the way now — see markLeadDialedLocally.
    markLeadDialedLocally(params.lead_id)
    try {
      await fetch('/api/leads/dispose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      })
    } finally {
      // Always attempt the refetch, even if the dispose call itself failed
      // — the queue should reflect real server state either way, and a
      // failed dispose might still be worth re-syncing against (e.g. to
      // confirm nothing actually changed, rather than leaving the client
      // in a stale guessed state).
      refreshQueueDebounced()
    }
  }, [refreshQueueDebounced, markLeadDialedLocally])

  useEffect(() => {
    if (predictiveView === 'offline') {
      setQueuedLeads([])
      return
    }
    if (!isSpecificCampaign && activeScopeCampaigns.length === 0) return
    fetchQueuedLeads()
    // activeScopeCampaigns is a freshly-mapped array every render (derived
    // from scopeCampaigns), so depend on its length + a stable id signature
    // rather than the array reference itself, or this effect would refire
    // every render (the same class of bug that was causing the visible
    // "reloading every second" symptom elsewhere on this page).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [predictiveView, isSpecificCampaign, selectedCampaign, queueSearch, queueSortDesc, activeScopeCampaigns.length, activeScopeCampaigns.map(c => c.id).join(',')])

  const fetchNextLead = async (): Promise<Lead | null> => {
    const params = new URLSearchParams({ user_id: user?.id || '' })
    if (isSpecificCampaign) params.append('campaign_id', selectedCampaign)
    if (!isPersonalScope) params.append('team_id', selectedScope)
    // ALWAYS send the exact currently-displayed order as an ordered
    // allowlist — not just when a filter/shuffle is active. Per explicit
    // instruction: dialing must always follow the queue panel's displayed
    // top-down order, not the server's own dial_attempts/created_at
    // priority (which is a DIFFERENT sort key than the panel's display
    // order — a lead with a prior failed attempt sorts later in dial
    // priority even though it can still be sitting near the top of the
    // displayed list, which is why dialing looked like it was "picking a
    // random number" instead of the top entry). visibleQueuedLeads already
    // reflects the current filter, sort, and shuffle state — sending it
    // unconditionally means what's dialed next always matches what's shown
    // next, with no exceptions.
    //
    // Only skipped while the queue's first load hasn't finished yet
    // (queuedLeadsLoading with zero leads loaded so far) — sending an EMPTY
    // allowlist during that race would make the server correctly report
    // "no leads match," blocking a dial that should have been allowed once
    // the list finishes loading. Once at least one page has loaded, the
    // list is used as-is even if more pages are still being fetched in the
    // background, since fetchQueuedLeads accumulates all pages before ever
    // setting queuedLeads in the first place — by the time visibleQueuedLeads
    // is non-empty, it already reflects the FULL dialable set for the
    // current scope, not a partial page.
    // Read through the ref, NOT the captured value. This function is reached
    // via scheduleDial -> setTimeout, so the closure it was created in predates
    // the rotation that just happened — sending that stale order told the
    // server the lead we had only just finished was still top of the list.
    const currentOrder = visibleQueuedLeadsRef.current
    const queueReadyForOrderedDial = !(queuedLeadsLoading && currentOrder.length === 0)

    // POSTed, not appended to the query string. The whole visible queue goes
    // to the server — every lead, in the exact displayed order — and a few
    // thousand UUIDs do not fit in a URL. The query-string version had to
    // truncate to 200 ids, which silently stalled dialing whenever the top of
    // a region-grouped list was outside its calling window: the server found
    // nothing dialable in the 200 it could see and reported an empty queue
    // while thousands of dialable leads sat below the cut.
    const res = await fetch(`/api/leads/next?${params}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        // Windowed to the top of the order — see DIAL_ORDER_WINDOW. The PANEL
        // still holds and displays every lead; this bounds only what is sent to
        // pick the next dial from. If nothing in the window is dialable right
        // now (a whole region outside its calling window, say), the server
        // falls back to an unconstrained query rather than reporting an empty
        // queue — see app/api/leads/next/route.ts.
        lead_ids: queueReadyForOrderedDial
          ? currentOrder.slice(0, DIAL_ORDER_WINDOW).map(l => l.id)
          : undefined,
      }),
    })
    const data = await res.json()
    if (data.success) {
      setNoLeads(false)
      setTcpaBlockedAll(false)
      setTcpaBlockedReason(null)
      setQueueDiagnosis(null)
      setNoLeadsReason(null)
      setNoLeadsStatus(null)
      return data.lead
    } else {
      setNoLeads(true)
      setTcpaBlockedAll(!!data.tcpaBlocked)
      setTcpaBlockedReason(typeof data.error === 'string' ? data.error : null)
      setQueueDiagnosis(
        data.diagnosis && Array.isArray(data.diagnosis.reasons) ? data.diagnosis : null
      )
      setNoLeadsReason(typeof data.error === 'string' ? data.error : null)
      setNoLeadsStatus(res.status)
      return null
    }
  }

  // Live timer display: H:MM:SS once the call passes an hour, else MM:SS.
  const formatTime = (s: number) => {
    const safe = Math.max(0, Math.floor(s))
    const h = Math.floor(safe / 3600)
    const m = Math.floor((safe % 3600) / 60)
    const sec = safe % 60
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`
    }
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`
  }

  // Human-readable duration for the after-call summary, e.g. "1h 4m 12s",
  // "3m 8s", "47s". Whole seconds only — never milliseconds.
  const formatDurationLong = (totalSeconds: number) => {
    const safe = Math.max(0, Math.floor(totalSeconds))
    const h = Math.floor(safe / 3600)
    const m = Math.floor((safe % 3600) / 60)
    const sec = safe % 60
    const parts: string[] = []
    if (h > 0) parts.push(`${h}h`)
    if (m > 0) parts.push(`${m}m`)
    parts.push(`${sec}s`) // always show seconds so a sub-minute call still reads
    return parts.join(' ')
  }

  const now = new Date()
  const timeStr = mounted ? now.toLocaleTimeString('en-US', { hour12: false }) : '--:--:--'
  const dateStr = mounted ? now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : ''
  void clockTick

  useEffect(() => {
    if (status === 'connected') {
      const startedAt = Date.now()
      setCallStart(startedAt)
      callStartRef.current = startedAt
      timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
      if (status !== 'calling') setSeconds(0)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [status])

  useEffect(() => {
    if (dialZoomed) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [dialZoomed])

  const fetchPreviewLead = async () => {
    setShowDisposition(false)
    setDisposition('')
    setNoLeads(false)
    const lead = await fetchNextLead()
    if (!lead) return
    setPreviewLead(lead)
    setStatus('preview_ready')
  }

  const dialPreviewLead = async () => {
    if (!previewLead) return
    const lead = previewLead
    setPreviewLead(null)
    setCurrentLead(lead)
    await dialLeadCall(lead)
  }

  const skipPreviewLead = async () => {
    if (!previewLead) return
    await disposeLead({
      lead_id: previewLead.id,
      campaign_id: previewLead.campaign_id,
      user_id: user?.id,
      disposition: 'SKIPPED',
      duration: 0,
      source: 'preview_skip',
    })
    setPreviewLead(null)
    setStatus('idle')
    fetchPreviewLead()
  }

  const dialLeadCall = async (lead: Lead) => {
    // ── HARD GUARD (final gate before SignalWire) ───────────────────────────
    // This is the last function before the POST to /api/calls/outbound. Even if
    // something reached here unexpectedly, refuse to dial unless you are
    // actively available right now. Nothing talks to SignalWire otherwise.
    if (!availableRef.current) {
      setStatus('idle')
      return
    }
    // Abort latch (TERMINATE pressed) — refuse to place the call.
    if (abortDialingRef.current) {
      setStatus('idle')
      return
    }
    const rawPhone = lead.phone?.replace(/\D/g, '')
    if (!rawPhone || rawPhone.length < 10) {
      await disposeLead({
        lead_id: lead.id,
        campaign_id: lead.campaign_id,
        user_id: user?.id,
        disposition: 'SKIPPED',
        duration: 0,
      })
      setCurrentLead(null)
      if (autoChainOnFailure) scheduleDial(300)
      else setStatus('idle')
      return
    }

    setStatus('calling')
    setSessionStats(s => ({ ...s, calls: s.calls + 1 }))
    playInitiateBlip()
    armDialing() // user-initiated dial — allow Telnyx to bridge to us
    // Clear the previous call's connect timestamp. It is only ever SET (when
    // status hits 'connected') and never cleared, so without this it stays
    // populated forever after the first answered call — and anything asking
    // "was the agent actually on this call?" would answer yes for every
    // subsequent dial, including ones that never connected. See
    // agentWasOnTheCall in terminateCall.
    callStartRef.current = 0
    // Open the agent-leg window BEFORE the request that causes the agent leg
    // to be dialed. The server places the agent leg first, so its INVITE can
    // land while the POST below is still in flight — see the ref's comment
    // for the silent-call bug this prevents.
    openAgentLegWindow()
    setLastCallDuration(null) // clear the previous call's duration readout
    // NOTE: this used to optimistically strip the lead out of queuedLeads
    // here, on the theory that a background refetch would "self-heal" the
    // list. There was no such periodic refetch anywhere in this file — the
    // only refetches were the manual REFRESH button and a few state-change
    // effects — so a dialed lead was hidden from the queue PERMANENTLY for
    // the rest of the session regardless of whether it ever actually
    // received a real disposition. Leads should only leave the visible
    // queue when the server's own disposition state says so (see
    // fetchQueuedLeads/disposition=uncalled) — a lead that's mid-dial or
    // was dialed but never dispositioned should still be findable. The
    // active-row highlight (activeQueueLeadIds, driven by currentLead/
    // previewLead/activeDialingNumbers) already visually marks this row as
    // "Dialing" without needing to remove it from the list.

    setAmdActivity(prev => [
      `DIALING ${lead.first_name || ''} ${lead.last_name || ''} — ${lead.phone}`.trim(),
      `AMD ENABLED — analyzing pickup`,
      ...prev,
    ].slice(0, 5))

    try {
      const res = await fetch('/api/calls/outbound', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: lead.phone,
          leadId: lead.id,
          campaignId: lead.campaign_id,
          teamId: isPersonalScope ? undefined : selectedScope,
        }),
      })
      const data = await res.json()

      if (data.success) {
        // If TERMINATE was pressed while this POST was in flight, the call was
        // created server-side but the user wants OUT. Hang it up immediately and
        // do not bridge/poll — prevents a ghost ring after abort.
        if (abortDialingRef.current || !availableRef.current) {
          try {
            await fetch('/api/calls/hangup', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ sid: data.callSid }),
            })
          } catch {}
          disarmDialing({ force: true })
          setStatus('idle')
          return
        }
        setActiveCallSid(data.callSid)
        startCallPolling(data.callSid)
      } else {
        if (res.status === 403) {
          setTier('lapsed')
          return
        }
        if (res.status === 451) {
          console.warn('TCPA window block:', data.detail)
          await disposeLead({
            lead_id: lead.id,
            campaign_id: lead.campaign_id,
            disposition: 'TCPA_BLOCKED',
            duration: 0,
            notes: data.detail,
            source: 'tcpa_block',
          })
          setAmdActivity(prev => [
            `TCPA SKIP — ${data.leadState || '?'}: ${data.detail}`,
            ...prev,
          ].slice(0, 5))
          // The server's own reason, not a generic one — "Invalid phone
          // number — 7 digits" is actionable where "outside calling window"
          // sends the agent to wait for a window that will never help.
          showQueueOutcome(lead.id, data.detail || 'Outside calling window…')
          setStatus('idle')
          setCurrentLead(null)
          if (autoChainOnFailure) scheduleDial(500)
          else scheduleDial(300)
          return
        }
        // Outbound call POST failed for a reason other than 403/451 (e.g. the
        // provider rejected it, a missing env var, or any other server error —
        // see /api/calls/outbound's catch block for the real message logged
        // server-side). Surface it in the queue row instead of failing
        // silently — this is real error text from the response, not invented.
        console.error('Outbound call failed:', res.status, data)
        showQueueOutcome(
          lead.id,
          data?.error
            ? `Call failed — ${data.error}${data?.detail ? ` (${data.detail})` : ''}`
            : 'Call failed…'
        )
        await disposeLead({
          lead_id: lead.id,
          campaign_id: lead.campaign_id,
          user_id: user?.id,
          disposition: 'SKIPPED',
          duration: 0,
        })
        setStatus('idle')
        setCurrentLead(null)
        if (autoChainOnFailure) scheduleDial(500)
      }
    } catch (error) {
      console.error('Call error:', error)
      showQueueOutcome(lead.id, 'Call failed…')
      setStatus('idle')
      setCurrentLead(null)
    }
  }

  /**
   * AMD ran out of time without reaching a conclusion.
   *
   * Worth telling the agent about, because silence from the dialer reads as
   * "detection has this covered" — and on a voicemail that ends with the agent
   * sitting on a greeting waiting for a skip that is never coming. One
   * observed case ran 65 seconds before it was killed by hand.
   *
   * Not a robot verdict: 'not_sure' never hangs up, here or on the server.
   * This only changes what the agent is told, so they use their own ears.
   */
  const isUndecided = (amd?: string): boolean => amd === 'not_sure'

  const isNotHuman = (amd?: string): boolean => {
    if (!amd) return false
    // MUST stay in step with ROBOT_RESULTS in app/api/calls/events/route.ts.
    // The server decides whether to hang up; this only decides what the agent
    // is told. If they disagree, the UI narrates something that didn't happen.
    //
    // The dial path requests PREMIUM AMD, whose vocabulary is
    // human_residence / human_business / machine / silence / fax_detected /
    // not_sure. Only an actual robot counts:
    //
    //   machine, fax_detected  -> not human
    //   human_residence, human_business, human, not_sure, silence -> human
    //
    // 'silence' is deliberately treated as human. It means AMD heard nothing
    // yet — a person who hasn't spoken, or a moment of dead air — and cutting
    // those off was the bug this vocabulary change fixes. 'not_sure' is
    // Telnyx's own documented recommendation to treat as human.
    //
    // machine_* / 'fax' / 'unknown' are SignalWire-era values, kept so
    // historical rows still render correctly.
    return (
      amd === 'machine' ||
      amd === 'fax_detected' ||
      amd.startsWith('machine_') ||
      amd === 'fax' ||
      amd === 'unknown'
    )
  }

  // Writes a short-lived outcome line under a lead's row in the queue panel,
  // right after ITS OWN dial resolves — e.g. "Sorry, couldn't answer…" for a
  // real no-answer/busy/failed/canceled status from /api/calls/check, or
  // "Voicemail detected…" for a real AMD machine result. Only ever called
  // with an actual resolution from the polling functions below — never
  // simulated. Auto-clears after a few seconds; by then the lead has also
  // normally dropped out of queuedLeads on the next background refetch.
  const showQueueOutcome = (leadId: string | undefined | null, text: string) => {
    if (!leadId) return
    setQueueOutcomeByLeadId(prev => ({ ...prev, [leadId]: text }))
    setTimeout(() => {
      setQueueOutcomeByLeadId(prev => {
        if (prev[leadId] !== text) return prev // already replaced/cleared by something newer
        const next = { ...prev }
        delete next[leadId]
        return next
      })
    }, 4000)
  }

  const startHangupPolling = (callSid: string) => {
    const hangupPoll = setInterval(async () => {
      try {
        const res = await fetch(`/api/calls/check?sid=${callSid}`)
        const d = await res.json()
        if (d.status === 'completed' || d.status === 'canceled' || d.status === 'failed') {
          clearInterval(hangupPoll)
          activePollRef.current = null
          setActiveCallSid(null)
          if (swCallRef.current) {
            try { await swCallRef.current.bye() } catch {}
            swCallRef.current = null
          }
          // Call is over. Disarm so nothing can bridge audio to us during wrap-up
          // / the disposition sheet. An auto-chained next dial re-arms itself.
          disarmDialing()

          // ── NOW IT HAS BEEN TRIED ──────────────────────────────────────
          // This is the one place every ending converges: rang out, skipped,
          // terminated, or a real conversation that hung up. Rotating here
          // means the row stays at the top and highlighted for the whole life
          // of the call, and only sinks once it is genuinely done with.
          //
          // Rotating at dial time instead — which is what this replaced — made
          // the top lead drop to the bottom the instant it was chosen, so the
          // agent never saw the row being called. disposeLead and the AMD
          // machine-skip still stamp their own paths; those end the call
          // earlier than this poll notices, and a second stamp is harmless.
          markLeadDialedLocally(currentLeadRef.current?.id)

          // AMD 'machine' ALWAYS auto-advances, even if the UI had already
          // flipped to connected.
          //
          // The `&& !agentWasOnTheCall` qualifier that used to be here is why
          // a detected voicemail sat on screen looking like a live call: AMD
          // fires ~2.4s after answer, but the poll can flip status to
          // 'connected' first, which sets callStartRef — so by the time the
          // call ended the client believed the agent had been on it and
          // showed the disposition sheet for a machine. The agent then had to
          // dismiss a sheet for a call that never happened before the queue
          // would move.
          //
          // There is nothing to disposition on a machine, so this skips
          // straight to the next lead. Human calls still get their sheet:
          // that qualifier still guards the non-AMD branch below, which is
          // what makes TERMINATE on a live call capture an outcome.
          if (isNotHuman(d.amd_result)) {
            setAmdActivity(prev =>
              [`VOICEMAIL FILTERED LATE — ${d.amd_result}`, ...prev].slice(0, 5)
            )
            setStatus('idle')
            setCurrentLead(null)
            if (autoChainOnFailure) scheduleDial(600)
          } else {
            // Snapshot the final duration before the timer effect resets it,
            // so the disposition sheet can show how long the call lasted. Use
            // the REF (not the state) — this callback's closure captured the
            // pre-connect callStart (0), which is why it always showed 0s.
            setLastCallDuration(
              callStartRef.current
                ? Math.max(0, Math.floor((Date.now() - callStartRef.current) / 1000))
                : 0
            )
            // Cancel any pending auto-chain dial so a new call can NEVER start
            // while you're filling out the disposition sheet. The next call only
            // begins when you submit a disposition.
            cancelAllPendingDials()
            setProfileFullscreen(false) // ensure the disposition sheet is reachable
            setStatus('ended')
            setShowDisposition(true)
          }
        }
      } catch {
        clearInterval(hangupPoll)
        activePollRef.current = null
      }
    }, 2000)
    activePollRef.current = hangupPoll
  }

  const startCallPolling = (callSid: string) => {
    const pollInterval = setInterval(async () => {
      try {
        const statusRes = await fetch(`/api/calls/check?sid=${callSid}`)
        const statusData = await statusRes.json()

        if (statusData.status === 'in-progress') {
          clearInterval(pollInterval)
          activePollRef.current = null

          // AMD says machine — skip instantly, no disposition, next lead.
          //
          // This briefly did NOT skip, on a misdiagnosis: calls were dropping
          // the moment they were answered and that was blamed on AMD
          // false-positives. The real cause was media negotiation (Telnyx
          // offering SDP without a=rtcp-mux). With that fixed, AMD is
          // demonstrably correct — and leaving the call up just meant the
          // agent read a script at a voicemail greeting and hung up by hand.
          if (isNotHuman(statusData.amd_result)) {
            const ld = currentLeadRef.current
            // ── A VOICEMAIL IS AN ATTEMPT, NOT AN EJECTION ────────────────
            // This branch rotated the lead away immediately, which quietly
            // overrode the 1x/2x/3x setting for the single most common
            // no-connect outcome there is. On 3x a lead that hit voicemail
            // got ONE dial and sank, while a lead that simply rang out got
            // three — the same rule producing opposite behaviour depending on
            // who was at the other end.
            //
            // The hangup-poll path further down already handles this
            // correctly. Same rule applied here: count the attempt, redial in
            // place while attempts remain, and only rotate once they are
            // spent. Position must not move mid-sequence.
            const effectiveMax = isPreview ? 1 : Math.min(dialRepeatCount, 3)
            const attemptsSoFar = leadAttemptCountRef.current

            if (ld && attemptsSoFar < effectiveMax) {
              leadAttemptCountRef.current = attemptsSoFar + 1
              setAmdActivity(prev =>
                [`VOICEMAIL — REDIALING (${attemptsSoFar + 1} of ${effectiveMax})`, ...prev].slice(0, 5)
              )
              showQueueOutcome(
                ld.id,
                `Voicemail — redialing (attempt ${attemptsSoFar + 1} of ${effectiveMax})…`
              )
              setActiveCallSid(null)
              disarmDialing()
              setStatus('idle')
              // Same lead, same position. No rotation until attempts are gone.
              const redialId = setTimeout(() => {
                dialChainTimeoutsRef.current.delete(redialId)
                if (abortDialingRef.current) return
                if (!availableRef.current) return
                dialLeadCall(ld)
              }, 800)
              dialChainTimeoutsRef.current.add(redialId)
              return
            }

            setAmdActivity(prev =>
              [`VOICEMAIL FILTERED — ${statusData.amd_result}`, ...prev].slice(0, 5)
            )
            showQueueOutcome(ld?.id, 'Voicemail detected…')
            // AMD skip writes NO disposition, so it never reaches
            // disposeLead — and therefore never rotated the lead out of the
            // way. The next dial 600ms later would resend the same order and
            // get the same lead back. Rotate it explicitly.
            markLeadDialedLocally(ld?.id)
            setActiveCallSid(null)
            disarmDialing() // machine — drop the browser leg; next dial re-arms
            setStatus('idle')
            setCurrentLead(null)
            leadAttemptCountRef.current = 1 // next lead starts its own count
            scheduleDial(600)
            return
          }

          if (isUndecided(statusData.amd_result)) {
            setAmdActivity(prev =>
              ['⚠ AMD COULD NOT TELL — LISTEN AND SKIP IF IT IS A MACHINE', ...prev].slice(0, 5)
            )
          }

          playPickup()
          setStatus('connected')
          setSessionStats(s => ({ ...s, connected: s.connected + 1 }))

          startHangupPolling(callSid)

        } else if (
          statusData.status === 'completed' ||
          statusData.status === 'busy' ||
          statusData.status === 'failed' ||
          statusData.status === 'no-answer' ||
          statusData.status === 'canceled'
        ) {
          clearInterval(pollInterval)
          activePollRef.current = null
          setActiveCallSid(null)

          if (isNotHuman(statusData.amd_result)) {
            setAmdActivity(prev =>
              [`VOICEMAIL FILTERED — ${statusData.amd_result}`, ...prev].slice(0, 5)
            )
          }

          const ld = currentLeadRef.current
          if (ld) {
            const isAmdHangup = isNotHuman(statusData.amd_result)

            // effectiveMax: the real cap for THIS session — the user's
            // selected 1x/2x/3x, hard-capped at 3 regardless (per
            // instruction, 3x is the maximum in a row no matter what).
            // Preview is excluded entirely — it's a manual, agent-in-the-
            // loop flow with no redial concept at all, forced to 1.
            const effectiveMax = isPreview ? 1 : Math.min(dialRepeatCount, 3)
            const attemptsSoFar = leadAttemptCountRef.current

            // AMD-DETECTED VOICEMAIL COUNTS AS AN ATTEMPT AND STILL REDIALS.
            //
            // This retry block used to sit inside 'if (!isAmdHangup)', so an
            // AMD 'machine' result skipped it entirely and fell straight
            // through to the next lead. On 3x, a lead that hit voicemail was
            // therefore dialed exactly ONCE and abandoned — the repeat
            // setting silently did nothing for the single most common
            // no-connect outcome there is, which is precisely the case it
            // exists to cover. Specified behavior: dial, hit AMD, dial
            // again, dial again, then move to the next lead.
            //
            // Voicemail is still never dispositioned (see below) — the
            // silent-skip rule is about not making the agent tag a machine,
            // not about giving that lead fewer attempts than any other.
            if (attemptsSoFar < effectiveMax) {
              // Still have retries left for this same lead — redial it
              // directly instead of dispositioning + fetching a new one.
              leadAttemptCountRef.current = attemptsSoFar + 1
              const outcomeReason = isAmdHangup
                ? 'Voicemail'
                : statusData.status === 'busy'
                  ? 'Line busy'
                  : 'No answer'
              showQueueOutcome(
                ld.id,
                `${outcomeReason} — redialing (attempt ${attemptsSoFar + 1} of ${effectiveMax})…`
              )
              setActiveCallSid(null)
              disarmDialing()
              setStatus('idle')
              // Same lead object, same id — currentLead/currentLeadRef
              // stay pointed at it, no fetchNextLead involved.
              const redialTimeoutId = setTimeout(() => {
                dialChainTimeoutsRef.current.delete(redialTimeoutId)
                if (abortDialingRef.current) return
                if (!availableRef.current) return
                dialLeadCall(ld)
              }, 800)
              dialChainTimeoutsRef.current.add(redialTimeoutId)
              return
            }

            // Attempts exhausted — done with this lead, move on.
            if (isAmdHangup) {
              // NO disposition on voicemail, deliberately — machine
              // detection is a silent skip by design, the same rule the
              // server-side AMD handler follows in
              // app/api/calls/events/route.ts. The agent is never asked to
              // tag a call they never actually had.
              showQueueOutcome(ld.id, 'Voicemail detected…')
            } else {
              showQueueOutcome(
                ld.id,
                statusData.status === 'busy' ? 'Line busy…' : 'Sorry, couldn\u2019t answer…'
              )
              await disposeLead({
                lead_id: ld.id,
                campaign_id: ld.campaign_id,
                user_id: user?.id,
                disposition: 'NO_ANSWER',
                duration: 0,
              })
            }
          }
          setStatus('idle')
          setCurrentLead(null)
          disarmDialing() // call ended without a human; next dial re-arms
          leadAttemptCountRef.current = 1 // moving to a new lead next — reset for it

          scheduleDial(800)
        }
      } catch (err) {
        clearInterval(pollInterval)
        activePollRef.current = null
      }
    }, 1500)
    activePollRef.current = pollInterval
  }

  // ── GHOST-DIAL PREVENTION: cancellable, guarded auto-chaining ────────────
  // Cancels every pending auto-chain dial. Called the moment you go offline so
  // no queued setTimeout can wake up and dial after you've stopped.
  const cancelAllPendingDials = () => {
    for (const id of dialChainTimeoutsRef.current) clearTimeout(id)
    dialChainTimeoutsRef.current.clear()
  }

  // ── AUTHORITATIVE KILL SWITCH (hard shutdown) ─────────────────────────────
  // ABORT/TERMINATE must stop EVERYTHING — the active call, any queued client
  // auto-chain dial, AND the SERVER-SIDE predictive controller that places calls
  // off the heartbeat. The previous version only flipped a 50ms client latch,
  // which did nothing about the real source of background calls: the heartbeat
  // loop kept reporting the agent as AVAILABLE, so the server kept filling lines
  // and the client auto-chain kept firing. The fix is to go UNAVAILABLE — that
  // is the one signal every dial path (client auto-chain via availableRef, and
  // the server controller via the heartbeat 'paused' state) actually respects.
  const abortDialingRef = useRef(false)

  // Schedules the next auto-chain dial, but tracked so it can be cancelled, and
  // re-checks availability when it fires. Use this everywhere instead of a bare
  // setTimeout(() => handleDial(), n).
  const scheduleDial = (delayMs: number) => {
    const id = setTimeout(() => {
      dialChainTimeoutsRef.current.delete(id)
      // Final live checks: abort latch (TERMINATE pressed) or went offline.
      if (abortDialingRef.current) return
      if (!availableRef.current) return
      // ── AND: ARE WE STILL IN A MODE THAT AUTO-CHAINS? ──────────────────
      // Read from the ref, because this closure predates any mode switch since
      // the timer was set. A chain begun in power or progressive would
      // otherwise keep dialing single-line calls after the agent moved to
      // predictive — which is exactly what produced 25 user_dial calls on a
      // predictive campaign, spaced 10-19 seconds apart, until abort.
      //
      // Predictive fans out server-side and must never be fed by this chain.
      if (dialerModeRef.current === 'predictive') return
      handleDial()
    }, delayMs)
    dialChainTimeoutsRef.current.add(id)
  }

  const handleDial = async () => {
    // ── HARD GUARD ──────────────────────────────────────────────────────────
    // The single authoritative gate: a dial may only proceed if you are
    // actively available at THIS moment. This stops "ghost dialing" — calls
    // firing from stale timers or async flows after you've gone unavailable.
    // Manual keypad dials go through handleManualDial, not here, so this does
    // not affect intentional manual dialing.
    if (!availableRef.current) return
    // Abort latch: if TERMINATE was just pressed, do not start a new call even
    // if this dial was already in flight when the latch was set.
    if (abortDialingRef.current) return

    setShowDisposition(false)
    setDisposition('')
    setNoLeads(false)

    if (!selectedCampaign) {
      setShowSelectCampaignMsg(true)
      setTimeout(() => setShowSelectCampaignMsg(false), 4000)
      return
    }

    // Past every guard — see startDialSequence for what these separate.
    armReachedRef.current++

    // Ref, not the captured isPredictive: handleDial is reached through
    // setTimeout, so the value baked into this closure can be a mode the agent
    // has already left. Getting this wrong sends a predictive campaign down the
    // single-line path and starts an auto-chain that nothing stops.
    if (dialerModeRef.current === 'predictive') {
      // ── ARM THE REF, NOT JUST THE STATE ─────────────────────────────────
      // predictive_armed is what the server gates fan-out on, and it was read
      // from React state through the heartbeat's interval closure. That state
      // is cleared by three separate effects — campaign change, scope change,
      // going offline — so between the render that armed it and the beat that
      // reports it, any of them can win. Production showed the result plainly:
      // mode predictive, state ready, allowlist 300, and predictive_armed
      // false on every single beat.
      //
      // The ref is set here, synchronously, in the same statement the agent's
      // click produced. Nothing can re-order it and no closure can capture it
      // stale. The state is still set for rendering; the ref is what the
      // heartbeat sends.
      armSetRef.current++
      predictiveEngineStartedRef.current = true
      setPredictiveEngineStarted(true)
      // The one that actually matters — the server gate.
      armedAgainstRef.current = selectedCampaign || null
      void setServerArmed(true)
      armDialing() // predictive engine running — incoming-route may bridge a human to us
      lastIncomingCallSidRef.current = null
      setAmdActivity(prev => [
        `PREDICTIVE ENGINE STARTED`,
        ...prev,
      ].slice(0, 5))
      return
    }

    if (isPreview) {
      await fetchPreviewLead()
      return
    }

    const lead = await fetchNextLead()
    if (!lead) return
    leadAttemptCountRef.current = 1
    setCurrentLead(lead)
    // Deliberately NOT rotated here. A lead that is about to be dialed must
    // stay exactly where it is, at the top, highlighted, for as long as the
    // call is up — rotating at dial time made the top row drop to the bottom
    // instantly and the agent never saw the row they were calling. Rotation
    // happens when the call ENDS; see startHangupPolling.
    await dialLeadCall(lead)
  }

  /**
   * TERMINATE CALL — end THIS call and continue the session.
   *
   * This button was wired to the old master kill switch: it
   * stopped the active call, cancelled every queued dial, cleared the abort
   * latch and dropped the agent all the way back to an inactive dialer. So
   * hanging up one call ended the whole session and the agent had to
   * re-arm to keep working — on every single call.
   *
   * "Terminate" means end the call in front of me, not end my shift. The
   * master abort still exists and is still reachable by going unavailable;
   * this button now does the thing its position in the call controls
   * implies.
   *
   * Ends with the disposition sheet when the agent was actually on the call,
   * because that outcome is worth capturing and its submit handler already
   * chains to the next lead. A call that never connected has nothing to
   * disposition, so it goes straight to the next lead.
   */
  /**
   * ABORT DIALING — stop, and stay stopped, without going offline.
   *
   * "Abort" previously routed into terminateCall(), which ends with
   * scheduleDial() for a call that never connected — so aborting a ringing
   * call hung it up and instantly dialed the next lead. There was no way to
   * actually stop: the button looked like it worked and the dialer picked
   * straight back up. That was a regression introduced when TERMINATE was
   * rewired away from the master kill switch.
   *
   * The other extreme is equally wrong: going fully offline stops everything
   * by flipping the agent UNAVAILABLE, which drops them out of the session and
   * makes going again a two-step recovery. (That teardown now lives in
   * handleSetAvailable, which is the only place it belongs.)
   *
   * What abort should mean is the state between those — not dialing, but live
   * and one click from starting. So: latch off, cancel every queued dial,
   * silence in-flight lines server-side, stop the predictive engine, and leave
   * `available` alone so the UI lands back on INITIATE DIAL SEQUENCE.
   */
  const abortDialing = async () => {
    // Latch first, so anything already mid-flight bails rather than racing us.
    abortDialingRef.current = true
    cancelAllPendingDials()
    if (activePollRef.current) {
      clearInterval(activePollRef.current)
      activePollRef.current = null
    }

    const sid = activeCallSidRef.current || activeCallSid

    // ── THE AUDIBLE CALL FIRST, ON ITS OWN ────────────────────────────────
    // These used to fire together in a Promise.all. They compete: both end up
    // as Call Control requests against the same rate limit, and the sweep can
    // issue several at once, so the one hangup the agent can actually HEAR
    // ends up queued behind housekeeping. That is the phone carrying on
    // ringing for a beat after STOP.
    //
    // Sequential, live call first. It is a single request and returns in
    // milliseconds.
    // 'skip' is the reason that triggers the compliance hold — see
    // app/api/calls/hangup/route.ts. TERMINATE sent no reason at all, so a call
    // the agent ended after two seconds was hung up at two seconds and counted
    // against the short-duration ratio, while the identical action via SKIP was
    // held to the threshold in the background.
    //
    // To the LEAD the two are the same event: the agent is leaving and is not
    // coming back. The distinction only ever meant something to the agent's own
    // UI, and it must not decide whether the line is held.
    if (sid) await hangupCall(sid, 'skip').catch(() => {})

    // Then the server sweep, NOT awaited. Predictive places lines the client
    // holds no ids for, so this still has to run — but nothing on screen
    // depends on its result, and making the UI wait for it only delays the
    // agent seeing that they have stopped. scope 'calls' silences the lines
    // without releasing claims or pausing the session.
    void fetch('/api/dialer/abort', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scope: 'calls' }),
    }).catch(err => console.error('[abort] server call sweep failed:', err))

    setPredictiveEngineStarted(false)
    predictiveEngineStartedRef.current = false
    // Explicit stop by the agent — always disarms, no guard.
    armedAgainstRef.current = null
    void setServerArmed(false)
    lastIncomingCallSidRef.current = null

    disarmDialing({ force: true })
    setStatus('idle')
    setCurrentLead(null)
    setPreviewLead(null)
    setShowDisposition(false)
    setSeconds(0)
    setActiveCallSid(null)
    activeCallSidRef.current = null
    setAmdActivity(prev => ['■ DIALING ABORTED — idle, still live', ...prev].slice(0, 5))
  }

  /**
   * Explicit "start dialing" from the agent. Clears the abort latch first.
   *
   * The latch is what makes abort stick, and it is only otherwise cleared by
   * toggling availability — so without this, pressing INITIATE DIAL SEQUENCE
   * after an abort would be silently ignored and the agent would have to go
   * offline and back on to recover. scheduleDial() still checks the latch
   * before auto-chaining, so clearing it here only ever happens because a
   * human asked to dial.
   */
  const startDialSequence = async () => {
    // ── COUNTERS, BECAUSE INFERENCE HAS RUN OUT ─────────────────────────────
    // predictive_armed has stayed false across two fixes. Everything upstream
    // of the arming line has been read and looks correct, which means reading
    // it again is not going to answer this. These three counters ride along on
    // the heartbeat and separate the possibilities outright:
    //
    //   clicks 0                     -> the button is not invoking this at all
    //   clicks > 0, reached 0        -> a guard in handleDial returns first
    //   reached > 0, armed 0         -> the predictive branch is not taken
    //   armed > 0, predictive_armed  -> something clears it after the fact
    //     still false
    armClicksRef.current++
    abortDialingRef.current = false
    await handleDial()
  }

  const terminateCall = async () => {
    const sid = activeCallSidRef.current || activeCallSid
    const agentWasOnTheCall = !!callStartRef.current

    if (activePollRef.current) {
      clearInterval(activePollRef.current)
      activePollRef.current = null
    }

    // Hang up the call this client knows about AND sweep any lines placed
    // server-side that it doesn't. In power/progressive the local hangup is
    // sufficient — there is only ever one call. Predictive fans out several
    // lines the client has no ids for, so terminating there used to leave the
    // rest ringing the lead's phone with nothing able to stop them.
    //
    // scope 'calls' silences the lines WITHOUT releasing claims or pausing
    // the session — terminate ends the call, not the shift.
    // Live call first and alone — see the note in abortDialing. Running these
    // together puts the audible hangup in a queue behind the sweep's requests.
    //
    // 'skip' here means "the agent is done — hold the lead's line if it would
    // otherwise be short", the same treatment SKIP gets. Terminate and skip
    // differ in what they mean for the LEAD, not in how the agent leaves, and
    // the agent waits on neither: the browser tears down its own audio first
    // and this request is not awaited for that reason.
    if (sid) await hangupCall(sid, 'skip').catch(() => {})

    void fetch('/api/dialer/abort', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scope: 'calls' }),
    }).catch(err => console.error('[terminate] server call sweep failed:', err))

    if (agentWasOnTheCall) {
      setLastCallDuration(elapsedSecondsSince(callStartRef.current))
      setProfileFullscreen(false) // ensure the sheet is reachable
      setStatus('ended')
      setShowDisposition(true)
      return
    }

    // Never connected — nothing to disposition, so keep the queue moving.
    setStatus('idle')
    setCurrentLead(null)
    if (isPredictive) {
      lastIncomingCallSidRef.current = null
    } else {
      scheduleDial(400)
    }
  }

  // CONTINUE was removed entirely. It was built as a companion to the 1x/2x/3x
  // repeat control — a manual "dial this lead again in place" — and both are
  // gone: the repeat count never worked outside a specific campaign, and the
  // button was shipped without being asked for. A lead that does not connect
  // comes back around when the queue rotates, which is what people wanted from
  // it. SKIP remains the single, unambiguous "give up on this one, next".

  const handleSkip = async () => {
    if (activePollRef.current) clearInterval(activePollRef.current)
    // 'skip' lets the server hold the lead's line to clear the short-duration
    // threshold. The agent does not wait for it — see hangupCall.
    if (activeCallSid) await hangupCall(activeCallSid, 'skip')
    if (currentLead) {
      await disposeLead({
        lead_id: currentLead.id,
        campaign_id: currentLead.campaign_id,
        disposition: 'SKIPPED',
        duration: Math.floor((Date.now() - (callStartRef.current || callStart)) / 1000),
        notes: notes.trim() || undefined,
        source: 'skip',
      })
    }
    setNotes('')
    setCurrentLead(null)
    setStatus('idle')

    if (isPredictive) {
      lastIncomingCallSidRef.current = null
    } else {
      scheduleDial(300)
    }
  }

  const handleDisposition = async (disp: string) => {
    if (disp === 'SKIP') { handleSkip(); return }
    setDisposition(disp)
    setSessionStats(s => ({
      ...s,
      appointments: disp === 'APPOINTMENT' ? s.appointments + 1 : s.appointments,
      closed: disp === 'CLOSED' ? s.closed + 1 : s.closed,
      dnc: disp === 'DO NOT CALL' ? s.dnc + 1 : s.dnc,
      notInterested: disp === 'NOT INTERESTED' ? s.notInterested + 1 : s.notInterested,
    }))
    if (currentLead) {
      await disposeLead({
        lead_id: currentLead.id,
        campaign_id: currentLead.campaign_id,
        disposition: disp,
        duration: Math.floor((Date.now() - (callStartRef.current || callStart)) / 1000),
        notes: notes.trim() || undefined,
        source: 'dialer',
      })
    }

    setTimeout(async () => {
      setStatus('idle')
      setShowDisposition(false)
      setDisposition('')
      setNotes('')
      setSeconds(0)
      setCurrentLead(null)

      if (isPredictive) {
        lastIncomingCallSidRef.current = null
        return
      }
      await handleDial()
    }, autoChainOnFailure ? 800 : 600)
  }

  const handleManualDial = async () => {
    if (!manualNumber) return
    setDialZoomed(false)
    setStatus('calling')
    setSessionStats(s => ({ ...s, calls: s.calls + 1 }))
    playInitiateBlip()
    armDialing() // user pressed dial on the keypad — allow bridge
    // Same agent-leg window as the queue dial path — a manual dial places an
    // agent leg exactly the same way, so it needs the same protection against
    // the browser rejecting its own INVITE.
    openAgentLegWindow()
    callStartRef.current = 0 // see the queue dial path for why this must reset
    try {
      const res = await fetch('/api/calls/outbound', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: manualNumber }),
      })
      const data = await res.json()
      if (data.success) {
        setActiveCallSid(data.callSid)
        startCallPolling(data.callSid)
      } else {
        if (res.status === 403) {
          setTier('lapsed')
          return
        }
        if (res.status === 451) {
          alert(`Cannot dial: ${data.detail}\n\nLocal time at destination: ${data.leadLocalTime || 'unknown'}`)
          setStatus('idle')
          return
        }
        console.error('Manual dial failed:', res.status, data)
        alert(`Call failed${data?.error ? ` — ${data.error}` : ''}${data?.detail ? `\n\n${data.detail}` : ''}`)
        setStatus('idle')
      }
    } catch {
      setStatus('idle')
    }
  }

  const handleKeypad = (key: string) => {
    if (manualNumber.length < 14) {
      setManualNumber(prev => prev + key)
      playDTMF(key)
    }
  }

  const handleBackspace = () => setManualNumber(prev => prev.slice(0, -1))

  useEffect(() => {
    if (!isActive) return
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement?.tagName
      if (activeEl === 'INPUT' || activeEl === 'TEXTAREA' || activeEl === 'SELECT') return
      if (e.key >= '0' && e.key <= '9') handleKeypad(e.key)
      if (e.key === '*' || e.key === '#') handleKeypad(e.key)
      if (e.key === 'Backspace') handleBackspace()
      if (e.key === 'Enter' && manualNumber) handleManualDial()
      if (e.key === 'Escape' && dialZoomed) setDialZoomed(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [manualNumber, status, dialZoomed, isActive])

  /**
   * Write a mode onto a campaign and reflect it locally.
   *
   * Split out of handleModeChange because two paths now need it: an ordinary
   * switch on the selected campaign, and the auto-select below that moves the
   * agent onto a campaign so predictive can actually run.
   */
  const persistModeToCampaign = async (
    campaignId: string,
    newMode: DialerMode
  ): Promise<boolean> => {
    // Preview never runs detection — the agent chose this lead and is
    // watching it answer. Power is single-line and connects instantly, so a
    // detector has nothing useful to add either. Progressive and predictive
    // are the modes where the dialer is moving faster than the agent can
    // watch, which is where AMD earns its place.
    const amd = newMode === 'progressive' || newMode === 'predictive'
    const res = await fetch('/api/campaigns/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: campaignId, dialer_mode: newMode, amd_enabled: amd }),
    })
    const data = await res.json()
    if (!data.success) {
      console.error('[dialer] mode change rejected:', data.error)
      setAmdActivity(prev => [
        `MODE CHANGE FAILED — STILL ${dialerMode.toUpperCase()}${data.error ? ` (${String(data.error).toUpperCase()})` : ''}`,
        ...prev,
      ].slice(0, 5))
      return false
    }
    setCampaigns(prev => prev.map(c =>
      c.id === campaignId ? { ...c, dialer_mode: newMode, amd_enabled: amd } : c
    ))
    return true
  }

  const handleModeChange = async (newMode: DialerMode) => {
    if (newMode === dialerMode) {
      setModeDropdownOpen(false)
      return
    }

    if (isAllActive) {
      // ── PREDICTIVE FROM "ALL ACTIVE" ─────────────────────────────────────
      // Predictive genuinely cannot run across every campaign at once: the
      // controller fans out within ONE campaign's lead pool and enforces that
      // campaign's line cap and abandon rate, and the heartbeat sends
      // campaign_id: null in this scope — so it declines on every beat.
      //
      // Refusing was correct and useless. The agent picked predictive, was
      // told no, and the only way forward was to leave the dialer, open
      // Campaigns, change the mode there and come back. So: if the choice is
      // unambiguous, make it for them.
      if (newMode === 'predictive') {
        const activeCampaigns = campaigns.filter(c => c.status === 'active')

        if (activeCampaigns.length === 1) {
          const only = activeCampaigns[0]
          setModeSaving(true)
          try {
            const ok = await persistModeToCampaign(only.id, 'predictive')
            if (ok) {
              // Move the agent onto it as well — predictive on a campaign
              // they are not looking at would be its own kind of confusing.
              setSelectedCampaign(only.id)
              setAmdActivity(prev => [
                `PREDICTIVE ON "${only.name.toUpperCase()}" — SWITCHED FROM ALL ACTIVE`,
                ...prev,
              ].slice(0, 5))
            }
          } finally {
            setModeSaving(false)
            setModeDropdownOpen(false)
          }
          return
        }

        // More than one active campaign, so there is nothing to infer — but
        // say which ones rather than just refusing.
        setModeDropdownOpen(false)
        setAmdActivity(prev => [
          activeCampaigns.length === 0
            ? 'PREDICTIVE NEEDS AN ACTIVE CAMPAIGN — NONE ARE ACTIVE'
            : `PREDICTIVE NEEDS ONE CAMPAIGN — PICK ONE OF ${activeCampaigns.length} ABOVE`,
          ...prev,
        ].slice(0, 5))
        return
      }

      // The other three modes run fine across All Active, and this override is
      // client-side by design: writing the mode onto every active campaign
      // because someone changed it once in this scope would silently rewrite
      // settings they never opened.
      setAllActiveOverrideMode(newMode)
      setModeDropdownOpen(false)
      setAmdActivity(prev => [
        `MODE SET TO ${newMode.toUpperCase()} FOR ALL ACTIVE (THIS SESSION)`,
        ...prev,
      ].slice(0, 5))
      return
    }

    if (!currentCampaign) {
      // No campaign at all — previously this closed the dropdown and said
      // nothing, which looks identical to the click not registering.
      setModeDropdownOpen(false)
      setAmdActivity(prev => [
        'PICK A CAMPAIGN BEFORE CHANGING MODE',
        ...prev,
      ].slice(0, 5))
      return
    }

    setModeSaving(true)
    try {
      const ok = await persistModeToCampaign(currentCampaign.id, newMode)
      if (ok) {
        setAmdActivity(prev => [`MODE SET TO ${newMode.toUpperCase()}`, ...prev].slice(0, 5))
      }
    } catch (err) {
      console.error('Mode change failed:', err)
      setAmdActivity(prev => [
        `MODE CHANGE FAILED — STILL ${dialerMode.toUpperCase()}`,
        ...prev,
      ].slice(0, 5))
    } finally {
      setModeSaving(false)
      setModeDropdownOpen(false)
    }
  }

  // Persists the 1x/2x/3x redial selection to the campaign — required for
  // predictive, which resolves calls entirely server-side (see
  // bumpLeadAttemptAndRelease in app/api/calls/events/route.ts) and has no
  // access to this page's React state at all. Power/Progressive/Preview
  // enforce the setting directly client-side regardless, but persisting it
  // here too keeps the selector consistent across a page reload and across
  // modes for the same campaign.
  const handleDialRepeatChange = async (n: 1 | 2 | 3) => {
    setDialRepeatCount(n) // update immediately — don't block the UI on the network round trip
    if (!currentCampaign) return // "All Active Campaigns" has no single campaign to persist to
    try {
      await fetch('/api/campaigns/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: currentCampaign.id,
          dial_repeat_count: n,
        }),
      })
      setCampaigns(prev => prev.map(c =>
        c.id === currentCampaign.id ? { ...c, dial_repeat_count: n } : c
      ))
    } catch (err) {
      console.error('Dial repeat count change failed:', err)
    }
  }

  useEffect(() => {
    if (!modeDropdownOpen) return
    const onDoc = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('.mode-tile-wrap')) {
        setModeDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [modeDropdownOpen])

  const nameKeys = ['name', 'first_name', 'last_name', 'full_name', 'fname', 'lname', 'firstname', 'lastname']
  const filteredExtraData = (data: Record<string, any>) => {
    return Object.entries(data).filter(([k, v]) =>
      v && String(v).trim() && !nameKeys.some(n => k.toLowerCase().replace(/[^a-z]/g, '') === n.replace(/[^a-z]/g, ''))
    )
  }

  const dispositions = [
    { label: 'CLOSED', color: '#16a34a', bg: '#dcfce7' },
    { label: 'APPOINTMENT', color: '#2563eb', bg: '#dbeafe' },
    { label: 'NOT INTERESTED', color: '#d97706', bg: '#fef3c7' },
    { label: 'DO NOT CALL', color: '#dc2626', bg: '#fee2e2' },
    { label: 'SKIP', color: '#64748b', bg: '#f1f5f9' },
  ]

  // Build the raw set of script tabs from each campaign's enabled scripts
  // (new global-library model). Each tab key is the script id; for ALL ACTIVE
  // we show every enabled script across active campaigns. Falls back to the
  // legacy single `script` field if a campaign has no linked scripts yet.
  const campaignScriptTabs = (c: Campaign): { key: string; name: string; script: string }[] => {
    if (c.scripts && c.scripts.length > 0) {
      // Sort by the campaign's own script order EXPLICITLY. This is the order
      // the user sets by dragging the script chips on the campaign (which
      // writes campaign_script_links.sort_order). Relying on the array's
      // arrival order made that a coincidence of query ordering rather than a
      // guarantee. The agent's manual drag in the dialer still overrides this
      // — see scriptOrder below, which is reset per campaign so the campaign's
      // order is always the starting point.
      return [...c.scripts]
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
        .map(s => ({ key: s.id, name: s.name, script: s.body }))
    }
    if (c.script) return [{ key: c.id, name: c.name, script: c.script }]
    return []
  }

  let rawScriptTabs: { key: string; name: string; script: string }[] = []
  if (isSpecificCampaign && currentCampaign) {
    rawScriptTabs = campaignScriptTabs(currentCampaign)
  } else if (isAllActive && isPersonalScope) {
    // ── ALL ACTIVE: FOLLOW THE LEAD, NOT THE UNION ───────────────────────
    // Each campaign decides independently which scripts are on and in what
    // order, so under ALL ACTIVE the only correct answer is "whatever the
    // campaign THIS lead belongs to says". Showing the union of every active
    // campaign's scripts — the previous behaviour — handed the agent tabs
    // belonging to campaigns the person on the phone has nothing to do with,
    // in an order no campaign actually chose.
    const leadCampaign = currentLead?.campaign_id
      ? campaigns.find(c => c.id === currentLead.campaign_id)
      : undefined

    if (leadCampaign) {
      rawScriptTabs = campaignScriptTabs(leadCampaign)
    } else {
      // No lead up yet (idle, between calls, or a manual dial with no
      // campaign). Falling back to the union keeps the panel populated so an
      // agent can read a script before the first lead loads, rather than
      // staring at an empty box.
      const seen = new Set<string>()
      for (const c of campaigns) {
        if (c.status !== 'active') continue
        for (const t of campaignScriptTabs(c)) {
          if (seen.has(t.key)) continue
          seen.add(t.key)
          rawScriptTabs.push(t)
        }
      }
    }
  }

  // Apply the user's custom drag order: keys present in scriptOrder come first
  // (in that order), any new/unordered tabs keep their natural order at the end.
  // HARDENING: a stale scriptOrder (keys that no longer exist after a campaign
  // refresh) must never cause tabs to disappear. We always append every raw tab
  // that wasn't placed by the order, and if the result is somehow empty we fall
  // back to the raw tabs. This fixes tabs vanishing on drag/click until refresh.
  const scriptTabs = (() => {
    if (rawScriptTabs.length === 0) return rawScriptTabs
    if (scriptOrder.length === 0) return rawScriptTabs
    const byKey = new Map(rawScriptTabs.map(t => [t.key, t]))
    const ordered: typeof rawScriptTabs = []
    for (const k of scriptOrder) {
      const t = byKey.get(k)
      if (t) { ordered.push(t); byKey.delete(k) }
    }
    for (const t of rawScriptTabs) {
      if (byKey.has(t.key)) ordered.push(t)
    }
    return ordered.length > 0 ? ordered : rawScriptTabs
  })()

  const activeScriptIdx = scriptIdx < scriptTabs.length ? scriptIdx : 0
  // NOTE: ?? not || — an empty saved script body ('') is different from "no
  // script exists." || treated them the same, collapsing activeScript to
  // null whenever the selected tab's script happened to be blank. Since the
  // render below keys the whole box (tabs included) off activeScript, one
  // blank script anywhere in the tab order silently hid every other tab too.
  const activeScript = scriptTabs[activeScriptIdx]?.script ?? null

  // Reorder helper: move the dragged tab key to the position of the target key.
  const reorderScriptTabs = (dragKey: string, targetKey: string) => {
    if (dragKey === targetKey) return
    const base = scriptTabs.map(t => t.key)
    const from = base.indexOf(dragKey)
    const to = base.indexOf(targetKey)
    if (from === -1 || to === -1) return
    const next = [...base]
    next.splice(from, 1)
    next.splice(to, 0, dragKey)
    setScriptOrder(next)
    // Keep the active tab pointing at the same script after a reorder.
    const activeKey = scriptTabs[activeScriptIdx]?.key
    if (activeKey) {
      const newIdx = next.indexOf(activeKey)
      if (newIdx !== -1) setScriptIdx(newIdx)
    }
  }

  const terminalBg = 'var(--brand-page-bg)'
  const terminalSurface = 'var(--brand-card-surface)'
  const terminalBorder = 'var(--brand-card-border)'
  const terminalDark = 'var(--brand-sidebar-bg)'
  const terminalText = 'var(--brand-on-page-bg)'
  const terminalMuted = 'var(--brand-muted-text)'
  const terminalAccent = '#2a4a8a'
  const terminalGreen = '#1a6a1a'
  const terminalRed = '#8a1a1a'
  const terminalAmber = '#8a6a1a'

  const modeColor = isPredictive ? terminalRed
    : isProgressive ? terminalGreen
    : isPreview ? terminalMuted
    : terminalAccent

  const connectedRate = sessionStats.calls > 0
    ? ((sessionStats.connected / sessionStats.calls) * 100).toFixed(0) + '%'
    : '—'

  if (tierLoaded && !isActive) {
    return (
      <div style={{
        flex: 1, background: terminalBg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24, minHeight: 'calc(100vh - 64px)',
        fontFamily: FUTURA,
      }}>
        <div style={{
          width: '100%', maxWidth: 520,
          background: terminalDark, border: `1px solid ${terminalBorder}`,
          borderTop: `3px solid #ffaa3e`, borderRadius: 4, padding: 36,
          color: 'var(--brand-on-sidebar)', textAlign: 'center', boxSizing: 'border-box',
        }}>
          <div style={{ fontSize: 56, marginBottom: 16, opacity: 0.85 }}>📞</div>
          <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: 5, color: '#ffaa3e', marginBottom: 12 }}>
            SUBSCRIBE TO DIAL
          </div>
          <div style={{ fontSize: 12, lineHeight: 1.7, color: 'var(--brand-on-sidebar-muted)', letterSpacing: 1, marginBottom: 28 }}>
            {tier === 'lapsed'
              ? 'Your subscription has lapsed. Resubscribe to restore dialing access. Your leads, recordings, and campaigns are still here waiting for you.'
              : 'An active subscription is required to make outbound calls.'}
          </div>
          <Link href="/billing" style={{
            display: 'block', padding: '16px 28px',
            background: 'linear-gradient(135deg, var(--brand-primary), color-mix(in srgb, var(--brand-primary) 75%, black))',
            border: 'none', borderRadius: 4, color: 'var(--brand-on-primary)',
            fontSize: 13, fontWeight: 700, letterSpacing: 4,
            textDecoration: 'none', boxShadow: '0 0 20px color-mix(in srgb, var(--brand-primary) 30%, transparent)',
            marginBottom: 16, fontFamily: FUTURA,
          }}>RESUBSCRIBE — $35/WEEK</Link>
          <div style={{ fontSize: 9, letterSpacing: 3, color: 'var(--brand-on-sidebar-muted)', marginBottom: 24 }}>
            NO CONTRACTS · CANCEL ANYTIME
          </div>
          <div style={{
            paddingTop: 20, borderTop: '1px solid var(--brand-sidebar-active-bg)',
            display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap',
          }}>
            <Link href="/dashboard/leads" style={navLinkStyle}>VIEW LEADS</Link>
            <Link href="/dashboard/recordings" style={navLinkStyle}>RECORDINGS</Link>
            <Link href="/dashboard/analytics" style={navLinkStyle}>ANALYTICS</Link>
          </div>
        </div>
      </div>
    )
  }

  if (!tierLoaded) {
    return (
      <div style={{
        flex: 1, background: terminalBg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        minHeight: 'calc(100vh - 64px)',
        fontFamily: FUTURA,
      }}>
        <div style={{ fontSize: 11, letterSpacing: 4, color: terminalMuted }}>LOADING TERMINAL...</div>
      </div>
    )
  }

  const displayLead = previewLead || currentLead

  const ManualDialer = ({ inOverlay = false }: { inOverlay?: boolean }) => (
    <>
      <div style={{
        background: terminalDark, padding: inOverlay ? '14px 20px' : '8px 16px',
        borderBottom: `1px solid ${terminalBorder}`, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{
          fontSize: inOverlay ? '11px' : '9px', letterSpacing: '3px',
          color: 'var(--brand-on-sidebar-muted)', fontWeight: 'bold',
        }}>MANUAL DIAL</span>
        <button
          onClick={() => setDialZoomed(!inOverlay)}
          aria-label={inOverlay ? 'Close fullscreen dialer' : 'Open fullscreen dialer'}
          style={{
            background: 'transparent', border: '1px solid var(--brand-sidebar-active-bg)', borderRadius: 4,
            color: 'var(--brand-on-sidebar-muted)', width: 28, height: 28,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', fontSize: 14, fontWeight: 'bold', padding: 0,
          }}
        >{inOverlay ? '×' : '⛶'}</button>
      </div>

      <div style={{
        padding: inOverlay ? '20px 24px' : '12px',
        background: terminalBg, flex: 1,
        display: 'flex', flexDirection: 'column',
        maxWidth: inOverlay ? 480 : 'none',
        margin: inOverlay ? '0 auto' : 0,
        width: inOverlay ? '100%' : 'auto',
        boxSizing: 'border-box',
        overflowY: inOverlay ? 'auto' : 'visible',
        paddingBottom: inOverlay ? 'calc(20px + env(safe-area-inset-bottom, 0px))' : 12,
      }}>
        <div style={{
          background: terminalSurface, border: `1px solid ${terminalBorder}`, borderRadius: '4px',
          padding: inOverlay ? '20px 16px' : '10px 12px',
          fontFamily: 'monospace', fontSize: inOverlay ? '32px' : '18px',
          fontWeight: 'bold', color: manualNumber ? terminalText : terminalMuted,
          letterSpacing: '3px', textAlign: 'center',
          marginBottom: inOverlay ? '20px' : '10px',
          minHeight: inOverlay ? '64px' : '44px',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          {manualNumber || '_ _ _ _ _ _ _ _'}
        </div>

        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
          gap: inOverlay ? '12px' : '6px', marginBottom: inOverlay ? '12px' : '6px',
          flex: inOverlay ? '0 0 auto' : 1,
        }}>
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'].map((key) => (
            <button key={key} onClick={() => handleKeypad(key)} style={{
              borderRadius: '3px', background: terminalSurface,
              border: `1px solid ${terminalBorder}`, borderBottom: `3px solid ${terminalBorder}`,
              color: terminalText, fontSize: inOverlay ? '28px' : '16px',
              fontWeight: 'bold', cursor: 'pointer', fontFamily: 'monospace',
              transition: 'all 0.05s', padding: inOverlay ? '20px 0' : '12px 0',
              minHeight: inOverlay ? 64 : 'auto',
            }}>{key}</button>
          ))}
        </div>

        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 2fr',
          gap: inOverlay ? '12px' : '6px', flexShrink: 0,
        }}>
          <button onClick={handleBackspace} style={{
            padding: inOverlay ? '20px' : '12px', borderRadius: '3px',
            background: terminalSurface, border: `1px solid ${terminalBorder}`,
            borderBottom: `3px solid ${terminalBorder}`, color: terminalMuted,
            fontSize: inOverlay ? '24px' : '16px', cursor: 'pointer',
          }}>⌫</button>
          <button onClick={handleManualDial} disabled={!manualNumber} style={{
            padding: inOverlay ? '20px' : '12px', borderRadius: '3px', border: 'none',
            background: manualNumber ? terminalDark : terminalSurface,
            borderBottom: `3px solid ${manualNumber ? 'var(--brand-primary)' : terminalBorder}`,
            color: manualNumber ? 'var(--brand-primary)' : terminalMuted,
            fontSize: inOverlay ? '14px' : '11px', fontWeight: 'bold', letterSpacing: '2px',
            cursor: manualNumber ? 'pointer' : 'not-allowed',
            fontFamily: FUTURA,
          }}>DIAL</button>
        </div>
      </div>
    </>
  )

  // Small inline metrics strip — reuses the same numbers the old
  // predictive-only "AVAILABLE" card showed (lines in flight, connected
  // today, 30-day abandon rate), now surfaced inside LeadQueuePanel's header
  // for predictive campaigns once dialing is armed, instead of replacing the
  // row view entirely.
  const QueueStatsStrip = () => {
    const linesActive = lastControllerSummary?.inFlight ?? 0
    const linesTarget = linesPref?.effective_lines || pacingInfo?.configuredLines || 3
    return (
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', padding: '0 14px 10px' }}>
        <div style={{ textAlign: 'left' }}>
          <div style={{ fontSize: 8, letterSpacing: 2, color: terminalMuted, fontFamily: FUTURA }}>LINES IN FLIGHT</div>
          <div style={{ fontSize: 16, fontFamily: 'monospace', fontWeight: 'bold', color: terminalText }}>
            {linesActive} / {linesTarget}
          </div>
        </div>
        <div style={{ textAlign: 'left' }}>
          <div style={{ fontSize: 8, letterSpacing: 2, color: terminalMuted, fontFamily: FUTURA }}>CONNECTED TODAY</div>
          <div style={{ fontSize: 16, fontFamily: 'monospace', fontWeight: 'bold', color: terminalAccent }}>
            {sessionStats.connected}
          </div>
        </div>
        <div style={{ textAlign: 'left' }}>
          <div style={{ fontSize: 8, letterSpacing: 2, color: terminalMuted, fontFamily: FUTURA }}>30D ABANDON</div>
          <div style={{
            fontSize: 16, fontFamily: 'monospace', fontWeight: 'bold',
            color: pacingInfo && pacingInfo.abandonRate >= 0.025 ? terminalRed
              : pacingInfo && pacingInfo.abandonRate >= 0.020 ? terminalAmber : terminalGreen,
          }}>
            {pacingInfo ? `${(pacingInfo.abandonRate * 100).toFixed(2)}%` : '—'}
          </div>
        </div>
      </div>
    )
  }

  // ===========================================================================
  // LEAD QUEUE PANEL — live, row-by-row view of the actual dialing queue
  // ===========================================================================
  // What this is: the visual replacement for "trust that something is
  // happening in the background." Every uncalled lead in the campaign is
  // rendered as its own row, and whichever row(s) are ACTUALLY being dialed
  // right now light up -- accurately, per dialer mode, not simulated:
  //
  //   PREDICTIVE  -- activeDialingNumbers comes straight from the heartbeat
  //                 controller's real dialedPhones for this tick, so however
  //                 many lines the campaign is actually set to fire at once
  //                 (2, 3, 5...) light up together, simultaneously, matching
  //                 what Telnyx is really doing right now.
  //   POWER /
  //   PROGRESSIVE /
  //   PREVIEW     -- exactly one row lights up: whichever lead matches
  //                 currentLead (actively dialing/connected) or previewLead
  //                 (loaded, about to be dialed). Matched by lead id, never by
  //                 list position -- fetchNextLead can return any lead in the
  //                 pool, not necessarily row #1, so a position-based guess
  //                 would misrepresent which row is really live.
  //
  // Mounted the moment the agent is available and no call is connected yet
  // (idle, previewing, or calling), and unmounted the instant status flips to
  // 'connected' -- the parent's existing displayLead branch already swaps to
  // the lead-profile/script view at that point, so this panel just needs to
  // get out of the way, which it does via the fade/collapse below rather than
  // a hard cut.
  //
  // INACTIVE vs DIALING: before the agent presses INITIATE DIAL SEQUENCE
  // (non-predictive) or the predictive engine is armed, the table renders but
  // every row sits at plain "Upcoming" — no highlighting, nothing pulses.
  // Highlighting only turns on once dialing has genuinely started
  // (isQueueDialingArmed below), so the panel never claims something is
  // happening before it actually is.
  //
  // Note: this panel is only ever mounted while status is 'idle' or
  // 'calling' (the center-panel branch below swaps to the lead-profile/
  // script card the instant status becomes 'connected' or 'preview_ready',
  // so those two states never actually reach here — 'calling' is the only
  // "in progress" state this component itself will ever see).
  const isQueueDialingArmed = isPredictive
    ? predictiveEngineStarted
    : status === 'calling'

  const activeQueueNumbers: string[] = isQueueDialingArmed
    ? (isPredictive
        ? activeDialingNumbers
        : [currentLead?.phone, previewLead?.phone].filter((p): p is string => !!p))
    : []

  // ── PHONE MATCHING MUST BE FORMAT-AGNOSTIC ────────────────────────────────
  // activeDialingNumbers comes from calls.phone_number, which is E.164
  // ("+13365925053"). lead.phone is whatever was imported, typically bare
  // digits ("3852821027"). A plain includes() between those two never matches,
  // so predictive row highlighting could not work at all — it was comparing
  // two different notations for the same number.
  //
  // Compared on the last 10 digits, which is the part that identifies a US
  // subscriber regardless of +1 / 1 / punctuation on either side.
  const activeDialingKeys = new Set(
    activeDialingNumbers.map(p => (p || '').replace(/\D/g, '').slice(-10)).filter(Boolean)
  )
  const leadPhoneKey = (phone?: string | null) => (phone || '').replace(/\D/g, '').slice(-10)

  // ── HIGHLIGHT BY LEAD ID ────────────────────────────────────────────────
  // Predictive highlighting used to match rows by PHONE NUMBER (last 10
  // digits). That is only correct while every lead has a distinct number.
  // Repeat a number across leads — a test list, a shared household line, one
  // business number on several contacts — and dialing ONE of them lit up
  // EVERY row carrying that number. On a list where all the numbers are the
  // same, the entire panel highlighted.
  //
  // The controller knows exactly which LEADS are in flight (it selects
  // lead_id on the in-flight query), so it now reports inFlightLeadIds and
  // this matches on identity instead of on a telephone. Exactly N rows light
  // up for N lines, which is what "3 lines highlights the top 3" requires.
  const activeQueueLeadIds = new Set(
    isQueueDialingArmed
      ? (isPredictive
          ? activeDialingLeadIds
          : [currentLead?.id, previewLead?.id].filter((id): id is string => !!id))
      : []
  )

  const LeadQueuePanel = () => {
    const dialingCount = activeQueueNumbers.length
    return (
      <div className="dialer-queue-panel dialer-queue-panel-enter" style={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 }}>
        <style>{`
          @keyframes queuePanelFadeIn {
            0% { opacity: 0; transform: translateY(-6px); }
            100% { opacity: 1; transform: translateY(0); }
          }
          @keyframes queueRowPulse {
            0%, 100% { background: rgba(42, 74, 138, 0.10); }
            50% { background: rgba(42, 74, 138, 0.20); }
          }
          .dialer-queue-panel-enter { animation: queuePanelFadeIn 0.25s ease; }
          .dialer-queue-row-active { animation: queueRowPulse 1.6s ease-in-out infinite; }
          .dialer-queue-row { transition: background 0.2s ease, border-color 0.2s ease, opacity 0.2s ease; overflow: hidden; }
          .dialer-queue-search-input::placeholder { color: ${terminalMuted}; }
          .dialer-queue-scroll {
            scrollbar-width: thin;
            scrollbar-color: ${terminalBorder} transparent;
          }
          .dialer-queue-scroll::-webkit-scrollbar {
            width: 10px;
          }
          .dialer-queue-scroll::-webkit-scrollbar-track {
            background: transparent;
          }
          .dialer-queue-scroll::-webkit-scrollbar-thumb {
            background-color: ${terminalMuted};
            border-radius: 5px;
            border: 2px solid ${terminalSurface};
          }
          .dialer-queue-scroll::-webkit-scrollbar-thumb:hover {
            background-color: ${terminalText};
          }
          .dialer-queue-btn {
            display: flex; align-items: center; gap: 6px;
            padding: 7px 12px; border-radius: 3px;
            background: transparent; cursor: pointer;
            font-family: ${FUTURA}; font-size: 10px; font-weight: bold; letter-spacing: 2px;
            transition: opacity 0.15s ease, background 0.15s ease;
          }
          .dialer-queue-btn:active { opacity: 0.7; }
          .dialer-queue-btn:disabled { cursor: default; opacity: 0.5; }
          .dialer-repeat-btn {
            font-family: ${FUTURA}; font-size: 11px; font-weight: bold;
            padding: 5px 9px; border-radius: 3px; cursor: pointer;
            transition: opacity 0.15s ease, background 0.15s ease;
          }
          .dialer-repeat-btn:disabled { cursor: default; opacity: 0.45; }
          .dialer-repeat-help {
            position: relative; display: inline-flex; align-items: center;
            justify-content: center; width: 15px; height: 15px; border-radius: 50%;
            border: 1px solid ${terminalMuted}; color: ${terminalMuted};
            font-size: 9px; font-weight: bold; cursor: default; user-select: none;
          }
          .dialer-repeat-help .dialer-repeat-tooltip {
            visibility: hidden; opacity: 0;
            position: absolute; top: calc(100% + 8px); left: 0;
            width: 220px; padding: 8px 10px; border-radius: 4px;
            background: ${terminalDark}; color: #fff;
            font-size: 10px; font-weight: normal; letter-spacing: 0.2px; line-height: 1.5;
            box-shadow: 0 4px 14px rgba(0,0,0,0.2);
            transition: opacity 0.15s ease; z-index: 6;
          }
          .dialer-repeat-help:hover .dialer-repeat-tooltip { visibility: visible; opacity: 1; }
          .dialer-queue-head-row {
            display: grid; grid-template-columns: 90px 130px 1fr 1fr 70px; gap: 10px;
          }
          .dialer-queue-head-row.no-status { grid-template-columns: 130px 1fr 1fr 70px; }
          @media (max-width: 640px) {
            .dialer-queue-controls { flex-direction: column; align-items: stretch !important; }
            .dialer-queue-head-row, .dialer-queue-row-grid {
              grid-template-columns: 1fr 1fr !important;
              row-gap: 4px;
            }
            .dialer-queue-head-row .dq-col-status, .dialer-queue-row-grid .dq-col-status { display: none; }
            .dialer-queue-head-row .dq-col-state, .dialer-queue-row-grid .dq-col-state { display: block; }
            .dialer-queue-row-mobile-status {
              display: flex !important;
            }
          }
          .dialer-queue-row-mobile-status { display: none; }
        `}</style>

        {/* ── CONTROLS ROW — FILTER (far right), outline-style to match the rest of dialerseat (leads page filter bar, etc.) ────── */}
        <div className="dialer-queue-controls" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '14px 16px 12px', flexShrink: 0, borderBottom: `1px solid ${terminalBorder}` }}>
          {/* The 1x/2x/3x repeat selector and its ? tooltip lived here and were
              removed. They never worked correctly — the count only synced when
              a specific campaign was selected, so All Active silently sat at 1
              — and a control that claims to do something it does not is worse
              than no control. Leads that do not connect come back around when
              the queue rotates, which is the behaviour people actually wanted
              from it. */}

          {isQueueDialingArmed && (
            <span style={{
              fontSize: 10, fontWeight: 'bold', letterSpacing: 1.5, fontFamily: FUTURA,
              color: terminalAccent,
            }}>
              ● DIALING {dialingCount || 1} LINE{dialingCount === 1 || dialingCount === 0 ? '' : 'S'}
            </span>
          )}

          <div style={{ flex: 1 }} />

          <div ref={queueFilterRef} style={{ position: 'relative' }}>
            <button
              className="dialer-queue-btn"
              onClick={() => setQueueFilterOpen(v => !v)}
              style={{
                border: `1px solid ${isQueueFiltered ? terminalAccent : terminalBorder}`,
                color: isQueueFiltered ? terminalAccent : terminalText,
                background: isQueueFiltered ? 'rgba(42, 74, 138, 0.08)' : 'transparent',
              }}
            >
              ▾ FILTER{isQueueFiltered ? ' •' : ''}
            </button>
            {queueFilterOpen && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 5,
                background: terminalSurface, border: `1px solid ${terminalBorder}`, borderRadius: 4,
                padding: 12, minWidth: 230, boxShadow: '0 8px 24px rgba(0,0,0,0.16)',
                display: 'flex', flexDirection: 'column', gap: 10,
              }}>
                <div>
                  <div style={{ fontSize: 9, letterSpacing: 1.5, color: terminalMuted, marginBottom: 5, fontFamily: FUTURA, fontWeight: 'bold' }}>SEARCH NAME / PHONE</div>
                  <input
                    autoFocus
                    className="dialer-queue-search-input"
                    value={queueSearch}
                    onChange={(e) => setQueueSearch(e.target.value)}
                    placeholder="e.g. Arlene or (447)…"
                    style={{
                      width: '100%', padding: '7px 9px', borderRadius: 3,
                      border: `1px solid ${terminalBorder}`, background: terminalBg,
                      color: terminalText, fontFamily: FUTURA, fontSize: 12, outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
                <div>
                  <div style={{ fontSize: 9, letterSpacing: 1.5, color: terminalMuted, marginBottom: 5, fontFamily: FUTURA, fontWeight: 'bold' }}>STATE</div>
                  <input
                    className="dialer-queue-search-input"
                    value={queueStateFilter}
                    onChange={(e) => setQueueStateFilter(e.target.value.toUpperCase())}
                    placeholder="e.g. TX"
                    maxLength={4}
                    style={{
                      width: '100%', padding: '7px 9px', borderRadius: 3,
                      border: `1px solid ${terminalBorder}`, background: terminalBg,
                      color: terminalText, fontFamily: FUTURA, fontSize: 12, outline: 'none',
                      boxSizing: 'border-box', textTransform: 'uppercase',
                    }}
                  />
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, letterSpacing: 0.5, color: terminalMuted, cursor: 'pointer', fontFamily: FUTURA }}>
                  <input type="checkbox" checked={queueSortDesc} onChange={(e) => setQueueSortDesc(e.target.checked)} />
                  NEWEST LEADS FIRST
                </label>

                <div style={{ borderTop: `1px solid ${terminalBorder}`, paddingTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <button
                    className="dialer-queue-btn"
                    onClick={() => setQueueShuffleSeed(Math.floor(Math.random() * 2147483647) || 1)}
                    title="Randomize the order of the currently visible rows — also changes dialing priority: leads earlier in the shuffled order are dialed first"
                    style={{
                      border: `1px solid ${queueShuffleSeed !== 0 ? terminalAccent : terminalBorder}`,
                      color: queueShuffleSeed !== 0 ? terminalAccent : terminalText,
                      background: queueShuffleSeed !== 0 ? 'rgba(42, 74, 138, 0.08)' : 'transparent',
                      fontSize: 9, padding: '6px 10px',
                    }}
                  >
                    ⇄ SHUFFLE
                  </button>
                  {queueShuffleSeed !== 0 && (
                    <button
                      onClick={() => setQueueShuffleSeed(0)}
                      style={{
                        background: 'none', border: 'none', padding: 0,
                        color: terminalMuted, fontFamily: FUTURA, fontSize: 9, letterSpacing: 0.5,
                        cursor: 'pointer', textDecoration: 'underline',
                      }}
                    >
                      UNSHUFFLE
                    </button>
                  )}
                </div>

                {isQueueFiltered && (
                  <div style={{ fontSize: 10, color: terminalMuted, fontFamily: FUTURA, lineHeight: 1.5 }}>
                    Only leads matching this filter will be dialed{isPredictive ? ' in Power/Progressive/Preview modes' : ''}.
                  </div>
                )}
                {(queueSearch || queueStateFilter || queueSortDesc || queueShuffleSeed !== 0) && (
                  <button
                    onClick={() => { setQueueSearch(''); setQueueStateFilter(''); setQueueSortDesc(false); setQueueShuffleSeed(0) }}
                    style={{
                      alignSelf: 'flex-start', background: 'none', border: 'none', padding: 0,
                      color: terminalRed, fontFamily: FUTURA, fontSize: 10, letterSpacing: 0.5,
                      fontWeight: 'bold', cursor: 'pointer', textDecoration: 'underline',
                    }}
                  >
                    RESET FILTERS
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {isPredictive && isQueueFiltered && isQueueDialingArmed && (
          <div style={{
            margin: '12px 16px 0',
            padding: '8px 12px',
            background: 'rgba(217, 119, 6, 0.1)',
            border: `1px solid ${terminalAmber}`,
            borderRadius: 4,
            fontFamily: FUTURA,
            fontSize: 11,
            color: terminalAmber,
            letterSpacing: '0.2px',
            flexShrink: 0,
          }}>
            ⚠ Predictive's background dialer pulls from the full active queue and does not currently respect this filter — the filter only restricts what's shown here and what Power/Progressive/Preview will dial.
          </div>
        )}

        {isPredictive && isQueueDialingArmed && QueueStatsStrip()}

        {(tcpaBlockedAll || (queueDiagnosis && queueDiagnosis.reasons.length > 0)) && (() => {
          // Two different situations wearing one banner, and they need
          // different colours because they need different actions.
          //
          //   Amber  — everything is blocked by the clock. Wait; it resolves.
          //   Red    — at least one reason is permanent. Waiting achieves
          //            nothing, and the leads need fixing.
          //
          // Showing "dialing will resume automatically" over a queue of
          // unroutable numbers is the specific lie this replaces.
          const permanent = (queueDiagnosis?.reasons ?? []).filter(
            r => r.code !== 'too_early' && r.code !== 'too_late' && r.code !== 'sunday'
          )
          const hasPermanent = permanent.length > 0
          const tone = hasPermanent ? '#dc2626' : terminalAmber
          return (
            <div style={{
              margin: '12px 16px 0',
              padding: '9px 14px',
              background: hasPermanent ? 'rgba(220, 38, 38, 0.08)' : 'rgba(217, 119, 6, 0.1)',
              border: `1px solid ${tone}`,
              borderRadius: 4,
              fontFamily: FUTURA,
              fontSize: 11,
              color: tone,
              letterSpacing: '0.3px',
              flexShrink: 0,
            }}>
              <div>
                {hasPermanent ? '⚠' : '⏱'}{' '}
                {queueDiagnosis?.summary
                  || (tcpaBlockedReason ? `${tcpaBlockedReason} — queue shown for review.` : null)
                  || 'Outside the calling window — queue shown for review, dialing will resume automatically once the window opens.'}
              </div>

              {/* Per-reason lines with a real example, so the user can go and
                  look at an actual offending lead rather than hunt for one. */}
              {queueDiagnosis && queueDiagnosis.reasons.length > 1 && (
                <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 2, opacity: 0.85 }}>
                  {queueDiagnosis.reasons.map(r => (
                    <div key={r.code} style={{ fontSize: 10 }}>
                      · {r.count.toLocaleString()} — {QUEUE_REASON_LABELS[r.code] ?? r.code}
                      {r.example ? ` (e.g. ${r.example})` : ''}
                    </div>
                  ))}
                </div>
              )}

              {/* Only promise a resume when waiting actually delivers one. */}
              {!hasPermanent && queueDiagnosis?.waitingOnClock && (
                <div style={{ marginTop: 4, fontSize: 10, opacity: 0.8 }}>
                  Dialing resumes automatically once the window opens.
                </div>
              )}
            </div>
          )
        })()}

        {/* ── TABLE ─────────────────────────────────────────────────────────── */}
        <div className="dialer-queue-scroll" style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
          {queuedLeadsLoading && visibleQueuedLeads.length === 0 ? (
            <div style={{ fontFamily: FUTURA, fontSize: 12, color: terminalMuted, letterSpacing: '0.3px', padding: '48px 0', textAlign: 'center' }}>
              Loading queue…
            </div>
          ) : visibleQueuedLeads.length === 0 ? (
            <div style={{ fontFamily: FUTURA, fontSize: 12, color: terminalMuted, letterSpacing: '0.3px', padding: '48px 0', textAlign: 'center' }}>
              {isQueueFiltered
                ? 'No leads match this filter.'
                : noLeads
                  ? 'No dialable leads right now.'
                  : 'Queue is empty.'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', padding: '10px 16px 16px', gap: 6 }}>
              {visibleQueuedLeads.map(lead => {
                const isRowActive = activeQueueLeadIds.has(lead.id)
                const outcome = queueOutcomeByLeadId[lead.id]
                const attempts = lead.dial_attempts || 0
                // Same disposition color mapping as the leads tab (see
                // dispositionTint/DISPOSITIONS in app/dashboard/leads/page.tsx)
                // — kept as real, shared string values rather than a fresh
                // guess, so a lead's badge here looks and reads identically
                // to how it appears on the leads tab.
                const dispInfo: { label: string; color: string; bg: string; tint: string } | null =
                  lead.disposition === 'CLOSED' ? { label: 'CLOSED', color: '#16a34a', bg: '#dcfce7', tint: 'rgba(22, 163, 74, 0.08)' }
                  : lead.disposition === 'APPOINTMENT' ? { label: 'APPOINTMENT', color: '#2563eb', bg: '#dbeafe', tint: 'rgba(37, 99, 235, 0.08)' }
                  : lead.disposition === 'NOT INTERESTED' ? { label: 'NOT INTERESTED', color: '#d97706', bg: '#fef3c7', tint: 'rgba(217, 119, 6, 0.08)' }
                  : lead.disposition === 'DO NOT CALL' ? { label: 'DO NOT CALL', color: '#dc2626', bg: '#fee2e2', tint: 'rgba(220, 38, 38, 0.08)' }
                  : lead.disposition === 'SKIPPED' ? { label: 'SKIPPED', color: '#64748b', bg: '#f1f5f9', tint: 'rgba(100, 116, 139, 0.05)' }
                  : lead.disposition === 'NO_ANSWER' ? { label: 'NO ANSWER', color: '#64748b', bg: '#f1f5f9', tint: 'rgba(100, 116, 139, 0.05)' }
                  : lead.disposition === 'TCPA_BLOCKED' ? { label: 'TIME BLOCKED', color: terminalAmber, bg: '#fef3c7', tint: 'rgba(217, 119, 6, 0.06)' }
                  : null

                return (
                  <div
                    key={lead.id}
                    className={`dialer-queue-row dialer-queue-card ${isRowActive ? 'dialer-queue-row-active' : ''}`}
                    style={{
                      padding: '10px 12px',
                      background: isRowActive ? 'rgba(42, 74, 138, 0.10)' : (dispInfo?.tint || terminalBg),
                      border: `1px solid ${isRowActive ? terminalAccent : terminalBorder}`,
                      borderLeft: `3px solid ${isRowActive ? terminalAccent : 'transparent'}`,
                      borderRadius: 4,
                    }}
                  >
                    <div className="dialer-queue-row-grid" style={{
                      display: 'grid',
                      gridTemplateColumns: '1.6fr 1fr 0.5fr 0.6fr',
                      gridTemplateAreas: '"name phone state badge"',
                      gap: 10,
                      alignItems: 'center', fontFamily: FUTURA, fontSize: 13,
                    }}>
                      <span className="dq-cell-name" style={{ gridArea: 'name', color: terminalText, fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {(lead.first_name || lead.last_name) ? `${lead.first_name || ''} ${lead.last_name || ''}`.trim() : '—'}
                      </span>
                      <span className="dq-cell-phone" style={{ gridArea: 'phone', color: terminalAccent, fontWeight: 'bold', fontVariantNumeric: 'tabular-nums', overflowWrap: 'anywhere' }}>
                        {lead.phone}
                      </span>
                      <span className="dq-cell-state" style={{ gridArea: 'state', color: terminalMuted, fontSize: 12 }}>
                        {lead.state || '—'}
                      </span>
                      <span className="dq-cell-badge" style={{ gridArea: 'badge', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 11, fontFamily: 'monospace', fontWeight: 'bold', color: attempts > 0 ? terminalAccent : terminalMuted }}>
                          {attempts}x
                        </span>
                        {isRowActive ? (
                          // The ONE and only "currently dialing" indicator for
                          // this row — replaces the normal disposition/NEW
                          // badge while active, rather than adding a second
                          // separate element. No emoji, per instruction.
                          <span style={{
                            fontSize: 9, fontWeight: 'bold', letterSpacing: 0.5,
                            padding: '3px 7px', borderRadius: 3,
                            background: 'rgba(42, 74, 138, 0.16)', color: terminalAccent,
                            border: `1px solid ${terminalAccent}`,
                          }}>
                            DIALING
                          </span>
                        ) : dispInfo ? (
                          <span style={{
                            fontSize: 9, fontWeight: 'bold', letterSpacing: 0.5,
                            padding: '3px 7px', borderRadius: 3,
                            background: dispInfo.bg, color: dispInfo.color,
                            border: `1px solid ${dispInfo.color}`,
                            whiteSpace: 'nowrap',
                          }}>
                            {dispInfo.label}
                          </span>
                        ) : (
                          <span style={{
                            fontSize: 9, fontWeight: 'bold', letterSpacing: 0.5,
                            padding: '3px 7px', borderRadius: 3,
                            background: '#e8e8ec', color: terminalMuted,
                            border: `1px solid ${terminalBorder}`,
                          }}>
                            NEW
                          </span>
                        )}
                      </span>
                    </div>
                    {outcome && (
                      <div style={{
                        marginTop: 6,
                        fontFamily: FUTURA, fontSize: 12, color: terminalMuted, letterSpacing: 0.2,
                        display: 'flex', alignItems: 'center', gap: 6,
                      }}>
                        <span>💬</span>{outcome}
                      </div>
                    )}
                  </div>
                )
              })}

              {/* ── THE BOTTOM OF THE LIST ALWAYS SAYS WHERE YOU ARE ──────
                  Either there is more and you can ask for it, or there is not
                  and it says so. A list that simply stops leaves the agent
                  guessing whether they are seeing their whole book. */}
              <div style={{
                padding: '14px 10px 18px', textAlign: 'center',
                fontFamily: FUTURA, fontSize: 9, letterSpacing: 2,
              }}>
                {queueHasMore ? (
                  <button
                    onClick={() => setQueueLoadCap(c => c * 2)}
                    disabled={queuedLeadsLoading}
                    style={{
                      width: '100%', padding: '12px', borderRadius: 4,
                      border: `1px solid ${terminalBorder}`,
                      background: terminalSurface,
                      color: queuedLeadsLoading ? terminalMuted : 'var(--brand-primary)',
                      fontFamily: FUTURA, fontSize: 10, fontWeight: 'bold',
                      letterSpacing: 3, cursor: queuedLeadsLoading ? 'default' : 'pointer',
                      touchAction: 'manipulation',
                    }}
                  >
                    {queuedLeadsLoading
                      ? 'LOADING…'
                      : `LOAD MORE LEADS (${visibleQueuedLeads.length.toLocaleString()} SHOWN)`}
                  </button>
                ) : (
                  <div style={{ color: terminalMuted }}>
                    ■ THAT'S ALL {visibleQueuedLeads.length.toLocaleString()} OF YOUR LEADS ■
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }


  return (
    <div className="dialer-root" style={{
      flex: 1, background: terminalBg,
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden', minHeight: 0, position: 'relative',
      fontFamily: FUTURA, color: terminalText,
    }}>
      <style>{`
        .dialer-root { height: 100vh; height: 100dvh; }
        .dialer-status-bar { display: flex; align-items: center; justify-content: space-between; }
        .dialer-status-bar-left { display: flex; align-items: center; gap: 18px; flex-wrap: wrap; }
        .dialer-status-bar-right { display: flex; align-items: center; gap: 18px; }
        .dialer-stat-grid { grid-template-columns: repeat(4, 1fr) !important; }
        .dialer-right-sidebar {
          width: 280px; border-left: 1px solid ${terminalBorder};
          display: flex; flex-direction: column; flex-shrink: 0; overflow: hidden;
        }
        .dialer-right-toggle { display: none; }
        .dialer-right-overlay { display: none; }
        .dialer-connected-pill {
          display: flex; align-items: center; gap: 6px;
          padding: 3px 10px; background: var(--brand-primary-soft);
          border: 1px solid color-mix(in srgb, var(--brand-primary) 30%, transparent); border-radius: 3px;
          font-family: monospace; font-size: 10px; letter-spacing: 1px;
          color: var(--brand-primary); font-weight: bold;
        }
        .mode-tile-wrap { position: relative; cursor: pointer; }
        .mode-tile-dropdown {
          position: absolute; top: calc(100% + 4px); left: 0; right: 0;
          background: ${terminalDark}; border: 1px solid var(--brand-sidebar-active-bg);
          border-radius: 4px; padding: 4px; z-index: 200;
          min-width: 160px; box-shadow: 0 4px 16px rgba(0,0,0,0.4);
        }
        .mode-dropdown-item {
          display: flex; align-items: center; gap: 8px;
          padding: 8px 10px; cursor: pointer;
          font-size: 10px; font-weight: bold; letter-spacing: 2px;
          font-family: monospace; border-radius: 3px;
          transition: background 0.1s;
        }
        .mode-dropdown-item:hover { background: color-mix(in srgb, var(--brand-on-sidebar) 5%, transparent); }
        .mode-dropdown-item.current { background: var(--brand-primary-soft); }
        .lines-selector {
          display: flex; align-items: center; gap: 6px;
          padding: 4px 10px; background: ${terminalBg};
          border: 1px solid ${terminalBorder}; border-radius: 3px;
        }
        .lines-selector select {
          background: transparent; border: none; outline: none;
          font-family: monospace; font-size: 12px; font-weight: bold;
          color: ${terminalText}; cursor: pointer; padding: 2px 4px;
        }

        /* Full-screen lead-profile toggle is mobile-only — hidden on desktop,
           shown inside the mobile media query below. */
        .dialer-profile-fs-btn { display: none; }

        @media (max-width: 768px) {
          .dialer-root { height: calc(100vh - 64px); height: calc(100dvh - 64px); }
          .dialer-status-bar { padding: 6px 12px !important; }

          /* Show the full-screen toggle on mobile only. */
          .dialer-profile-fs-btn { display: inline-flex; align-items: center; }

          /* Full-screen lead profile: NOT an overlay. It's an in-flow page
             region — the profile/script card grows to fill the available space
             under the header, pushing everything else (status tiles, campaign
             select) out of the way, while the action button below it (SET
             AVAILABLE / dial / SKIP+TERMINATE) stays in normal flow right
             beneath it. The page itself scrolls if needed; nothing is fixed or
             overlapping. */
          .dialer-profile-card.fullscreen {
            flex: 1 1 auto !important;
            min-height: 0 !important;
            border-radius: 4px;
          }
          /* When fullscreen is on, collapse the stuff above the card so the
             profile gets the room and the dial button sits just under it. */
          .dialer-main-col.has-fullscreen .dialer-collapse-on-fs {
            display: none !important;
          }

          /* When the disposition sheet is up, cap the lead profile so the
             disposition buttons are always on screen without scrolling. The
             script box shrinks; the disposition square stays fully visible. */
          .dialer-profile-card.with-disposition:not(.fullscreen) {
            flex: 0 0 auto !important;
            max-height: 30vh !important;
            min-height: 0 !important;
          }
          .dialer-profile-card.with-disposition:not(.fullscreen) .dialer-script-box {
            display: none !important;
          }
          .dialer-disposition-sheet {
            max-height: none !important;
          }
          /* Mobile script box: give it a real, bounded height so it never
             collapses, and let the body scroll inside it. The tab row wraps. */
          .dialer-script-box {
            min-height: 220px !important;
            max-height: 45vh;
          }
          .dialer-script-body {
            -webkit-overflow-scrolling: touch;
            font-size: 13px !important;
            line-height: 1.75 !important;
          }
          /* Live activity panel (dialing state): reduce letter-spacing and
             font sizes just enough that phone numbers and log lines wrap
             cleanly instead of crowding/clipping on a narrow screen. Chips
             go full-width and stack so a full E.164 number always has room. */
          .dialer-live-activity-label,
          .dialer-live-activity-sublabel {
            letter-spacing: 1px !important;
          }
          .dialer-live-number-chip {
            font-size: 13px !important;
            letter-spacing: 0.5px !important;
            padding: 7px 10px !important;
            flex-wrap: wrap;
          }
          .dialer-live-now-dialing-number {
            font-size: 15px !important;
            letter-spacing: 0.5px !important;
          }
          .dialer-live-activity-log {
            max-height: 140px !important;
          }
          .dialer-live-activity-line {
            font-size: 10.5px !important;
            letter-spacing: 0 !important;
          }
          .dialer-status-bar-left { gap: 10px; }
          .dialer-status-bar-right { gap: 10px; }
          .dialer-status-bar-right .dialer-time-block { display: none !important; }
          .dialer-stat-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .dialer-right-sidebar {
            position: fixed; right: 0; top: 0; bottom: 0; z-index: 60;
            width: 280px; max-width: 85vw;
            transform: translateX(100%); transition: transform 0.25s ease;
            background: ${terminalBg}; border-left: 1px solid ${terminalBorder};
          }
          .dialer-right-sidebar.open { transform: translateX(0); }

          /* C9b: only the METRICS HEADER BAR gets the safe-area inset. The dark
             header (terminalDark) extends UP under the dynamic island, and its
             label text sits flush just below the island. This keeps the rest of
             the sidebar (conversion card, manual dialer, SYSTEM LOG) at their
             normal positions — they no longer get pushed down. */
          .dialer-metrics-header {
            padding-top: max(8px, env(safe-area-inset-top, 0px)) !important;
          }

          .dialer-right-toggle {
            display: flex;
            position: fixed;
            right: 0;
            top: 73%;
            transform: translateY(-50%);
            z-index: 50;
            width: 22px;
            height: 64px;
            border-radius: 8px 0 0 8px;
            background: ${terminalDark};
            border: 1px solid var(--brand-sidebar-active-bg);
            border-right: none;
            color: var(--brand-primary);
            align-items: center;
            justify-content: center;
            cursor: pointer;
            font-size: 18px;
            font-weight: bold;
            box-shadow: -2px 4px 12px rgba(0,0,0,0.25);
            padding: 0;
          }
          .dialer-right-toggle:active {
            background: color-mix(in srgb, var(--brand-on-sidebar) 6%, var(--brand-sidebar-bg));
          }
          .dialer-right-overlay {
            display: block; position: fixed; inset: 0;
            background: rgba(0,0,0,0.5); z-index: 55;
            opacity: 0; pointer-events: none; transition: opacity 0.2s ease;
          }
          .dialer-right-overlay.open { opacity: 1; pointer-events: auto; }
        }
      `}</style>

      <div className="dialer-status-bar" style={{
        background: 'var(--brand-header-bg)', padding: '8px 20px',
        borderBottom: '2px solid var(--brand-header-top-accent)', flexShrink: 0,
      }}>
        <div className="dialer-status-bar-left">
          <span style={{ fontSize: '11px', fontWeight: 'bold', letterSpacing: '4px', color: 'var(--brand-primary)' }}>
            DIALERSEAT TERMINAL
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div onClick={handleSetAvailable} style={{
              width: '36px', height: '20px', borderRadius: '10px',
              background: available ? 'var(--brand-primary)' : 'color-mix(in srgb, var(--brand-on-header) 30%, var(--brand-header-bg))',
              position: 'relative', cursor: 'pointer', transition: 'background 0.2s',
              flexShrink: 0,
            }}>
              <div style={{
                width: '14px', height: '14px', borderRadius: '50%', background: 'white',
                position: 'absolute', top: '3px', left: available ? '19px' : '3px', transition: 'left 0.2s',
              }} />
            </div>
            <div style={{
              width: '8px', height: '8px', borderRadius: '50%',
              background: available ? '#32ff7e' : '#ff6464',
              boxShadow: available ? '0 0 6px #32ff7e' : '0 0 6px #ff6464',
            }} />
            <span style={{ fontSize: '10px', letterSpacing: '2px', color: available ? '#32ff7e' : '#ff6464' }}>
              {available ? 'LIVE' : 'OFFLINE'}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: swReady ? 'var(--brand-primary)' : 'var(--brand-on-header-muted)' }} />
            <span style={{ fontSize: '9px', letterSpacing: '2px', color: swReady ? 'var(--brand-primary)' : 'var(--brand-on-header-muted)' }}>
              {swReady ? 'AUDIO' : '...'}
            </span>
          </div>

        </div>
        <div className="dialer-status-bar-right">
          <div className="dialer-connected-pill" title="Connected calls today">
            <span style={{ fontSize: 8, letterSpacing: 2, opacity: 0.75 }}>CONNECTED TODAY</span>
            <span>{sessionStats.connected}</span>
          </div>
          <div className="dialer-time-block" style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            <span style={{ fontSize: '11px', fontFamily: 'monospace', color: 'var(--brand-on-header-muted)', letterSpacing: '2px' }}>{dateStr}</span>
            <span style={{ fontSize: '14px', fontFamily: 'monospace', fontWeight: 'bold', color: 'var(--brand-primary)', letterSpacing: '3px' }}>{timeStr}</span>
          </div>
        </div>
      </div>

      {isPredictive && pacingInfo?.isDegraded && (
        <div style={{
          padding: '8px 20px',
          background: '#f8e8e8',
          borderBottom: `2px solid ${terminalRed}`,
          color: terminalRed,
          fontSize: 11,
          letterSpacing: 1,
          textAlign: 'center',
          fontWeight: 'bold',
        }}>
          ⚠ AUTO-DEGRADED TO PROGRESSIVE — abandon rate {(pacingInfo.abandonRate * 100).toFixed(2)}% (legal cap 3%)
        </div>
      )}

      {isPredictive && shouldYield && !pacingInfo?.isDegraded && (
        <div style={{
          padding: '8px 20px',
          background: '#fdf4e8',
          borderBottom: `2px solid ${terminalAmber}`,
          color: terminalAmber,
          fontSize: 11,
          letterSpacing: 1,
          textAlign: 'center',
          fontWeight: 'bold',
        }}>
          ⚠ YIELDING — abandon rate approaching FTC 3% cap. Dialing paused briefly.
        </div>
      )}

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
        <div className={`dialer-main-col ${profileFullscreen ? 'has-fullscreen' : ''}`} style={{ flex: 1, padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px', overflow: 'auto', minHeight: 0 }}>

          <div className="dialer-stat-grid dialer-collapse-on-fs" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', flexShrink: 0 }}>
            <div style={{
              padding: '8px 12px', background: terminalSurface,
              border: `1px solid ${terminalBorder}`, borderRadius: '4px',
            }}>
              <div style={{ fontSize: '9px', letterSpacing: '2px', color: terminalMuted, marginBottom: '3px' }}>STATUS</div>
              <div style={{
                fontSize: '12px', fontWeight: 'bold', fontFamily: 'monospace',
                color: status === 'connected' ? terminalGreen : status === 'calling' ? '#8a6a1a' : status === 'preview_ready' ? terminalAccent : terminalMuted,
                letterSpacing: '1px',
              }}>{status === 'preview_ready' ? 'PREVIEW' : status.toUpperCase()}</div>
            </div>
            <div style={{
              padding: '8px 12px', background: terminalSurface,
              border: `1px solid ${terminalBorder}`, borderRadius: '4px',
            }}>
              <div style={{ fontSize: '9px', letterSpacing: '2px', color: terminalMuted, marginBottom: '3px' }}>DURATION</div>
              <div style={{ fontSize: '12px', fontWeight: 'bold', fontFamily: 'monospace', color: terminalAccent, letterSpacing: '1px' }}>
                {status === 'connected' ? formatTime(seconds) : '--:--'}
              </div>
            </div>
            <div style={{
              padding: '8px 12px', background: terminalSurface,
              border: `1px solid ${terminalBorder}`, borderRadius: '4px',
            }}>
              <div style={{ fontSize: '9px', letterSpacing: '2px', color: terminalMuted, marginBottom: '3px' }}>CONNECTED RATE</div>
              <div style={{ fontSize: '12px', fontWeight: 'bold', fontFamily: 'monospace', color: terminalAccent, letterSpacing: '1px' }}>
                {connectedRate}
              </div>
            </div>
            <div
              className="mode-tile-wrap"
              onClick={() => {
                if (!modeTileInteractive || modeSaving) return
                setModeDropdownOpen(o => !o)
              }}
              style={{
                padding: '8px 12px', background: terminalSurface,
                border: `1px solid ${modeTileInteractive ? modeColor : terminalBorder}`,
                borderRadius: '4px',
                cursor: modeTileInteractive ? 'pointer' : 'default',
                opacity: modeSaving ? 0.5 : 1,
                userSelect: 'none',
              }}
              title={
                isAllActive
                  ? 'Click to change mode for ALL ACTIVE session (does not modify individual campaign settings)'
                  : isSpecificCampaign
                    ? 'Click to change mode for this campaign'
                    : 'Select a campaign to change mode'
              }
            >
              <div style={{
                fontSize: '9px', letterSpacing: '2px', color: terminalMuted, marginBottom: '3px',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <span>MODE{isAllActive ? ' (SESSION)' : ''}</span>
                {modeTileInteractive && (
                  <span style={{ fontSize: 8, opacity: 0.7 }}>{modeDropdownOpen ? '▲' : '▼'}</span>
                )}
              </div>
              <div style={{
                fontSize: '12px', fontWeight: 'bold', fontFamily: 'monospace',
                color: modeColor, letterSpacing: '1px',
              }}>
                {dialerMode.toUpperCase()}
              </div>
              {modeDropdownOpen && modeTileInteractive && (
                <div className="mode-tile-dropdown" onClick={e => e.stopPropagation()}>
                  {MODE_OPTIONS.map(opt => (
                    <div
                      key={opt.value}
                      className={`mode-dropdown-item ${opt.value === dialerMode ? 'current' : ''}`}
                      onClick={() => handleModeChange(opt.value)}
                      style={{ color: opt.color }}
                    >
                      <span style={{
                        width: 8, height: 8, borderRadius: '50%',
                        background: opt.color, flexShrink: 0,
                      }} />
                      {opt.label}
                      {opt.value === dialerMode && (
                        <span style={{ marginLeft: 'auto', color: 'var(--brand-primary)' }}>✓</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {isPredictive && pacingInfo && (
            <div style={{
              padding: '10px 14px', background: terminalSurface,
              border: `1px solid ${terminalBorder}`, borderLeft: `3px solid ${pacingInfo.isDegraded ? terminalRed : terminalAccent}`,
              borderRadius: '4px', flexShrink: 0,
              display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10,
            }}>
              <div>
                <div style={{ fontSize: 9, letterSpacing: 2, color: terminalMuted, marginBottom: 3 }}>ACTIVE AGENTS</div>
                <div style={{ fontSize: 14, fontWeight: 'bold', fontFamily: 'monospace', color: terminalText }}>
                  {pacingInfo.activeAgents}{pacingInfo.isPredictiveTeam && (
                    <span style={{ fontSize: 9, color: terminalGreen, marginLeft: 6, letterSpacing: 1 }}>TEAM</span>
                  )}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 9, letterSpacing: 2, color: terminalMuted, marginBottom: 3 }}>MY LINES</div>
                {linesPref ? (
                  <div className="lines-selector" style={{ padding: '2px 8px', opacity: linesPrefSaving ? 0.5 : 1 }}>
                    <select
                      value={linesPref.preferred_lines ?? linesPref.campaign_default}
                      disabled={linesPrefSaving}
                      onChange={e => handleLinesChange(parseInt(e.target.value))}
                    >
                      {LINES_OPTIONS
                        .filter(n => n <= linesPref.campaign_max && n >= linesPref.campaign_min)
                        .map(n => (
                          <option key={n} value={n}>{n}</option>
                        ))}
                    </select>
                    <span style={{ fontSize: 9, color: terminalMuted, letterSpacing: 1 }}>
                      {linesPref.preferred_lines === null ? '(default)' : ''}
                    </span>
                  </div>
                ) : (
                  <div style={{ fontSize: 14, fontFamily: 'monospace', color: terminalMuted }}>—</div>
                )}
              </div>
              <div>
                <div style={{ fontSize: 9, letterSpacing: 2, color: terminalMuted, marginBottom: 3 }}>EFFECTIVE LINES</div>
                <div style={{ fontSize: 14, fontWeight: 'bold', fontFamily: 'monospace', color: pacingInfo.isDegraded ? terminalRed : terminalAccent }}>
                  {pacingInfo.effectiveLines.toFixed(1)}×{pacingInfo.isDegraded && ' (degraded)'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 9, letterSpacing: 2, color: terminalMuted, marginBottom: 3 }}>30D ABANDON RATE</div>
                <div style={{
                  fontSize: 14, fontWeight: 'bold', fontFamily: 'monospace',
                  color: pacingInfo.abandonRate >= 0.025 ? terminalRed : pacingInfo.abandonRate >= 0.020 ? '#8a6a1a' : terminalGreen,
                }}>
                  {(pacingInfo.abandonRate * 100).toFixed(2)}%
                </div>
              </div>
            </div>
          )}

          {teamScopes.length > 0 && (
            <div style={{
              padding: '10px 14px', background: terminalSurface,
              border: `1px solid ${terminalBorder}`, borderRadius: '4px', flexShrink: 0,
            }}>
              <div style={{ fontSize: '9px', letterSpacing: '3px', color: terminalMuted, marginBottom: '6px' }}>▸ SOURCE</div>
              <select
                value={selectedScope}
                onChange={(e) => setSelectedScope(e.target.value)}
                style={{
                  width: '100%', padding: '6px 10px', borderRadius: '4px',
                  background: terminalBg, border: `1px solid ${terminalBorder}`,
                  color: terminalText, fontSize: '12px', outline: 'none',
                  fontFamily: 'monospace', cursor: 'pointer',
                }}
              >
                <option value={PERSONAL_SCOPE}>MY LEADS (PERSONAL)</option>
                {teamScopes.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.viewerRole === 'owner' ? 'TEAM (OWNER): ' : 'TEAM: '}{s.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="dialer-collapse-on-fs" style={{ padding: '10px 14px', background: terminalSurface, border: `1px solid ${terminalBorder}`, borderRadius: '4px', flexShrink: 0 }}>
            <div style={{ fontSize: '9px', letterSpacing: '3px', color: terminalMuted, marginBottom: '6px' }}>▸ SELECT CAMPAIGN</div>
            <select value={selectedCampaign} onChange={(e) => setSelectedCampaign(e.target.value)} style={{
              width: '100%', padding: '6px 10px', borderRadius: '4px',
              background: terminalBg, border: `1px solid ${selectedCampaign ? terminalBorder : '#ffaa3e'}`,
              color: selectedCampaign ? terminalText : terminalMuted,
              fontSize: '12px', outline: 'none',
              fontFamily: FUTURA, cursor: 'pointer',
            }}>
              <option value="">— SELECT A CAMPAIGN —</option>
              {activeCampaignsCount > 0 && (
                <option value={ALL_ACTIVE}>ALL ACTIVE CAMPAIGNS ({activeCampaignsCount})</option>
              )}
              {activeScopeCampaigns.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} — {c.total_leads} leads
                </option>
              ))}
            </select>
            {activeScopeCampaigns.length === 0 && (
              <div style={{
                marginTop: '6px', padding: '5px 8px', background: '#f8e8e8',
                border: '1px solid #d0a0a0', borderRadius: '4px',
                fontSize: '10px', letterSpacing: '2px', color: terminalRed,
              }}>
                ⚠ {scopeCampaigns.length === 0
                    ? (isPersonalScope ? 'NO CAMPAIGNS FOUND' : 'NO CAMPAIGNS ACCESSIBLE FROM THIS TEAM')
                    : 'NO ACTIVE CAMPAIGNS — ACTIVATE A CAMPAIGN TO START DIALING'}
              </div>
            )}
            {showSelectCampaignMsg && (
              <div style={{
                marginTop: 6, padding: '6px 10px',
                background: '#fdf4e8',
                border: `1px solid ${terminalAmber}`,
                borderLeft: `3px solid ${terminalAmber}`,
                borderRadius: 4,
                fontSize: 11, color: terminalAmber, letterSpacing: 0.5, fontWeight: 'bold',
              }}>
                ⚠ YOU MUST SELECT A CAMPAIGN BEFORE DIALING
              </div>
            )}
          </div>

          {/* CENTER PANEL */}
          {available && (isSpecificCampaign || activeScopeCampaigns.length > 0) && status !== 'connected' && !(status === 'preview_ready' && !isPredictive) ? (
            <div className="dialer-queue-card" style={{
              flex: 1, background: terminalSurface, border: `1px solid ${terminalBorder}`,
              borderRadius: '4px', overflow: 'hidden', display: 'flex', flexDirection: 'column',
              minHeight: 280, maxHeight: 'calc(100vh - 220px)',
            }}>
              {LeadQueuePanel()}
            </div>
          ) : (!available || (!isSpecificCampaign && activeScopeCampaigns.length === 0)) && status !== 'connected' && status !== 'calling' && !currentLead && !previewLead ? (
            <div style={{
              flex: 1, background: terminalSurface, border: `1px solid ${terminalBorder}`,
              borderRadius: '4px', overflow: 'hidden', display: 'flex',
              flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              minHeight: 280, padding: 20,
            }}>
              <p style={{ fontSize: 11, letterSpacing: 3, color: terminalMuted, textAlign: 'center' }}>
                {!isSpecificCampaign && activeScopeCampaigns.length === 0
                  ? 'SELECT A CAMPAIGN TO BEGIN'
                  : 'SET AVAILABLE TO BEGIN'}
              </p>
            </div>
          ) : (
            <div className={`dialer-profile-card ${profileFullscreen ? 'fullscreen' : ''} ${showDisposition ? 'with-disposition' : ''}`} style={{
              flex: 1, background: terminalSurface, border: `1px solid ${terminalBorder}`,
              borderRadius: '4px', overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 200,
            }}>
              <div style={{
                padding: '7px 14px', background: terminalDark, borderBottom: `1px solid ${terminalBorder}`,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
              }}>
                <span style={{ fontSize: '10px', letterSpacing: '3px', color: 'var(--brand-on-sidebar-muted)', fontWeight: 'bold' }}>
                  {previewLead ? 'LEAD PREVIEW — REVIEW BEFORE DIALING' : 'LEAD PROFILE'}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {displayLead && (status === 'connected' || status === 'preview_ready') && (
                    <span style={{ fontSize: '10px', fontFamily: 'monospace', color: 'var(--brand-primary)' }}>ID: {displayLead.id.substring(0, 8)}</span>
                  )}
                  <button
                    className="dialer-profile-fs-btn"
                    onClick={() => setProfileFullscreen(v => !v)}
                    title={profileFullscreen ? 'Exit full screen' : 'Full screen lead profile'}
                    aria-label="Toggle full screen lead profile"
                    style={{
                      background: 'transparent', border: '1px solid var(--brand-on-sidebar-muted)',
                      borderRadius: 3, color: 'var(--brand-on-sidebar-muted)', cursor: 'pointer',
                      fontSize: 11, lineHeight: 1, padding: '3px 6px', fontFamily: FUTURA,
                    }}
                  >{profileFullscreen ? '✕' : '⛶'}</button>
                </div>
              </div>

              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
                {(!displayLead || status === 'calling') ? (
                  status === 'calling' ? (
                    <div className="dialer-live-activity" style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div className="dialer-live-activity-label" style={{ fontSize: '10px', letterSpacing: '3px', color: terminalMuted, fontFamily: FUTURA, fontWeight: 'bold' }}>
                        LIVE ACTIVITY
                      </div>

                      {/* ── CURRENT / IN-FLIGHT NUMBER(S) ─────────────────────────
                          Power/Progressive/Preview: one number, the exact one
                          being dialed right now. Predictive: every line
                          currently in flight this tick, shown together and
                          highlighted as a group — the count matches however
                          many lines the campaign/dialer is actually set to
                          dial at once (effectiveLines from the controller),
                          not a hardcoded number. */}
                      {isPredictive && activeDialingNumbers.length > 0 ? (
                        <div>
                          <div className="dialer-live-activity-sublabel" style={{ fontSize: '9px', letterSpacing: '2px', color: terminalAccent, fontFamily: FUTURA, fontWeight: 'bold', marginBottom: 6 }}>
                            DIALING {activeDialingNumbers.length} LINE{activeDialingNumbers.length === 1 ? '' : 'S'} SIMULTANEOUSLY
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {activeDialingNumbers.map((num, i) => (
                              <div key={`${num}-${i}`} className="dialer-live-number-chip" style={{
                                padding: '8px 12px',
                                background: 'rgba(42, 74, 138, 0.12)',
                                border: `1.5px solid ${terminalAccent}`,
                                borderRadius: 4,
                                fontFamily: FUTURA,
                                fontSize: 14,
                                fontWeight: 'bold',
                                color: terminalText,
                                letterSpacing: '1px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                              }}>
                                <span style={{ color: terminalAccent }}>●</span>
                                <span className="dialer-live-number-chip-text" style={{ overflowWrap: 'anywhere' }}>{num}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="dialer-live-now-dialing" style={{
                          padding: '10px 14px',
                          background: terminalBg,
                          border: `2px solid ${terminalAccent}`,
                          borderRadius: 4,
                        }}>
                          <div className="dialer-live-activity-sublabel" style={{ fontSize: '9px', letterSpacing: '2px', color: terminalMuted, fontFamily: FUTURA, marginBottom: 4 }}>
                            NOW DIALING
                          </div>
                          <div className="dialer-live-now-dialing-number" style={{ fontFamily: FUTURA, fontSize: 17, fontWeight: 'bold', color: terminalText, letterSpacing: '1px', overflowWrap: 'anywhere' }}>
                            {previewLead?.phone || activeDialingNumbers[0] || '—'}
                          </div>
                          {(previewLead?.first_name || previewLead?.last_name) && (
                            <div style={{ fontFamily: FUTURA, fontSize: 12, color: terminalMuted, marginTop: 2, overflowWrap: 'anywhere' }}>
                              {previewLead.first_name} {previewLead.last_name}
                            </div>
                          )}
                        </div>
                      )}

                      {/* ── FULL SCROLLING LOG — everything happening, in order ── */}
                      <div className="dialer-live-activity-log" style={{
                        display: 'flex', flexDirection: 'column', gap: 3,
                        maxHeight: 180, overflowY: 'auto',
                        borderTop: `1px solid ${terminalBorder}`, paddingTop: 8,
                      }}>
                        {amdActivity.length === 0 ? (
                          <div style={{ fontFamily: FUTURA, fontSize: 11, color: terminalMuted, letterSpacing: '1px' }}>
                            Waiting for activity…
                          </div>
                        ) : (
                          amdActivity.map((line, i) => (
                            <div key={i} className="dialer-live-activity-line" style={{
                              fontFamily: FUTURA,
                              fontSize: 11,
                              color: i === 0 ? terminalText : terminalMuted,
                              letterSpacing: '0.5px',
                              lineHeight: 1.5,
                              wordBreak: 'break-word',
                              overflowWrap: 'anywhere',
                            }}>
                              {'> '}{line}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '40px 0' }}>
                      <p style={{ fontSize: '11px', letterSpacing: '3px', color: terminalMuted, fontFamily: FUTURA }}>
                        {noLeads ? 'NO MORE LEADS AVAILABLE' : 'AWAITING DIAL COMMAND'}
                      </p>
                      {noLeads && (
                        <p style={{
                          fontSize: '10px',
                          color: noLeadsStatus === 403 ? terminalRed : tcpaBlockedAll ? terminalAmber : terminalMuted,
                          marginTop: '8px',
                          letterSpacing: '1px',
                          fontFamily: FUTURA,
                          padding: '0 20px',
                          lineHeight: 1.6,
                        }}>
                          {/* Real reason from the server when we have one — e.g.
                              "Too early in TX (6:30 local, window starts 8:00)",
                              "Unknown state — cannot determine calling window",
                              "Not a member of this team", "No leads match the
                              current filter" — instead of collapsing every
                              non-success response into one hardcoded 8am-9pm
                              message regardless of the actual cause. Falls back
                              to the old generic messages only if the server
                              didn't provide a specific reason at all. */}
                          {noLeadsReason
                            ? noLeadsReason.toUpperCase()
                            : tcpaBlockedAll
                              ? 'ALL LEADS OUTSIDE CALLING WINDOW — TRY LATER'
                              : isPersonalScope
                                ? 'UPLOAD MORE LEADS TO CONTINUE'
                                : 'NO MORE TEAM LEADS — TRY ANOTHER CAMPAIGN OR SCOPE'}
                        </p>
                      )}
                    </div>
                  )
                ) : (
                  <>
                    <div style={{ padding: '12px', flexShrink: 0 }}>
                      <div style={{
                        padding: '10px 14px', background: terminalBg,
                        border: `2px solid ${status === 'connected' ? terminalGreen : status === 'preview_ready' ? terminalAccent : terminalBorder}`,
                        borderRadius: '4px', marginBottom: '10px',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                          <div>
                            <div style={{ fontSize: '19px', fontWeight: 'bold', fontFamily: 'monospace', color: terminalText, letterSpacing: '1px', marginBottom: '3px' }}>
                              {displayLead.first_name} {displayLead.last_name}
                            </div>
                            <div style={{ fontSize: '15px', fontFamily: 'monospace', color: terminalAccent, fontWeight: 'bold', letterSpacing: '2px' }}>
                              {displayLead.phone}
                            </div>
                            {/* Location · live timer — matches /welcome page 1 layout */}
                            <div style={{ fontSize: '10px', fontFamily: 'monospace', color: terminalMuted, letterSpacing: '1px', marginTop: '4px' }}>
                              {(() => {
                                const st = displayState(displayLead)
                                const loc = [displayLead.city, st.text === '—' ? null : st.text]
                                  .filter(Boolean).join(', ')
                                return st.inferred
                                  ? <span style={{ opacity: 0.75, fontStyle: 'italic' }}>{loc}</span>
                                  : loc
                              })()}
                              {status === 'connected' && (
                                <>
                                  {(displayLead.city || displayLead.state || phoneToState(displayLead.phone)) ? ' · ' : ''}
                                  {formatTime(seconds)}
                                </>
                              )}
                            </div>
                          </div>
                          <div style={{
                            padding: '4px 10px', borderRadius: '2px',
                            background: status === 'connected' ? '#e8f5e8' : status === 'preview_ready' ? '#e8eef8' : '#f0f0f0',
                            border: `1px solid ${status === 'connected' ? terminalGreen : status === 'preview_ready' ? terminalAccent : terminalBorder}`,
                            fontSize: '9px', letterSpacing: '2px', fontWeight: 'bold',
                            color: status === 'connected' ? terminalGreen : status === 'preview_ready' ? terminalAccent : terminalMuted,
                          }}>
                            {status === 'connected' ? '● LIVE' : status === 'preview_ready' ? '◉ PREVIEW' : '○ IDLE'}
                          </div>
                        </div>
                      </div>
                      {displayLead.extra_data && Object.keys(displayLead.extra_data).length > 0 && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '5px' }}>
                          {filteredExtraData(displayLead.extra_data).map(([key, value]) => (
                            <div key={key} style={{ padding: '7px 10px', background: terminalBg, border: `1px solid ${terminalBorder}`, borderRadius: '3px' }}>
                              <div style={{ fontSize: '8px', letterSpacing: '2px', color: terminalMuted, marginBottom: '2px', textTransform: 'uppercase' }}>{key}</div>
                              <div style={{ fontSize: '11px', fontWeight: 'bold', fontFamily: 'monospace', color: terminalText }}>{String(value)}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    {scriptTabs.length > 0 && (
                      <div className="dialer-script-box" style={{
                        flex: 1, margin: '0 12px 12px',
                        background: terminalBg, border: `1px solid ${terminalBorder}`,
                        borderLeft: `3px solid ${terminalAccent}`, borderRadius: '3px',
                        display: 'flex', flexDirection: 'column', minHeight: 80, overflow: 'hidden',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '2px', padding: '6px 8px 0', borderBottom: `1px solid ${terminalBorder}`, flexWrap: 'wrap', flexShrink: 0 }}>
                          {scriptTabs.map((sc, i) => (
                            <button
                              key={sc.key}
                              onClick={() => setScriptIdx(i)}
                              draggable
                              onDragStart={() => setScriptDragKey(sc.key)}
                              onDragOver={(e) => { e.preventDefault() }}
                              onDrop={(e) => {
                                e.preventDefault()
                                if (scriptDragKey) reorderScriptTabs(scriptDragKey, sc.key)
                                setScriptDragKey(null)
                              }}
                              onDragEnd={() => setScriptDragKey(null)}
                              title="Drag to reorder"
                              style={{
                                padding: '5px 10px',
                                cursor: scriptDragKey ? 'grabbing' : 'grab',
                                border: 'none', borderRadius: '5px 5px 0 0',
                                background: i === activeScriptIdx ? terminalAccent : 'transparent',
                                color: i === activeScriptIdx ? '#fff' : terminalMuted,
                                fontFamily: FUTURA, fontSize: '9px', letterSpacing: '1px', fontWeight: 800,
                                opacity: scriptDragKey === sc.key ? 0.4 : 1,
                                transition: 'all 0.15s ease',
                              }}
                            >{sc.name.toUpperCase()}</button>
                          ))}
                        </div>
                        <div style={{ flex: 1, padding: '10px 12px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                          <div style={{ fontSize: '8px', letterSpacing: '2px', color: terminalMuted, marginBottom: '6px', flexShrink: 0 }}>CALL SCRIPT</div>
                          <div className="dialer-script-body" style={{
                            fontSize: '11px', lineHeight: '1.7', color: activeScript ? terminalText : terminalMuted,
                            fontFamily: 'monospace', whiteSpace: 'pre-wrap', overflowY: 'auto', flex: 1,
                          }}>{activeScript || 'This script is empty — add content from Manage Scripts.'}</div>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {showDisposition && (
            <div className="dialer-disposition-sheet" style={{
              padding: '10px 14px', background: terminalSurface,
              border: `2px solid ${terminalAccent}`, borderRadius: '4px', flexShrink: 0,
            }}>
              {lastCallDuration !== null && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  marginBottom: '10px', paddingBottom: '8px',
                  borderBottom: `1px solid ${terminalBorder}`,
                  fontSize: '10px', letterSpacing: '2px', color: terminalMuted,
                }}>
                  <span>⏱</span>
                  <span>CALL LASTED</span>
                  <span style={{ color: terminalAccent, fontWeight: 'bold', letterSpacing: '1px' }}>
                    {formatDurationLong(lastCallDuration)}
                  </span>
                </div>
              )}
              <div style={{ fontSize: '9px', letterSpacing: '3px', color: terminalMuted, marginBottom: '6px' }}>▸ NOTES <span style={{ opacity: 0.6 }}>(OPTIONAL)</span></div>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Anything to remember about this call..."
                rows={2}
                style={{
                  width: '100%', padding: '8px 10px',
                  background: terminalBg, border: `1px solid ${terminalBorder}`,
                  borderRadius: 3, fontFamily: 'monospace', fontSize: 12,
                  color: terminalText, outline: 'none', resize: 'vertical',
                  marginBottom: 10, boxSizing: 'border-box',
                }}
              />
              {isPredictive && (
                <div style={{
                  marginBottom: 10, padding: '6px 10px',
                  background: 'rgba(42,74,138,0.08)',
                  borderLeft: `3px solid ${terminalAccent}`,
                  fontSize: 10, color: terminalAccent, letterSpacing: 0.5,
                }}>
                  ⓘ System is still dialing in background. Next human routes automatically.
                </div>
              )}
              <div style={{ fontSize: '9px', letterSpacing: '3px', color: terminalMuted, marginBottom: '8px' }}>▸ SELECT DISPOSITION</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))', gap: '6px' }}>
                {dispositions.map((d) => (
                  <button key={d.label} onClick={() => handleDisposition(d.label)} style={{
                    padding: '10px 4px', borderRadius: '3px',
                    background: disposition === d.label ? d.color : d.bg,
                    border: `1px solid ${d.color}`,
                    color: disposition === d.label ? 'white' : d.color,
                    fontSize: '8px', fontWeight: 'bold', letterSpacing: '1px',
                    cursor: 'pointer', fontFamily: FUTURA,
                  }}>{d.label}</button>
                ))}
              </div>
            </div>
          )}

          {/* BUTTONS — predictive 4-state + non-predictive 3-state flows */}

          {isPredictive ? (
            <>
              {/* Predictive can start on ALL ACTIVE as well as on one campaign.
                  It used to require a single selected campaign, which left the
                  All Active view showing nothing but the dead placard below —
                  there was no way to even arm the engine. The controller now
                  resolves its campaign set from the queue panel's own rows, so
                  the only real requirement is having something to dial, which
                  is the same condition the non-predictive flows already use. */}
              {predictiveView === 'offline' && (isSpecificCampaign || activeScopeCampaigns.length > 0) && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px', flexShrink: 0 }}>
                  <button onClick={handleSetAvailable} style={{
                    padding: '14px', borderRadius: '4px', border: 'none',
                    background: terminalSurface, color: terminalMuted,
                    fontSize: '12px', fontWeight: 'bold', letterSpacing: '4px',
                    cursor: 'pointer', fontFamily: FUTURA,
                    borderTop: `3px solid ${terminalBorder}`, transition: 'all 0.15s',
                  }}>[ SET AVAILABLE TO DIAL ]</button>
                </div>
              )}

              {predictiveView === 'offline' && !isSpecificCampaign && activeScopeCampaigns.length === 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px', flexShrink: 0 }}>
                  <div style={{
                    padding: '14px', borderRadius: '4px', background: terminalSurface, color: terminalMuted,
                    fontSize: '12px', fontWeight: 'bold', letterSpacing: '4px',
                    textAlign: 'center', borderTop: `3px solid ${terminalBorder}`,
                  }}>[ NO ACTIVE CAMPAIGNS TO DIAL ]</div>
                </div>
              )}

              {predictiveView === 'available' && !predictiveEngineStarted && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px', flexShrink: 0 }}>
                  <button onClick={startDialSequence} style={{
                    padding: '14px', borderRadius: '4px', border: 'none',
                    background: terminalDark, color: 'var(--brand-primary)',
                    fontSize: '12px', fontWeight: 'bold', letterSpacing: '4px',
                    cursor: 'pointer', fontFamily: FUTURA,
                    borderTop: `3px solid var(--brand-primary)`, transition: 'all 0.15s',
                  }}>INITIATE DIAL SEQUENCE</button>
                </div>
              )}

              {predictiveView === 'available' && predictiveEngineStarted && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px', flexShrink: 0 }}>
                  <button onClick={() => {
                    // STOP must also INSTANTLY terminate any calls already in
                    // process (ringing/connecting fanout), not just prevent new
                    // ones. Route through the full kill switch so in-flight calls
                    // are swept and hung up server-side across the board.
                    setAmdActivity(prev => [`PREDICTIVE ENGINE STOPPED`, ...prev].slice(0, 5))
                    // abortDialing, not a full offline: stopping the engine
                    // should leave the agent live and one click from starting
                    // again, not flip them offline.
                    abortDialing()
                  }} style={{
                    padding: '14px', borderRadius: '4px', border: 'none',
                    background: '#f8e8e8', color: terminalRed,
                    fontSize: '12px', fontWeight: 'bold', letterSpacing: '4px',
                    cursor: 'pointer', fontFamily: FUTURA,
                    borderTop: `3px solid ${terminalRed}`,
                  }}>■ STOP DIAL SEQUENCE</button>
                </div>
              )}

              {/* CONTINUE is deliberately NOT in these live-call controls. It
                  redials the current lead, which is meaningless while that call
                  is still up — you are already talking to them. It belongs on
                  the after-call controls, not the live ones. */}
              {/* SKIP and TERMINATE stay distinct — they mean different things
                  to the LEAD (give up on it vs end this call) — but both now
                  leave the same way: the agent moves on at once, and the lead's
                  line is parked in the background until it clears the
                  threshold. Neither makes the agent wait. */}
              {status === 'connected' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, flexShrink: 0 }}>
                  <button onClick={handleSkip} style={{
                    padding: '14px', borderRadius: '4px',
                    background: '#f8f4e8', border: `1px solid #8a6a1a`,
                    borderTop: `3px solid #8a6a1a`, color: '#8a6a1a',
                    fontSize: '11px', fontWeight: 'bold', letterSpacing: '3px',
                    cursor: 'pointer', fontFamily: FUTURA,
                  }}>SKIP / NEXT</button>
                  <button onClick={() => { terminateCall() }} style={{
                    padding: '14px', borderRadius: '4px', border: 'none',
                    background: '#f8e8e8', borderTop: `3px solid ${terminalRed}`,
                    color: terminalRed, fontSize: '11px', fontWeight: 'bold',
                    letterSpacing: '3px', cursor: 'pointer',
                    fontFamily: FUTURA,
                  }}>■ TERMINATE CALL</button>
                </div>
              )}
            </>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: status === 'connected' ? '1fr 1fr' : status === 'preview_ready' ? '1fr 1fr' : '1fr', gap: '8px', flexShrink: 0 }}>
              {status === 'idle' && !available && (
                <button onClick={handleSetAvailable} style={{
                  padding: '14px', borderRadius: '4px', border: 'none',
                  background: terminalSurface, color: terminalMuted,
                  fontSize: '12px', fontWeight: 'bold', letterSpacing: '4px',
                  cursor: 'pointer', fontFamily: FUTURA,
                  borderTop: `3px solid ${terminalBorder}`, transition: 'all 0.15s',
                }}>[ SET AVAILABLE TO DIAL ]</button>
              )}
              {status === 'idle' && available && activeScopeCampaigns.length === 0 && (
                <div style={{
                  padding: '14px', borderRadius: '4px', background: terminalSurface, color: terminalMuted,
                  fontSize: '12px', fontWeight: 'bold', letterSpacing: '4px',
                  textAlign: 'center', borderTop: `3px solid ${terminalBorder}`,
                }}>[ NO ACTIVE CAMPAIGNS IN SCOPE ]</div>
              )}
              {status === 'idle' && available && activeScopeCampaigns.length > 0 && (
                <button onClick={startDialSequence} style={{
                  padding: '14px', borderRadius: '4px', border: 'none',
                  background: terminalDark, color: 'var(--brand-primary)',
                  fontSize: '12px', fontWeight: 'bold', letterSpacing: '4px',
                  cursor: 'pointer', fontFamily: FUTURA,
                  borderTop: `3px solid var(--brand-primary)`, transition: 'all 0.15s',
                }}>
                  {isPreview ? 'LOAD NEXT LEAD' : 'INITIATE DIAL SEQUENCE'}
                </button>
              )}
              {status === 'preview_ready' && previewLead && (
                <>
                  <button onClick={skipPreviewLead} style={{
                    padding: '14px', borderRadius: '4px',
                    background: '#f8f4e8', border: `1px solid #8a6a1a`,
                    borderTop: `3px solid #8a6a1a`, color: '#8a6a1a',
                    fontSize: '11px', fontWeight: 'bold', letterSpacing: '3px',
                    cursor: 'pointer', fontFamily: FUTURA,
                  }}>SKIP THIS LEAD</button>
                  <button onClick={dialPreviewLead} style={{
                    padding: '14px', borderRadius: '4px', border: 'none',
                    background: terminalDark, color: 'var(--brand-primary)',
                    fontSize: '12px', fontWeight: 'bold', letterSpacing: '3px',
                    cursor: 'pointer', fontFamily: FUTURA,
                    borderTop: `3px solid var(--brand-primary)`,
                  }}>DIAL THIS LEAD</button>
                </>
              )}
              {status === 'calling' && (
                <button onClick={() => { abortDialing() }} style={{
                  padding: '14px', borderRadius: '4px', border: 'none',
                  background: '#f8e8e8', color: terminalRed,
                  fontSize: '12px', fontWeight: 'bold', letterSpacing: '4px',
                  cursor: 'pointer', fontFamily: FUTURA,
                  borderTop: `3px solid ${terminalRed}`,
                }}>■ ABORT CALL</button>
              )}
              {status === 'connected' && (
                <>
                  {/* CONTINUE removed here too — same reason as the grid
                      layout above: redialing the lead you are currently
                      speaking to is not an action anyone wants mid-call. */}
                  <button onClick={handleSkip} style={{
                    padding: '14px', borderRadius: '4px',
                    background: '#f8f4e8', border: `1px solid #8a6a1a`,
                    borderTop: `3px solid #8a6a1a`, color: '#8a6a1a',
                    fontSize: '11px', fontWeight: 'bold', letterSpacing: '3px',
                    cursor: 'pointer', fontFamily: FUTURA,
                  }}>SKIP / NEXT</button>
                  <button onClick={() => { terminateCall() }} style={{
                    padding: '14px', borderRadius: '4px', border: 'none',
                    background: '#f8e8e8', borderTop: `3px solid ${terminalRed}`,
                    color: terminalRed, fontSize: '11px', fontWeight: 'bold',
                    letterSpacing: '3px', cursor: 'pointer',
                    fontFamily: FUTURA,
                  }}>■ TERMINATE CALL</button>
                </>
              )}
              {status === 'ended' && !showDisposition && (
                <button onClick={startDialSequence} style={{
                  padding: '14px', borderRadius: '4px', border: 'none',
                  background: terminalDark, color: 'var(--brand-primary)',
                  fontSize: '12px', fontWeight: 'bold', letterSpacing: '4px',
                  cursor: 'pointer', fontFamily: FUTURA,
                  borderTop: `3px solid var(--brand-primary)`,
                }}>NEXT LEAD</button>
              )}
            </div>
          )}
        </div>

        <div
          className={`dialer-right-overlay ${rightSidebarOpen ? 'open' : ''}`}
          onClick={() => setRightSidebarOpen(false)}
        />

        <aside className={`dialer-right-sidebar ${rightSidebarOpen ? 'open' : ''}`}>
          <div className="dialer-metrics-header" style={{ background: terminalDark, padding: '8px 16px', borderBottom: `1px solid ${terminalBorder}`, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '9px', letterSpacing: '3px', color: 'var(--brand-on-sidebar-muted)', fontWeight: 'bold' }}>TODAY&apos;S METRICS</span>
          </div>

          <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '5px', flexShrink: 0 }}>
            {[
              { label: 'CONNECTED', value: sessionStats.connected, color: 'var(--brand-primary)' },
              { label: 'CLOSED', value: sessionStats.closed, color: '#16a34a' },
              { label: 'APPOINTMENTS', value: sessionStats.appointments, color: '#2563eb' },
              { label: 'NOT INTERESTED', value: sessionStats.notInterested, color: '#d97706' },
              { label: 'DO NOT CALL', value: sessionStats.dnc, color: '#dc2626' },
            ].map((stat) => (
              <div key={stat.label} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '8px 12px', background: terminalSurface,
                border: `1px solid ${terminalBorder}`, borderRadius: '3px',
                borderLeft: `3px solid ${stat.color}`,
              }}>
                <span style={{ fontSize: '9px', letterSpacing: '2px', color: terminalMuted }}>{stat.label}</span>
                <span style={{ fontSize: '18px', fontWeight: 'bold', fontFamily: 'monospace', color: stat.color }}>{stat.value}</span>
              </div>
            ))}
          </div>

          <div style={{ padding: '0 12px 10px', flexShrink: 0 }}>
            <div style={{
              padding: '10px 12px', background: terminalSurface,
              border: `1px solid ${terminalBorder}`, borderRadius: '3px',
              borderTop: `3px solid ${terminalAccent}`,
            }}>
              <div style={{ fontSize: '8px', letterSpacing: '1px', color: terminalMuted, marginBottom: '3px' }}>
                TODAY&apos;S CONVERSION RATE
              </div>
              <div style={{ fontSize: '20px', fontWeight: 'bold', fontFamily: 'monospace', color: terminalAccent }}>
                {sessionStats.calls > 0
                  ? `${(((sessionStats.appointments + sessionStats.closed) / sessionStats.calls) * 100).toFixed(1)}%`
                  : '0.0%'}
              </div>
            </div>
          </div>

          <ManualDialer />

          <div style={{ background: terminalDark, padding: '6px 16px', borderBottom: `1px solid ${terminalBorder}`, flexShrink: 0 }}>
            <span style={{ fontSize: '9px', letterSpacing: '3px', color: 'var(--brand-on-sidebar-muted)', fontWeight: 'bold' }}>SYSTEM LOG</span>
          </div>
          <div style={{ padding: '5px 12px', background: '#1a1c24', height: '88px', overflowY: 'auto', flexShrink: 0 }}>
            {[
              ...amdActivity.map(a => `> ${a}`),
              status === 'connected' && `> CONNECTED — ${currentLead?.first_name} ${currentLead?.last_name}`,
              status === 'calling' && '> DIALING IN QUEUE...',
              status === 'preview_ready' && `> PREVIEW LOADED — ${previewLead?.first_name} ${previewLead?.last_name}`,
              isSpecificCampaign && currentCampaign && `> CAMPAIGN MODE: ${dialerMode.toUpperCase()} + AMD`,
              isAllActive && `> ALL ACTIVE · SESSION MODE: ${dialerMode.toUpperCase()}`,
              isPredictive && pacingInfo && `> AGENTS: ${pacingInfo.activeAgents} (READY:${pacingInfo.readyAgents}/DIALING:${pacingInfo.dialingAgents}/ONCALL:${pacingInfo.onCallAgents})`,
              isPredictive && pacingInfo && `> ABANDON: ${(pacingInfo.abandonRate * 100).toFixed(2)}%`,
              isPredictive && lastControllerSummary && `> CTRL: fired=${lastControllerSummary.fired} desired=${lastControllerSummary.desired} inflight=${lastControllerSummary.inFlight}`,
              isPredictive && lastControllerSummary && lastControllerSummary.reason && `> CTRL: ${lastControllerSummary.reason}`,
              isPredictive && shouldYield && `> SERVER ASKED TO YIELD — abandon rate near cap`,
              isPredictive && pacingInfo?.isPredictiveTeam && `> TEAM PREDICTIVE — reroute on disconnect enabled`,
              currentSessionId && '> SESSION ACTIVE',
              !isPersonalScope && currentScope && `> SCOPE: ${currentScope.name.toUpperCase()}`,
              swReady && '> AUDIO READY',
              available && `> AGENT STATE: ${agentState.toUpperCase()}`,
            ].filter(Boolean).slice(0, 14).map((log, i) => (
              <div key={i} style={{
                fontSize: '9px', fontFamily: 'monospace',
                color: i === 0 ? 'var(--brand-primary)' : '#4a5a4a',
                letterSpacing: '1px', marginBottom: '2px',
              }}>{log as string}</div>
            ))}
          </div>
        </aside>
      </div>

      {/* v23: right-edge arrow tab */}
      <button
        className="dialer-right-toggle"
        onClick={() => setRightSidebarOpen(true)}
        aria-label="Open metrics & dial pad"
      >‹</button>

      {dialZoomed && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 100,
            background: terminalDark, display: 'flex', flexDirection: 'column',
            height: '100vh', ['height' as any]: '100dvh',
            paddingTop: 'env(safe-area-inset-top)',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setDialZoomed(false)
          }}
        >
          <ManualDialer inOverlay />
        </div>
      )}
    </div>
  )
}

const navLinkStyle: React.CSSProperties = {
  padding: '10px 16px', background: 'transparent',
  border: '1px solid #2a4a8a', borderRadius: 3,
  color: 'var(--brand-primary)', fontSize: 10, fontWeight: 700, letterSpacing: 2,
  textDecoration: 'none', fontFamily: 'Futura PT, Futura, sans-serif',
}

/**
 * Safari still only exposes webkitAudioContext. One typed lookup, so the
 * fallback isn't spelled out (and cast away) at every call site.
 */
function resolveAudioContextCtor(): typeof AudioContext | undefined {
  if (typeof window === 'undefined') return undefined
  return (
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  )
}

/**
 * Short forms of the server's reason labels, for the breakdown list.
 *
 * The server sentence is prose and reads as one thought; these have to be
 * scannable in a stack of four, so they are clipped rather than reused.
 */
/**
 * What to show in the STATE column for a lead that has no state of its own.
 *
 * The calling window is enforced against a state derived from the area code
 * when the lead's own column is blank, so the dialer was already ACTING on a
 * state it never displayed. Showing a bare dash there is worse than unhelpful:
 * the agent sees "no state", the system quietly times the call as North
 * Carolina, and nothing on screen explains why a lead is being held until 9am.
 *
 * "Maybe: NC" says both things at once — here is the state we are using, and
 * here is the fact that we inferred it. An agent who knows the lead is really
 * in California can then correct the record instead of wondering.
 *
 * Deliberately only for the ABSENT case. A lead that carries its own state
 * renders exactly as before, with no hedge on data the customer supplied.
 *
 * Used ONLY on the live-call profile, not in the queue list. In a dense list of
 * rows a per-row "Maybe:" is noise — the agent is scanning, not deciding. On
 * the profile of the person currently ringing it is the opposite: that is the
 * moment the distinction between known and guessed can actually change what
 * the agent says.
 */
function displayState(lead: { state?: string | null; phone?: string | null }): {
  text: string
  inferred: boolean
} {
  const own = (lead.state || '').trim()
  if (own) return { text: own, inferred: false }

  const guessed = phoneToState(lead.phone)
  if (guessed) return { text: `Maybe: ${guessed}`, inferred: true }

  return { text: '—', inferred: false }
}

const QUEUE_REASON_LABELS: Record<string, string> = {
  no_number: 'no phone number',
  invalid_number: 'invalid phone number',
  impossible_number: 'not a routable US number',
  unknown_area: 'area code not recognised, no state set',
  toll_free: 'toll-free number, not a personal line',
  non_geographic: 'premium/service number, not a personal line',
  too_early: 'before their local calling window',
  too_late: 'past their local calling window',
  sunday: 'state prohibits Sunday calls',
  international: 'outside US calling rules',
  other: 'not dialable right now',
}

export default function DialerPage() {
  return (
    <Suspense fallback={
      <div style={{
        flex: 1,
        background: 'var(--brand-page-bg)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 'calc(100vh - 64px)',
        fontFamily: 'Futura PT, Futura, sans-serif',
      }}>
        <div style={{ fontSize: 11, letterSpacing: 4, color: 'var(--brand-muted-text)' }}>
          LOADING TERMINAL...
        </div>
      </div>
    }>
      <DialerPageInner />
    </Suspense>
  )
}