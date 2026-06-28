import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getServiceClient } from '@/lib/supabase'
import { runPredictiveController } from '@/lib/predictiveController'
import { STALE_HEARTBEAT_SECONDS, ABANDON_YIELD_PCT } from '@/lib/dialerConstants'

const supabase = getServiceClient('dialer/heartbeat')

// =============================================================================
// AGENT HEARTBEAT — also drives the predictive controller
// =============================================================================
// POST /api/dialer/heartbeat
// Body: { state, campaign_id, dialer_mode, current_call_id }
//
// This endpoint serves THREE purposes:
//   1. Upsert the agent_sessions row (presence tracking)
//   2. Return `should_yield` based on 30-day abandon rate (FTC throttle)
//   3. **NEW**: If agent is in predictive mode + LIVE on a campaign, invoke
//      the controller server-side to refill lines.
//
// The controller invocation is what makes ReadyMode-style "set it and forget
// it" predictive work. The agent never clicks DIAL. They toggle LIVE. The
// heartbeat fires every 5s. Every time the heartbeat fires and the agent is
// in a fillable state (ready/on_call/wrapping), we top up their lines.
//
// State definitions:
//   - paused: agent is offline / toggle is off → controller does NOT fire
//   - ready: agent is LIVE, no call routed yet → controller refills lines
//   - on_call: agent is talking → controller still refills lines in background
//                 (this is predictive's main speed advantage)
//   - wrapping: agent is dispositioning → controller still refills lines
//   - dialing: legacy transition state, treat like ready
//
// IMPORTANT: We invoke the controller AFTER the heartbeat is processed, so
// the controller sees the FRESH state. Order of operations is critical here.
// =============================================================================

// Stale-claim window and yield threshold now come from lib/dialerConstants
// (STALE_HEARTBEAT_SECONDS, ABANDON_YIELD_PCT) so they stay in lockstep with
// the controller and pacing module.
// NOTE: STALE_HEARTBEAT_SECONDS must still match the SQL stale-claim function's
// interval (15s). If you change it in dialerConstants, update the SQL too.

// Heartbeat-derived states that should trigger the controller to refill lines.
// 'paused' is intentionally absent — paused agents don't get fanout.
const CONTROLLER_TRIGGER_STATES = new Set(['ready', 'on_call', 'wrapping', 'dialing'])

// ── USER + TEAM RESOLUTION CACHE ──────────────────────────────────────────
// The heartbeat fires every 5s per agent. The agent's internal user id and
// their team (owned or member) are stable for the life of a session, yet the
// original code re-queried users + teams + team_members on EVERY beat. At 100
// concurrent agents that's ~60 wasted queries/second. We cache the resolved
// { userId, teamId } per clerk id with a short TTL so steady-state heartbeats
// do a single write (the agent_sessions upsert) instead of 3-4 reads + write.
//
// Staleness tradeoff: if a user changes teams, the heartbeat keeps using the
// old team for up to TTL. That only affects presence/pacing grouping, never
// correctness of calls, so a few minutes is perfectly safe. The cache is
// per-warm-instance memory (serverless), which is exactly where the repeated
// beats land.
const RESOLVE_TTL_MS = 5 * 60 * 1000 // 5 minutes
type ResolvedIdentity = { userId: string; teamId: string | null }
const identityCache = new Map<string, { value: ResolvedIdentity; expires: number }>()

async function resolveIdentity(clerkId: string): Promise<ResolvedIdentity | null> {
  const cached = identityCache.get(clerkId)
  if (cached && cached.expires > Date.now()) return cached.value

  // user id
  const { data: userRow } = await supabase
    .from('users')
    .select('id')
    .eq('clerk_id', clerkId)
    .maybeSingle()
  if (!userRow) return null

  // team id (owned first, then active membership)
  const teamId = await resolveTeamId(clerkId)

  const value: ResolvedIdentity = { userId: userRow.id, teamId }
  // Bound the cache so a long-lived warm instance serving many distinct users
  // can't grow memory without limit. When it gets large, drop the oldest-ish
  // entries (Map preserves insertion order, so deleting from the front is cheap
  // and good enough — TTL handles correctness regardless).
  if (identityCache.size > 5000) {
    let toDrop = 1000
    for (const key of identityCache.keys()) {
      identityCache.delete(key)
      if (--toDrop <= 0) break
    }
  }
  identityCache.set(clerkId, { value, expires: Date.now() + RESOLVE_TTL_MS })
  return value
}

async function resolveTeamId(clerkId: string): Promise<string | null> {
  const { data: ownedTeam } = await supabase
    .from('teams')
    .select('id')
    .eq('owner_id', clerkId)
    .limit(1)
    .maybeSingle()
  if (ownedTeam?.id) return ownedTeam.id

  const { data: membership } = await supabase
    .from('team_members')
    .select('team_id')
    .eq('user_id', clerkId)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()
  if (membership?.team_id) return membership.team_id

  return null
}

