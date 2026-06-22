import { createClient } from '@supabase/supabase-js'
import { pickNumberForLead, recordUsage } from '@/lib/numberPool'
import { isCallableNow } from '@/lib/callingWindow'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// =============================================================================
// PLACE OUTBOUND CALL — shared core logic
// =============================================================================
// This is the SignalWire call placement extracted from app/api/calls/outbound.
// Both the user-facing /api/calls/outbound route AND the predictive controller
// call this function. Single source of truth for:
//   - TCPA window enforcement (skipped for manual dials)
//   - SignalWire MachineDetection (AMD) parameters
//   - Number pool selection
//   - Two-call architecture (lead leg + agent leg into a shared conference)
//   - calls table insertion
//   - call_rooms tracking
//
// IMPORTANT: This function preserves the exact behavior of outbound/route.ts.
// Any change in here changes behavior for the live API as well.
//
// Two call modes:
//   - source='user_dial': fired by the dialer page (user clicks dial). Places
//     BOTH a lead call AND an agent call. Default behavior.
//   - source='controller_fanout': fired by the predictive controller. Places
//     ONLY the lead call (no agent leg). When AMD says human, the controller
//     decides which ready agent to route the call to AT THAT POINT, not
//     pre-emptively. Extras get the abandon TwiML.
// =============================================================================

export interface PlaceCallParams {
  to: string                              // raw phone, will be +1-normalized
  userId: string                          // Clerk ID — written to calls.user_id
  leadId?: string | null
  campaignId?: string | null
  teamId?: string | null
  source: 'user_dial' | 'controller_fanout'
  // For controller_fanout, the controller can pass a session_id so the
  // calls row links back to which agent_session triggered the dial.
  agentSessionId?: string | null
}

export interface PlaceCallResult {
  success: boolean
  callSid?: string                        // lead-leg SignalWire SID
  agentCallSid?: string                   // agent-leg SignalWire SID (user_dial only)
  roomName?: string
  fromNumber?: string
  status?: string
  amdEnabled?: boolean
  dialerMode?: string
  ringTimeout?: string
  // Failure modes
  error?: string
  detail?: string                         // TCPA detail for 451 responses
  leadState?: string | null
  leadLocalTime?: string | null
  retryAfter?: string                     // ISO timestamp
  httpStatus?: number                     // status code the caller should return
}

interface SignalWireEnv {
  spaceUrl: string
  projectId: string
  apiToken: string
  sipUsername: string
  sipDomain: string
  appUrl: string
}

