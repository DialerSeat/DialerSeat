import { createClient } from '@supabase/supabase-js'
import { pickNumberForLead, recordUsage } from '@/lib/numberPool'
import { isCallableNow } from '@/lib/callingWindow'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// =============================================================================
// PLACE OUTBOUND CALL — Telnyx native Call Control, direct bridge (no conference)
// =============================================================================
// See sandbox/docs/TELNYX-MIGRATION-DESIGN.md for the full "why" — short
// version: direct agent<->lead audio is required (no conference mixing
// bridge, which adds latency and a "walkie talkie" quality hit), so this
// uses native Call Control's link_to/bridge_on_answer instead of TeXML's
// <Dial><Conference>.
//
// SEQUENCING, because it matters and is easy to get backwards:
//   1. Dial the AGENT's SIP leg first. Capture its call_control_id from
//      the Dial response.
//   2. Dial the LEAD leg with link_to = agent's call_control_id and
//      bridge_on_answer = true. The moment the lead picks up, Telnyx
//      bridges the two legs automatically — no separate bridge command,
//      no gap. This is what gives instant connect with zero dead air.
//   3. AMD (answering_machine_detection: 'greeting_end') runs AFTER
//      answer, in parallel with the (already-bridged) call. It's a
//      background safety net: if it later reports 'machine', the
//      webhook handler hangs up immediately — no disposition, silent
//      skip to the next lead (see amd webhook handler, not this file).
//
// PRODUCT-LEVEL RULES this file enforces (see design doc for full spec):
//   - Dialing only ever happens because something explicitly requested it
//     (a user_dial click, or the controller's Initiate-Dialing-driven
//     fanout). There is no ghost dialing path in this function — it only
//     runs when called, and it's never called on a timer/poll by itself.
//   - Abort/cancel of an in-flight (not yet answered) call is handled by
//     app/api/dialer/abort/route.ts calling actions/hangup directly on the
//     call_control_id this function returns — instant, no lingering ring.
// =============================================================================

export interface PlaceCallParams {
  to: string
  userId: string
  leadId?: string | null
  campaignId?: string | null
  teamId?: string | null
  source: 'user_dial' | 'controller_fanout'
  agentSessionId?: string | null
}

export interface PlaceCallResult {
  success: boolean
  callControlId?: string        // lead-leg Telnyx call_control_id
  callLegId?: string            // lead-leg call_leg_id (stable webhook correlation id)
  agentCallControlId?: string   // agent-leg call_control_id (user_dial only)
  fromNumber?: string
  status?: string
  amdEnabled?: boolean
  dialerMode?: string
  ringTimeout?: number
  error?: string
  detail?: string
  leadState?: string | null
  leadLocalTime?: string | null
  retryAfter?: string
  httpStatus?: number
}

interface TelnyxEnv {
  apiKey: string
  connectionId: string  // Call Control Application id
  sipUsername: string
  sipDomain: string
  appUrl: string
}

