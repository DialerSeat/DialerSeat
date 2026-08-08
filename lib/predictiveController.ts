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
  dialedPhones: string[]     // NEW — actual numbers placed THIS TICK ONLY, for live-activity log entries
  inFlightPhones: string[]   // real, live numbers currently in flight (any tick, refreshed every heartbeat)
  /** Lead ids currently in flight. THIS is what row highlighting must use —
   *  phone numbers are not unique per lead. Refreshed every heartbeat. */
  inFlightLeadIds: string[]
  /**
   * Lead ids placed on THIS tick only.
   *
   * Distinct from inFlightLeadIds, which is a cumulative snapshot. The client
   * rotates these to the bottom of the queue panel the moment they are fired,
   * so a 3-line tick takes the top three, drops them to the end, and the next
   * tick starts from the new top three. Without it the dialed rows stay at the
   * top, the panel never appears to advance, and once the 30-second claim
   * lapses the same three are simply re-dialed.
   */
  dialedLeadIds: string[]
}

interface RunControllerInput {
  sessionId: string
  campaignId: string
  clerkId: string
  internalUserId: string
  teamId: string | null
  // Ordered lead ids from the dialer's queue panel FILTER/shuffle, or null
  // if no filter/shuffle is active. When present, predictive claims leads
  // as usual (the atomic claim_next_leads_for_campaign RPC is untouched —
  // this doesn't introduce any race condition into claiming itself), then
  // releases any claimed lead that isn't in this list before dialing, so
  // predictive's background engine actually respects "the only numbers
  // dialed are the ones from the filter results" instead of pulling from
  // the full active pool regardless of what's filtered/shuffled on screen.
  // When more filtered candidates exist than lines available this tick,
  // the ones earlier in this list's order are preferred.
  leadIdAllowlist?: string[] | null
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
  const { sessionId, campaignId, clerkId, internalUserId, teamId, leadIdAllowlist } = input

  
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
  // ── LIVE CALLS ONLY ──────────────────────────────────────────────────
  // duration = 0 is this codebase's "still in flight" sentinel: the row is
  // inserted with 0 and app/api/calls/events/route.ts writes a real duration
  // the moment call.hangup fires (never 0 — it floors at 1 precisely so this
  // distinction holds).
  //
  // Without it this query counted every call from the last 90 seconds that
  // had no disposition yet — which includes calls that ALREADY ENDED. An AMD
  // machine-skip writes no disposition at all by design, so each one stayed
  // in this set for a full 90 seconds after hanging up. Two consequences,
  // one cosmetic and one not:
  //
  //   - inFlightPhones ballooned, so the queue panel highlighted dozens of
  //     rows as "dialing" when only a few lines were live. On 4 lines it
  //     eventually lit up the whole list.
  //   - inFlight feeds the pacing decision (shouldDial = desired - inFlight),
  //     so predictive believed it was already at target and STOPPED FIRING
  //     new lines while actually idle. The dialer quietly ran far below the
  //     configured line count.
  //
  // The 90-second window still bounds this in case a hangup webhook is
  // missed and duration never gets written.
  const { data: inFlightCallsRaw } = await supabase
    .from('calls')
    .select('id, phone_number, lead_id')
    .eq('campaign_id', campaignId)
    .eq('dial_group_id', sessionId)
    .gte('created_at', ninetySecondsAgo)
    .is('disposition', null)
    .eq('duration', 0)

  const inFlightCalls = (inFlightCallsRaw || []) as Array<{
    id: string
    phone_number: string | null
    lead_id: string | null
  }>

  const inFlight = inFlightCalls.length
  // Real, live phone numbers currently in flight — genuinely still ringing
  // or connected right now, not just "were dialed on the last tick that
  // fired." Previously the frontend only learned about dialed numbers on
  // the specific tick they were fired, with nothing refreshing or clearing
  // that list on every subsequent tick (predictive doesn't fire new calls
  // most ticks — it only fires when capacity opens up) — so the queue
  // panel's highlighted rows could sit stale for an entire call's duration,
  // or worse, keep showing numbers from a call that already ended. This is
  // returned unconditionally below (not just when shouldDial/fired > 0) so
  // the frontend always has a true current snapshot every single heartbeat.
  const inFlightPhones = inFlightCalls
    .map(c => c.phone_number)
    .filter((p): p is string => !!p)

