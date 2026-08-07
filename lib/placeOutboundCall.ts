import { createClient } from '@supabase/supabase-js'
import { pickNumberForLead } from '@/lib/numberPool'
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
//   3. AMD (answering_machine_detection: 'detect') runs AFTER answer, in
//      parallel with the (already-bridged) call. It's a background safety
//      net: if it later reports 'machine', the webhook handler hangs up
//      immediately — no disposition, silent skip to the next lead (see amd
//      webhook handler, not this file).
//
//      Step 3 was briefly inverted — AMD first, bridge on the verdict — on
//      the strength of a Telnyx docs note advising against bridging during
//      analysis. It cost 1-6 seconds of silence on every single answered
//      call, measured, and was reverted. Do not reintroduce it: any design
//      where the bridge waits on a webhook is dead air by construction.
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

  // ── PREVIEW OPTS OUT ──────────────────────────────────────────────────
  // In preview the agent picked this lead on purpose and is watching the
  // screen when it answers. A detector adds nothing they cannot do better
  // themselves, and the downside is asymmetric: hanging up on a hand-picked
  // prospect is the most expensive mistake the dialer can make.
  //
  // Opt-in rather than opt-out, via platform_config.amd_in_preview.
  if (dialerMode === 'preview' && !platform.amd_in_preview) {
    amdEnabled = false
  }
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

  // ── WHO OWNS THIS CALL, recorded ON THE CALL ─────────────────────────────
  // Stamped into Telnyx's client_state so a leg can be traced back to its
  // agent from Telnyx's own active-call list, with no database lookup.
  //
  // This is what lets ABORT be authoritative. The sweep used to read the
  // `calls` table and hang up what it found there — which cannot reach a leg
  // whose row does not exist yet (the row is written AFTER Telnyx accepts the
  // dial) or never got written at all (the insert is best-effort). Those are
  // exactly the legs that keep ringing after the agent presses stop.
  //
  // Telnyx echoes client_state back on every webhook and includes it in
  // GET /v2/connections/{id}/active_calls, so this is readable from both
  // directions. See buildClientState / parseClientState below.
  const clientState = buildClientState({ u: p.userId, s: p.source })

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
          client_state: clientState,
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
    client_state: clientState,
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

  // ── ALWAYS BRIDGE ON ANSWER ─────────────────────────────────────────────
  // The agent hears the lead the millisecond they pick up. No exceptions, no
  // dependence on a webhook, no detector in the audio path.
  //
  // This reverses a change made a day earlier, and the reversal is measured
  // rather than reasoned. Telnyx's docs advise bridging only AFTER detection
  // completes, so AMD-enabled calls were dialed alone and bridged when
  // call.machine.detection.ended arrived. Production data for what that cost:
  //
  //     answered → bridged        0.74s   3.93s   6.04s
  //     answered → AMD verdict    0.73s   3.92s   6.03s
  //
  // The bridge tracked the verdict to within ten milliseconds, because it WAS
  // the verdict. Every answered call bought its detection accuracy with one to
  // six seconds of silence on both ends — the prospect saying "hello?" into
  // nothing, the agent hearing nothing back. On a voicemail it was worse: the
  // greeting played to an empty line and the agent joined partway through.
  //
  // That trade is not worth making. A dialer's first job is that the call
  // sounds instant; detection is a convenience that saves an agent a few
  // seconds of listening. Paying three seconds on EVERY answered call to save
  // three seconds on the ones that turn out to be machines is a straight loss.
  //
  // So AMD now runs alongside a live, bridged call and decides only whether to
  // END it — see handleAmdResult in app/api/calls/events/route.ts. What that
  // demands of the detector is covered below.
  if (agentCallControlId) {
    dialBody.link_to = agentCallControlId
    dialBody.bridge_on_answer = true
  }

  if (p.amdEnabled) {
    // ── AMD RUNS ALONGSIDE A LIVE CALL, NOT IN FRONT OF IT ─────────────────
    // The call is already bridged by the time detection finishes. AMD's only
    // remaining job is to answer "should this call continue?" — and on a
    // machine, to end it and advance the queue without the agent doing
    // anything. Hearing a second or two of a voicemail greeting before it
    // drops is the accepted cost, and it is a far smaller one than making
    // every answered call start with silence.
    //
    // ── WHY 'detect' AND NOT 'greeting_end' ────────────────────────────────
    // 'greeting_end' waits for the greeting to END, which it decides by
    // hearing silence. Two things make that unusable here:
    //
    //   1. A person who says "Hello?" and waits produces precisely the signal
    //      it looks for. Three days of traffic gave 33 'machine' to 8 'human',
    //      machine landing 2.0-4.7s after answer. A real voicemail greeting
    //      does not end two seconds in — those were live people.
    //
    //   2. Now that the agent is bridged from the first millisecond, the audio
    //      on this leg includes the agent. 'greeting_end' would be measuring
    //      the length of a conversation and calling it a greeting.
    //
    // 'detect' classifies from the initial answer pattern and reports as soon
    // as it can, which is what a concurrent detector has to do: decide while
    // the lead's own greeting is still the only thing on the line, before the
    // agent has said enough to matter.
    //
    // NOT premium. Premium is a per-leg surcharge and the account owner has
    // been explicit about not paying it; it also emits a different event
    // (call.machine.premium.detection.ended), handled but not requested.
    //
    // Result arrives via call.machine.detection.ended,
    // payload.result = 'human' | 'machine' | 'not_sure'. Only 'machine' and
    // 'fax_detected' end a call — 'not_sure' and silence deliberately do not,
    // so a detector that cannot make up its mind fails toward leaving two
    // people talking.
    //
    // Detector and timings are configurable rather than hardcoded because both
    // move the carrier bill, and that is the account owner's call. Cached for
    // 30s by getPlatformConfig, so this is a memo read rather than a query on
    // the dial path.
    const amdCfg = await getPlatformConfig()
    dialBody.answering_machine_detection = amdCfg.amd_detector || 'detect'

    // Guarded by its own switch: an unrecognised parameter name makes Telnyx
    // reject the WHOLE dial request, failing every call rather than merely
    // mistuning detection. That risk is why an earlier tuning attempt was
    // reverted. It can now be turned off from the admin app in seconds.
    if (amdCfg.amd_tuning_enabled) {
      // ── WHAT EACH OF THESE ACTUALLY MEASURES ───────────────────────────
      // Taken from Telnyx's field descriptions, not inferred — inferring them
      // is how this was tuned in the wrong direction twice.
      //
      //   maximum_number_of_words       "If number of detected words is
      //                                 greater than this value, consider it a
      //                                 machine." DEFAULT 5. Anyone who
      //                                 answers with a sentence is a machine at
      //                                 the default.
      //
      //   greeting_duration_millis      "Maximum threshold of a human
      //                                 greeting. If greeting longer than this
      //                                 value, considered machine."
      //
      //   initial_silence_millis        "If initial silence duration is
      //                                 greater than this value, consider it a
      //                                 machine."
      //
      //   after_greeting_silence_millis "Silence duration threshold after a
      //                                 greeting message or voice for it to be
      //                                 considered HUMAN." Note the direction:
      //                                 this is how long we wait to CONFIRM a
      //                                 human, not grace before judging one.
      //                                 Raising it delays the human verdict and
      //                                 lets the two rules above fire first —
      //                                 a mistake already made once here.
      //
      //   total_analysis_time_millis    Overall cap. On timeout the result is
      //                                 'not_sure', which leaves the call up,
      //                                 so this fails safe. It NO LONGER gates
      //                                 the bridge, so shortening it costs
      //                                 accuracy rather than responsiveness —
      //                                 the two used to be the same dial.
      dialBody.answering_machine_detection_config = {
        total_analysis_time_millis: amdCfg.amd_total_analysis_ms,
        after_greeting_silence_millis: amdCfg.amd_after_greeting_silence_ms,
        greeting_duration_millis: amdCfg.amd_greeting_duration_ms,
        maximum_number_of_words: amdCfg.amd_max_words,
        initial_silence_millis: amdCfg.amd_initial_silence_ms,
      }
    }

    // ── DIAGNOSTIC ────────────────────────────────────────────────────────
    // Telnyx silently DROPS request fields it does not recognise rather than
    // rejecting the call, so a mistyped parameter looks identical to a working
    // one from our side — which is precisely the ambiguity that has made the
    // last three attempts at this unfalsifiable. Logging what we send, next to
    // what comes back, ends the guessing on the next test call.
    console.log(
      `[placeOutboundCall:${p.source}] AMD request →`,
      JSON.stringify({
        detector: dialBody.answering_machine_detection,
        config: dialBody.answering_machine_detection_config ?? '(none)',
        bridgedOnAnswer: !!dialBody.bridge_on_answer,
      })
    )
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

  // The other half of the diagnostic above. If Telnyx echoes the detector and
  // config back, our parameters are accepted and the problem is the detector
  // or the bridge. If they are absent, it silently dropped them and we have
  // been tuning a field it never read.
  if (p.amdEnabled) {
    console.log(
      `[placeOutboundCall:${p.source}] AMD response ←`,
      JSON.stringify({
        // Cast: the typed shape only declares the four fields we normally
        // read. Telnyx returns more, and whether these two are among them is
        // exactly the question.
        detector: (leadData.data as Record<string, unknown>).answering_machine_detection ?? '(not echoed)',
        config: (leadData.data as Record<string, unknown>).answering_machine_detection_config ?? '(not echoed)',
      })
    )
  }

  // ── INSERT calls ROW ─────────────────────────────────────────────────────
  // NOTE the error check below. supabase-js does NOT throw on a failed
  // insert — it resolves with { error } — so the try/catch this used to rely
  // on caught nothing, and a failed insert produced a live call with no row.
  // Nothing downstream could then find it: not the abort sweep, not the
  // recordings list, not analytics.
  try {
    const { error: insertErr } = await supabase.from('calls').insert({
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
      // The agent's SIP leg, recorded on the LEAD's row because the agent leg
      // never gets a row of its own. Without this the abort sweep — which
      // reads from `calls` — had no way to reach it, so stopping a dial hung
      // up the lead and left the agent's own leg ringing. See
      // app/api/dialer/abort.
      agent_call_control_id: agentCallControlId ?? null,
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
    if (insertErr) {
      console.error(
        `[placeOutboundCall:${p.source}] calls row insert FAILED for ${leadCallControlId} — ` +
        `this call is live and untracked; abort will still reach it via client_state:`,
        insertErr
      )
    }
  } catch (thrown) {
    console.error(`[placeOutboundCall:${p.source}] calls row insert threw:`, thrown)
  }

  // Usage is no longer recorded here. claim_pool_number counts the call in the
  // same statement that selects the number, because doing it as a second write
  // lost increments whenever two agents dialed at once — see lib/numberPool.
  //
  // ONE BEHAVIOUR CHANGE, ACCEPTED DELIBERATELY: the count now happens when the
  // number is picked rather than after the dial is accepted, so a rejected dial
  // still consumes one from that number's daily cap. That errs toward resting a
  // number slightly early, which is the safe direction — the cap exists to
  // protect the number's reputation, and under-counting is the failure that
  // actually costs money.

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
/**
 * Telnyx's client_state is an opaque base64 string it stores on the call and
 * hands back on webhooks and in the active-call list.
 */
export function buildClientState(payload: { u: string; s: string }): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64')
}

/** Returns null for anything that isn't one of ours. */
export function parseClientState(raw?: string | null): { u: string; s: string } | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(Buffer.from(raw, 'base64').toString('utf8'))
    return typeof parsed?.u === 'string' ? parsed : null
  } catch {
    return null
  }
}

