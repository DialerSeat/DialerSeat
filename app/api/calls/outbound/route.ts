import { NextResponse } from 'next/server'
import { requireActive } from '@/lib/subscription'
import { auth } from '@clerk/nextjs/server'
import { shouldMaskCampaign } from '@/lib/leadMasking'
import { supabaseAdmin } from '@/lib/supabase'
import { placeOutboundCall } from '@/lib/placeOutboundCall'
import { apiError } from '@/lib/apiError'
import { logCallEvent } from '@/lib/callEvents'

// =============================================================================
// OUTBOUND CALL — user-initiated dial
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

    // ── ON A MASKED CAMPAIGN THE CLIENT DOES NOT KNOW THE NUMBER ────────
    // The queue sends back "(•••) •••-4821" instead of the real thing, so the
    // number has to be resolved here from the lead id. Which is the safer
    // arrangement regardless: a dialer that places calls to whatever
    // destination a browser hands it is trusting the wrong end of the wire.
    let destination = to
    if (leadId && (await shouldMaskCampaign(campaignId, userId))) {
      const { data: lead } = await supabaseAdmin
        .from('leads')
        .select('phone, campaign_id')
        .eq('id', leadId)
        .maybeSingle()

      if (!lead?.phone) {
        return NextResponse.json(
          { success: false, error: 'Lead not found' },
          { status: 404 }
        )
      }
      // The lead must actually belong to the campaign it was claimed under —
      // otherwise a masked campaign becomes a way to dial any lead by id.
      if (campaignId && lead.campaign_id && lead.campaign_id !== campaignId) {
        return NextResponse.json(
          { success: false, error: 'Lead is not on this campaign' },
          { status: 403 }
        )
      }
      destination = lead.phone
    }

    if (!destination) {
      return NextResponse.json(
        { success: false, error: 'Missing destination' },
        { status: 400 }
      )
    }

    const result = await placeOutboundCall({
      to: destination,
      userId,
      leadId,
      campaignId,
      teamId,
      source: 'user_dial',
    })

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

    void logCallEvent({
      event_type: 'initiated',
      call_control_id: result.callControlId ?? null,
      user_id: userId,
      lead_id: leadId ?? null,
      campaign_id: campaignId ?? null,
      status: result.status ?? null,
      source: 'dialer',
      detail: {
        amdEnabled: result.amdEnabled,
        dialerMode: result.dialerMode,
      },
    })

    // NOTE: response keys (callSid, agentCallSid, roomName) are kept as-is
    // for frontend compatibility — app/dashboard/dialer/page.tsx reads
    // data.callSid/data.agentCallSid unchanged. Only the INTERNAL
    // PlaceCallResult field names changed when placeOutboundCall.ts was
    // rewritten for native Call Control (callSid -> callControlId,
    // agentCallSid -> agentCallControlId, roomName removed entirely since
    // there's no conference room under the direct-bridge design — see
    // TELNYX-MIGRATION-DESIGN.md). roomName is sent back as null rather
    // than omitted, so existing frontend code that reads
    // data.roomName doesn't hit an undefined-vs-missing-key surprise.
    return NextResponse.json({
      success: true,
      callSid: result.callControlId,
      agentCallSid: result.agentCallControlId,
      roomName: null,
      fromNumber: result.fromNumber,
      status: result.status,
      amdEnabled: result.amdEnabled,
      dialerMode: result.dialerMode,
      ringTimeout: result.ringTimeout,
    })

  } catch (error: any) {
    // 🔥 FIX: expose real error instead of hiding it in apiError()
    console.error("OUTBOUND CALL ERROR:", error)

    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Unknown error',
        stack: error?.stack,
      },
      { status: 500 }
    )
  }
}