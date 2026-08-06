import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getServiceClient } from '@/lib/supabase'
import { apiError } from '@/lib/apiError'
import { logCallEvent } from '@/lib/callEvents'
import { hangupCallControlId } from '@/lib/placeOutboundCall'

const supabase = getServiceClient('calls/hangup')

// =============================================================================
// HANGUP — user-initiated hangup of a live call (Telnyx native Call Control)
// =============================================================================
// OWNERSHIP CHECK CHANGE: the SignalWire version checked call_rooms,
// looking up by lead_call_sid/agent_call_sid. Under the no-conference
// direct-bridge architecture (see TELNYX-MIGRATION-DESIGN.md), call_rooms
// is no longer written to at all — there's no room to track. Ownership is
// now checked against the calls table instead, which IS still written on
// every placeOutboundCall (see lib/placeOutboundCall.ts), keyed by the
// same shared call_control_id column that now holds the Telnyx
// call_control_id.
//
// NOTE: this only covers hanging up the LEAD leg by its own
// call_control_id (what "sid" means here — same param name kept for
// frontend compatibility). The agent's own SIP leg ends naturally when
// their softphone hangs up locally; we don't need to separately hang up
// the agent leg from the server. For aborting an in-flight (not yet
// answered) dial, see app/api/dialer/abort/route.ts instead, which is the
// "cancel before pickup" path this route doesn't handle.
// =============================================================================

export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { sid } = body

    if (!sid) {
      return NextResponse.json({ success: false, error: 'No SID' }, { status: 400 })
    }

    // Verify the caller owns this call before hanging it up.
    const { data: callRow } = await supabase
      .from('calls')
      .select('user_id')
      .eq('call_control_id', sid)
      .maybeSingle()

    if (!callRow || callRow.user_id !== userId) {
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
    }

    await hangupCallControlId(sid)

    void logCallEvent({
      event_type: 'hangup_requested',
      call_control_id: sid,
      user_id: userId,
      source: 'dialer',
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return apiError(error, { route: 'calls/hangup' })
  }
}