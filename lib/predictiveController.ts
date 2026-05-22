import { createClient } from '@supabase/supabase-js'
import { placeOutboundCall } from '@/lib/placeOutboundCall'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// =============================================================================
// PREDICTIVE CONTROLLER
// =============================================================================
// The fan-out logic that places multiple simultaneous outbound calls for one
// agent in predictive mode.
//
// FIRES WHEN: /api/calls/predictive-tick is POSTed (by the dialer page when
// an agent transitions to ready+predictive+has-campaign).
//
// CORE LOGIC:
//   1. Look up agent's session and verify it's ready+predictive+campaign
//   2. Determine N = how many lines to dial
//        a. agent_predictive_prefs.preferred_lines (if set)
//        b. else campaigns.predictive_lines_per_agent
//        c. clamped to [1, predictive_lines_max] (max ceiling 5)
//   3. Count in-flight calls for this campaign+session (calls inserted in
//      last 60s with no completion signal)
//   4. desired = N, shouldDial = max(0, N - inFlight)
//   5. Atomically claim shouldDial leads via claim_next_leads_for_campaign()
//   6. For each claimed lead, place an outbound call via placeOutboundCall()
//      with source='controller_fanout'
//   7. Return summary so the API endpoint can report back
//
// ABANDON HANDLING (later in the call lifecycle, not here):
//   When AMD says human on a fanout call, /api/calls/amd-result will either:
//   - Route to the agent if they're still ready (their UI picks it up via
//     polling or websocket)
//   - Or play the abandon TwiML if the agent is already on another call
//   That logic lives in amd-result, not here — controller's job ends once
//   the leads are dialing.
//
// ABANDON-RATE THROTTLING:
//   The heartbeat already returns should_yield=true when 30d rate > 2.8%.
//   The dialer client honors that and doesn't fire predictive-tick. So if
//   we got here, abandon rate is under the throttle. Controller does NOT
//   re-check abandon rate — it trusts the heartbeat decision.
//
//   However, we do check campaign_abandon_rate_30d and if >= 2.5%, we
//   FORCE shouldDial = 1 (auto-degrade to progressive). This is the
//   hard safety net.
// =============================================================================

const HARD_LINE_CAP = 5                          // never fire more than 5
const ABANDON_AUTO_DEGRADE_PCT = 2.5             // force 1 line at/above this

export interface ControllerResult {
  fired: number                                  // how many calls placed
  desired: number                                // target N before any clamping
  inFlight: number                               // existing in-flight count
  effectiveLines: number                         // post-clamp lines value
  degraded: boolean                              // abandon-rate forced 1x
  reason: string                                 // human-readable
  callSids: string[]                             // placed-call SIDs
  skipped: number                                // leads claimed but skipped (TCPA, etc)
  released: number                               // stale claims cleaned
}

interface RunControllerInput {
  sessionId: string                              // agent_sessions.id
  campaignId: string
  clerkId: string                                // for placeOutboundCall.userId
  internalUserId: string                         // for matching agent_sessions.user_id
  teamId: string | null
}