// =============================================================================
// PHONE NORMALIZATION — E.164 for SignalWire
// =============================================================================
// Real lead sheets store phone numbers in many shapes. SignalWire requires
// strict E.164 (+15044580577). This normalizes any common US/NANP format to
// E.164, or returns null if the value can't be a valid number so the caller
// can skip the row cleanly instead of placing a broken call.
//
// THE BUG THIS FIXES: the previous inline logic was
//     to.startsWith('+') ? to : `+1${to.replace(/\D/g,'')}`
// which blindly prepended +1. For an 11-digit number that ALREADY had a
// leading 1 (e.g. "15044580577", the exact format in the Halo VET sheet) it
// produced "+115044580577" — a doubled country code that SignalWire rejects.
// That's why a manually-typed +1 number worked but the sheet numbers 500'd.
//
// Cases handled:
//   "+15044580577"     -> "+15044580577"  (already E.164, validated)
//   "15044580577"      -> "+15044580577"  (11-digit, leading 1, no +)  <-- the bug
//   "5044580577"       -> "+15044580577"  (bare 10-digit US)
//   "(504) 458-0577"   -> "+15044580577"  (punctuation)
//   "504-458-0577"     -> "+15044580577"  (dashes)
//   "1-504-458-0577"   -> "+15044580577"  (dashes + leading 1)
//   "+44 20 7946 0958" -> "+442079460958" (intl, kept as-is)
//   "", "N/A", "—", "5551234" -> null     (too short / not a phone -> skip)
// =============================================================================
export function normalizeToE164(raw: string | null | undefined): string | null {
  if (raw === null || raw === undefined) return null

  const trimmed = String(raw).trim()
  if (!trimmed) return null

  // Preserve a leading + (international) but strip everything non-digit.
  const hadPlus = trimmed.startsWith('+')
  const digits = trimmed.replace(/\D/g, '')

  if (!digits) return null

  // If it explicitly came with a +, trust the digits as a full international
  // number (must be at least a plausible length).
  if (hadPlus) {
    return digits.length >= 8 ? `+${digits}` : null
  }

  // No +. Resolve NANP (US/Canada) forms:
  //   10 digits            -> prepend +1
  //   11 digits leading 1  -> prepend + (the country code is already there)
  if (digits.length === 10) {
    return `+1${digits}`
  }
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`
  }

  // Longer than 11 with no +: assume it's an international number missing its +.
  if (digits.length > 11) {
    return `+${digits}`
  }

  // Anything shorter than 10 digits isn't a dialable number — skip it.
  return null
}

function getSignalWireEnv(): SignalWireEnv | null {
  const spaceUrl = process.env.SIGNALWIRE_SPACE_URL
  const projectId = process.env.SIGNALWIRE_PROJECT_ID
  const apiToken = process.env.SIGNALWIRE_API_TOKEN
  const sipUsername = process.env.SIGNALWIRE_SIP_USERNAME
  const sipDomain = process.env.SIGNALWIRE_SIP_DOMAIN
  const appUrl = process.env.NEXT_PUBLIC_APP_URL

  if (!spaceUrl || !projectId || !apiToken || !sipUsername || !sipDomain || !appUrl) {
    return null
  }
  return { spaceUrl, projectId, apiToken, sipUsername, sipDomain, appUrl }
}

/**
 * Main entry point — places a call, handling all the existing logic
 * (TCPA pre-flight, AMD config, number pool, two-leg dial).
 */
export async function placeOutboundCall(
  params: PlaceCallParams
): Promise<PlaceCallResult> {
  const { to, userId, leadId, campaignId, teamId, source, agentSessionId } = params

  if (!to) {
    return { success: false, error: 'Missing destination', httpStatus: 400 }
  }

  const env = getSignalWireEnv()
  if (!env) {
    return { success: false, error: 'Missing credentials', httpStatus: 500 }
  }

  // Normalize to E.164. Returns null for numbers that can't be dialed (blank,
  // too short, junk like "N/A"), so we skip the row with a clean 422 instead of
  // sending a broken number to SignalWire and getting a 500.
  const toFormatted = normalizeToE164(to)
  if (!toFormatted) {
    return {
      success: false,
      error: 'Invalid phone number — skipped',
      detail: `"${to}" is not a dialable number`,
      httpStatus: 422,
    }
  }

  // ── MANUAL DIAL BYPASS ──────────────────────────────────────────────────
  // Dials with no leadId AND no campaignId originate from the manual keypad.
  // The user is dialing a number they typed in directly, so TCPA window
  // enforcement is skipped. Campaign-driven dials still go through the check.
  //
  // The controller's fanout calls always have leadId AND campaignId, so
  // they always get TCPA-checked. Good — controller dials are TSR-regulated.
  const isManualDial = !leadId && !campaignId

  if (!isManualDial) {
    let leadStateForTcpa: string | null = null
    if (leadId) {
      const { data: lead } = await supabase
        .from('leads')
        .select('phone, state, user_id')
        .eq('id', leadId)
        .maybeSingle()
      // Note: user_id check here is for user_dial source where userId is the
      // Clerk ID. For controller_fanout, the controller already verified
      // ownership upstream, so we still TCPA-check but don't reject on owner.
      if (lead && (source === 'controller_fanout' || lead.user_id === userId)) {
        leadStateForTcpa = lead.state
      }
    }

    const tcpaCheck = isCallableNow({
      phone: toFormatted,
      state: leadStateForTcpa,
    })

    if (!tcpaCheck.allowed) {
      return {
        success: false,
        error: 'Cannot dial outside calling window',
        detail: tcpaCheck.reason,
        leadState: tcpaCheck.leadState,
        leadLocalTime: tcpaCheck.leadLocalTime,
        retryAfter: tcpaCheck.retryAfter?.toISOString(),
        httpStatus: 451,  // RFC 7725 Unavailable For Legal Reasons
      }
    }
  }

  // AMD is ALWAYS on — voicemail filtering is core to the product.
  const amdEnabled = true
  let dialerMode = 'power'
  if (campaignId) {
    const { data: campaign } = await supabase
      .from('campaigns')
      .select('dialer_mode')
      .eq('id', campaignId)
      .maybeSingle()
    if (campaign) {
      dialerMode = campaign.dialer_mode || 'power'
    }
  }

  // ── NUMBER POOL ──────────────────────────────────────────────────────
  // Pass dialerMode so the pool can decide how to pick:
  //   - predictive: ignore area-code matching, round-robin the full pool
  //     to spread load across many caller IDs (essential for multi-line)
  //   - everything else: area-code → state → region → any (fallback always
  //     succeeds if there's any active number at all)
  const poolNumber = await pickNumberForLead(toFormatted, dialerMode)
  const fromNumber = poolNumber?.phone_number || process.env.SIGNALWIRE_PHONE_NUMBER

  if (!fromNumber) {
    return {
      success: false,
      error: 'No phone numbers available in pool. Contact admin.',
      httpStatus: 503,
    }
  }

  if (!poolNumber) {
    console.warn('[placeOutboundCall] Pool empty, using SIGNALWIRE_PHONE_NUMBER fallback')
  }

  return await doPlaceCall({
    toFormatted,
    fromNumber,
    poolNumberId: poolNumber?.id || null,
    userId,
    leadId: leadId || null,
    campaignId: campaignId || null,
    teamId: teamId || null,
    amdEnabled,
    dialerMode,
    source,
    agentSessionId: agentSessionId || null,
    env,
  })
}

interface DoPlaceCallParams {
  toFormatted: string
  fromNumber: string
  poolNumberId: string | null
  userId: string
  leadId: string | null
  campaignId: string | null
  teamId: string | null
  amdEnabled: boolean
  dialerMode: string
  source: 'user_dial' | 'controller_fanout'
  agentSessionId: string | null
  env: SignalWireEnv
}

async function doPlaceCall(p: DoPlaceCallParams): Promise<PlaceCallResult> {
  const roomName = `room-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const authHeader =
    'Basic ' + Buffer.from(`${p.env.projectId}:${p.env.apiToken}`).toString('base64')
  const callsUrl = `https://${p.env.spaceUrl}/api/laml/2010-04-01/Accounts/${p.env.projectId}/Calls.json`

  const isTsrRegulated = p.dialerMode === 'progressive' || p.dialerMode === 'predictive'
  const ringTimeout = isTsrRegulated ? '20' : '60'

  // ── BUILD AMD PARAMS ────────────────────────────────────────────────────
  const outboundParams: Record<string, string> = {
    To: p.toFormatted,
    From: p.fromNumber,
    Url: `${p.env.appUrl}/api/calls/twiml?room=${roomName}&record=true&campaignId=${p.campaignId || ''}`,
    StatusCallback: `${p.env.appUrl}/api/calls/status`,
    StatusCallbackMethod: 'POST',
    Timeout: ringTimeout,
  }

  if (p.amdEnabled) {
    // These are the exact values from the original outbound route.
    // Don't change without testing — they are tuned for human/machine balance.
    outboundParams.MachineDetection = 'Enable'
    outboundParams.AsyncAmd = 'true'
    outboundParams.AsyncAmdStatusCallback = `${p.env.appUrl}/api/calls/amd-result`
    outboundParams.AsyncAmdStatusCallbackMethod = 'POST'
    outboundParams.MachineDetectionTimeout = '10'
    outboundParams.MachineDetectionSpeechThreshold = '1800'
    outboundParams.MachineDetectionSpeechEndThreshold = '800'
    outboundParams.MachineDetectionSilenceTimeout = '3000'
  }

  // ── PLACE LEAD CALL ─────────────────────────────────────────────────────
  const leadCallResponse = await fetch(callsUrl, {
    method: 'POST',
    headers: {
      'Authorization': authHeader,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(outboundParams).toString(),
  })

  const leadData = await leadCallResponse.json()
  console.log(`[placeOutboundCall:${p.source}] Lead call response:`, leadData)

  if (!leadCallResponse.ok) {
    return {
      success: false,
      error: leadData.message || 'Lead call failed',
      httpStatus: 500,
    }
  }

  // ── INSERT calls ROW ────────────────────────────────────────────────────
  try {
    await supabase.from('calls').insert({
      user_id: p.userId,
      lead_id: p.leadId,
      campaign_id: p.campaignId,
      team_id: p.teamId,
      phone_number: p.toFormatted,
      signalwire_call_id: leadData.sid,
      duration: 0,
      disposition: null,
      // Controller-originated calls get a marker so we can distinguish them
      // in analytics and so the abandon-tracker knows to count them.
      ...(p.source === 'controller_fanout' && p.agentSessionId
        ? { dial_group_id: p.agentSessionId }
        : {}),
    })
  } catch (insertErr) {
    console.error(`[placeOutboundCall:${p.source}] Failed to insert calls row:`, insertErr)
  }

  // ── RECORD NUMBER POOL USAGE ────────────────────────────────────────────
  if (p.poolNumberId) {
    try {
      await recordUsage(p.poolNumberId)
    } catch (err) {
      console.error(`[placeOutboundCall:${p.source}] recordUsage failed:`, err)
    }
  }

  // ── PLACE AGENT CALL (only for user_dial) ───────────────────────────────
  // For controller fanout we don't pre-place the agent leg — the controller
  // decides routing once AMD confirms human (or aborts on machine).
  let agentCallSid: string | undefined
  if (p.source === 'user_dial') {
    const agentSipUri = `sip:${p.env.sipUsername}@${p.env.sipDomain}`
    const agentCallResponse = await fetch(callsUrl, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        To: agentSipUri,
        From: p.fromNumber,
        Url: `${p.env.appUrl}/api/calls/twiml-agent?room=${roomName}`,
      }).toString(),
    })

    const agentData = await agentCallResponse.json()
    console.log(`[placeOutboundCall:${p.source}] Agent call response:`, agentData)

    if (!agentCallResponse.ok) {
      console.warn(`[placeOutboundCall:${p.source}] Agent call failed but lead call succeeded:`, agentData)
    }
    agentCallSid = agentData?.sid
  }

  // ── TRACK call_rooms ─────────────────────────────────────────────────────
  try {
    await supabase.from('call_rooms').upsert({
      room_name: roomName,
      user_id: p.userId,
      phone_number: p.toFormatted,
      lead_call_sid: leadData.sid,
      agent_call_sid: agentCallSid || null,
      created_at: new Date().toISOString(),
      pool_number_id: p.poolNumberId,
    })
  } catch (e) {
    console.warn(`[placeOutboundCall:${p.source}] call_rooms tracking skipped:`, e)
  }

  return {
    success: true,
    callSid: leadData.sid,
    agentCallSid,
    roomName,
    fromNumber: p.fromNumber,
    status: leadData.status,
    amdEnabled: p.amdEnabled,
    dialerMode: p.dialerMode,
    ringTimeout,
  }
}