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
// The abandoned side is the approximation. We cannot see Telnyx's own
// disconnect attribution, so it is inferred from the shapes we know are ours:
// surplus fan-out lines cancelled when a sibling answers, agent-leg failures
// that hang up a ringing lead, and unallocated-number causes.

/** Telnyx thresholds. Crossing them applies the charge retroactively for the month. */
export const SHORT_DURATION_LIMIT = 0.15
export const ABANDONED_LIMIT = 0.20
export const SHORT_DURATION_FEE_USD = 0.01
export const ABANDONED_FEE_USD = 0.005
/** A connected call of this many seconds or fewer is a Short Duration Call. */
export const SHORT_DURATION_SECONDS = 6

/** Hangup causes Telnyx counts as reaching a disconnected number. */
export const DISCONNECTED_NUMBER_CAUSES = [
  'unallocated_number',
  'invalid_number_format',
  'no_route_destination',
]

export interface ExposureRow {
  /** Did Telnyx see this call at all? Rows with no call_control_id never placed. */
  placed: boolean
  answered: boolean
  /** Seconds AFTER answer. Billing starts at answer; the ring is never billable. */
  talkSeconds: number
  dialSource: string | null
  disposition: string | null
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
 * Deliberately narrow. A lead that simply rang out is NOT abandoned — nobody
 * hung up on it, the timeout expired. Counting those would put every dialer
 * permanently over the line and make the number useless.
 */
export function isAbandoned(r: ExposureRow): boolean {
  if (!r.placed || r.answered) return false
  return (
    // Surplus predictive lines, cancelled the moment a sibling line answered.
    r.dialSource === 'controller_fanout' ||
    // The agent's browser never took its own leg, so we hung up a ringing lead.
    r.disposition === 'AGENT_LEG_FAILED' ||
    DISCONNECTED_NUMBER_CAUSES.includes(r.hangupCause || '')
  )
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
 * makes it worse. September's clean day ran 33.8% abandoned as it actually
 * happened, so this returned "impossible" until the socket breaker took it to
 * 15.4%. Returning null rather than a number is the honest answer there, and
 * the reason an earlier draft of §1i was wrong.
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