export async function POST(req: NextRequest) {
  try {
    const { userId: clerkId } = await auth()
    if (!clerkId) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    let body: any = {}
    try {
      body = await req.json()
    } catch {
      body = {}
    }

    const state: string = body.state || 'paused'
    const rawCampaignId: string | null = body.campaign_id ?? null
    const dialerMode: string | null = body.dialer_mode ?? null
    const rawCallId: string | null = body.current_call_id ?? null
    // GHOST-DIALING SERVER GUARD: the predictive controller (which fans out lead
    // calls) must only run when the client has EXPLICITLY armed the engine via
    // the INITIATE button — never merely because the agent toggled Available.
    // The client sends predictive_armed=true only while the engine is started.
    const predictiveArmed: boolean = body.predictive_armed === true
    // current_call_id and campaign_id are uuid columns. The client may pass a
    // provider call SID (non-uuid) or a virtual sub-campaign id ("<uuid>:appt").
    // Writing those into a uuid column throws and 500s the heartbeat. Normalize:
    //  - campaign_id: take the real uuid prefix before any ':' suffix
    //  - current_call_id: only keep if it's a valid uuid, else null
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    const campaignId: string | null = (() => {
      if (!rawCampaignId) return null
      const base = rawCampaignId.split(':')[0]
      return UUID_RE.test(base) ? base : null
    })()
    const currentCallId: string | null =
      rawCallId && UUID_RE.test(rawCallId) ? rawCallId : null

    // ── Resolve user + team (cached; see resolveIdentity) ──────────────────
    const identity = await resolveIdentity(clerkId)
    if (!identity) {
      return NextResponse.json({ error: 'user not found' }, { status: 404 })
    }
    const userInternalId = identity.userId
    const teamId = identity.teamId

    // ── Upsert agent_sessions row ──────────────────────────────────────────
    // Uses (user_id) as conflict target so each user has exactly one session
    // row. Updates state/campaign/mode/heartbeat on every tick.
    const now = new Date().toISOString()

    const { data: upserted, error: upsertErr } = await supabase
      .from('agent_sessions')
      .upsert(
        {
          user_id: userInternalId,
          team_id: teamId,
          campaign_id: campaignId,
          dialer_mode: dialerMode,
          state,
          current_call_id: currentCallId,
          last_heartbeat: now,
          updated_at: now,
        },
        { onConflict: 'user_id' }
      )
      .select('id, state, campaign_id, dialer_mode')
      .single()

    if (upsertErr || !upserted) {
      console.error('[heartbeat] upsert failed', upsertErr)
      // Degrade gracefully rather than 500-spamming the client every 5s. The
      // dialer only needs should_yield/controller info; presence is best-effort.
      return NextResponse.json({
        ok: false,
        session_id: null,
        state,
        should_yield: false,
        stale_window_seconds: STALE_HEARTBEAT_SECONDS,
        controller_invoked: false,
        controller: null,
        warning: 'session upsert failed',
      })
    }

    const sessionId = upserted.id

    // ── Compute should_yield (FTC throttle) ────────────────────────────────
    let shouldYield = false
    if (campaignId) {
      try {
        const { data: rate } = await supabase
          .from('campaign_abandon_rate_30d')
          .select('abandon_rate_pct')
          .eq('campaign_id', campaignId)
          .maybeSingle()
        if (rate && typeof rate.abandon_rate_pct === 'number') {
          shouldYield = rate.abandon_rate_pct >= ABANDON_YIELD_PCT
        }
      } catch (rateErr) {
        console.error('[heartbeat] abandon rate lookup failed', rateErr)
      }
    }

    // ── NEW: Invoke predictive controller (server-side) ────────────────────
    // This is the architectural shift. Previously the client called
    // /api/calls/predictive-tick on ready transitions. Now the heartbeat
    // itself triggers fanout, which means:
    //
    //   1. No race conditions with client state — server uses what was
    //      just upserted, fresh
    //   2. Refills happen during on_call/wrapping (background dialing)
    //   3. No client debouncing needed
    //   4. Lines stay topped up even if the page is sluggish
    //
    // Controller only fires when ALL of these are true:
    //   - dialer_mode = 'predictive'
    //   - predictive_armed = true  ← the agent pressed INITIATE (not just online)
    //   - state is in CONTROLLER_TRIGGER_STATES
    //   - campaign_id is set
    //   - shouldYield is false (FTC margin)
    //
    // The predictive_armed gate is the server-side half of the ghost-dialing
    // lockdown: without it, merely toggling Available on a predictive campaign
    // would start fanning out lead calls. Now nothing dials until the agent
    // explicitly starts the engine.
    //
    // We don't await the result for the response — the heartbeat returns
    // immediately. But we DO await within the request so failures get
    // logged. The controller itself is idempotent: if lines are full, it
    // returns fired=0 cheaply.
    let controllerInvoked = false
    let controllerSummary: any = null

    if (
      dialerMode === 'predictive' &&
      predictiveArmed &&
      campaignId &&
      !shouldYield &&
      CONTROLLER_TRIGGER_STATES.has(state)
    ) {
      controllerInvoked = true
      try {
        controllerSummary = await runPredictiveController({
          sessionId,
          campaignId,
          clerkId,
          internalUserId: userInternalId,
          teamId,
        })
      } catch (controllerErr) {
        console.error('[heartbeat] controller failed', controllerErr)
        controllerSummary = { error: 'controller threw' }
      }
    }

    return NextResponse.json({
      ok: true,
      session_id: sessionId,
      state: upserted.state,
      should_yield: shouldYield,
      stale_window_seconds: STALE_HEARTBEAT_SECONDS,
      controller_invoked: controllerInvoked,
      controller: controllerSummary,
    })
  } catch (err: unknown) {
    console.error('[heartbeat] unhandled', err)
    return NextResponse.json({ error: 'server error' }, { status: 500 })
  }
}