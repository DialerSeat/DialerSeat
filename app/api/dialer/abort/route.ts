import { NextResponse, after } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'
import { apiError } from '@/lib/apiError'
import { hangupCallControlId, listActiveCallControlIdsForUser } from '@/lib/placeOutboundCall'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

// =============================================================================
// /api/dialer/abort — HARD SERVER-SIDE SHUTDOWN for one agent
// =============================================================================
// When the agent hits ABORT/TERMINATE, the client tears down what it can, but
// it cannot silence calls it doesn't have IDs for — e.g. a predictive/auto
// dial that was placed server-side and is now being ANSWERED in the background
// (the "numbers making noise after I aborted" bug). This endpoint is the
// server's half of the kill switch:
//
//   1. Find every recent `calls` row for this user (last few minutes) and hang
//      up the lead leg via Telnyx Call Control. This stops in-flight ringing
//      and already-answered background calls — matches the product
//      requirement that cancelling an active dial stops the lead's number
//      from ringing instantly.
//   2. Release every lead this agent's sessions have claimed, so the controller
//      doesn't think work is still in progress and the leads return to the pool.
//   3. Mark the agent's sessions paused so the heartbeat controller won't
//      immediately re-fill on the next beat.
//
// TWO SOURCES, DELIBERATELY. Reading only our own `calls` table was the bug:
// that table records what we believe we dialed, written after Telnyx accepts
// each dial and best-effort at that, so it cannot see a leg placed a moment
// ago or one whose insert failed. Telnyx's active-call list knows what is
// actually ringing, and every leg carries a client_state naming its owner, so
// the sweep can be both authoritative and correctly scoped to one agent on a
// connection shared by every tenant.
//
// Idempotent and best-effort: every step is wrapped so a single failure can't
// block the others. Returns counts for observability.
// =============================================================================