  // ── THE IDS, NOT JUST THE NUMBERS ──────────────────────────────────────
  // Row highlighting used to match queue rows against inFlightPhones by
  // comparing the last 10 digits. That is only correct while every lead has a
  // distinct number: the moment a list contains the same number on several
  // leads — a test list, or a real one with a shared household or business
  // line — dialing ONE of them lights up EVERY row sharing that number. On a
  // list where all the numbers are the same, the whole panel highlights.
  //
  // A lead id identifies the row being dialed. A phone number identifies a
  // telephone, which is not the same thing and never was.
  const inFlightLeadIds = inFlightCalls
    .map(c => c.lead_id)
    .filter((id): id is string => !!id)
  const desired = effectiveLines

  // ── p_count MUST BE A WHOLE NUMBER ──────────────────────────────────────
  // predictive_lines_per_agent is a numeric column and its default is 1.5, so
  // effectiveLines is fractional and shouldDial came out as 1.5. That was then
  // passed to claim_next_leads_for_campaign, whose p_count is declared integer
  // — a type PostgREST will not coerce a decimal into. The claim failed on
  // every tick and the controller reported fired: 0 with a claim error.
  //
  // Floored, not rounded. 1.5 lines with one agent becomes 1, which is
  // progressive-equivalent and cannot abandon a call; rounding up to 2 would
  // add abandon-rate exposure off the back of a config default nobody chose
  // deliberately. A 1.5 multiplier only earns its extra line once inFlight
  // math puts desired above 2, which is the behaviour you want anyway.
  const shouldDial = Math.max(0, Math.floor(desired - inFlight))

  if (shouldDial === 0) {
    return {
      fired: 0, desired, inFlight, effectiveLines, degraded,
      reason: `at target: ${inFlight}/${desired} in flight`,
      callSids: [], skipped: 0, released, dedupedPhones: 0, dialedPhones: [], dialedLeadIds: [], inFlightPhones, inFlightLeadIds,
    }
  }

  
  // ── DIAL THE PANEL'S ORDER, TOP DOWN ────────────────────────────────────
  // leadIdAllowlist is the queue panel's displayed order, sent on every
  // heartbeat. It arrived here and was then dropped on the floor: the RPC had
  // no parameter for it, so predictive claimed by the database's own priority
  // (dial_attempts ASC, created_at ASC) while every other mode dialed the list
  // as shown.
  //
  // That is the same "bouncing around" the queue panel showed elsewhere, in
  // the one mode where it is hardest to notice — nobody watches an individual
  // predictive call, so the order was wrong invisibly.
  //
  // The RPC now takes p_lead_ids and uses array_position as its sort key, so
  // the top row is claimed first. Passing null keeps the old behaviour for any
  // caller without a panel order.
  const { data: claimedLeads, error: claimErr } = await supabase.rpc(
    'claim_next_leads_for_campaign',
    {
      p_campaign_id: campaignId,
      p_session_id: sessionId,
      p_count: shouldDial,
      p_lead_ids: leadIdAllowlist && leadIdAllowlist.length > 0 ? leadIdAllowlist : null,
    }
  )

