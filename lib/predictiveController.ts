import { createClient } from '@supabase/supabase-js'
import { placeOutboundCall } from '@/lib/placeOutboundCall'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// =============================================================================
// PREDICTIVE CONTROLLER
// =============================================================================
// Pure server-side function. Invoked by /api/dialer/heartbeat every 5s
// (was: /api/calls/predictive-tick by the client — now deprecated).
//
// FIRES WHEN: agent's heartbeat reports state in (ready/on_call/wrapping)
//             AND dialer_mode='predictive' AND has campaign AND not yielding
//
// CORE LOGIC:
//   1. Look up agent's preferred_lines (or campaign default)
//   2. Clamp to [1, 5] AND apply abandon-rate auto-degrade (if >=2.5%, force 1)
//   3. Count in-flight calls scoped to this session
//   4. desired = effectiveLines, shouldDial = max(0, desired - inFlight)
//   5. Atomically claim shouldDial leads via claim_next_leads_for_campaign()
//   6. DEDUPE by phone number (new — fixes the all-same-number test case)
//   7. For each unique phone, place an outbound call with source='controller_fanout'
//   8. Release any failed-to-dial OR deduped claims back to the pool
//
// REFILLS DURING ON_CALL / WRAPPING:
//   This is the key speed feature. When agent is talking, controller still
//   refills lines so that by the time they disposition, the next human is
//   already queued. ReadyMode's "set it and forget it" philosophy.
// =============================================================================

const HARD_LINE_CAP = 5
const ABANDON_AUTO_DEGRADE_PCT = 2.5

export interface ControllerResult {
  fired: number
  desired: number
  inFlight: number
  effectiveLines: number
  degraded: boolean
  reason: string
  callSids: string[]
  skipped: number
  released: number
  dedupedPhones: number      // NEW — how many leads in the batch were dupes
}

interface RunControllerInput {
  sessionId: string
  campaignId: string
  clerkId: string
  internalUserId: string
  teamId: string | null
}

// Normalize a phone number for dedup comparison.
// '+13365925053', '13365925053', '3365925053', '336-592-5053' all → '13365925053'
function normalizePhone(raw: string): string {
  const digits = (raw || '').replace(/\D/g, '')
  if (digits.length === 11 && digits.startsWith('1')) return digits
  if (digits.length === 10) return '1' + digits
  return digits
}

