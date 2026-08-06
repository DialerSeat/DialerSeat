import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'
import { apiError } from '@/lib/apiError'
import { hangupCallControlId } from '@/lib/placeOutboundCall'

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
// SOURCE CHANGE FROM SIGNALWIRE VERSION: the old version pulled both leg
// SIDs from call_rooms (lead_call_sid, agent_call_sid). Under the
// no-conference direct-bridge architecture, call_rooms is no longer
// written to at all (see TELNYX-MIGRATION-DESIGN.md) — there's no room to
// track. This version pulls the lead leg's call_control_id from the
// `calls` table instead (call_control_id column, same one every other
// rewritten route uses). We only need to hang up the LEAD leg here: for a
// user_dial call, hanging up the lead leg via Telnyx also tears down the
// bridged agent leg (they're linked); for a controller_fanout call with no
// agent bridged yet, there's no separate agent leg in flight to worry
// about — the agent's own SIP leg (if any was reactively dialed for
// overflow) will simply stop ringing on its own once the lead leg it was
// linked to is gone.
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

    // ── 1. Hang up the lead leg of every recent call for this user ─────────
    const sinceIso = new Date(Date.now() - LOOKBACK_MINUTES * 60_000).toISOString()
    const { data: recentCalls, error: callsErr } = await supabase
      .from('calls')
      .select('call_control_id')
      .eq('user_id', userId)
      .gte('created_at', sinceIso)
      // .eq, NOT .is — PostgREST's `is` operator only accepts null/true/false/
      // unknown, so `.is('duration', 0)` is not an equality test and matched
      // nothing. The sweep therefore hung up NOTHING, silently.
      //
      // It looked fine in power/progressive because the client separately
      // hangs up the one call id it knows about, which is all those modes
      // have. Predictive places N calls server-side that the client has no
      // ids for and relies entirely on this sweep — so aborting predictive
      // left every fanned-out line ringing the lead's phone with no way to
      // stop it. That is the reported "abort doesn't stop the ringing".
      //
      // duration = 0 is the in-flight sentinel; a finished call always has a
      // real duration (floored at 1) written by the hangup webhook.
      .eq('duration', 0)
    if (callsErr) {
      console.error('[abort] calls lookup failed:', callsErr)
    }

    const callControlIds = new Set<string>()
    for (const c of recentCalls || []) {
      if (c.call_control_id) callControlIds.add(c.call_control_id)
    }
    // Hang them up in parallel; each is best-effort — hangupCallControlId
    // already treats "already gone" (404/422) as a non-fatal outcome.
    await Promise.all(
      [...callControlIds].map(async (id) => {
        try {
          await hangupCallControlId(id)
          hungUp++
        } catch (e) {
          console.error('[abort] hangup failed for', id, e)
        }
      })
    )

    // Calls-only scope stops here: the lines are silenced, but the agent's
    // claims and session stay intact so they keep working.
    if (scope === 'calls') {
      return NextResponse.json({ success: true, hungUp, claimsReleased: 0, scope })
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