  if (claimErr) {
    console.error('[controller] claim failed', claimErr)
    return {
      fired: 0, desired, inFlight, effectiveLines, degraded,
      reason: `claim failed: ${claimErr.message}`,
      callSids: [], skipped: 0, released, dedupedPhones: 0, dialedPhones: [], dialedLeadIds: [], inFlightPhones, inFlightLeadIds,
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
      callSids: [], skipped: 0, released, dedupedPhones: 0, dialedPhones: [], dialedLeadIds: [], inFlightPhones, inFlightLeadIds,
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

  // ── FILTER/SHUFFLE ENFORCEMENT ──────────────────────────────────────────
  // If the queue panel has an active filter or shuffle, leadIdAllowlist
  // carries the exact ordered set of leads that are actually allowed to be
  // dialed right now. claim_next_leads_for_campaign has no knowledge of
  // this (it's a database function, selecting purely by its own
  // dial_attempts/created_at priority) — so any claimed lead NOT in this
  // list gets released back to the pool immediately, unfired, exactly like
  // the dupe-release above. When there are more allowed candidates than
  // lines available this tick, the ones earlier in the allowlist's order
  // (i.e. earlier in shuffle order, when shuffled) are kept preferentially.
  let filteredOutCount = 0
  if (leadIdAllowlist !== null && leadIdAllowlist !== undefined) {
    const allowedSet = new Set(leadIdAllowlist)
    const positionById = new Map(leadIdAllowlist.map((id, idx) => [id, idx]))
    const allowed: typeof leadsToCall = []
    const disallowedIds: string[] = []

    for (const lead of leadsToCall) {
      if (allowedSet.has(lead.id)) {
        allowed.push(lead)
      } else {
        disallowedIds.push(lead.id)
      }
    }

    if (disallowedIds.length > 0) {
      await Promise.allSettled(
        disallowedIds.map(leadId =>
          supabase.rpc('release_lead_claim', { p_lead_id: leadId })
        )
      )
      console.log(`[controller] released ${disallowedIds.length} leads outside the active filter/shuffle`)
    }

    // Sort the surviving allowed leads by their position in the allowlist
    // (shuffle order), so if there are more allowed leads than lines this
    // tick, the ones earlier in shuffle order are the ones actually dialed.
    allowed.sort((a, b) => (positionById.get(a.id) ?? 0) - (positionById.get(b.id) ?? 0))

    filteredOutCount = disallowedIds.length
    leadsToCall.length = 0
    leadsToCall.push(...allowed)
  }

  if (leadsToCall.length === 0) {
    return {
      fired: 0, desired, inFlight, effectiveLines, degraded,
      reason: filteredOutCount > 0
        ? `claimed ${leads.length} leads but none matched the active filter/shuffle`
        : `claimed ${leads.length} leads but all were dupes/invalid`,
      callSids: [], skipped: 0, released, dedupedPhones: dupeLeadIds.length, dialedPhones: [], dialedLeadIds: [], inFlightPhones, inFlightLeadIds,
    }
  }

  
  const callSids: string[] = []
  const dialedPhones: string[] = []
  const dialedLeadIds: string[] = []
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

    if (result.status === 'fulfilled' && result.value.success && result.value.callControlId) {
      callSids.push(result.value.callControlId)
      dialedPhones.push(lead.phone)
      dialedLeadIds.push(lead.id)
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
    dialedPhones,
    dialedLeadIds,
    // inFlightPhones was snapshotted BEFORE this tick's calls were placed —
    // the numbers just dialed this tick are also genuinely in flight now,
    // so combine both rather than report only the pre-dial snapshot (which
    // would miss exactly the calls this tick just started) or only the
    // newly-dialed ones (which would miss calls still ringing from a prior
    // tick).
    inFlightPhones: Array.from(new Set([...inFlightPhones, ...dialedPhones])),
    // Same reasoning as inFlightPhones above: the snapshot predates this
    // tick's dials, so union it with the leads just placed.
    inFlightLeadIds: Array.from(new Set([...inFlightLeadIds, ...dialedLeadIds])),
  }
}

function zeroResult(reason: string, released: number): ControllerResult {
  return {
    fired: 0, desired: 0, inFlight: 0, effectiveLines: 0,
    degraded: false, reason,
    callSids: [], skipped: 0, released, dedupedPhones: 0, dialedPhones: [], dialedLeadIds: [], inFlightPhones: [], inFlightLeadIds: [],
  }
}