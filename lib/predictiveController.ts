import { createClient } from '@supabase/supabase-js'
import { placeOutboundCall } from '@/lib/placeOutboundCall'
import { logCallEvent } from '@/lib/callEvents'
import { hasCallingWindowOverride } from '@/lib/callingWindowOverride'
import { getPlatformConfig } from '@/lib/platformConfig'
import { sellerIdentityForCampaigns } from '@/lib/sellerIdentity'
import { backToBackAttempts } from '@/lib/dialerConstants'
import {
  legalLineCount, estimateHumanRate, planRound, breakerTripped,
  BREAKER_PAUSE_MS, HARD_LINE_CAP, PREDICTIVE_MIN_LINES, PREDICTIVE_MAX_LINES,
  type LegalLinesResult,
} from '@/lib/predictive/pacing'
import { ensureSeat, readSession, rotateSeatIfOld, linesInFlight } from '@/lib/predictive/seat'

// =============================================================================
// THE PREDICTIVE ENGINE — one tick (v2, docs/PREDICTIVE.md)
// =============================================================================
// Driven by the agent's heartbeat while predictive is armed. A tick either
// places ONE round of lines or says, on the record, why it did not.
//
// The order of the checks is the design:
//
//   1. the agent's seat must be live       nobody is dialed without a line
//                                           ready to take them
//   2. the agent must be free              nothing rings for someone talking
//   3. the previous round must be over     rounds do not overlap, and no
//                                           ringing line is ever cut to make
//                                           room for the next
//   4. one tick at a time                  a lease on the session row
//   5. the line count the law allows       from the campaign's own 30 days
//   6. the runaway breaker                 six rounds a minute is a loop
//   7. repeats owed first, then fresh      1x/2x/3x per lead, then the queue
//
// Every early return carries a reason, and runPredictiveController records
// the ones that fire nothing (fanout_idle), as before.
// =============================================================================

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Last time each session's idle tick was recorded. Per warm instance.
const tickLogCache = new Map<string, number>()

/** A tick that dies mid-round frees its lock after this long. */
const TICK_LOCK_MS = 15_000

/** Nobody new is rung on a number this engine rang in the last minute. */
const RECENTLY_DIALED_MS = 60_000

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
  dedupedPhones: number
  /** Numbers placed on THIS tick only, for the live activity feed. */
  dialedPhones: string[]
  /** Numbers genuinely up right now, refreshed every tick. */
  inFlightPhones: string[]
  /** Lead ids up right now. Row highlighting keys off these, not numbers. */
  inFlightLeadIds: string[]
  /** Lead ids placed on THIS tick only. Drives queue rotation. */
  dialedLeadIds: string[]
  /** The agent's line. */
  seat?: 'live' | 'placing' | 'failed'
  /** Why the line count is what it is. */
  lines?: {
    count: number
    limitedBy: LegalLinesResult['limitedBy']
    reason: string
    projectedPct: number
    measuredPct: number
  }
}

interface RunControllerInput {
  sessionId: string
  /** null means All Active: the campaigns come from the queue panel's leads. */
  campaignId: string | null
  clerkId: string
  internalUserId: string
  teamId: string | null
  /** The queue panel's displayed order. Dialing follows it top down. */
  leadIdAllowlist?: string[] | null
}

interface ClaimedLead {
  id: string
  phone: string
  campaign_id: string
}

interface Snapshot {
  released: number
  inFlight: number
  inFlightPhones: string[]
  inFlightLeadIds: string[]
}

function normalizePhone(raw: string): string {
  const digits = (raw || '').replace(/\D/g, '')
  if (digits.length === 11 && digits.startsWith('1')) return digits
  if (digits.length === 10) return '1' + digits
  return digits
}

function idle(reason: string, snap: Snapshot, extra: Partial<ControllerResult> = {}): ControllerResult {
  return {
    fired: 0, desired: 0, inFlight: snap.inFlight, effectiveLines: 0, degraded: false, reason,
    callSids: [], skipped: 0, released: snap.released, dedupedPhones: 0,
    dialedPhones: [], dialedLeadIds: [],
    inFlightPhones: snap.inFlightPhones, inFlightLeadIds: snap.inFlightLeadIds,
    ...extra,
  }
}

