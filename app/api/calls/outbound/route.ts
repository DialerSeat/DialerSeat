import { NextResponse } from 'next/server'
import { requireActive } from '@/lib/subscription'
import { auth } from '@clerk/nextjs/server'
import { placeOutboundCall } from '@/lib/placeOutboundCall'

// =============================================================================
// OUTBOUND CALL — user-initiated dial
// =============================================================================
// This route handles dials initiated by the dialer page UI (user clicks
// "INITIATE DIAL SEQUENCE" or types in the manual keypad).
//
// As of Deploy 3 Part B, this is a THIN WRAPPER around lib/placeOutboundCall.
// All the actual logic (TCPA, AMD config, number pool, two-leg dial) lives
// in the library so the predictive controller can share it.
//
// BEHAVIOR PRESERVED:
//   - Subscription gate (requireActive) — same
//   - Clerk auth check — same
//   - Body shape: { to, leadId, campaignId, teamId } — same
//   - Response shape: { success, callSid, agentCallSid, roomName, ... } — same
//   - HTTP status codes: 200 success, 403 no-sub, 451 TCPA, 500 error — same
//   - AMD config (1800ms threshold etc) — same, lives in placeOutboundCall
//   - Manual dial bypass (no leadId+campaignId skips TCPA) — same
//
// THE ONE FUNCTIONAL DIFFERENCE:
//   Calls source='user_dial' which places BOTH the lead leg AND the agent
//   leg into the conference (same as before — the controller is what uses
//   source='controller_fanout' which is single-leg).
// =============================================================================

export async function POST(req: Request) {
  try {
    // Subscription gate — returns 403 if no active sub
    const gate = await requireActive()
    if (gate) return gate

    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await req.json()
    const { to, leadId, campaignId, teamId } = body

    if (!to) {
      return NextResponse.json(
        { success: false, error: 'Missing destination' },
        { status: 400 }
      )
    }

    // Decide the dial source EXPLICITLY here, where we know the intent:
    //   - manual keypad dial = a number typed in directly, no lead/campaign
    //     context → source 'manual' (TCPA window bypass, the user chose this number)
    //   - campaign dial (lead and/or campaign present) → source 'user_dial'
    //     (full TCPA enforcement — these are regulated outbound calls)
    // This replaces the old behavior where the library INFERRED manual-vs-
    // campaign from absent IDs. Being explicit prevents an accidental bypass.
    const isManualKeypadDial = !leadId && !campaignId
    const dialSource = isManualKeypadDial ? 'manual' : 'user_dial'

    // Delegate everything else to the shared library.
    // source='user_dial'/'manual' both trigger the two-leg behavior:
    // place lead call AND agent call, both join conference room.
    const result = await placeOutboundCall({
      to,
      userId,
      leadId,
      campaignId,
      teamId,
      source: dialSource,
    })

    // Library returns either a success or a failure with httpStatus hint.
    if (!result.success) {
      const status = result.httpStatus || 500
      return NextResponse.json(
        {
          success: false,
          error: result.error,
          detail: result.detail,
          leadState: result.leadState,
          leadLocalTime: result.leadLocalTime,
          retryAfter: result.retryAfter,
        },
        { status }
      )
    }

    // Success — return the same shape the dialer page already expects
    return NextResponse.json({
      success: true,
      callSid: result.callSid,
      agentCallSid: result.agentCallSid,
      roomName: result.roomName,
      fromNumber: result.fromNumber,
      status: result.status,
      amdEnabled: result.amdEnabled,
      dialerMode: result.dialerMode,
      ringTimeout: result.ringTimeout,
    })
  } catch (error: any) {
    console.error('Call error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}