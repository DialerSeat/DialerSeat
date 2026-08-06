import { NextResponse } from 'next/server'
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

const LOOKBACK_MINUTES = 10

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

    let hungUp = 0
    let claimsReleased = 0

    const sinceIso = new Date(Date.now() - LOOKBACK_MINUTES * 60_000).toISOString()
    const alreadyHungUp = new Set<string>()

    const hangUpAll = async (ids: Iterable<string>) => {
      const fresh = [...ids].filter(id => id && !alreadyHungUp.has(id))
      if (fresh.length === 0) return 0
      fresh.forEach(id => alreadyHungUp.add(id))
      await Promise.all(fresh.map(async (id) => {
        try {
          await hangupCallControlId(id)
          hungUp++
        } catch (e) {
          console.error('[abort] hangup failed for', id, e)
        }
      }))
      return fresh.length
    }

    // ── WHAT IS ACTUALLY LIVE, ACCORDING TO TELNYX ─────────────────────────
    // The authoritative source, and the one that fixes the reported bug.
    //
    // The sweep below it reads our own `calls` table, which is a record of
    // what we believe we dialed — written AFTER Telnyx accepts each dial, and
    // best-effort at that. It structurally cannot see the leg placed half a
    // second ago, or one whose insert failed. In predictive those are most of
    // them, which is why stop left phones ringing.
    //
    // Telnyx knows what is ringing right now. Scoped to this user through the
    // client_state stamped on every leg at dial time (see
    // lib/placeOutboundCall), so a shared connection never leaks one tenant's
    // abort into another's live calls.
    const fromTelnyx = async () => {
      const ids = await listActiveCallControlIdsForUser(userId)
      if (ids.length > 0) {
        const n = await hangUpAll(ids)
        if (n > 0) console.warn(`[abort] Telnyx active-call sweep hung up ${n} leg(s)`)
      }
    }

    // ── AND WHAT OUR TABLE KNOWS ───────────────────────────────────────────
    // Still worth running: it reaches a leg Telnyx has already moved out of
    // "active" but that our records show as unfinished, and it costs one
    // indexed query.
    const fromDatabase = async () => {
      const { data: rows, error: callsErr } = await supabase
        .from('calls')
        .select('call_control_id, agent_call_control_id')
        .eq('user_id', userId)
        .gte('created_at', sinceIso)
        // duration is 0 while in flight and gets a real value from the hangup
        // webhook. null is included because a row that never received the
        // webhook is exactly the kind that might still be up.
        //
        // This was `.eq('duration', 0)` alone, and before that `.is('duration',
        // 0)` — which PostgREST does not accept as an equality test, so the
        // sweep silently matched nothing at all.
        .or('duration.eq.0,duration.is.null')
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

    await Promise.all([fromTelnyx(), fromDatabase()])

    // ── SECOND AND THIRD PASSES ────────────────────────────────────────────
    // A dial already in flight when STOP was pressed lands after the first
    // sweep has read. The engine is disarmed by then so nothing new starts,
    // but that last batch would otherwise ring on with nothing left to stop
    // it. Two spaced passes cover a dial that was mid-flight and one that had
    // not reached Telnyx yet. Both are cheap and idempotent — hanging up an
    // already-ended call is a no-op, and alreadyHungUp keeps us from asking
    // twice about the same leg.
    for (const delay of [1200, 1800]) {
      await new Promise(resolve => setTimeout(resolve, delay))
      const before = hungUp
      await Promise.all([fromTelnyx(), fromDatabase()])
      if (hungUp > before) {
        console.warn(`[abort] late pass caught ${hungUp - before} straggler leg(s)`)
      }
    }

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