export async function runPredictiveController(
  input: RunControllerInput
): Promise<ControllerResult> {
  const { sessionId, campaignId, clerkId, internalUserId, teamId } = input

  // ── Stale-claim sweep (cheap, idempotent) ──────────────────────────────
  let released = 0
  try {
    const { data } = await supabase.rpc('release_stale_lead_claims')
    if (typeof data === 'number') released = data
  } catch (sweepErr) {
    console.error('[controller] stale claim sweep failed', sweepErr)
  }

  // ── Campaign config ────────────────────────────────────────────────────
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('id, dialer_mode, predictive_lines_per_agent, predictive_lines_max')
    .eq('id', campaignId)
    .maybeSingle()

  if (!campaign) {
    return zeroResult(`campaign ${campaignId} not found`, released)
  }
  if (campaign.dialer_mode !== 'predictive') {
    return zeroResult(`campaign mode is ${campaign.dialer_mode}, not predictive`, released)
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
  // Scoped to dial_group_id=sessionId so two agents on the same campaign
  // don't pollute each other's line counts.
  //
  // "In-flight" = no disposition yet AND placed within last 90s.
  // Previously used duration=0 which incorrectly excluded calls that had
  // just ended but hadn't been dispositioned yet.
  const ninetySecondsAgo = new Date(Date.now() - 90_000).toISOString()
  const { count: inFlightCount } = await supabase
    .from('calls')
    .select('id', { count: 'exact', head: true })
    .eq('campaign_id', campaignId)
    .eq('dial_group_id', sessionId)
    .gte('created_at', ninetySecondsAgo)
    .is('disposition', null)

  const inFlight = inFlightCount || 0
  const desired = effectiveLines
  const shouldDial = Math.max(0, desired - inFlight)

  if (shouldDial === 0) {
    return {
      fired: 0, desired, inFlight, effectiveLines, degraded,
      reason: `at target: ${inFlight}/${desired} in flight`,
      callSids: [], skipped: 0, released, dedupedPhones: 0,
    }
  }

  // ── Atomically claim leads ─────────────────────────────────────────────
  const { data: claimedLeads, error: claimErr } = await supabase.rpc(
    'claim_next_leads_for_campaign',
    {
      p_campaign_id: campaignId,
      p_session_id: sessionId,
      p_count: shouldDial,
    }
  )

  if (claimErr) {
    console.error('[controller] claim failed', claimErr)
    return {
      fired: 0, desired, inFlight, effectiveLines, degraded,
      reason: `claim failed: ${claimErr.message}`,
      callSids: [], skipped: 0, released, dedupedPhones: 0,
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
      callSids: [], skipped: 0, released, dedupedPhones: 0,
    }
  }

  // ── PHONE DEDUPLICATION (new) ──────────────────────────────────────────
  // If the batch contains multiple leads with the same phone number (your
  // test case had 4 leads all pointing to 336-592-5053), only dial each
  // unique phone once. Release the duplicates so they can be tried later
  // (likely a data quality issue but we don't want to FAIL the batch).
  const phoneSeen = new Set<string>()
  const leadsToCall: typeof leads = []
  const dupeLeadIds: string[] = []

  for (const lead of leads) {
    const phone = normalizePhone(lead.phone)
    if (!phone) {
      // Invalid phone — release claim, skip
      dupeLeadIds.push(lead.id)
      continue
    }
    if (phoneSeen.has(phone)) {
      // Duplicate within this batch — release claim, skip
      dupeLeadIds.push(lead.id)
      continue
    }
    phoneSeen.add(phone)
    leadsToCall.push(lead)
  }

  // Release dupes / invalid in parallel
  if (dupeLeadIds.length > 0) {
    await Promise.allSettled(
      dupeLeadIds.map(leadId =>
        supabase.rpc('release_lead_claim', { p_lead_id: leadId })
      )
    )
    console.log(`[controller] released ${dupeLeadIds.length} dupes/invalid from batch`)
  }

  if (leadsToCall.length === 0) {
    return {
      fired: 0, desired, inFlight, effectiveLines, degraded,
      reason: `claimed ${leads.length} leads but all were dupes/invalid`,
      callSids: [], skipped: 0, released, dedupedPhones: dupeLeadIds.length,
    }
  }

  // ── Fire calls in parallel ─────────────────────────────────────────────
  const callSids: string[] = []
  let skipped = 0

  const placements = await Promise.allSettled(
    leadsToCall.map(lead =>
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
    const lead = leadsToCall[i]

    if (result.status === 'fulfilled' && result.value.success && result.value.callSid) {
      callSids.push(result.value.callSid)
    } else {
      skipped++
      try {
        await supabase.rpc('release_lead_claim', { p_lead_id: lead.id })
      } catch (relErr) {
        console.error('[controller] release_lead_claim failed', relErr)
      }

      if (result.status === 'fulfilled') {
        console.warn(
          `[controller] placement failed for lead ${lead.id}:`,
          result.value.error, result.value.detail
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
      : `dialed ${callSids.length}/${leadsToCall.length} unique${dupeLeadIds.length ? `, deduped ${dupeLeadIds.length}` : ''}`,
    callSids,
    skipped,
    released,
    dedupedPhones: dupeLeadIds.length,
  }
}

function zeroResult(reason: string, released: number): ControllerResult {
  return {
    fired: 0, desired: 0, inFlight: 0, effectiveLines: 0,
    degraded: false, reason,
    callSids: [], skipped: 0, released, dedupedPhones: 0,
  }
}