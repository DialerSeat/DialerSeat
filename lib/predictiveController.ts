import { createClient } from '@supabase/supabase-js'
import { placeOutboundCall } from '@/lib/placeOutboundCall'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)


























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

  
  let released = 0
  try {
    const { data } = await supabase.rpc('release_stale_lead_claims')
    if (typeof data === 'number') released = data
  } catch (sweepErr) {
    console.error('[controller] stale claim sweep failed', sweepErr)
  }

  
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

  
  
  
  
  
  const phoneSeen = new Set<string>()
  const leadsToCall: typeof leads = []
  const dupeLeadIds: string[] = []

  for (const lead of leads) {
    const phone = normalizePhone(lead.phone)
    if (!phone) {
      
      dupeLeadIds.push(lead.id)
      continue
    }
    if (phoneSeen.has(phone)) {
      
      dupeLeadIds.push(lead.id)
      continue
    }
    phoneSeen.add(phone)
    leadsToCall.push(lead)
  }

  
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