export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // ── SCOPE ────────────────────────────────────────────────────────────
    // 'all'   (default) — the full kill switch: hang up in-flight calls,
    //         release claims, pause sessions. Used when the agent stops
    //         working entirely.
    // 'calls' — hang up in-flight calls ONLY, leaving claims and sessions
    //         alone so the agent keeps working.
    //
    // 'calls' exists for TERMINATE CALL. In power/progressive the client can
    // hang up unaided because it holds the one call id there is. Predictive
    // places several lines SERVER-side that the client has no ids for, so
    // terminating a predictive call left every other fanned-out line ringing
    // the lead's phone with nothing able to stop it. Terminate needs the
    // sweep — it just must not also end the agent's session, which is what
    // the full abort does.
    const body = await req.json().catch(() => ({}))
    const scope: 'all' | 'calls' = body?.scope === 'calls' ? 'calls' : 'all'

    // ── DISARM FIRST, BEFORE ANYTHING ELSE ────────────────────────────────
    // Hanging up the live lines is pointless while the engine is still armed:
    // the next heartbeat is at most five seconds away and will simply fan out
    // a fresh batch. Pressing STOP and watching the phone keep ringing is
    // exactly that race.
    //
    // The client also calls /api/dialer/arm, but that is a separate
    // fire-and-forget request that can land after the next beat — or not at
    // all. The kill switch must not depend on a second request succeeding, so
    // it clears the flag itself, first, and awaits it.
    try {
      const { data: userRow } = await supabase
        .from('users')
        .select('id')
        .eq('clerk_id', userId)
        .maybeSingle()
      if (userRow) {
        await supabase
          .from('agent_sessions')
          .update({ predictive_armed: false })
          .eq('user_id', userRow.id)
      }
    } catch (disarmErr) {
      console.error('[abort] failed to clear predictive_armed:', disarmErr)
    }

    let hungUp = 0
    let claimsReleased = 0

    const alreadyHungUp = new Set<string>()

    /**
     * Hang up a set of legs, a few at a time.
     *
     * BOUNDED ON PURPOSE. This used to be an unbounded Promise.all, which
     * turned one abort into a burst of dozens of simultaneous Call Control
     * requests. Telnyx rate-limits those, and the request that actually
     * matters — the client's own hangup of the live call, fired at the same
     * instant — ends up queued behind the burst. The symptom is the phone
     * carrying on ringing for a second or two after STOP, which is precisely
     * the thing this whole endpoint exists to prevent.
     */
    const hangUpAll = async (ids: Iterable<string>) => {
      const fresh = [...ids].filter(id => id && !alreadyHungUp.has(id))
      if (fresh.length === 0) return 0
      fresh.forEach(id => alreadyHungUp.add(id))

      const CONCURRENCY = 5
      for (let i = 0; i < fresh.length; i += CONCURRENCY) {
        await Promise.all(fresh.slice(i, i + CONCURRENCY).map(async (id) => {
          try {
            await hangupCallControlId(id)
            hungUp++
          } catch (e) {
            console.error('[abort] hangup failed for', id, e)
          }
        }))
      }
      return fresh.length
    }

    // ── PRIMARY: WHAT TELNYX SAYS IS LIVE ─────────────────────────────────
    // Authoritative, and — the part that matters here — SMALL. It returns the
    // handful of legs actually up right now, scoped to this agent by the
    // client_state stamped at dial time.
    const fromTelnyx = async () => {
      const ids = await listActiveCallControlIdsForUser(userId)
      if (ids.length > 0) {
        const n = await hangUpAll(ids)
        if (n > 0) console.warn(`[abort] Telnyx active-call sweep hung up ${n} leg(s)`)
      }
    }

    // ── BACKSTOP: A LEG TOO NEW FOR TELNYX'S LIST ─────────────────────────
    // Deliberately a NARROW window, and this is the fix for the regression.
    //
    // The filter is `duration = 0`, which reads like an in-flight sentinel and
    // is not one: it is the permanent resting value of every call nobody
    // answered — 1,404 of 1,831 rows over thirty days. Over a ten-minute
    // lookback that matched every call placed in the session, so a single
    // abort tried to hang up dozens of long-dead calls and drowned the live
    // one in rate-limited noise.
    //
    // 90 seconds is enough to cover a leg placed moments ago that Telnyx has
    // not surfaced in active_calls yet, while keeping the set to the few calls
    // that could plausibly still be up. The ring timeout is 20-60s, so
    // anything older than this is finished regardless of what `duration` says.
    const RECENT_MS = 90_000
    const fromDatabase = async () => {
      const { data: rows, error: callsErr } = await supabase
        .from('calls')
        .select('call_control_id, agent_call_control_id')
        .eq('user_id', userId)
        .gte('created_at', new Date(Date.now() - RECENT_MS).toISOString())
        .or('duration.eq.0,duration.is.null')
        .limit(40)
      if (callsErr) {
        console.error('[abort] calls lookup failed:', callsErr)
        return
      }

      const ids: string[] = []
      for (const c of rows || []) {
        if (c.call_control_id) ids.push(c.call_control_id)
        // Agent legs get no row of their own, so they live on the lead's row.
        // Hanging up the lead does not reliably tear down an agent leg that is
        // still ringing: it was dialed first and only linked via link_to.
        if (c.agent_call_control_id) ids.push(c.agent_call_control_id)
      }
      await hangUpAll(ids)
    }

    // Telnyx first and ALONE, then the backstop. Sequential rather than
    // parallel so the authoritative, live set is dealt with before any
    // best-effort extras compete for the same rate limit.
    await fromTelnyx()
    await fromDatabase()

    // ── ONE LATE PASS, AFTER THE RESPONSE ─────────────────────────────────
    // A dial already in flight when STOP was pressed lands after the sweep has
    // read. The engine is disarmed by then so nothing new starts, but that
    // last leg would otherwise ring on.
    //
    // One pass, not two: each is another burst against the same rate limit,
    // and the first sweep now uses the authoritative source so there is far
    // less left to catch. after() lets the response go immediately — the
    // client waits on this request before showing the dial as stopped.
    after(async () => {
      await new Promise(resolve => setTimeout(resolve, 1500))
      const before = hungUp
      await fromTelnyx()
      await fromDatabase()
      if (hungUp > before) {
        console.warn(`[abort] late pass caught ${hungUp - before} straggler leg(s)`)
      }
    })

    // Calls-only scope stops here: the lines are silenced, but the agent's
    // claims and session stay intact so they keep working.
    if (scope === 'calls') {
      return NextResponse.json({ success: true, hungUp, scope })
    }

    // ── 2. Release this agent's claimed leads ────────────────────────────────
    // Find the agent's session ids, then clear claims tied to them so the
    // controller stops treating those leads as in-flight.
    const { data: sessions } = await supabase
      .from('agent_sessions')
      .select('id')
      .eq('user_id', userId)
    const sessionIds = (sessions || []).map(s => s.id).filter(Boolean)
    if (sessionIds.length > 0) {
      const { data: released, error: relErr } = await supabase
        .from('leads')
        .update({ claimed_at: null, claimed_by_session_id: null })
        .in('claimed_by_session_id', sessionIds)
        .select('id')
      if (relErr) {
        console.error('[abort] lead claim release failed:', relErr)
      } else {
        claimsReleased = released?.length || 0
      }
    }

    // ── 3. Pause the agent's sessions so the controller won't re-fill ─────────
    const { error: pauseErr } = await supabase
      .from('agent_sessions')
      .update({ state: 'paused', current_call_id: null })
      .eq('user_id', userId)
    if (pauseErr) {
      console.error('[abort] session pause failed:', pauseErr)
    }

    return NextResponse.json({ success: true, hungUp, claimsReleased })
  } catch (error: any) {
    return apiError(error, { route: 'dialer/abort' })
  }
}
