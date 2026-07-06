import { NextResponse } from 'next/server'
import { requireActive } from '@/lib/subscription'
import { auth } from '@clerk/nextjs/server'
import { placeOutboundCall } from '@/lib/placeOutboundCall'
import { logCallEvent } from '@/lib/callEvents'

export async function POST(req: Request) {
  try {
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

    // ✅ HARD GUARD: prevent invalid outbound calls
    if (!to || typeof to !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Missing or invalid phone number' },
        { status: 400 }
      )
    }

    const cleanTo = to.replace(/\D/g, '')

    if (cleanTo.length < 10) {
      return NextResponse.json(
        { success: false, error: 'Invalid phone number format' },
        { status: 400 }
      )
    }

    // ✅ HARD GUARD: prevent orphan calls (THIS IS YOUR MAIN BUG FIX)
    if (!leadId && !campaignId) {
      return NextResponse.json(
        {
          success: false,
          error: 'No lead context available — cannot place call',
        },
        { status: 400 }
      )
    }

    const result = await placeOutboundCall({
      to: cleanTo,
      userId,
      leadId,
      campaignId,
      teamId,
      source: 'user_dial',
    })

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
          detail: result.detail,
        },
        { status: result.httpStatus || 500 }
      )
    }

    void logCallEvent({
      event_type: 'initiated',
      signalwire_call_id: result.callSid ?? null,
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
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Outbound call failed',
      },
      { status: 500 }
    )
  }
}