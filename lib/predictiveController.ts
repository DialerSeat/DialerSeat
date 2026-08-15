import { createClient } from '@supabase/supabase-js'
import { placeOutboundCall, hangupCallControlId } from '@/lib/placeOutboundCall'
import { logCallEvent } from '@/lib/callEvents'

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
  /** null means All Active — the campaign set is derived from the queue
   *  panel's own lead ids. See campaignIds resolution in the body. */
  campaignId: string | null
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

// =============================================================================
// PICKUP ABORTS THE REST
// =============================================================================
// The defining behaviour of this dialer's predictive mode, and the reason it
// carries far less abandonment risk than a textbook one.
//
// A textbook predictive dialer does the opposite of this: surplus answered
// calls are routed to whoever is free, and when nobody is free the prospect is
// abandoned — dead air, then a drop. That is the behaviour the FTC's 3% rule
// exists to bound, and every vendor in this category lives inside it.
//
// Here, the moment a human is committed to the agent, every OTHER line this
// session still has ringing is hung up. A line that never got answered cannot
// be abandoned, so for a solo agent the surplus simply stops existing.
//
// WHAT THIS DELIBERATELY DOES NOT TOUCH — and it is the whole of the team
// behaviour in one clause: only lines with answered_at IS NULL are aborted. A
// sibling that has ALREADY been answered is left completely alone to finish its
// own AMD verdict and route itself — to the originating agent if somehow free,
// otherwise through handleOverflowAnsweredCall, which hands it to the next
// available agent on a team campaign and drops it on a solo one. "A pickup
// aborts all active dials, and if two are picked up the next available user
// gets the pickup" is exactly that distinction: kill what is still ringing,
// never take a call away from someone who already said hello.
//
// WHY THE CLAIM RELEASE IS NOT OPTIONAL. handleHangup writes duration and
// clears the session pin, but it does not release the lead's claim — nothing
// does, short of the 30-second stale sweep. The controller paces off live
// claims (see inFlight below), so without this the aborted lines would keep
// counting as in flight for a further 30 seconds and the engine would sit at
// target, refusing to refill, immediately after the one moment it most needs
// to. The abort would visibly stall the dialer it was meant to sharpen.
//
// dial_attempts is deliberately NOT incremented. These leads were hung up by
// us, typically inside a second or two of ringing, because somebody else
// answered — that is our decision, not their non-answer. Counting it would let
// a lead exhaust its retry cap and be set aside as 'maxed' without ever having
// been genuinely dialed, quietly eating the customer's list. They go back to
// the pool untouched; the panel's own rotation is what stops them being the
// very next thing dialed.
const ABORT_LOOKBACK_MS = 90_000

