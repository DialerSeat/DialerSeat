import { createClient } from '@supabase/supabase-js'
import { pickNumberForLead, recordUsage } from '@/lib/numberPool'
import { isCallableNow } from '@/lib/callingWindow'
import { hasCallingWindowOverride } from '@/lib/callingWindowOverride'
import { resolveTelnyxConfigOrLog, type TelnyxConfig } from '@/lib/telnyxConfig'
import { agentSipUriForClerkId, resolveCredentialConnectionId } from '@/lib/agentSipCredentials'
import { ensureSipUriCallingEnabled, isSipUriRejection } from '@/lib/telnyxSipUriCalling'
import { syncNumberPoolOnce, isUnverifiedOriginationError } from '@/lib/telnyxNumberSync'
import { getPlatformConfig, resolveWithGlobal } from '@/lib/platformConfig'
import { normalizeToE164 } from '@/lib/phoneNormalize'
import { checkSuppression } from '@/lib/suppression'

// Re-exported so existing importers (and anything reaching for it here out of
// habit) keep working. The implementation moved to lib/phoneNormalize.ts
// because it is pure, has caused two production incidents, and could not be
// unit tested while it lived in a module that opens a Supabase client at
// import time.
export { normalizeToE164 }

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

  const env = resolveTelnyxConfigOrLog('placeOutboundCall')
  if (!env) {
    return {
      success: false,
      error: 'Telnyx is not configured',
      detail: 'Server is missing required Telnyx env vars — see server logs, or GET /api/calls/diagnostics for the full checklist.',
      httpStatus: 500,
    }
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

  // ── SUPPRESSION ──────────────────────────────────────────────────────────
  // Checked before ANYTHING else, including the manual-dial bypass and the
  // calling window. Suppression is not a scheduling rule that a manual dial
  // can reasonably skip — it is somebody having said "stop calling me", and
  // the one path where an agent types a number by hand is exactly where that
  // gets forgotten.
  //
  // One indexed exact-match lookup, and it fails open (see lib/suppression.ts)
  // so an unavailable table cannot stop a legitimate business dialing.
  const suppressed = await checkSuppression(toFormatted, userId)
  if (suppressed) {
    console.warn(
      `[placeOutboundCall:${source}] BLOCKED — ${toFormatted} is on the ` +
      `${suppressed.scope} suppression list (source: ${suppressed.source})`
    )
    return {
      success: false,
      error: suppressed.scope === 'platform'
        ? 'This number is on the platform do-not-call list'
        : 'This number is on your do-not-call list',
      detail: suppressed.reason ?? undefined,
      httpStatus: 451,
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

    // Resolved from an email allowlist, once per dial. False for every account
    // that isn't named, and false on any lookup failure.
    const overrideWindow = await hasCallingWindowOverride(userId)

    const tcpaCheck = isCallableNow(
      { phone: toFormatted, state: leadStateForTcpa },
      { overrideWindow }
    )

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
  // ── RECORDING TOGGLE — DEFAULTS OFF ──────────────────────────────────────
  // Recording is now opt-IN. It previously defaulted to on whenever the
  // column was null (`!== false`), which meant every campaign — including
  // throwaway test ones — recorded every answered call, and Telnyx bills
  // recording per minute plus storage. Opt-in is also the safer default for
  // a multi-tenant product: two-party-consent states make silent recording a
  // legal exposure, and a tenant who never asked to record should not be.
  //
  // A campaign that wants recording sets it explicitly to true. Manual dials
  // (no campaignId) do not record.
  let amdEnabled = true
  let recordingEnabled = false
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
      // Strict equality: null/undefined means "not opted in", not "on".
      recordingEnabled = campaign.recording_enabled === true
    }
  }

  // ── GLOBAL OVERRIDES ─────────────────────────────────────────────────────
  // Applied AFTER the campaign's own values, and only ever to turn something
  // OFF (see resolveWithGlobal). Two reasons this direction matters:
  //
  //   - AMD is billed PER CALL, not per minute (~$0.002 standard). On a heavy
  //     dialing day it can exceed the cost of the talk time itself. This is
  //     the switch that stops that bleeding without a deploy or touching a
  //     single tenant's campaign settings.
  //   - Recording carries legal exposure in two-party-consent states. Being
  //     able to stop it platform-wide in seconds is worth more than the
  //     seconds it takes.
  //
  // Flipping a global back on restores every campaign to its own setting,
  // untouched — the override never writes to campaigns.
  //
  // getPlatformConfig is cached for 30s and fails safe to shipped defaults, so
  // this adds no per-dial query and cannot block a call if the table is
  // unreadable.
  const platform = await getPlatformConfig()
  amdEnabled = resolveWithGlobal(amdEnabled, platform.amd_enabled_global)
  recordingEnabled = resolveWithGlobal(recordingEnabled, platform.recording_enabled_global)

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
  env: TelnyxConfig
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
    // THIS agent's own SIP endpoint — not a shared one. p.userId is the
    // Clerk id of the person who clicked dial, and agentSipUriForClerkId
    // resolves it to the credential their browser registered with, so the
    // INVITE rings exactly one browser. Falls back to the shared username
    // for a user who hasn't been provisioned yet (see
    // lib/agentSipCredentials.ts), which preserves the old behavior rather
    // than failing the call.
    //
    // Domain and normalization come from lib/telnyxConfig.ts, the same
    // resolver /api/calls/sip-credentials uses to tell the browser where to
    // register — so the URI we dial and the identity it registered as
    // cannot drift apart.
    const agentSipUri = await agentSipUriForClerkId(p.userId, p.env)

    const dialAgentLeg = () =>
      fetch(dialUrl, {
        method: 'POST',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          connection_id: p.env.connectionId,
          to: agentSipUri,
          from: p.fromNumber,
          webhook_url: p.env.webhookUrl,
          timeout_secs: 30, // agent's own device ring timeout — generous but bounded
        }),
      })

    let agentRes = await dialAgentLeg()
    let agentData: TelnyxDialResponse = await agentRes.json()
    console.log(`[placeOutboundCall:${p.source}] Agent leg dial response:`, agentData)

    // ── SELF-HEAL: SIP URI CALLING DISABLED ─────────────────────────────────
    // Telnyx disables SIP URI calling on every connection by default, which
    // rejects the agent leg with 10016 "Phone number must be in +E164
    // format" — an error about phone numbers, raised for a SIP URI, caused
    // by a setting on a resource that isn't in this request. On a fresh
    // account that single default breaks 100% of dials.
    //
    // It's detectable and its fix is one API call, so fix it here rather
    // than making every operator of every deployment decode that error
    // themselves. Bounded and memoized in lib/telnyxSipUriCalling.ts: at
    // most one remediation per connection per process, never widens an
    // already-permissive setting, and only ever fires on this exact
    // signature.
    if (!agentRes.ok && isSipUriRejection(agentData.errors)) {
      const targetConnection =
        (await resolveCredentialConnectionId(p.env)) || p.env.connectionId
      const outcome = await ensureSipUriCallingEnabled(targetConnection, p.env.apiKey)

      if (outcome === 'enabled') {
        console.log(
          `[placeOutboundCall:${p.source}] enabled SIP URI calling on ${targetConnection}, retrying agent leg`
        )
        agentRes = await dialAgentLeg()
        agentData = await agentRes.json()
        console.log(`[placeOutboundCall:${p.source}] Agent leg retry response:`, agentData)
      }
    }

    if (!agentRes.ok || !agentData.data?.call_control_id) {
      console.error(
        `[placeOutboundCall:${p.source}] Telnyx rejected AGENT leg (this is the agent's own SIP endpoint, NOT the lead's phone number)`,
        {
          status: agentRes.status,
          errors: agentData.errors,
          agentSipUri,
          configWarnings: p.env.warnings,
        }
      )
      return {
        success: false,
        // "Agent connection" prefix so this is unmistakably distinct from a
        // lead-leg failure in the queue row / console — same underlying
        // Telnyx error title can otherwise read identically for either leg.
        error: `Agent connection failed — ${agentData.errors?.[0]?.title || 'unknown error'}`,
        // Telnyx's own error text for this leg is close to useless on its
        // own (a malformed SIP URI comes back as "must be in +E164 format",
        // pointing at phone numbers when the problem is SIP config), so
        // always say WHICH URI was dialed, and lead with any config
        // normalization warnings — those name the actual misconfiguration.
        detail: [
          `Dialed agent SIP endpoint: ${agentSipUri}`,
          ...p.env.warnings,
          // Telnyx's 10016 on a SIP URI never means what it says. Spell out
          // the two things it actually indicates, in likelihood order, so
          // the message is self-sufficient — the self-heal above already
          // tried the first one, so reaching here means it could not be
          // read/written (usually an API key without account-settings
          // permission) or the cause is the second one.
          isSipUriRejection(agentData.errors)
            ? 'Telnyx did not accept this as a SIP endpoint. Either SIP URI calling is ' +
              'disabled on the connection (auto-fix was attempted and did not succeed — ' +
              'check TELNYX_API_KEY has account permissions), or the SIP username begins ' +
              'with a digit, which Telnyx parses as a phone number.'
            : agentData.errors?.[0]?.detail,
          'GET /api/calls/diagnostics (as an admin) reports which.',
        ]
          .filter(Boolean)
          .join(' — '),
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
    webhook_url: p.env.webhookUrl,
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
    // NOTE: no answering_machine_detection_config is sent. A tuning block was
    // added here and reverted — adding unverified parameters to the dial body
    // risks Telnyx rejecting the whole request, which fails EVERY call rather
    // than just mistuning detection. The AMD false-positive problem is handled
    // downstream instead, in app/api/calls/events/route.ts, where ignoring a
    // suspiciously fast 'machine' verdict cannot break dialing.
    dialBody.answering_machine_detection = 'greeting_end'
  }

  const dialLeadLeg = () =>
    fetch(dialUrl, {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(dialBody),
    })

  let leadRes = await dialLeadLeg()
  let leadData: TelnyxDialResponse = await leadRes.json()
  console.log(`[placeOutboundCall:${p.source}] Lead leg dial response:`, leadData)

  // ── SELF-HEAL: CALLER ID ISN'T A TELNYX NUMBER (D51) ────────────────────
  // The pool still contains numbers from the previous provider. Telnyx
  // refuses to originate from a number it doesn't own, so every dial dies
  // here — after the agent's leg has already been placed and is ringing.
  //
  // Telnyx knows exactly which numbers we own, so reconcile the pool against
  // it, pick again, and retry. Once per process (memoized), and the sync
  // itself never retires anything on a failed or empty response — see
  // lib/telnyxNumberSync.ts.
  if (!leadRes.ok && isUnverifiedOriginationError(leadData.errors)) {
    console.warn(
      `[placeOutboundCall:${p.source}] caller ID ${p.fromNumber} is not a Telnyx number — ` +
      `reconciling the number pool with Telnyx and retrying`
    )
    const sync = await syncNumberPoolOnce(p.env.apiKey)

    if (sync.ok && (sync.imported.length > 0 || sync.reactivated.length > 0 || sync.retired.length > 0)) {
      const replacement = await pickNumberForLead(p.toFormatted, p.dialerMode)
      if (replacement?.phone_number && replacement.phone_number !== p.fromNumber) {
        console.log(
          `[placeOutboundCall:${p.source}] retrying with Telnyx-owned caller ID ${replacement.phone_number}`
        )
        dialBody.from = replacement.phone_number
        p.fromNumber = replacement.phone_number
        p.poolNumberId = replacement.id
        leadRes = await dialLeadLeg()
        leadData = await leadRes.json()
        console.log(`[placeOutboundCall:${p.source}] Lead leg retry response:`, leadData)
      }
    }
  }

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

    // D51 — the caller ID isn't a number this Telnyx account owns. The
    // self-heal above already tried reconciling the pool, so reaching here
    // means there was nothing to swap in: the account owns no usable number,
    // or every owned number is at its daily cap.
    if (isUnverifiedOriginationError(leadData.errors)) {
      return {
        success: false,
        error: 'Caller ID is not a Telnyx number',
        detail:
          `Telnyx refused to place a call from ${p.fromNumber} because that number isn't owned by ` +
          `this Telnyx account (their D51). The number pool was reconciled with Telnyx automatically ` +
          `and no usable replacement was available. Buy at least one number on Telnyx — admin → ` +
          `numbers, or Telnyx Mission Control → Numbers — and dial again.`,
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
      // WHICH caller ID placed this call. Recorded so per-number answer rate
      // is computable at all — without it a number the carriers have labelled
      // "Spam Likely" is indistinguishable from a healthy one, and quietly
      // burns its full daily cap at a near-zero answer rate forever.
      // See app/api/cron/number-health.
      pool_number_id: p.poolNumberId,
      // The Telnyx call_control_id — it's the identifier every
      // subsequent command/webhook correlates against, playing the exact
      // same role SignalWire's CallSid did. Revisit naming only at actual
      // cutover time.
      call_control_id: leadCallControlId,
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