async function snapshot(sessionId: string, released: number): Promise<Snapshot> {
  const live = await linesInFlight(sessionId)
  return {
    released,
    inFlight: live.length,
    inFlightPhones: live.map(c => c.phone_number).filter((p): p is string => !!p),
    inFlightLeadIds: live.map(c => c.lead_id).filter((id): id is string => !!id),
  }
}

export async function runPredictiveController(input: RunControllerInput): Promise<ControllerResult> {
  const result = await runPredictiveControllerInner(input)

  // Rate-limited per session rather than filtered by reason, so a stuck engine
  // shows up without a busy one writing twelve rows a minute.
  const lastLogged = tickLogCache.get(input.sessionId) ?? 0
  if (result.fired === 0 && Date.now() - lastLogged > 20_000) {
    tickLogCache.set(input.sessionId, Date.now())
    // Awaited: a pending insert is frozen with the invocation on serverless.
    await logCallEvent({
      event_type: 'fanout_idle',
      user_id: input.clerkId,
      campaign_id: input.campaignId,
      source: 'system',
      status: String(result.desired),
      detail: {
        reason: result.reason,
        seat: result.seat ?? null,
        lines: result.lines ?? null,
        in_flight: result.inFlight,
        released: result.released,
        allowlist_size: input.leadIdAllowlist?.length ?? null,
      },
    })
  }
  return result
}

async function runPredictiveControllerInner(input: RunControllerInput): Promise<ControllerResult> {
  const { sessionId, clerkId } = input

  let released = 0
  try {
    const { data } = await supabase.rpc('release_stale_lead_claims')
    if (typeof data === 'number') released = data
  } catch (err) {
    console.error('[controller] stale claim sweep failed', err)
  }

  // Taken first so the queue panel's highlighting is true on every tick,
  // including the ones that dial nothing.
  const snap = await snapshot(sessionId, released)

  const session = await readSession(sessionId)
  if (!session) return idle('no dialer session yet', snap)

  // 1. The agent's line.
  const seat = await ensureSeat(sessionId, clerkId)
  if (seat.state !== 'live') return idle(seat.reason, snap, { seat: seat.state })

  // 2. Nobody rings for an agent who is talking.
  if (session.current_call_id) return idle('agent is on a call', snap, { seat: 'live' })

  const pausedUntil = session.predictive_paused_until ? Date.parse(session.predictive_paused_until) : NaN
  if (Number.isFinite(pausedUntil) && pausedUntil > Date.now()) {
    const secs = Math.ceil((pausedUntil - Date.now()) / 1000)
    return idle(`paused by the runaway breaker for ${secs}s more`, snap, { seat: 'live' })
  }

  // 3. The previous round is over only when every one of its legs has ended.
  if (snap.inFlight > 0) {
    return idle(
      `round in progress, ${snap.inFlight} line${snap.inFlight === 1 ? '' : 's'} still up`,
      snap,
      { seat: 'live' }
    )
  }

  // Between rounds and idle is the only safe moment to replace an old seat.
  if (await rotateSeatIfOld(session)) {
    return idle('refreshing your line before its four-hour limit', snap, { seat: 'placing' })
  }

  // 4. One tick at a time.
  const lockBefore = new Date(Date.now() - TICK_LOCK_MS).toISOString()
  const { data: locked } = await supabase
    .from('agent_sessions')
    .update({ predictive_tick_lock: new Date().toISOString() })
    .eq('id', sessionId)
    .or(`predictive_tick_lock.is.null,predictive_tick_lock.lt.${lockBefore}`)
    .select('id')
    .maybeSingle()
  if (!locked) return idle('another tick is placing this round', snap, { seat: 'live' })

  try {
    // Re-read under the lock: a tick that passed the barrier at the same moment
    // as this one may have placed its round since.
    const fresh = await snapshot(sessionId, released)
    if (fresh.inFlight > 0) {
      return idle(`round in progress, ${fresh.inFlight} line(s) still up`, fresh, { seat: 'live' })
    }
    return await placeRound(input, fresh)
  } finally {
    await supabase.from('agent_sessions').update({ predictive_tick_lock: null }).eq('id', sessionId)
  }
}