export async function runPredictiveController(
  input: RunControllerInput
): Promise<ControllerResult> {
  const { sessionId, campaignId, clerkId, internalUserId, teamId } = input

  // ── Opportunistic stale-claim cleanup ──────────────────────────────────
  // Every controller tick releases claims older than 30s. Cheap, idempotent.
  // If nothing's stale, returns 0 instantly.
  let released = 0
  try {
    const { data } = await supabase.rpc('release_stale_lead_claims')
    if (typeof data === 'number') released = data
  } catch (sweepErr) {
    console.error('[controller] stale claim sweep failed', sweepErr)
  }

  // ── Look up campaign config ────────────────────────────────────────────
  const { data: campaign, error: campaignErr } = await supabase
    .from('campaigns')
    .select('id, dialer_mode, predictive_lines_per_agent, predictive_lines_max, user_id')
    .eq('id', campaignId)
    .maybeSingle()

  if (campaignErr || !campaign) {
    return {
      fired: 0, desired: 0, inFlight: 0, effectiveLines: 0, degraded: false,
      reason: `campaign ${campaignId} not found`,
      callSids: [], skipped: 0, released,
    }
  }

  if (campaign.dialer_mode !== 'predictive') {
    return {
      fired: 0, desired: 0, inFlight: 0, effectiveLines: 0, degraded: false,
      reason: `campaign mode is ${campaign.dialer_mode}, not predictive`,
      callSids: [], skipped: 0, released,
    }
  }

  // ── Determine N (lines for this agent) ─────────────────────────────────
  const campaignDefault = campaign.predictive_lines_per_agent || 3
  const campaignMax = Math.min(campaign.predictive_lines_max || 5, HARD_LINE_CAP)

  let agentPref: number | null = null
  try {
    const { data: pref } = await supabase
      .from('agent_predictive_prefs')
      .select('preferred_lines')
      .eq('user_id', internalUserId)
      .eq('campaign_id', campaignId)
      .maybeSingle()
    if (pref && typeof pref.preferred_lines === 'number') {
      agentPref = pref.preferred_lines
    }
  } catch (prefErr) {
    console.error('[controller] pref lookup failed', prefErr)
  }

  let effectiveLines = agentPref ?? campaignDefault
  effectiveLines = Math.max(1, Math.min(effectiveLines, campaignMax))

  // ── Abandon-rate auto-degrade ──────────────────────────────────────────
  let degraded = false
  try {
    const { data: rateRow } = await supabase
      .from('campaign_abandon_rate_30d')
      .select('abandon_rate_pct')
      .eq('campaign_id', campaignId)
      .maybeSingle()

    if (rateRow && rateRow.abandon_rate_pct >= ABANDON_AUTO_DEGRADE_PCT) {
      degraded = true
      effectiveLines = 1
    }
  } catch (rateErr) {
    console.error('[controller] abandon rate lookup failed', rateErr)
  }

  // ── Count in-flight calls for THIS session ─────────────────────────────
  // We scope to this session_id (via dial_group_id) so two agents on the
  // same campaign each get their own line count. Without this, agent A's
  // calls would count against agent B's quota.
  const sixtySecondsAgo = new Date(Date.now() - 60_000).toISOString()
  const { count: inFlightCount } = await supabase
    .from('calls')
    .select('id', { count: 'exact', head: true })
    .eq('campaign_id', campaignId)
    .eq('dial_group_id', sessionId)
    .gte('created_at', sixtySecondsAgo)
    .eq('duration', 0)

  const inFlight = inFlightCount || 0
  const desired = effectiveLines
  const shouldDial = Math.max(0, desired - inFlight)

  if (shouldDial === 0) {
    return {
      fired: 0, desired, inFlight, effectiveLines, degraded,
      reason: `at target: ${inFlight}/${desired} in flight`,
      callSids: [], skipped: 0, released,
    }
  }

  // ── Atomically claim N leads ───────────────────────────────────────────
  const { data: claimedLeads, error: claimErr } = await supabase.rpc(
    'claim_next_leads_for_campaign',
    {
      p_campaign_id: campaignId,
      p_session_id: sessionId,
      p_count: shouldDial,
    }
  )

  if (claimErr) {
    console.error('[controller] claim_next_leads_for_campaign failed', claimErr)
    return {
      fired: 0, desired, inFlight, effectiveLines, degraded,
      reason: `claim failed: ${claimErr.message}`,
      callSids: [], skipped: 0, released,
    }
  }

  const leads = (claimedLeads || []) as Array<{
    id: string
    phone: string
    campaign_id: string
  }>

  if (leads.length === 0) {
    return {
      fired: 0, desired, inFlight, effectiveLines, degraded,
      reason: 'no claimable leads',
      callSids: [], skipped: 0, released,
    }
  }

  // ── Fire calls in parallel ─────────────────────────────────────────────
  const callSids: string[] = []
  let skipped = 0

  const placements = await Promise.allSettled(
    leads.map(lead =>
      placeOutboundCall({
        to: lead.phone,
        userId: clerkId,
        leadId: lead.id,
        campaignId: lead.campaign_id,
        teamId,
        source: 'controller_fanout',
        agentSessionId: sessionId,
      })
    )
  )

  for (let i = 0; i < placements.length; i++) {
    const result = placements[i]
    const lead = leads[i]

    if (result.status === 'fulfilled' && result.value.success && result.value.callSid) {
      callSids.push(result.value.callSid)
    } else {
      // Release the claim so this lead can be retried later
      skipped++
      try {
        await supabase.rpc('release_lead_claim', { p_lead_id: lead.id })
      } catch (relErr) {
        console.error('[controller] release_lead_claim failed', relErr)
      }

      if (result.status === 'fulfilled') {
        console.warn(
          `[controller] placement failed for lead ${lead.id}:`,
          result.value.error,
          result.value.detail
        )
      } else {
        console.error(`[controller] placement threw for lead ${lead.id}:`, result.reason)
      }
    }
  }

  return {
    fired: callSids.length,
    desired,
    inFlight,
    effectiveLines,
    degraded,
    reason: degraded
      ? `auto-degraded to 1x (abandon rate >= ${ABANDON_AUTO_DEGRADE_PCT}%)`
      : `dialed ${callSids.length}/${shouldDial}, ${skipped} skipped`,
    callSids,
    skipped,
    released,
  }
}