// =============================================================================
// PHONE NORMALIZATION — E.164 (provider-agnostic, unchanged)
// =============================================================================
// See prior version's header comment for the full rationale (the historical
// double-country-code bug this fixes). Logic itself is unchanged — Telnyx
// requires the same strict E.164 format SignalWire did.
// =============================================================================
export function normalizeToE164(raw: string | null | undefined): string | null {
  if (raw === null || raw === undefined) return null

  const trimmed = String(raw).trim()
  if (!trimmed) return null

  // Reject outright if the raw value contains anything other than digits,
  // and the small set of characters a real phone number can legitimately
  // be formatted with (+, spaces, dashes, dots, parens, x for extensions).
  // Letters are the tell — no real phone number contains them, so their
  // presence means this value is contaminated (e.g. a name or state that
  // got concatenated into the phone field during a bad CSV import — this
  // is a real, confirmed pattern in actual uploaded lead data, e.g. a
  // phone/initials/phone-again/state string all merged into one field).
  // This catches contamination directly rather than relying on it
  // coincidentally pushing the digit count out of the valid E.164 range —
  // stripping non-digits from a letter-contaminated string can still land
  // in a plausible-looking digit count purely by chance.
  if (/[a-zA-Z]/.test(trimmed)) return null

  const hadPlus = trimmed.startsWith('+')
  const digits = trimmed.replace(/\D/g, '')

  if (!digits) return null

  // E.164 (the actual ITU-T standard, not a made-up limit) caps a phone
  // number at 15 digits total, INCLUDING the country code — no real,
  // dialable phone number is longer than that. An earlier version had no
  // upper bound at all: any digit string over 11 characters got a bare "+"
  // prepended and was treated as valid, which is how genuinely malformed
  // data (e.g. a 12-digit value ending in a run of zeros, confirmed present
  // in real uploaded lead data) reached Telnyx's API instead of being
  // caught here — Telnyx correctly rejected it downstream with a generic
  // "must be in +E164 format" error that gave no hint WHICH lead or WHY,
  // several layers removed from the actual bad data. Catching it here
  // means the failure is attributable to a specific lead immediately.
  const MAX_E164_DIGITS = 15
  const MIN_E164_DIGITS = 8 // shortest real-world numbers (some small-country lines) are ~8 digits

  if (digits.length > MAX_E164_DIGITS) return null

  if (hadPlus) {
    return digits.length >= MIN_E164_DIGITS ? `+${digits}` : null
  }

  if (digits.length === 10) {
    return `+1${digits}`
  }
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`
  }
  if (digits.length > 11 && digits.length <= MAX_E164_DIGITS) {
    return `+${digits}`
  }

  return null
}

function getTelnyxEnv(): TelnyxEnv | null {
  const apiKey = process.env.TELNYX_API_KEY?.trim()
  const connectionId = process.env.TELNYX_CONNECTION_ID?.trim()
  const sipUsername = process.env.TELNYX_SIP_USERNAME?.trim()
  const sipDomain = process.env.TELNYX_SIP_DOMAIN?.trim()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim()

  const missing: string[] = []
  if (!apiKey) missing.push('TELNYX_API_KEY')
  if (!connectionId) missing.push('TELNYX_CONNECTION_ID')
  if (!sipUsername) missing.push('TELNYX_SIP_USERNAME')
  if (!sipDomain) missing.push('TELNYX_SIP_DOMAIN')
  if (!appUrl) missing.push('NEXT_PUBLIC_APP_URL')

  if (missing.length > 0) {
    // This used to fail completely silently — placeOutboundCall would
    // return { error: 'Missing credentials' } to the caller with NOTHING
    // logged server-side, so a misconfigured/missing env var produced
    // zero call records on Telnyx's side (the request never left this
    // function) and zero trace in Vercel's logs explaining why. Naming
    // the exact missing variable(s) here is what actually makes "why
    // aren't calls reaching Telnyx" diagnosable from server logs instead
    // of requiring a guess-and-check pass through every env var.
    console.error(`[placeOutboundCall] Cannot place call — missing env var(s): ${missing.join(', ')}`)
    return null
  }

  // DIAGNOSTIC ONLY — never logs the actual key. This exists because a
  // real production failure (Telnyx 401 "10009 Authentication failed —
  // Could not find any usable credentials in the request") turned out to
  // require a full round trip through Vercel's logs to even see the raw
  // Telnyx response, before we could tell the var was PRESENT but Telnyx
  // still rejected it as invalid — which is a different failure mode than
  // "missing" and gives no hint from the missing-var check above.
  //
  // NOTE: an earlier version of this check warned when the key didn't
  // start with "KEY_", based on Telnyx's own docs showing that format.
  // That turned out to be wrong for at least one real, active, portal-
  // confirmed v2 key on this account (no underscore, ever) — so the
  // prefix isn't a reliable signal and asserting it produces a false
  // alarm. Logging length only (never the value) still gives a real,
  // format-agnostic signal — e.g. a key that's suspiciously short because
  // it got truncated when pasted into Vercel — without claiming anything
  // about what a "valid" key must look like.
  console.log(`[placeOutboundCall] TELNYX_API_KEY present, length ${apiKey!.length}`)

  return { apiKey: apiKey!, connectionId: connectionId!, sipUsername: sipUsername!, sipDomain: sipDomain!, appUrl: appUrl! }
}

/**
 * Main entry point — places a call. Only ever invoked in response to an
 * explicit action (user_dial click, or a controller fanout tick that only
 * runs because Initiate Dialing is active) — never on its own.
 */
export async function placeOutboundCall(
  params: PlaceCallParams
): Promise<PlaceCallResult> {
  const { to, userId, leadId, campaignId, teamId, source, agentSessionId } = params

  if (!to) {
    return { success: false, error: 'Missing destination', httpStatus: 400 }
  }

  const env = getTelnyxEnv()
  if (!env) {
    return { success: false, error: 'Missing credentials', httpStatus: 500 }
  }

  const toFormatted = normalizeToE164(to)
  if (!toFormatted) {
    return {
      success: false,
      error: 'Invalid phone number — skipped',
      detail: `"${to}" is not a dialable number`,
      httpStatus: 422,
    }
  }

  // ── MANUAL DIAL BYPASS (unchanged from prior version) ───────────────────
  const isManualDial = !leadId && !campaignId

  if (!isManualDial) {
    let leadStateForTcpa: string | null = null
    if (leadId) {
      const { data: lead } = await supabase
        .from('leads')
        .select('phone, state, user_id')
        .eq('id', leadId)
        .maybeSingle()
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
        httpStatus: 451,
      }
    }
  }

  // ── AMD TOGGLE — reads the campaign's actual setting ─────────────────────
  // (This used to be hardcoded `true`, silently ignoring
  // campaigns.amd_enabled. Fixed — a false stored value must stay false,
  // or users get billed for AMD they explicitly disabled.)
  //
  // ── RECORDING TOGGLE — same pattern, new column ──────────────────────────
  // campaigns.recording_enabled, defaulting to true so every existing
  // campaign keeps recording exactly as it always has until a user
  // explicitly turns it off. Manual dials (no campaignId) also default to
  // recording on, matching how this app behaved before the toggle existed.
  let amdEnabled = true
  let recordingEnabled = true
  let dialerMode = 'power'
  if (campaignId) {
    const { data: campaign } = await supabase
      .from('campaigns')
      .select('dialer_mode, amd_enabled, recording_enabled')
      .eq('id', campaignId)
      .maybeSingle()
    if (campaign) {
      dialerMode = campaign.dialer_mode || 'power'
      amdEnabled = campaign.amd_enabled !== false
      recordingEnabled = campaign.recording_enabled !== false
    }
  }

  const poolNumber = await pickNumberForLead(toFormatted, dialerMode)
  const fromNumber = poolNumber?.phone_number || process.env.TELNYX_PHONE_NUMBER

  if (!fromNumber) {
    return {
      success: false,
      error: 'No phone numbers available in pool. Contact admin.',
      httpStatus: 503,
    }
  }

  if (!poolNumber) {
    console.warn('[placeOutboundCall] Pool empty, using TELNYX_PHONE_NUMBER fallback')
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
    recordingEnabled,
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
  recordingEnabled: boolean
  dialerMode: string
  source: 'user_dial' | 'controller_fanout'
  agentSessionId: string | null
  env: TelnyxEnv
}

interface TelnyxDialResponse {
  data?: {
    call_control_id: string
    call_leg_id: string
    call_session_id: string
    is_alive: boolean
  }
  errors?: Array<{ code: string; title: string; detail?: string }>
}

async function doPlaceCall(p: DoPlaceCallParams): Promise<PlaceCallResult> {
  const authHeader = `Bearer ${p.env.apiKey}`
  const dialUrl = 'https://api.telnyx.com/v2/calls'

  const isTsrRegulated = p.dialerMode === 'progressive' || p.dialerMode === 'predictive'
  const ringTimeoutSecs = isTsrRegulated ? 20 : 60

  // ── STEP 1: DIAL THE AGENT'S SIP LEG (user_dial only) ───────────────────
  // Dialed FIRST and immediately — no gating on the lead answering — so
  // the agent's leg is already ringing/connecting while the lead call
  // goes out, minimizing the delay before bridge_on_answer fires. This is
  // what "direct to caller, instant connect" actually requires: the agent
  // leg has to already exist (with a real call_control_id) before we can
  // reference it as link_to on the lead leg.
  //
  // For controller_fanout, no agent leg is placed here at all — the
  // controller decides which ready agent to route to once AMD confirms
  // human (or, for team-shared campaigns, offers it to the next ready
  // agent on overflow — see lib/teamOverflow.ts and the events webhook).
  let agentCallControlId: string | undefined
  if (p.source === 'user_dial') {
    const agentSipUri = `sip:${p.env.sipUsername}@${p.env.sipDomain}`
    // Diagnostic only — logs shape, never the actual username/domain
    // values. This exact generic Telnyx error ("Phone number must be in
    // +E164 format or a SIP endpoint") can come from THIS leg (a malformed
    // SIP URI — wrong domain, stray characters, a `sip:` prefix already
    // baked into the env var producing "sip:sip:...") just as easily as
    // from the lead leg (a bad phone number) — Telnyx uses the same title
    // for both, and until now the error text sent to the frontend didn't
    // distinguish which leg actually failed, making this genuinely
    // undiagnosable from the browser console alone.
    console.log(`[placeOutboundCall:${p.source}] Agent leg SIP URI shape: sip:${p.env.sipUsername.length}chars@${p.env.sipDomain.length}chars, domain contains dot: ${p.env.sipDomain.includes('.')}`)
    const agentRes = await fetch(dialUrl, {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        connection_id: p.env.connectionId,
        to: agentSipUri,
        from: p.fromNumber,
        webhook_url: `${p.env.appUrl}/api/calls/events`,
        timeout_secs: 30, // agent's own device ring timeout — generous but bounded
      }),
    })

    const agentData: TelnyxDialResponse = await agentRes.json()
    console.log(`[placeOutboundCall:${p.source}] Agent leg dial response:`, agentData)

    if (!agentRes.ok || !agentData.data?.call_control_id) {
      console.error(
        `[placeOutboundCall:${p.source}] Telnyx rejected AGENT leg (this is the agent's own SIP endpoint, NOT the lead's phone number)`,
        { status: agentRes.status, errors: agentData.errors }
      )
      return {
        success: false,
        // "Agent connection" prefix so this is unmistakably distinct from a
        // lead-leg failure in the queue row / console — same underlying
        // Telnyx error title can otherwise read identically for either leg.
        error: `Agent connection failed — ${agentData.errors?.[0]?.title || 'unknown error'}`,
        detail: agentData.errors?.[0]?.detail,
        httpStatus: 500,
      }
    }
    agentCallControlId = agentData.data.call_control_id
  }

  // ── STEP 2: DIAL THE LEAD LEG ────────────────────────────────────────────
  // For user_dial: link_to the agent leg we just placed, bridge_on_answer
  // true — Telnyx auto-bridges the instant the lead picks up, direct
  // audio, no conference mixing bridge in between.
  //
  // For controller_fanout: no link_to at all yet. This leg is placed
  // alone; the events webhook handler decides at answer time which agent
  // (if any) to bridge it to, matching the existing "controller picks the
  // target only once a human is confirmed" design.
  const dialBody: Record<string, unknown> = {
    connection_id: p.env.connectionId,
    to: p.toFormatted,
    from: p.fromNumber,
    webhook_url: `${p.env.appUrl}/api/calls/events`,
    timeout_secs: ringTimeoutSecs,
  }

  // ── RECORDING TOGGLE ──────────────────────────────────────────────────
  // Only set record/record_channels when the campaign has recording
  // turned on. Omitting these entirely (not just setting record: 'false')
  // matches the same pattern used for the AMD toggle above — Telnyx only
  // records/bills for recording when these params are present at all.
  if (p.recordingEnabled) {
    dialBody.record = 'record-from-answer'
    dialBody.record_channels = 'dual'
  }

  if (agentCallControlId) {
    dialBody.link_to = agentCallControlId
    dialBody.bridge_on_answer = true
  }

  if (p.amdEnabled) {
    // ── AMD (native Call Control) ──────────────────────────────────────────
    // 'greeting_end' is the closest native equivalent to SignalWire's
    // DetectMessageEnd — waits for the actual end of the greeting
    // (silence/beep) before deciding, which is what catches human-voiced
    // voicemail instead of committing to "human" on the first sound. See
    // TELNYX-MIGRATION-DESIGN.md for the full reasoning and the Standard
    // vs Premium tradeoff (Standard chosen for cost, matching the original
    // brief's guidance).
    //
    // Result arrives via call.machine.detection.ended webhook,
    // payload.result = 'human' | 'machine' | 'not_sure'. Per Telnyx's own
    // docs, 'not_sure' should be treated as human — and since disposition-
    // on-AMD has been removed entirely (machine = silent instant skip, no
    // disposition shown), the only branch that matters downstream is
    // result === 'machine'. See app/api/calls/events/route.ts.
    dialBody.answering_machine_detection = 'greeting_end'
  }

  const leadRes = await fetch(dialUrl, {
    method: 'POST',
    headers: {
      Authorization: authHeader,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(dialBody),
  })

  const leadData: TelnyxDialResponse = await leadRes.json()
  console.log(`[placeOutboundCall:${p.source}] Lead leg dial response:`, leadData)

  if (!leadRes.ok || !leadData.data?.call_control_id) {
    console.error(
      `[placeOutboundCall:${p.source}] Telnyx rejected lead call`,
      { status: leadRes.status, errors: leadData.errors }
    )
    // If we already placed an agent leg for a user_dial and the lead leg
    // failed, hang up the orphaned agent leg rather than leaving it
    // ringing with nothing to bridge to.
    if (agentCallControlId) {
      hangupCallControlId(agentCallControlId, p.env.apiKey).catch((err) =>
        console.error('[placeOutboundCall] failed to clean up orphaned agent leg:', err)
      )
    }

    // D13 — "403 Dialed Number is not included in whitelisted countries" is
    // Telnyx's documented rejection when the destination's country isn't
    // added to the Outbound Voice Profile's whitelisted_destinations list.
    // This is a real, common, and entirely fixable account-config issue —
    // e.g. dialing a UK/AU/FR lead (see internationalCallingWindow.ts —
    // this app now correctly computes THAT a UK/AU/FR lead is callable by
    // time-of-day, but that's a separate check from whether Telnyx's
    // account-level profile will actually let the call leave at all) on a
    // profile still scoped to US-only. Surfaced with the actual fix
    // spelled out rather than making the agent go decode a raw Telnyx
    // error title themselves.
    const rawTitle = leadData.errors?.[0]?.title || ''
    const rawDetail = leadData.errors?.[0]?.detail || ''
    const isWhitelistRejection =
      /whitelist/i.test(rawTitle) || /whitelist/i.test(rawDetail) || rawDetail.includes('D13')

    if (isWhitelistRejection) {
      return {
        success: false,
        error: 'Destination country not whitelisted on Telnyx',
        detail: `Telnyx rejected this call because ${p.toFormatted}'s country isn't in your Outbound Voice Profile's whitelisted destinations. Fix: Telnyx Mission Control → Outbound Voice Profiles → your profile → add that country/region, then retry.`,
        httpStatus: 500,
      }
    }

    return {
      success: false,
      error: `Lead call failed — ${leadData.errors?.[0]?.title || 'unknown error'}`,
      detail: leadData.errors?.[0]?.detail,
      httpStatus: 500,
    }
  }

  const leadCallControlId = leadData.data.call_control_id
  const leadCallLegId = leadData.data.call_leg_id

  // ── INSERT calls ROW ─────────────────────────────────────────────────────
  try {
    await supabase.from('calls').insert({
      user_id: p.userId,
      lead_id: p.leadId,
      campaign_id: p.campaignId,
      team_id: p.teamId,
      phone_number: p.toFormatted,
      // Column is still named signalwire_call_id in this shared schema
      // (sandbox writes to the same tables as production). Storing the
      // Telnyx call_control_id here — it's the identifier every
      // subsequent command/webhook correlates against, playing the exact
      // same role SignalWire's CallSid did. Revisit naming only at actual
      // cutover time.
      signalwire_call_id: leadCallControlId,
      duration: 0,
      disposition: null,
      dial_source: p.source,
      ...(p.source === 'controller_fanout' && p.agentSessionId
        ? { dial_group_id: p.agentSessionId }
        : {}),
    })
  } catch (insertErr) {
    console.error(`[placeOutboundCall:${p.source}] Failed to insert calls row:`, insertErr)
  }

  if (p.poolNumberId) {
    try {
      await recordUsage(p.poolNumberId)
    } catch (err) {
      console.error(`[placeOutboundCall:${p.source}] recordUsage failed:`, err)
    }
  }

  // No call_rooms tracking — there is no room. If a downstream piece needs
  // to find "the agent leg for this lead call," it should look up the
  // calls row (or, for user_dial, the agentCallControlId returned here,
  // which the caller is responsible for persisting if it needs it later
  // — e.g. the dialer page already tracks its own active-call state
  // client-side).

  return {
    success: true,
    callControlId: leadCallControlId,
    callLegId: leadCallLegId,
    agentCallControlId,
    fromNumber: p.fromNumber,
    status: 'dialing',
    amdEnabled: p.amdEnabled,
    dialerMode: p.dialerMode,
    ringTimeout: ringTimeoutSecs,
  }
}