/**
 * Every call currently live on our Telnyx connection that belongs to `userId`.
 *
 * Telnyx is the only party that actually knows what is ringing right now. Our
 * `calls` table is a record of what we *believe* we dialed, written after the
 * fact and best-effort — so a sweep that trusts it will miss the newest legs
 * and any whose insert failed. Asking Telnyx closes both gaps.
 *
 * Scoped by client_state: a leg with no client_state, or one belonging to
 * another agent, is left strictly alone. This connection is shared by every
 * tenant, so an unscoped hangup here would drop other people's live calls.
 */
export async function listActiveCallControlIdsForUser(
  userId: string,
  apiKey = process.env.TELNYX_API_KEY,
  connectionId = process.env.TELNYX_CONNECTION_ID
): Promise<string[]> {
  if (!apiKey || !connectionId) return []

  const ids: string[] = []
  try {
    const res = await fetch(
      `https://api.telnyx.com/v2/connections/${encodeURIComponent(connectionId)}/active_calls?page[size]=250`,
      { headers: { Authorization: `Bearer ${apiKey}` }, cache: 'no-store' }
    )
    if (!res.ok) {
      console.warn('[activeCalls] Telnyx active_calls lookup failed:', res.status)
      return []
    }
    const json = await res.json().catch(() => null)
    for (const call of json?.data || []) {
      const owner = parseClientState(call?.client_state)
      if (owner?.u === userId && call?.call_control_id) {
        ids.push(call.call_control_id)
      }
    }
  } catch (err) {
    console.warn('[activeCalls] Telnyx active_calls lookup threw:', err)
  }
  return ids
}

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
