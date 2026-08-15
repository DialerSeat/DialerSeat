import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getServiceClient } from '@/lib/supabase'
import { runPredictiveController } from '@/lib/predictiveController'
import { STALE_HEARTBEAT_SECONDS, ABANDON_YIELD_PCT } from '@/lib/dialerConstants'
import { sendAdminPush } from '@/lib/pushNotify'
import { logCallEvent } from '@/lib/callEvents'

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

// Last time each session's predictive skip reason was written to call_events.
// Per-warm-instance, which is fine: the worst case is a few extra rows after a
// cold start, and the alternative is twelve rows a minute per idle agent.
const skipLogCache = new Map<string, number>()

// How long a gap in heartbeats counts as the agent having gone away, so that
// coming back is worth announcing again. Beats are 5s apart, so this is 60
// missed beats — long enough that a redeploy, a tab reload or a phone locking
// briefly does not read as a new arrival and re-notify.
const AGENT_ONLINE_GAP_MS = 5 * 60 * 1000
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
    // Kept only as a diagnostic now — see below. The value that GATES fan-out
    // is read from the session row, not from this.
    const clientClaimsArmed: boolean = body.predictive_armed === true
    // Ordered lead ids from the dialer's queue panel (always sent now, not
    // just when filtered/shuffled — see page.tsx). Sent as a comma-separated
    // string (consistent with how /api/leads/next already accepts lead_ids
    // as a query param) rather than a JSON array, since the heartbeat body
    // already mixes a few different shapes and this keeps it simple to
    // construct client-side without restructuring the whole payload.
    // null/absent (the key is genuinely missing) means "no constraint" —
    // the controller dials from the full active pool. An explicit empty
    // string is different from absent: it means the queue panel currently
    // shows ZERO dialable leads, and must produce a real empty allowlist
    // (blocking any dial) rather than silently falling back to "no
    // constraint," which would let predictive dial something the panel
    // isn't even showing.
    const leadIdAllowlist: string[] | null = typeof body.lead_ids === 'string'
      ? body.lead_ids.split(',').map((s: string) => s.trim()).filter(Boolean)
      : null
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

    // ── OPPORTUNISTIC STALE-CALL RECOVERY ──────────────────────────────────
    // A session can get "wedged" pinned to a call that's actually over (browser
    // crashed mid-call, then the agent returns; or the client lost track of a
    // call that already ended). Rather than wait for a cron, we self-heal on the
    // agent's own heartbeat: if the call this session would be pinned to is
    // already finished (has a disposition) or no longer exists, clear it so the
    // agent isn't stuck. A genuinely live call (no disposition yet) is untouched.
    let effectiveCallId = currentCallId
    if (effectiveCallId) {
      const { data: callRow } = await supabase
        .from('calls')
        .select('id, disposition, created_at')
        .eq('id', effectiveCallId)
        .maybeSingle()
      // Clear the pin if the call: doesn't exist, is already dispositioned
      // (finished), or is older than 30 min (no real call runs that long — this
      // catches a call that dropped without ever being dispositioned). A genuine
      // in-progress call (recent + no disposition) is preserved untouched.
      const ageMs = callRow?.created_at ? Date.now() - new Date(callRow.created_at).getTime() : 0
      if (!callRow || callRow.disposition || ageMs > 30 * 60 * 1000) {
        effectiveCallId = null
      }
    }

    // ── Upsert agent_sessions row ──────────────────────────────────────────
    // Uses (user_id) as conflict target so each user has exactly one session
    // row. Updates state/campaign/mode/heartbeat on every tick.
    const now = new Date().toISOString()

    // ── "SOMEONE IS DIALING" ───────────────────────────────────────────────
    // A heartbeat every 5 seconds has no edge to notify on — every beat looks
    // exactly like the last one. This creates the edge, and claims it
    // atomically: the UPDATE only matches when the agent has never been
    // notified, or when their previous heartbeat is old enough that they had
    // clearly gone away and come back. Whichever concurrent request matches
    // first takes the row, so N serverless instances still send exactly one
    // notification.
    //
    // Deliberately BEFORE the upsert, because the upsert overwrites
    // last_heartbeat — after it, every agent looks like they just arrived.
    //
    // A brand-new session row does not match here (no row exists yet); it is
    // inserted with online_notified_at NULL and picked up by the null branch
    // on the next beat five seconds later, which is soon enough.
    const onlineGapCutoff = new Date(Date.now() - AGENT_ONLINE_GAP_MS).toISOString()
    const { data: cameOnline } = await supabase
      .from('agent_sessions')
      .update({ online_notified_at: now })
      .eq('user_id', userInternalId)
      .or(`online_notified_at.is.null,last_heartbeat.lt.${onlineGapCutoff}`)
      .select('id')

    if (cameOnline && cameOnline.length > 0) {
      // Name resolved only on the rare beat that actually notifies, never on
      // the steady-state ones. "e060ea9f-433a-4d83…" on a lock screen tells
      // you nothing about who started dialing.
      void (async () => {
        try {
          const { data: u } = await supabase
            .from('users')
            .select('first_name, last_name, email, username')
            .eq('id', userInternalId)
            .maybeSingle()
          const label =
            [u?.first_name, u?.last_name].filter(Boolean).join(' ').trim() ||
            u?.username || u?.email || 'An agent'
          await sendAdminPush('agent_online', `${label} is online and dialing.`)
        } catch (e) {
          console.error('[heartbeat] agent-online notification failed', e)
        }
      })()
    }

    const { data: upserted, error: upsertErr } = await supabase
      .from('agent_sessions')
      .upsert(
        {
          user_id: userInternalId,
          team_id: teamId,
          campaign_id: campaignId,
          dialer_mode: dialerMode,
          state,
          // ── NEVER NULL A SERVER-ASSIGNED CALL ────────────────────────────
          // In every client-dialed mode this column mirrors what the browser
          // is on. Predictive is the opposite: the fan-out bridge assigns the
          // agent a call SERVER-side and writes it here, and the client has no
          // id at all — so it sends null, and this upsert erased the
          // assignment five seconds after it was made, every time.
          //
          // That is why answering a predictive call never opened the lead
          // profile: the row that says "you are on this call" was being
          // cleared by the very request that reports the agent is alive.
          //
          // Undefined omits the column from the upsert, leaving whatever the
          // server assigned intact. Only a client that actually has a call id
          // writes this now.
          ...(currentCallId !== null ? { current_call_id: effectiveCallId } : {}),
          // ── A PAUSED SESSION CANNOT BE ARMED ─────────────────────────────
          // Server-side invariant, independent of the client. predictive_armed
          // is durable now, so a flag left set by a session that ended badly
          // survives everything — and the agent merely going Available again
          // satisfied every controller condition and started dialing before
          // they pressed anything.
          //
          // Paused is the one state where arming is meaningless, so it is
          // cleared here unconditionally. Coming back always requires an
          // explicit INITIATE, whatever happened last time.
          ...(state === 'paused' ? { predictive_armed: false } : {}),
          last_heartbeat: now,
          updated_at: now,
        },
        { onConflict: 'user_id' }
      )
      // predictive_armed is READ here and never written by the upsert — it is
      // owned entirely by POST /api/dialer/arm. Including it in the upsert
      // payload would let every heartbeat overwrite the agent's own decision
      // with whatever the browser last computed, which is the whole class of
      // bug this replaces.
      .select('id, state, campaign_id, dialer_mode, predictive_armed, current_call_id')
      .single()

    // ── RENEW THIS AGENT'S LEAD CLAIMS ────────────────────────────────────
    // Claims expire after 30 seconds so a crashed session cannot strand a
    // lead. But dial_attempts is only incremented when a call ENDS, so a lead
    // on a three-minute conversation would otherwise expire its own claim and
    // become dialable by another agent on the same team — while the first
    // agent is still talking to them.
    //
    // Renewing here turns the claim into a lease held for exactly as long as
    // the agent is alive: the moment heartbeats stop, the lead frees itself.
    // ── RENEW ONLY WHAT IS ACTUALLY ON A CALL ─────────────────────────────
    // This renewed EVERY lead the session held, unconditionally, every five
    // seconds. A claim left behind by a call that already ended was therefore
    // kept permanently young — the stale sweep could never reach it, and no
    // age-based check anywhere could either, because its claimed_at was always
    // seconds old.
    //
    // That is what pinned predictive at "at target: 3/3 in flight" with zero
    // fan-out calls in existence: three dead claims, renewed forever, holding
    // every line against an idle dialer.
    //
    // A lease should be held by the thing it protects. Renewing is now limited
    // to leads with a live call row behind them — duration 0 and no
    // disposition, this codebase's in-flight sentinel. A lead genuinely on a
    // three-minute conversation still gets renewed for as long as it lasts,
    // which is the whole reason renewal exists; a lead whose call is over gets
    // let go by the 30-second sweep as designed.
    if (upserted?.id) {
      void (async () => {
        try {
          const { data: liveCalls } = await supabase
            .from('calls')
            .select('lead_id')
            .eq('user_id', clerkId)
            .eq('duration', 0)
            .is('disposition', null)
            .gte('created_at', new Date(Date.now() - 90_000).toISOString())

          const liveLeadIds = (liveCalls || [])
            .map(c => c.lead_id)
            .filter((id): id is string => !!id)

          if (liveLeadIds.length === 0) return

          await supabase
            .from('leads')
            .update({ claimed_at: now })
            .eq('claimed_by_session_id', upserted.id)
            .in('id', liveLeadIds)
            .not('claimed_at', 'is', null)
        } catch (e) {
          console.error('[heartbeat] claim renewal failed', e)
        }
      })()
    }

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

    // ── THE GATE READS THE ROW, NOT THE WIRE ──────────────────────────────
    // Written once by POST /api/dialer/arm when the agent starts the sequence.
    // Nothing between that click and this line can lose it: no render, no
    // effect, no interval closure. See app/api/dialer/arm/route.ts for the
    // three separate ways the browser-computed version managed to be wrong.
    const predictiveArmed: boolean = upserted.predictive_armed === true

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

    // ── WHY THE CONTROLLER DIDN'T RUN ────────────────────────────────────
    // Every condition below is a legitimate reason to skip a tick, and until
    // now skipping was completely silent. That is how predictive came to have
    // placed ZERO calls in the product's lifetime without anyone being able to
    // point at a failure: the agent armed the engine, the UI said "PREDICTIVE
    // ENGINE STARTED", and the server quietly declined on every heartbeat.
    //
    // Only computed when the agent has actually armed predictive, so this adds
    // nothing to the hot path for every other mode.
    // ── ALL ACTIVE IS NO LONGER A SKIP ────────────────────────────────────
    // This used to refuse outright without a single selected campaign, on the
    // grounds that predictive "fans out within ONE campaign". It doesn't have
    // to: the queue panel already sends its displayed lead ids on every beat,
    // and those ids carry their own campaigns. The controller resolves the
    // campaign set from them and claims per campaign in panel order.
    //
    // What remains a skip is having no leads to work from at all — an armed
    // engine on an empty panel — which is a genuinely different condition and
    // now says so.
    let controllerSkippedReason: string | null = null
    if (dialerMode === 'predictive') {
      // ── AN UNARMED ENGINE MUST SAY SO ─────────────────────────────────────
      // This whole block used to be gated on predictiveArmed, so the ONE state
      // that produces no dialing and no explanation — the client never telling
      // the server the engine was started — was also the one state that
      // reported nothing at all. The agent sees a started engine, the server
      // sees an idle one, and neither says a word about the disagreement.
      //
      // Reported first, and unconditionally, because it is the only reason
      // that describes the client rather than the data.
      if (!predictiveArmed) {
        controllerSkippedReason =
          'engine not armed — the dialer has not told the server the sequence is running'
      } else if (!campaignId && (!leadIdAllowlist || leadIdAllowlist.length === 0)) {
        controllerSkippedReason =
          'no campaign selected and the queue panel is empty — nothing to fan out across'
      } else if (shouldYield) {
        controllerSkippedReason = 'abandon rate at or above the FTC threshold — throttling'
      } else if (!CONTROLLER_TRIGGER_STATES.has(state)) {
        controllerSkippedReason = `agent state "${state}" is not a dialing state`
      }
      if (controllerSkippedReason) {
        console.warn(`[heartbeat] predictive skipped: ${controllerSkippedReason}`)
        // ── RECORDED, NOT JUST RETURNED ────────────────────────────────────
        // This reason is already sent to the client and shown in the activity
        // feed, but a reason that only exists on someone's screen cannot be
        // read back later or correlated with the call rows. Predictive has now
        // spent two days failing for a cause that was visible only in a place
        // nobody could query.
        //
        // Rate-limited to one row per session per 30s so an armed engine
        // sitting idle doesn't write twelve rows a minute forever.
        const lastLogged = skipLogCache.get(sessionId) ?? 0
        if (Date.now() - lastLogged > 30_000) {
          skipLogCache.set(sessionId, Date.now())
          await logCallEvent({
            event_type: 'fanout_idle',
            user_id: clerkId,
            campaign_id: campaignId,
            source: 'system',
            status: 'skipped',
            detail: {
              reason: controllerSkippedReason,
              predictive_armed: predictiveArmed,
              dialer_mode: dialerMode,
              state,
              allowlist_size: leadIdAllowlist?.length ?? null,
              // Client-side arming counters — these separate "the button never
              // fired" from "a guard returned early" from "it armed and
              // something cleared it", which two rounds of reading the code
              // could not.
              // Kept so a disagreement between what the browser believes and
              // what the row says is visible rather than inferred.
              client_claims_armed: clientClaimsArmed,
              arm_clicks: body.arm_clicks ?? null,
              arm_reached: body.arm_reached ?? null,
              arm_set: body.arm_set ?? null,
              arm_mode_ref: body.arm_mode_ref ?? null,
            },
          })
        }
      }
    }

    if (
      dialerMode === 'predictive' &&
      predictiveArmed &&
      (campaignId || (leadIdAllowlist && leadIdAllowlist.length > 0)) &&
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
          leadIdAllowlist,
        })
      } catch (controllerErr) {
        console.error('[heartbeat] controller failed', controllerErr)
        controllerSummary = { error: 'controller threw' }
      }
    }

    // ── TELL THE BROWSER IT IS ON A CALL ──────────────────────────────────
    // In every other mode the client dials, holds the call id, polls it, and
    // flips to the lead profile when it connects. Predictive places its lines
    // SERVER-side, so the client has no id to poll and was never informed at
    // all: a prospect could answer, the agent leg could bridge, audio could be
    // flowing, and the dialer sat on the queue panel as though nothing had
    // happened.
    //
    // The server has always known — agent_sessions.current_call_id is set the
    // moment a fan-out line claims the agent, and this route reads that row on
    // every beat. It simply never returned it.
    //
    // Returned with the lead attached so the client can render the profile
    // immediately rather than making another round trip while someone is
    // already talking. Null when the agent is not on a call, which is what
    // takes them back to the queue panel when a machine verdict releases them.
    let activeCall: {
      call_id: string
      call_control_id: string | null
      lead: Record<string, unknown> | null
    } | null = null

    // Read from the SESSION ROW, not the client's value. For predictive the
    // client has no call id — the assignment only exists server-side, which is
    // the whole reason this field had to be added.
    let assignedCallId = upserted.current_call_id ?? effectiveCallId

    // ── THE SCREEN OPENS BECAUSE SOMEBODY ANSWERED ─────────────────────────
    // Progressive shows the lead profile the instant the LEAD answers —
    // /api/calls/check reports in-progress as soon as answered_at is set, and
    // AMD decides afterwards whether the call survives. The bridge is a
    // separate concern entirely.
    //
    // Predictive's view was gated on current_call_id, which is only written
    // once a fan-out line has claimed the agent AND the agent leg has been
    // dialed. Five guards sit in front of that, any of which leaves the agent
    // staring at the queue panel through a live answered call. That is the
    // wrong dependency: answering is what opens the screen.
    //
    // So if this session has a live answered fan-out line and nothing else is
    // assigned, that is the call — same trigger progressive uses, same
    // ordering, and AMD still decides what happens next.
    if (!assignedCallId && dialerMode === 'predictive') {
      // ── A MACHINE VERDICT ENDS THE CALL *FOR THE AGENT* ──────────────────
      // The lead's leg deliberately outlives the agent on a machine: it is
      // held to clear the carrier's short-duration threshold, which is the
      // whole point of the compliance hold. But the agent was released the
      // moment the verdict landed and must go straight back to the queue
      // panel — leaving them on the lead profile for the full nine seconds is
      // exactly the "stuck watching a voicemail" this is meant to avoid.
      //
      // Same rule /api/calls/check already applies for every other mode:
      // machine or fax means over, regardless of what duration says. The hold
      // continues in the background either way; it is billing housekeeping and
      // no longer the agent's business.
      const { data: answeredLine } = await supabase
        .from('calls')
        .select('id')
        .eq('dial_group_id', sessionId)
        .not('answered_at', 'is', null)
        .eq('duration', 0)
        .is('disposition', null)
        // NULL-safe on purpose. `not.in` would drop rows where amd_result is
        // still NULL — which is every call in the first few seconds after
        // pickup, the exact window this has to fire in. A verdict that has not
        // arrived yet is not a machine.
        .or('amd_result.is.null,and(amd_result.neq.machine,amd_result.neq.fax_detected)')
        .order('answered_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (answeredLine) assignedCallId = answeredLine.id
    }

    if (assignedCallId) {
      const { data: liveCall } = await supabase
        .from('calls')
        .select('id, call_control_id, lead_id, dial_source')
        .eq('id', assignedCallId)
        .maybeSingle()

      if (liveCall) {
        let lead: Record<string, unknown> | null = null
        if (liveCall.lead_id) {
          const { data: leadRow } = await supabase
            .from('leads')
            .select('*')
            .eq('id', liveCall.lead_id)
            .maybeSingle()
          lead = leadRow ?? null
        }
        activeCall = {
          call_id: liveCall.id,
          call_control_id: liveCall.call_control_id,
          lead,
        }
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
      controller_skipped_reason: controllerSkippedReason,
      // Null unless this agent is currently pinned to a live call. Only
      // predictive needs it — every other mode already knows its own call id —
      // but it is returned unconditionally because it describes the session,
      // not the mode.
      active_call: activeCall,
    })
  } catch (err: unknown) {
    console.error('[heartbeat] unhandled', err)
    return NextResponse.json({ error: 'server error' }, { status: 500 })
  }
}