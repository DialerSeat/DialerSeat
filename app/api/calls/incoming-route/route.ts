import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// =============================================================================
// INCOMING ROUTE — polled by dialer page in predictive mode
// =============================================================================
// GET /api/calls/incoming-route
//
// The dialer page polls this every 2s while in predictive AVAILABLE state.
// When it returns `incoming: true`, the page transitions from AVAILABLE →
// ON CALL, populates the lead profile, and the SIP audio is already coming
// through the headset.
//
// Returns:
//   { incoming: false }
//   { incoming: true, call: { sid, lead_id, lead: {...}, started_at, room_name } }
//
// Determined by:
//   1. Find this agent's agent_sessions row
//   2. If session.current_call_id is set → look up that call + lead
//   3. Return lead info so the page can populate the profile
//
// The amd-result route is what SETS current_call_id (when a fanout call
// detects a human and the agent is available). So this endpoint is
// essentially asking: "amd-result, do you have any work for me?"
//
// Performance:
//   - Most polls return `incoming: false` (just one indexed lookup)
//   - When `incoming: true`, the page stops polling (transitions UI)
//   - Polling rate: 2000ms is plenty — amd-result writes happen ~1-2s
//     after human pickup, so worst-case detection lag is ~4s
// =============================================================================

export async function GET(req: NextRequest) {
  try {
    const { userId: clerkId } = await auth()
    if (!clerkId) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    // Resolve internal user ID for the agent_sessions lookup
    const { data: userRow } = await supabase
      .from('users')
      .select('id')
      .eq('clerk_id', clerkId)
      .maybeSingle()

    if (!userRow) {
      return NextResponse.json({ incoming: false, reason: 'no user row' })
    }

    // Get the current agent_session. Heartbeat upserts this every 5s.
    // If session is stale (heartbeat hasn't fired) we still return whatever
    // current_call_id is set, because amd-result writes happen instantly
    // and might beat the next heartbeat.
    const { data: session } = await supabase
      .from('agent_sessions')
      .select('id, current_call_id, state, dialer_mode, campaign_id')
      .eq('user_id', userRow.id)
      .maybeSingle()

    if (!session) {
      return NextResponse.json({ incoming: false, reason: 'no session' })
    }

    if (!session.current_call_id) {
      return NextResponse.json({
        incoming: false,
        session_state: session.state,
        session_id: session.id,
      })
    }

    // ── Look up the call + lead for the routed call ────────────────────
    const { data: call } = await supabase
      .from('calls')
      .select('id, signalwire_call_id, lead_id, phone_number, created_at, was_abandoned, disposition')
      .eq('id', session.current_call_id)
      .maybeSingle()

    if (!call) {
      // current_call_id points to a call that doesn't exist or was deleted.
      // Race condition or data inconsistency. Treat as no incoming and
      // clear the stale current_call_id.
      console.warn(`[incoming-route] session ${session.id} has current_call_id=${session.current_call_id} but no call row`)
      try {
        await supabase
          .from('agent_sessions')
          .update({ current_call_id: null, state: 'ready' })
          .eq('id', session.id)
      } catch {}
      return NextResponse.json({ incoming: false, reason: 'stale current_call_id cleared' })
    }

    // If the call is already finished (disposition set OR abandoned),
    // don't surface it as "incoming." Clear the current_call_id so the
    // agent flips back to AVAILABLE.
    if (call.disposition || call.was_abandoned) {
      try {
        await supabase
          .from('agent_sessions')
          .update({ current_call_id: null, state: 'ready' })
          .eq('id', session.id)
      } catch {}
      return NextResponse.json({
        incoming: false,
        reason: `call already ${call.disposition ? 'dispositioned' : 'abandoned'}`,
      })
    }

    // ── Fetch the lead (for the profile display) ───────────────────────
    let lead: any = null
    if (call.lead_id) {
      const { data: leadRow } = await supabase
        .from('leads')
        .select('id, first_name, last_name, phone, city, state, campaign_id, dial_attempts, extra_data')
        .eq('id', call.lead_id)
        .maybeSingle()
      if (leadRow) lead = leadRow
    }

    // Look up the room name so the client knows which conference its SIP
    // leg should be in (for diagnostic / future websocket features).
    let roomName: string | null = null
    try {
      const { data: room } = await supabase
        .from('call_rooms')
        .select('room_name')
        .eq('lead_call_sid', call.signalwire_call_id)
        .maybeSingle()
      if (room) roomName = room.room_name
    } catch {}

    return NextResponse.json({
      incoming: true,
      call: {
        id: call.id,
        sid: call.signalwire_call_id,
        lead_id: call.lead_id,
        phone_number: call.phone_number,
        started_at: call.created_at,
        room_name: roomName,
      },
      lead,
      session_id: session.id,
    })
  } catch (err: unknown) {
    console.error('[incoming-route] unhandled', err)
    return NextResponse.json({ incoming: false, error: 'server error' }, { status: 500 })
  }
}