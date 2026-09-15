// =============================================================================
// THE TWO SURCHARGE RATIOS TELNYX JUDGES THE ACCOUNT ON
// =============================================================================
// Both are month-long ratios with DIFFERENT denominators, and getting that
// wrong is how docs/COST-FINDINGS.md §1i was written twice before it was right.
// Telnyx's own wording:
//
//   SHORT DURATION  "Short Duration Calls (SDCs) are outbound calls that are 6
//                   seconds or less in duration." Ratio is "Count of short
//                   duration calls connected / Total count of CONNECTED calls."
//                   Limit 15%. $0.01 applied to ALL SDCs that month, "not only
//                   those above the 15% mark". Domestic and international.
//
//   ABANDONED       "the originating user initiates the call disconnection
//                   during the ringing/call set-up process", INCLUDING calls to
//                   disconnected numbers. Ratio is abandoned / TOTAL OUTBOUND.
//                   Limit 20%, $0.005 each, "applied to all the abandoned calls
//                   and not just those that exceeded the threshold."
//
// September 2026 breached both: 20.8% and 21.6%, about $3.53 — 12.5% of a
// $28.29 usage bill — and neither was visible anywhere.
//
// ── THIS IS AN ESTIMATE, AND THE PORTAL OUTRANKS IT ─────────────────────────
// Telnyx publishes the abandoned rate as a pie chart on the Mission Control
// dashboard, and both figures in the advanced usage reports. That is the count
// that gets billed. This exists because a number you can see every day beats a
// number you have to go and look up, not because it is more authoritative —
// and §1m is the standing reminder that a column we populate is not the
// carrier's state.
//
// The abandoned side USED to be an inference from call shape. It is now taken
// from Telnyx's own `hangup_cause`, which is the nearest thing to their
// attribution we hold -- see isAbandoned. The remaining gap is only that we
// count OUR records of their causes, not their ledger.

/** Telnyx thresholds. Crossing them applies the charge retroactively for the month. */
export const SHORT_DURATION_LIMIT = 0.15
export const ABANDONED_LIMIT = 0.20
export const SHORT_DURATION_FEE_USD = 0.01
export const ABANDONED_FEE_USD = 0.005
/** A connected call of this many seconds or fewer is a Short Duration Call. */
export const SHORT_DURATION_SECONDS = 6

/**
 * Telnyx's own cause for "the originating side cleared this call".
 *
 * An UNANSWERED leg with `normal_clearing` is us hanging up. A leg nobody
 * answered that simply rang out carries `timeout`; a busy one carries
 * `user_busy`; a dead number carries `not_found`. Only `normal_clearing`
 * means somebody chose to end it, and on an unanswered leg that somebody is us.
 */
export const WE_CANCELLED_CAUSE = 'normal_clearing'

/** Hangup causes Telnyx counts as reaching a disconnected number. */
export const DISCONNECTED_NUMBER_CAUSES = [
  'unallocated_number',
  'invalid_number_format',
  'no_route_destination',
  'not_found',
]

export interface ExposureRow {
  /** Did Telnyx see this call at all? Rows with no call_control_id never placed. */
  placed: boolean
  answered: boolean
  /** Seconds AFTER answer. Billing starts at answer; the ring is never billable. */
  talkSeconds: number
  dialSource: string | null
  disposition: string | null
  /** Telnyx's cause. This is the signal, not our own inference. */
  hangupCause: string | null
}

export interface Exposure {
  totalOutbound: number
  totalConnected: number
  shortDurationCalls: number
  shortDurationPct: number
  shortDurationOver: boolean
  shortDurationFeeUsd: number
  abandonedCalls: number
  abandonedPct: number
  abandonedOver: boolean
  abandonedFeeUsd: number
  totalFeeUsd: number
}

/**
 * A call we ended before the other side answered.
 *
 * ── THIS USED TO BE A PROXY, AND THE PROXY WAS WRONG BOTH WAYS ──────────────
 * It inferred abandonment from shape: any unanswered fan-out leg, plus
 * AGENT_LEG_FAILED, plus disconnected-number causes. Checked against Telnyx's
 * own `hangup_cause` on 14 September:
 *
 *     the proxy said   180 of 533   33.8%
 *     hangup_cause says 118 of 533   22.1%
 *
 * It OVERSTATED by counting fan-out lines that simply rang out — those carry
 * `timeout`, nobody cancelled them — and UNDERSTATED by missing 857 legs across
 * 8-12 Sept that died at ZERO seconds with `normal_clearing` and were
 * dispositioned NO_ANSWER, the undetected half of the dead-socket failure.
 *
 * So use the carrier's own word for it. §1m of docs/COST-FINDINGS.md is the
 * standing rule this violated: a column we populate is not the carrier's state.
 */
export function isAbandoned(r: ExposureRow): boolean {
  if (!r.placed || r.answered) return false
  // Telnyx's definition also explicitly includes calls to disconnected numbers.
  if (DISCONNECTED_NUMBER_CAUSES.includes(r.hangupCause || '')) return true
  return r.hangupCause === WE_CANCELLED_CAUSE
}

export function isShortDuration(r: ExposureRow): boolean {
  return r.placed && r.answered && r.talkSeconds <= SHORT_DURATION_SECONDS
}

export function computeExposure(rows: ExposureRow[]): Exposure {
  const placed = rows.filter(r => r.placed)
  const connected = placed.filter(r => r.answered)
  const sdc = placed.filter(isShortDuration).length
  const abandoned = placed.filter(isAbandoned).length

  const sdcPct = connected.length > 0 ? sdc / connected.length : 0
  const abPct = placed.length > 0 ? abandoned / placed.length : 0
  const sdcOver = sdcPct > SHORT_DURATION_LIMIT
  const abOver = abPct > ABANDONED_LIMIT

  // Retroactive to EVERY qualifying call once over, not just the excess —
  // which is why being a point over costs the whole month, not a sliver.
  const sdcFee = sdcOver ? sdc * SHORT_DURATION_FEE_USD : 0
  const abFee = abOver ? abandoned * ABANDONED_FEE_USD : 0

  return {
    totalOutbound: placed.length,
    totalConnected: connected.length,
    shortDurationCalls: sdc,
    shortDurationPct: round3(sdcPct),
    shortDurationOver: sdcOver,
    shortDurationFeeUsd: round2(sdcFee),
    abandonedCalls: abandoned,
    abandonedPct: round3(abPct),
    abandonedOver: abOver,
    abandonedFeeUsd: round2(abFee),
    totalFeeUsd: round2(sdcFee + abFee),
  }
}

/**
 * How much more clean volume clears a breach.
 *
 * Both ratios span the whole month and the bad calls are already in the
 * numerator, so they cannot be removed — only diluted. **Dilution only works
 * when the recent rate is already under the limit**; if it is not, dialing more
 * makes it worse, and returning null rather than a number is the honest answer.
 *
 * On 14 September, measured from hangup_cause: 118 of 533 cancelled, 22.1%,
 * still over the 20% line. 98 of those 118 were AGENT_LEG_FAILED, so the agent
 * socket breaker alone takes that day to 20 of 533 — 3.8%, and comfortably
 * under. Before the breaker there was no volume that could dilute it.
 */
export function callsToClear(
  bad: number,
  total: number,
  limit: number,
  recentRate: number
): number | null {
  if (total > 0 && bad / total <= limit) return 0
  if (!(recentRate < limit)) return null
  return Math.ceil((bad - limit * total) / (limit - recentRate))
}

function round2(n: number): number { return Math.round(n * 100) / 100 }
function round3(n: number): number { return Math.round(n * 1000) / 1000 }