export async function abortSiblingFanoutLines(params: {
  sessionId: string
  keepCallControlId: string
}): Promise<number> {
  const { sessionId, keepCallControlId } = params

  const { data: siblings, error } = await supabase
    .from('calls')
    .select('call_control_id, lead_id')
    .eq('dial_group_id', sessionId)
    .eq('dial_source', 'controller_fanout')
    .eq('duration', 0)
    .is('answered_at', null)
    .is('disposition', null)
    .gte('created_at', new Date(Date.now() - ABORT_LOOKBACK_MS).toISOString())
    .neq('call_control_id', keepCallControlId)

  if (error) {
    console.error('[controller] sibling lookup failed', error)
    return 0
  }
  if (!siblings || siblings.length === 0) return 0

  // Bounded, for the same reason /api/dialer/abort is bounded: an unbounded
  // burst of Call Control requests gets rate-limited by Telnyx, and the
  // request that actually matters — the bridge putting the agent on the live
  // call — ends up queued behind it. Five at a time covers the hard line cap
  // in a single pass anyway.
  let aborted = 0
  const CONCURRENCY = 5
  for (let i = 0; i < siblings.length; i += CONCURRENCY) {
    await Promise.all(
      siblings.slice(i, i + CONCURRENCY).map(async (s) => {
        if (!s.call_control_id) return
        try {
          await hangupCallControlId(s.call_control_id)
          aborted++
        } catch (e) {
          console.error('[controller] sibling abort hangup failed', s.call_control_id, e)
        }
      })
    )
  }

  // One statement rather than a release_lead_claim RPC per lead — this runs
  // while a human is waiting on the other line, so it stays off the critical
  // path in both latency and round trips.
  const leadIds = siblings.map(s => s.lead_id).filter((id): id is string => !!id)
  if (leadIds.length > 0) {
    const { error: relErr } = await supabase
      .from('leads')
      .update({ claimed_at: null, claimed_by_session_id: null })
      .in('id', leadIds)
    if (relErr) console.error('[controller] sibling claim release failed', relErr)
  }

  console.log(
    `[controller] pickup on ${keepCallControlId} aborted ${aborted} still-ringing ` +
    `line(s) and released ${leadIds.length} claim(s)`
  )
  return aborted
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

  // ── WHICH CAMPAIGNS THIS TICK MAY DIAL ──────────────────────────────────
  // Two changes here, and between them they are why predictive had never
  // placed a single call in this product's lifetime.
  //
  // 1. THE MODE BELONGS TO THE AGENT, NOT THE CAMPAIGN. This used to refuse
  //    outright unless campaigns.dialer_mode was itself 'predictive'. But the
  //    agent picks their mode in the dialer, on whatever list they are working;
  //    the column is the campaign's DEFAULT, not a permission. An agent who
  //    selected predictive on a campaign saved as progressive got a controller
  //    that returned zero on every heartbeat while the UI happily said the
  //    engine was running — and the dialer fell back to placing one user_dial
  //    at a time, which looks exactly like a working dialer that is simply slow.
  //
  // 2. ALL ACTIVE IS A REAL CASE. Predictive fans out across lines, and nothing
  //    about a line requires every lead on it to belong to one campaign. When
  //    no single campaign is selected the queue panel's own order — already
  //    sent on every heartbeat as leadIdAllowlist — defines both the leads AND
  //    the campaigns, so predictive dials the list exactly as displayed,
  //    spanning campaigns, the same way every other mode already does.
  let campaignIds: string[] = []

  if (campaignId) {
    campaignIds = [campaignId]
  } else if (leadIdAllowlist && leadIdAllowlist.length > 0) {
    // Derive the campaign set from the panel itself, preserving the order the
    // rows are displayed in so the top of the list is dialed first.
    const { data: allowRows } = await supabase
      .from('leads')
      .select('id, campaign_id')
      .in('id', leadIdAllowlist)
    const byId = new Map((allowRows || []).map(r => [r.id, r.campaign_id]))
    const seen = new Set<string>()
    for (const id of leadIdAllowlist) {
      const cid = byId.get(id)
      if (cid && !seen.has(cid)) {
        seen.add(cid)
        campaignIds.push(cid)
      }
    }
  }

  if (campaignIds.length === 0) {
    return zeroResult(
      'no campaign selected and the queue panel sent no leads — nothing to dial',
      released
    )
  }

  const { data: campaignRows } = await supabase
    .from('campaigns')
    .select('id, dialer_mode, predictive_lines_per_agent, predictive_lines_max')
    .in('id', campaignIds)

  const campaignsById = new Map((campaignRows || []).map(c => [c.id, c]))
  // Drop any id that didn't resolve, keeping panel order.
  campaignIds = campaignIds.filter(id => campaignsById.has(id))
  if (campaignIds.length === 0) {
    return zeroResult('none of the selected campaigns could be loaded', released)
  }

  // Line settings come from the FIRST campaign in panel order — the one the
  // agent is effectively working. Lines are an agent-level idea ("how many at
  // once am I comfortable with"), not a property of whichever list a given row
  // happens to belong to, so mixing per-campaign values across one All Active
  // run would make the pace depend on scroll position.
  const campaign = campaignsById.get(campaignIds[0])!

  
  // ── A LINE IS A WHOLE THING ─────────────────────────────────────────────
  // predictive_lines_per_agent is a numeric column whose DEFAULT IS 1.5, and
  // the create/update routes clamped it to a fractional [1.0, 3.0]. Nothing in
  // the product ever asked for one and a half telephone calls — the agent picks
  // a number of lines and watches that many rows light up.
  //
  // What the fraction actually did: shouldDial floors, so 1.5 lines became one
  // line and predictive placed exactly as many calls as progressive. Combined
  // with the controller never having been reached at all (see the heartbeat's
  // skip conditions), predictive has never in this product's lifetime dialed
  // more than one line at a time.
  //
  // Rounded rather than floored so the stored 1.5 becomes 2 rather than
  // silently staying at progressive parity, and the value is a real integer
  // from here down — claim_next_leads_for_campaign's p_count is an integer
  // parameter and PostgREST will not coerce a decimal into it.
  const rawDefault = Number(campaign.predictive_lines_per_agent)
  const campaignDefault = Number.isFinite(rawDefault) && rawDefault > 0
    ? Math.round(rawDefault)
    : 3
  const campaignMax = Math.min(campaign.predictive_lines_max || 5, HARD_LINE_CAP)

  // ── THE LINE COUNT IS THE AGENT'S, WHICHEVER LIST THEY SET IT ON ────────
  // agent_predictive_prefs is keyed per campaign, which is fine for a single
  // selected campaign and ambiguous across an All Active run. Rather than have
  // the client and the controller each independently nominate a "primary"
  // campaign to key on — two lists that must agree, and eventually won't — this
  // reads the agent's preference across every involved campaign and takes the
  // most recently set one. Wherever the agent moved the LINES selector, that is
  // the number this dials, and no ordering assumption has to hold.
  let agentPref: number | null = null
  try {
    const { data: prefs } = await supabase
      .from('agent_predictive_prefs')
      .select('preferred_lines, updated_at')
      .eq('user_id', internalUserId)
      .in('campaign_id', campaignIds)
      .order('updated_at', { ascending: false })
      .limit(1)
    const pref = prefs?.[0]
    if (pref && typeof pref.preferred_lines === 'number') {
      agentPref = pref.preferred_lines
    }
  } catch (prefErr) {
    console.error('[controller] pref lookup failed', prefErr)
  }

  let effectiveLines = agentPref ?? campaignDefault
  effectiveLines = Math.max(1, Math.min(effectiveLines, campaignMax))

  
  // ── THE ABANDON THROTTLE IS PER CAMPAIGN, BECAUSE THE RULE IS ───────────
  // The FTC's 3% ceiling is measured per campaign over a rolling 30 days, so
  // one unhealthy list must not throttle a healthy one, and a healthy one must
  // not launder an unhealthy one. Across an All Active run:
  //
  //   - campaigns at or over the trigger are simply not claimed from this tick;
  //     the healthy ones absorb the lines instead
  //   - if EVERY involved campaign is degraded there is nothing healthy left to
  //     shift to, so the whole tick drops to a single line — progressive parity,
  //     which cannot abandon anyone
  let degraded = false
  let dialableCampaignIds = campaignIds
  try {
    const { data: rateRows } = await supabase
      .from('campaign_abandon_rate_30d')
      .select('campaign_id, abandon_rate_pct')
      .in('campaign_id', campaignIds)

    const degradedIds = new Set(
      (rateRows || [])
        .filter(r => typeof r.abandon_rate_pct === 'number' && r.abandon_rate_pct >= ABANDON_AUTO_DEGRADE_PCT)
        .map(r => r.campaign_id)
    )

    if (degradedIds.size > 0) {
      degraded = true
      const healthy = campaignIds.filter(id => !degradedIds.has(id))
      if (healthy.length > 0) {
        dialableCampaignIds = healthy
      } else {
        effectiveLines = 1
      }
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
    .in('campaign_id', campaignIds)
    .eq('dial_group_id', sessionId)
    .gte('created_at', ninetySecondsAgo)
    .is('disposition', null)
    .eq('duration', 0)

  const inFlightCalls = (inFlightCallsRaw || []) as Array<{
    id: string
    phone_number: string | null
    lead_id: string | null
  }>

  // ── PACE OFF CLAIMS, NOT CALL ROWS ──────────────────────────────────────
  // This paced entirely off rows in `calls`, and a real dial runaway proved
  // why that is not safe: calls reached the carrier and rang a phone, no row
  // appeared, so inFlight stayed 0 and shouldDial stayed at full on every
  // heartbeat. The controller fired again, and again, for as long as the
  // engine was armed — the only thing that stopped it was pressing abort.
  //
  // The problem is not that the insert failed; it is that pacing depended on
  // the insert succeeding. A safety limit must not be downstream of the thing
  // it limits.
  //
  // leads.claimed_at is written by claim_next_leads_for_campaign itself, in the
  // same atomic statement that hands the lead over, and it is proven working.
  // A lead claimed by this session and not yet released IS a line in flight,
  // whether or not anything else about that call got recorded.
  //
  // The higher of the two is used, so a genuinely missing claim cannot make the
  // controller more aggressive than the call-row count already allowed.
  const { count: claimedInFlight } = await supabase
    .from('leads')
    .select('id', { count: 'exact', head: true })
    .in('campaign_id', campaignIds)
    .eq('claimed_by_session_id', sessionId)
    .gte('claimed_at', ninetySecondsAgo)

  const inFlight = Math.max(inFlightCalls.length, claimedInFlight ?? 0)
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

  // ── WHOLE LINES ONLY ────────────────────────────────────────────────────
  // predictive_lines_per_agent is numeric and defaults to 1.5, so this came out
  // fractional and was passed to claim_next_leads_for_campaign, whose p_count is
  // an integer. PostgREST will not coerce a decimal into it, the claim failed on
  // every tick, and predictive placed nothing at all.
  //
  // Floored, not rounded: 1.5 becomes 1, which is progressive-equivalent and
  // cannot abandon a call. Rounding up to 2 would add abandon-rate exposure off
  // a default nobody chose.
  const shouldDial = Math.max(0, Math.floor(desired - inFlight))

  // ── THE PACE, IN PLAIN ARITHMETIC ───────────────────────────────────────
  // inFlight above now counts live CLAIMS as well as call rows, and that is
  // what bounds this. A claim lives 30 seconds (release_stale_lead_claims) and
  // a predictive line rings for at most 20 (ringTimeoutSecs under the TSR), so
  // for an unanswered call — the majority — the claim outlives the call and the
  // line is counted for its whole life.
  //
  // That caps the pace at `desired` lines per 30 seconds. At 3 lines: 6 dials a
  // minute, 360 an hour. A progressive agent does roughly 120 an hour, and three
  // lines should be about three times that, so 360 is the correct number rather
  // than a compromise.
  //
  // What it replaces: pacing that read ONLY the calls table. Calls reached the
  // carrier and rang a phone with no row written, so inFlight stayed 0,
  // shouldDial stayed at full, and the controller fired a fresh batch on every
  // 5-second heartbeat until someone pressed abort. A limit must never sit
  // downstream of the thing it is limiting.

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
  //
  // ACROSS CAMPAIGNS, IN PANEL ORDER. The RPC claims within one campaign, which
  // is correct — the atomic FOR UPDATE SKIP LOCKED claim is what makes
  // concurrent agents safe, and that is worth keeping exactly as it is. So for
  // an All Active run this walks the campaigns in the order they first appear
  // in the panel, taking as many lines as each can still fill, and stops as
  // soon as the tick is full. A three-line tick whose top rows are all one
  // campaign therefore makes one RPC call, same as before; it only reaches for
  // a second campaign when the first cannot fill the tick.
  const leads: Array<{ id: string; phone: string; campaign_id: string }> = []
  let claimFailure: string | null = null

  for (const cid of dialableCampaignIds) {
    const remaining = shouldDial - leads.length
    if (remaining <= 0) break

    // The whole panel order is passed, not a per-campaign slice. The RPC
    // already intersects it with `campaign_id = p_campaign_id`, so ids
    // belonging to other campaigns simply don't match — and passing the full
    // list keeps array_position ranking rows by their true position in the
    // panel rather than their position within one campaign's subset.
    const panelOrder = leadIdAllowlist && leadIdAllowlist.length > 0
      ? leadIdAllowlist
      : null

    const { data: claimedLeads, error: claimErr } = await supabase.rpc(
      'claim_next_leads_for_campaign',
      {
        p_campaign_id: cid,
        p_session_id: sessionId,
        p_count: remaining,
        p_lead_ids: panelOrder,
      }
    )

    if (claimErr) {
      // One campaign failing must not abort the tick — the others can still
      // fill it. Remember the first error for the reason string.
      console.error(`[controller] claim failed for campaign ${cid}`, claimErr)
      if (!claimFailure) claimFailure = claimErr.message
      continue
    }

    leads.push(...((claimedLeads || []) as Array<{
      id: string
      phone: string
      campaign_id: string
    }>))
  }

  if (leads.length === 0) {
    return {
      fired: 0, desired, inFlight, effectiveLines, degraded,
      reason: claimFailure
        ? `claim failed: ${claimFailure}`
        : `no claimable leads across ${dialableCampaignIds.length} campaign(s)`,
      callSids: [], skipped: 0, released, dedupedPhones: 0, dialedPhones: [], dialedLeadIds: [], inFlightPhones, inFlightLeadIds,
    }
  }

  
  
  
  
  
  // ── NEVER RING THE SAME PHONE TWICE AT ONCE ─────────────────────────────
  // Seeded with the numbers already in flight, not just emptied per tick.
  //
  // Deduping only within a single batch stopped one tick dialing a number
  // twice, and did nothing about the NEXT tick dialing the number the previous
  // one is still ringing. On a list with a repeated number — a test list, or a
  // real one with a shared household or business line — that is the common
  // case, not the edge case: the same handset gets called again while the first
  // call is still up.
  const phoneSeen = new Set<string>(inFlightPhones.map(normalizePhone).filter(Boolean))
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

      // ── A FAILED FAN-OUT MUST LEAVE A TRACE ─────────────────────────────
      // These failures were console-only, which makes them invisible: a
      // predictive tick that claims leads and then places nothing looks
      // identical, from every table in the database, to a tick that was never
      // asked to dial. That ambiguity is exactly what made "predictive has
      // never placed a call" take this long to pin down — there was no row
      // anywhere that said WHY.
      //
      // Written to call_events with no call_control_id (there is no call — that
      // is the point), so the reason is queryable next to every other event.
      const reason = result.status === 'fulfilled'
        ? `${result.value.error}${result.value.detail ? ` — ${result.value.detail}` : ''}`
        : `threw: ${String(result.reason)}`

      if (result.status === 'fulfilled') {
        console.warn(
          `[controller] placement failed for lead ${lead.id}:`,
          result.value.error, result.value.detail
        )
      } else {
        console.error(`[controller] placement threw for lead ${lead.id}:`, result.reason)
      }

      void logCallEvent({
        event_type: 'fanout_placement_failed',
        user_id: clerkId,
        campaign_id: lead.campaign_id,
        lead_id: lead.id,
        source: 'system',
        status: result.status === 'fulfilled' ? String(result.value.httpStatus ?? '') : 'threw',
        detail: { phone: lead.phone, reason },
      })
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