async function placeRound(input: RunControllerInput, snap: Snapshot): Promise<ControllerResult> {
  const { sessionId, campaignId, clerkId, internalUserId, teamId, leadIdAllowlist } = input
  const panelOrder = leadIdAllowlist && leadIdAllowlist.length > 0 ? leadIdAllowlist : null
  const panelPosition = new Map((panelOrder || []).map((id, i) => [id, i]))

  // ── WHICH CAMPAIGNS ────────────────────────────────────────────────────
  // A selected campaign, or on All Active the campaigns of the leads the queue
  // panel is showing, in the order they first appear there.
  let campaignIds: string[] = []
  if (campaignId) {
    campaignIds = [campaignId]
  } else if (panelOrder) {
    const { data: rows } = await supabase.from('leads').select('id, campaign_id').in('id', panelOrder)
    const byLead = new Map((rows || []).map(r => [r.id, r.campaign_id as string]))
    const seen = new Set<string>()
    for (const id of panelOrder) {
      const cid = byLead.get(id)
      if (cid && !seen.has(cid)) { seen.add(cid); campaignIds.push(cid) }
    }
  }
  if (campaignIds.length === 0) {
    return idle('no campaign selected and the queue panel sent no leads', snap, { seat: 'live' })
  }

  const { data: campaignRows } = await supabase
    .from('campaigns')
    .select('id, predictive_lines_per_agent, predictive_lines_max, dial_repeat_count')
    .in('id', campaignIds)
  const campaignsById = new Map((campaignRows || []).map(c => [c.id as string, c]))
  campaignIds = campaignIds.filter(id => campaignsById.has(id))
  if (campaignIds.length === 0) {
    return idle('none of the selected campaigns could be loaded', snap, { seat: 'live' })
  }

  // ── NO LINES WITHOUT THE TWO DETAILS ────────────────────────────────────
  // The recorded message names each campaign owner's business and a callback
  // number (lib/sellerIdentity). One campaign in the round without them stops
  // the whole round: a surplus answer on it would have nothing lawful to hear.
  // The dialer asks for them before START; this is the backstop.
  const sellers = await sellerIdentityForCampaigns(campaignIds)
  if (campaignIds.some(id => !sellers.get(id)?.ready)) {
    return idle("predictive needs the campaign owner's business name and callback number, set in Settings", snap, { seat: 'live' })
  }
  const primary = campaignsById.get(campaignIds[0])!

  // ── THE CAP: WHAT SETTINGS ALLOW ────────────────────────────────────────
  // The agent's LINES choice (most recently set across these campaigns), else
  // the campaign default, bounded by the campaign's max, the platform ceiling
  // and five. The law then decides how much of the cap is usable.
  let agentPref: number | null = null
  try {
    const { data: prefs } = await supabase
      .from('agent_predictive_prefs')
      .select('preferred_lines, updated_at')
      .eq('user_id', internalUserId)
      .in('campaign_id', campaignIds)
      .order('updated_at', { ascending: false })
      .limit(1)
    if (prefs?.[0] && typeof prefs[0].preferred_lines === 'number') agentPref = prefs[0].preferred_lines
  } catch (err) {
    console.error('[controller] line preference lookup failed', err)
  }

  let platformCeiling = HARD_LINE_CAP
  try {
    const { predictive_line_ceiling } = await getPlatformConfig()
    if (Number.isFinite(predictive_line_ceiling) && predictive_line_ceiling > 0) {
      platformCeiling = Math.min(HARD_LINE_CAP, predictive_line_ceiling)
    }
  } catch (err) {
    // Fail toward the safe end: one line cannot abandon anyone.
    console.error('[controller] line ceiling unreadable, holding at 1', err)
    platformCeiling = 1
  }

  const rawDefault = Number(primary.predictive_lines_per_agent)
  const campaignDefault = Number.isFinite(rawDefault) && rawDefault > 0 ? Math.round(rawDefault) : 3
  const campaignMax = Math.min(Number(primary.predictive_lines_max) || HARD_LINE_CAP, HARD_LINE_CAP)
  // 2 or 3, as chosen (lib/predictive/pacing). A leftover LINES 1, or a
  // campaign max below 2 from before that rule, is read as 2. The platform
  // ceiling is an operator's switch and can still lower it; the law decides
  // below how much of it is usable.
  const chosen = Math.max(PREDICTIVE_MIN_LINES, Math.min(agentPref ?? campaignDefault, PREDICTIVE_MAX_LINES))
  const cap = Math.max(1, Math.min(chosen, Math.max(PREDICTIVE_MIN_LINES, campaignMax), platformCeiling))

  // ── THE LAW: WHAT EACH CAMPAIGN'S OWN 30 DAYS ALLOW ─────────────────────
  // A round rings together, so it runs at the count the strictest campaign in
  // it allows. An unreadable record fails to one line.
  let binding: { id: string; result: LegalLinesResult }
  const { data: statRows, error: statErr } = await supabase.rpc('predictive_campaign_stats', {
    p_campaign_ids: campaignIds,
  })
  if (statErr) {
    console.error('[controller] abandonment record unreadable, one line', statErr)
    binding = {
      id: campaignIds[0],
      result: {
        lines: 1, projectedPct: 0, measuredPct: 0, limitedBy: 'law',
        reason: 'the 30-day abandonment record could not be read, so one line',
      },
    }
  } else {
    const stats = new Map(((statRows || []) as Array<Record<string, unknown>>).map(r => [r.campaign_id as string, r]))
    const perCampaign = campaignIds.map(id => {
      const st = stats.get(id)
      return {
        id,
        result: legalLineCount({
          cap,
          humanRate: estimateHumanRate(Number(st?.humans_14d ?? 0), Number(st?.dials_14d ?? 0)),
          answered30d: Number(st?.answered_30d ?? 0),
          abandoned30d: Number(st?.abandoned_30d ?? 0),
          sellerMessageReady: sellers.get(id)?.ready === true,
        }),
      }
    })
    binding = perCampaign.reduce((a, b) => (b.result.lines < a.result.lines ? b : a))
  }
  const lines = binding.result.lines
  const degraded = binding.result.limitedBy === 'degraded'
  const linesInfo: ControllerResult['lines'] = {
    count: lines,
    limitedBy: binding.result.limitedBy,
    reason: binding.result.reason,
    projectedPct: Number(binding.result.projectedPct.toFixed(2)),
    measuredPct: Number(binding.result.measuredPct.toFixed(2)),
  }
  const base = { seat: 'live' as const, desired: lines, effectiveLines: lines, degraded, lines: linesInfo }

  // ── THE RUNAWAY BREAKER ─────────────────────────────────────────────────
  const { count: dialsLastMinute } = await supabase
    .from('calls')
    .select('id', { count: 'exact', head: true })
    .eq('dial_group_id', sessionId)
    .gte('created_at', new Date(Date.now() - 60_000).toISOString())
  if (breakerTripped(dialsLastMinute ?? 0, lines)) {
    await supabase
      .from('agent_sessions')
      .update({ predictive_paused_until: new Date(Date.now() + BREAKER_PAUSE_MS).toISOString() })
      .eq('id', sessionId)
    await logCallEvent({
      event_type: 'predictive_breaker',
      user_id: clerkId,
      campaign_id: campaignIds[0],
      source: 'system',
      status: String(dialsLastMinute),
      detail: { session_id: sessionId, lines },
    })
    return idle(`runaway breaker: ${dialsLastMinute} dials in the last minute, pausing 30s`, snap, base)
  }

  // ── REPEATS OWED FIRST ──────────────────────────────────────────────────
  const dialable = new Set(campaignIds)
  const { data: owedRows } = await supabase
    .from('predictive_batch')
    .select('lead_id, campaign_id, attempts, max_attempts, position')
    .eq('session_id', sessionId)
    .eq('state', 'waiting')
  const owed = ((owedRows || []) as Array<{ lead_id: string; campaign_id: string; attempts: number; max_attempts: number; position: number }>)
    .filter(r => dialable.has(r.campaign_id))
  const attemptsSoFar = new Map(owed.map(r => [r.lead_id, r.attempts]))
  const plan = planRound(lines, owed.map(r => ({
    leadId: r.lead_id,
    position: panelPosition.get(r.lead_id) ?? r.position,
  })))

  const repeats: ClaimedLead[] = []
  if (plan.repeatIds.length > 0) {
    const { data, error } = await supabase.rpc('claim_predictive_repeats', {
      p_session_id: sessionId,
      p_lead_ids: plan.repeatIds,
    })
    if (error) console.error('[controller] repeat claim failed', error)
    repeats.push(...((data || []) as ClaimedLead[]))
    const got = new Set(repeats.map(l => l.id))
    const lost = plan.repeatIds.filter(id => !got.has(id))
    if (lost.length > 0) {
      // Taken by a teammate, dispositioned, or no longer dialable. Done with.
      await supabase.from('predictive_batch').delete().eq('session_id', sessionId).in('lead_id', lost)
    }
  }

  // ── THEN FRESH LEADS FROM THE TOP OF THE QUEUE ─────────────────────────
  const owedIds = new Set((owedRows || []).map(r => r.lead_id as string))
  const fresh: ClaimedLead[] = []
  let freshNeeded = lines - repeats.length
  let claimFailure: string | null = null
  for (const cid of campaignIds) {
    if (freshNeeded <= 0) break
    const { data, error } = await supabase.rpc('claim_next_leads_for_campaign', {
      p_campaign_id: cid,
      p_session_id: sessionId,
      p_count: Math.min(freshNeeded, HARD_LINE_CAP),
      p_lead_ids: panelOrder,
    })
    if (error) {
      console.error(`[controller] claim failed for campaign ${cid}`, error)
      claimFailure = claimFailure ?? error.message
      continue
    }
    for (const lead of (data || []) as ClaimedLead[]) {
      if (owedIds.has(lead.id)) {
        // Owed a repeat but not in this round: it waits its turn.
        await supabase.rpc('release_lead_claim', { p_lead_id: lead.id })
        continue
      }
      fresh.push(lead)
      freshNeeded--
    }
  }

  const claimed = [...repeats, ...fresh]
  if (claimed.length === 0) {
    return idle(
      claimFailure ? `claim failed: ${claimFailure}` : `no dialable leads across ${campaignIds.length} campaign(s)`,
      snap,
      base
    )
  }

  // ── NEVER THE SAME PHONE TWICE AT ONCE, AND NO NEW LEAD ON A NUMBER JUST RUNG
  // Repeats are exempt from the one-minute rule on purpose: calling the same
  // person back straight away is exactly what 1x/2x/3x asks for. Testers are
  // exempt entirely (their lists are a handful of their own numbers).
  const isTester = await hasCallingWindowOverride(clerkId)
  const { data: recentCalls } = isTester
    ? { data: [] as Array<{ phone_number: string | null }> }
    : await supabase
        .from('calls')
        .select('phone_number')
        .eq('dial_group_id', sessionId)
        .gte('created_at', new Date(Date.now() - RECENTLY_DIALED_MS).toISOString())
  const recentPhones = new Set(
    (recentCalls || []).map(c => c.phone_number).filter((p): p is string => !!p).map(normalizePhone)
  )
  const repeatIds = new Set(repeats.map(l => l.id))
  const roundPhones = new Set<string>()
  const toDial: ClaimedLead[] = []
  const dropped: string[] = []
  for (const lead of claimed) {
    const phone = normalizePhone(lead.phone)
    const blockedAsRecent = !repeatIds.has(lead.id) && recentPhones.has(phone)
    if (!phone || roundPhones.has(phone) || blockedAsRecent) { dropped.push(lead.id); continue }
    if (panelOrder && !panelPosition.has(lead.id)) { dropped.push(lead.id); continue }
    roundPhones.add(phone)
    toDial.push(lead)
  }
  if (dropped.length > 0) {
    await Promise.allSettled(dropped.map(id => supabase.rpc('release_lead_claim', { p_lead_id: id })))
    await supabase.from('predictive_batch').delete().eq('session_id', sessionId).in('lead_id', dropped)
  }
  if (toDial.length === 0) {
    return idle(`claimed ${claimed.length} lead(s) but none could be dialed this round`, snap, {
      ...base, dedupedPhones: dropped.length,
    })
  }

  // ── PLACE THE ROUND ─────────────────────────────────────────────────────
  // Same placement as every mode: calling window, suppression, number pool,
  // the same AMD settings as progressive. No agent leg per line: the seat is it.
  const placements = await Promise.allSettled(
    toDial.map(lead =>
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

  const callSids: string[] = []
  const dialedPhones: string[] = []
  const dialedLeadIds: string[] = []
  const batchRows: Array<Record<string, unknown>> = []
  const failedLeadIds: string[] = []
  let skipped = 0
  let permanentlyFailed = 0
  let capacityBlocked = 0
  let heldUntilCallable = 0
  const now = new Date().toISOString()

  for (let i = 0; i < placements.length; i++) {
    const result = placements[i]
    const lead = toDial[i]

    if (result.status === 'fulfilled' && result.value.success && result.value.callControlId) {
      callSids.push(result.value.callControlId)
      dialedPhones.push(lead.phone)
      dialedLeadIds.push(lead.id)
      const campaign = campaignsById.get(lead.campaign_id)
      batchRows.push({
        session_id: sessionId,
        lead_id: lead.id,
        campaign_id: lead.campaign_id,
        attempts: (attemptsSoFar.get(lead.id) ?? 0) + 1,
        max_attempts: backToBackAttempts(campaign?.dial_repeat_count as number | null | undefined),
        state: 'ringing',
        position: panelPosition.get(lead.id) ?? i,
        updated_at: now,
      })
      continue
    }

    skipped++
    failedLeadIds.push(lead.id)
    const kind = result.status === 'fulfilled' ? (result.value.failureKind ?? 'transient') : 'transient'

    if (kind === 'permanent') {
      // Out of rotation without spending an attempt: it was never dialed.
      permanentlyFailed++
      await supabase
        .from('leads')
        .update({
          status: 'undialable',
          last_call_disposition: 'UNDIALABLE',
          claimed_at: null,
          claimed_by_session_id: null,
        })
        .eq('id', lead.id)
    } else if (kind === 'capacity') {
      // No number to dial from. Holding the claim lets the 30-second sweep be
      // the backoff, instead of the next tick failing on it a second later.
      capacityBlocked++
    } else if (result.status === 'fulfilled' && result.value.httpStatus === 451 && result.value.retryAfter) {
      // Refused by the calling window or Florida's daily limit: not callable
      // until retryAfter. Released, it would be claimed on the very next tick
      // and refused again, and the round would never move past it. So it is
      // held until then: a claim stamped 30 s before that instant expires
      // exactly at it (claims older than 30 s are free).
      heldUntilCallable++
      const holdFrom = new Date(Date.parse(result.value.retryAfter) - 30_000).toISOString()
      await supabase
        .from('leads')
        .update({ claimed_at: holdFrom, claimed_by_session_id: sessionId })
        .eq('id', lead.id)
    } else {
      await supabase.rpc('release_lead_claim', { p_lead_id: lead.id })
    }

    const reason = result.status === 'fulfilled'
      ? `${result.value.error}${result.value.detail ? `, ${result.value.detail}` : ''}`
      : `threw: ${String(result.reason)}`
    await logCallEvent({
      event_type: 'fanout_placement_failed',
      user_id: clerkId,
      campaign_id: lead.campaign_id,
      lead_id: lead.id,
      source: 'system',
      status: result.status === 'fulfilled' ? String(result.value.httpStatus ?? '') : 'threw',
      detail: { phone: lead.phone, reason, failureKind: kind },
    })
  }

  if (batchRows.length > 0) {
    const { error } = await supabase.from('predictive_batch').upsert(batchRows, { onConflict: 'session_id,lead_id' })
    if (error) console.error('[controller] batch write failed', error)
  }
  if (failedLeadIds.length > 0) {
    await supabase.from('predictive_batch').delete().eq('session_id', sessionId).in('lead_id', failedLeadIds)
  }

  return {
    fired: callSids.length,
    desired: lines,
    inFlight: snap.inFlight + callSids.length,
    effectiveLines: lines,
    degraded,
    reason:
      `dialed ${callSids.length}/${toDial.length}` +
      (repeats.length ? `, ${repeats.filter(l => dialedLeadIds.includes(l.id)).length} repeat` : '') +
      (dropped.length ? `, ${dropped.length} held back` : '') +
      (permanentlyFailed ? `, ${permanentlyFailed} undialable` : '') +
      (capacityBlocked ? `, ${capacityBlocked} held for capacity` : '') +
      (heldUntilCallable ? `, ${heldUntilCallable} held until callable` : '') +
      `; ${linesInfo.reason}`,
    callSids,
    skipped,
    released: snap.released,
    dedupedPhones: dropped.length,
    dialedPhones,
    dialedLeadIds,
    inFlightPhones: Array.from(new Set([...snap.inFlightPhones, ...dialedPhones])),
    inFlightLeadIds: Array.from(new Set([...snap.inFlightLeadIds, ...dialedLeadIds])),
    seat: 'live',
    lines: linesInfo,
  }
}
