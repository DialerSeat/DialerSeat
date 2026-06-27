import { NextResponse } from 'next/server'
import { requireActive } from '@/lib/subscription'
import { auth } from '@clerk/nextjs/server'
import { placeOutboundCall } from '@/lib/placeOutboundCall'
import { apiError } from '@/lib/apiError'

// =============================================================================
// OUTBOUND CALL — user-initiated dial
// =============================================================================
// Thin wrapper around lib/placeOutboundCall. All the real logic (phone
// normalization, TCPA window enforcement, AMD config, number pool, two-leg
// dial) lives in the library so the predictive controller shares it.
//
// IMPORTANT ARCHITECTURE NOTE — why this route does NOT pass source='manual':
//   The library decides manual-vs-campaign INTERNALLY via `isManualDial`
//   (!leadId && !campaignId). Its `source` parameter only distinguishes the
//   TWO-LEG dialer path ('user_dial') from the single-leg predictive controller
//   path ('controller_fanout'). There is no 'manual' source — passing one is a
//   type error. Manual keypad dials are 'user_dial' with no lead/campaign IDs,
//   and the library skips the TCPA window for them automatically.
//
//   (A previous draft tried source='manual'; that value does not exist in
//   PlaceCallParams and fails to compile. This is the correct contract.)
//
// PHONE NORMALIZATION:
//   Lives in lib/placeOutboundCall.ts (normalizeToE164), applied at the single
//   choke-point every dial path passes through — so the predictive controller
//   gets it too, not just this route. Do NOT duplicate it here.
//
// PRESERVED BEHAVIOR:
//   - Subscription gate (requireActive) → 403 if no active sub
//   - Clerk auth check → 401 if not signed in
//   - Body shape: { to, leadId, campaignId, teamId }
//   - Response shape: { success, callSid, agentCallSid, roomName, ... }
//   - Status codes: 200 / 401 / 403 / 422 (bad number) / 451 (TCPA) / 500
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

    // Delegate to the shared library. Always 'user_dial' from this route — the
    // library detects manual keypad dials (no leadId/campaignId) on its own and
    // handles the TCPA bypass there. Phone normalization also happens in the
    // library, so we pass `to` through untouched.
    const result = await placeOutboundCall({
      to,
      userId,
      leadId,
      campaignId,
      teamId,
      source: 'user_dial',
    })

    // Library returns either success or a failure carrying an httpStatus hint
    // (422 for an un-dialable number, 451 for TCPA window, 503 for empty pool,
    // 500 for missing credentials, etc.). Surface it as-is.
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

    // Success — same shape the dialer page already expects
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
    return apiError(error, { route: 'calls/outbound' })
  }
}