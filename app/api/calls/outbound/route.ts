import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireActive } from '@/lib/subscription'
import { auth } from '@clerk/nextjs/server'
import { pickNumberForLead, recordUsage } from '@/lib/numberPool'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  try {
    // Hard gate: only active subscribers can initiate outbound calls.
    const gate = await requireActive()
    if (gate) return gate

    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { to } = body

    if (!to) {
      return NextResponse.json({ success: false, error: 'Missing destination' }, { status: 400 })
    }

    const spaceUrl = process.env.SIGNALWIRE_SPACE_URL
    const projectId = process.env.SIGNALWIRE_PROJECT_ID
    const apiToken = process.env.SIGNALWIRE_API_TOKEN
    const sipUsername = process.env.SIGNALWIRE_SIP_USERNAME
    const sipDomain = process.env.SIGNALWIRE_SIP_DOMAIN
    const appUrl = process.env.NEXT_PUBLIC_APP_URL

    if (!spaceUrl || !projectId || !apiToken || !sipUsername || !sipDomain || !appUrl) {
      return NextResponse.json({ success: false, error: 'Missing credentials' }, { status: 500 })
    }

    const toFormatted = to.startsWith('+') ? to : `+1${to.replace(/\D/g, '')}`

    // Pick a pool number based on the lead's area code (local presence).
    // Falls back through state -> region -> any active number.
    const poolNumber = await pickNumberForLead(toFormatted)

    if (!poolNumber) {
      // Pool is empty or all numbers are at daily cap.
      // Fall back to the legacy SIGNALWIRE_PHONE_NUMBER env var so we don't
      // hard-fail in production if the pool isn't seeded yet.
      const fallback = process.env.SIGNALWIRE_PHONE_NUMBER
      if (!fallback) {
        return NextResponse.json(
          {
            success: false,
            error: 'No phone numbers available in pool. Contact admin.',
          },
          { status: 503 }
        )
      }
      console.warn('[calls/outbound] Pool empty, using SIGNALWIRE_PHONE_NUMBER fallback')
      return await placeCall(toFormatted, fallback, null, userId, {
        spaceUrl, projectId, apiToken, sipUsername, sipDomain, appUrl,
      })
    }

    // Normal path: dial from the pool number.
    return await placeCall(toFormatted, poolNumber.phone_number, poolNumber.id, userId, {
      spaceUrl, projectId, apiToken, sipUsername, sipDomain, appUrl,
    })
  } catch (error: any) {
    console.error('Call error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

interface PlaceCallEnv {
  spaceUrl: string
  projectId: string
  apiToken: string
  sipUsername: string
  sipDomain: string
  appUrl: string
}

async function placeCall(
  toFormatted: string,
  fromNumber: string,
  poolNumberId: string | null,
  userId: string,
  env: PlaceCallEnv
) {
  const roomName = `room-${Date.now()}`
  const authHeader = 'Basic ' + Buffer.from(`${env.projectId}:${env.apiToken}`).toString('base64')
  const callsUrl = `https://${env.spaceUrl}/api/laml/2010-04-01/Accounts/${env.projectId}/Calls.json`

  // 1) Dial the lead from the pool/fallback number into the conference room.
  const leadCallResponse = await fetch(callsUrl, {
    method: 'POST',
    headers: {
      'Authorization': authHeader,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      To: toFormatted,
      From: fromNumber,
      Url: `${env.appUrl}/api/calls/twiml?room=${roomName}&record=true`,
      StatusCallback: `${env.appUrl}/api/calls/status`,
      StatusCallbackMethod: 'POST',
    }).toString(),
  })

  const leadData = await leadCallResponse.json()
  console.log('Lead call response:', leadData)

  if (!leadCallResponse.ok) {
    return NextResponse.json(
      { success: false, error: leadData.message || 'Lead call failed' },
      { status: 500 }
    )
  }

  // The dial succeeded (or at least was accepted by SignalWire). Record usage on
  // the pool number now, BEFORE waiting for connect, because the dial attempt
  // itself counts against the number's reputation budget with carriers.
  // Skip if we used the fallback env var (no pool entry to charge).
  if (poolNumberId) {
    try {
      await recordUsage(poolNumberId)
    } catch (err) {
      // Non-fatal — the call is already going. Log and move on.
      console.error('[calls/outbound] recordUsage failed:', err)
    }
  }

  // 2) Dial the agent (browser SIP) into the same conference room.
  const agentSipUri = `sip:${env.sipUsername}@${env.sipDomain}`
  const agentCallResponse = await fetch(callsUrl, {
    method: 'POST',
    headers: {
      'Authorization': authHeader,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      To: agentSipUri,
      From: fromNumber,
      Url: `${env.appUrl}/api/calls/twiml-agent?room=${roomName}`,
    }).toString(),
  })

  const agentData = await agentCallResponse.json()
  console.log('Agent call response:', agentData)

  if (!agentCallResponse.ok) {
    console.warn('Agent call failed but lead call succeeded:', agentData)
  }

  // Track the room->user mapping so when the recording webhook fires we know
  // who owns the recording.
  try {
    await supabase.from('call_rooms').upsert({
      room_name: roomName,
      user_id: userId,
      phone_number: toFormatted,
      lead_call_sid: leadData.sid,
      agent_call_sid: agentData?.sid || null,
      created_at: new Date().toISOString(),
      // Track which pool number was used for this call
      pool_number_id: poolNumberId,
    })
  } catch (e) {
    console.warn('call_rooms tracking skipped:', e)
  }

  return NextResponse.json({
    success: true,
    callSid: leadData.sid,
    agentCallSid: agentData?.sid,
    roomName,
    fromNumber,
    status: leadData.status,
  })
}