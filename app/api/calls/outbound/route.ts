import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireActive } from '@/lib/subscription'
import { auth } from '@clerk/nextjs/server'
import { pickNumberForLead, recordUsage } from '@/lib/numberPool'
import { isCallableNow } from '@/lib/callingWindow'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  try {
    const gate = await requireActive()
    if (gate) return gate

    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { to, leadId, campaignId, teamId } = body

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

    // ── TCPA WINDOW PRE-FLIGHT (defense in depth) ─────────────────────────
    // /api/leads/next already filters callable leads, but a stale lead-id
    // or a manual dial could bypass that. This endpoint is the last gate
    // before we hit SignalWire. Returns HTTP 451 if outside window.
    let leadStateForTcpa: string | null = null
    if (leadId) {
      const { data: lead } = await supabase
        .from('leads')
        .select('phone, state, user_id')
        .eq('id', leadId)
        .maybeSingle()
      if (lead && lead.user_id === userId) {
        leadStateForTcpa = lead.state
      }
    }

    const tcpaCheck = isCallableNow({
      phone: toFormatted,
      state: leadStateForTcpa,
    })

    if (!tcpaCheck.allowed) {
      return NextResponse.json({
        success: false,
        error: 'Cannot dial outside calling window',
        detail: tcpaCheck.reason,
        leadState: tcpaCheck.leadState,
        leadLocalTime: tcpaCheck.leadLocalTime,
        retryAfter: tcpaCheck.retryAfter?.toISOString(),
      }, { status: 451 })  // 451 Unavailable For Legal Reasons (RFC 7725)
    }

    let amdEnabled = false
    let dialerMode = 'power'
    if (campaignId) {
      const { data: campaign } = await supabase
        .from('campaigns')
        .select('amd_enabled, dialer_mode')
        .eq('id', campaignId)
        .maybeSingle()
      if (campaign) {
        amdEnabled = !!campaign.amd_enabled
        dialerMode = campaign.dialer_mode || 'power'
      }
    }

    const poolNumber = await pickNumberForLead(toFormatted)

    if (!poolNumber) {
      const fallback = process.env.SIGNALWIRE_PHONE_NUMBER
      if (!fallback) {
        return NextResponse.json(
          { success: false, error: 'No phone numbers available in pool. Contact admin.' },
          { status: 503 }
        )
      }
      console.warn('[calls/outbound] Pool empty, using SIGNALWIRE_PHONE_NUMBER fallback')
      return await placeCall(toFormatted, fallback, null, userId, leadId, campaignId, teamId, amdEnabled, dialerMode, {
        spaceUrl, projectId, apiToken, sipUsername, sipDomain, appUrl,
      })
    }

    return await placeCall(toFormatted, poolNumber.phone_number, poolNumber.id, userId, leadId, campaignId, teamId, amdEnabled, dialerMode, {
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
  leadId: string | null | undefined,
  campaignId: string | null | undefined,
  teamId: string | null | undefined,
  amdEnabled: boolean,
  dialerMode: string,
  env: PlaceCallEnv
) {
  const roomName = `room-${Date.now()}`
  const authHeader = 'Basic ' + Buffer.from(`${env.projectId}:${env.apiToken}`).toString('base64')
  const callsUrl = `https://${env.spaceUrl}/api/laml/2010-04-01/Accounts/${env.projectId}/Calls.json`

  const isTsrRegulated = dialerMode === 'progressive' || dialerMode === 'predictive'
  const ringTimeout = isTsrRegulated ? '20' : '60'

  const outboundParams: Record<string, string> = {
    To: toFormatted,
    From: fromNumber,
    Url: `${env.appUrl}/api/calls/twiml?room=${roomName}&record=true&campaignId=${campaignId || ''}`,
    StatusCallback: `${env.appUrl}/api/calls/status`,
    StatusCallbackMethod: 'POST',
    Timeout: ringTimeout,
  }

  if (amdEnabled) {
    outboundParams.MachineDetection = 'DetectMessageEnd'
    outboundParams.AsyncAmd = 'true'
    outboundParams.AsyncAmdStatusCallback = `${env.appUrl}/api/calls/amd-result`
    outboundParams.AsyncAmdStatusCallbackMethod = 'POST'
    outboundParams.MachineDetectionTimeout = '20'
    outboundParams.MachineDetectionSpeechThreshold = '2400'
    outboundParams.MachineDetectionSpeechEndThreshold = '1200'
    outboundParams.MachineDetectionSilenceTimeout = '5000'
  }

  const leadCallResponse = await fetch(callsUrl, {
    method: 'POST',
    headers: {
      'Authorization': authHeader,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(outboundParams).toString(),
  })

  const leadData = await leadCallResponse.json()
  console.log('Lead call response:', leadData)

  if (!leadCallResponse.ok) {
    return NextResponse.json(
      { success: false, error: leadData.message || 'Lead call failed' },
      { status: 500 }
    )
  }

  try {
    await supabase.from('calls').insert({
      user_id: userId,
      lead_id: leadId || null,
      campaign_id: campaignId || null,
      team_id: teamId || null,
      phone_number: toFormatted,
      signalwire_call_id: leadData.sid,
      duration: 0,
      disposition: null,
    })
  } catch (insertErr) {
    console.error('[calls/outbound] Failed to insert calls row:', insertErr)
  }

  if (poolNumberId) {
    try {
      await recordUsage(poolNumberId)
    } catch (err) {
      console.error('[calls/outbound] recordUsage failed:', err)
    }
  }

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

  try {
    await supabase.from('call_rooms').upsert({
      room_name: roomName,
      user_id: userId,
      phone_number: toFormatted,
      lead_call_sid: leadData.sid,
      agent_call_sid: agentData?.sid || null,
      created_at: new Date().toISOString(),
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
    amdEnabled,
    dialerMode,
    ringTimeout,
  })
}