/**
 * Hang up a call by its call_control_id. Exported for reuse by
 * hangup/abort routes and the AMD-machine-detected handler, so there's one
 * place that knows the correct Telnyx endpoint/auth shape.
 */
export async function hangupCallControlId(
  callControlId: string,
  apiKey?: string
): Promise<void> {
  const key = apiKey || process.env.TELNYX_API_KEY
  if (!key) {
    console.error('[hangupCallControlId] missing TELNYX_API_KEY, cannot hang up')
    return
  }
  const res = await fetch(`https://api.telnyx.com/v2/calls/${callControlId}/actions/hangup`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  })
  if (!res.ok) {
    const text = await res.text()
    // A 422/404 here often just means the call already ended on its own
    // (callee hung up first) — log but don't throw, matching the
    // idempotent-release pattern used elsewhere (e.g. releaseNumber).
    console.warn(`[hangupCallControlId] hangup for ${callControlId} returned ${res.status}: ${text}`)
  }
}

/**
 * Bridge two existing call legs directly. Used by the team-overflow path
 * (lib/teamOverflow.ts) where the lead leg was dialed without a link_to
 * (controller_fanout) and we only decide who to bridge it to once AMD
 * confirms human and we know which agent is actually available.
 */
export async function bridgeCallControlIds(
  callControlIdA: string,
  callControlIdB: string,
  apiKey?: string
): Promise<boolean> {
  const key = apiKey || process.env.TELNYX_API_KEY
  if (!key) {
    console.error('[bridgeCallControlIds] missing TELNYX_API_KEY, cannot bridge')
    return false
  }
  const res = await fetch(`https://api.telnyx.com/v2/calls/${callControlIdA}/actions/bridge`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ call_control_id: callControlIdB }),
  })
  if (!res.ok) {
    const text = await res.text()
    console.error(`[bridgeCallControlIds] bridge failed (${res.status}): ${text}`)
    return false
  }
  return true
}
