// =============================================================================
// TELEPHONY COST MODEL
// =============================================================================
// The rates used to turn call activity into a dollar figure. Kept in one file
// and DISPLAYED on every page that uses them, because a cost number whose
// assumptions are hidden is worse than no cost number: it gets quoted in a
// decision months later by someone who has no idea what went into it.
//
// THE COUNTER-INTUITIVE PART, AND THE REASON THIS EXISTS:
// minutes are not the dominant cost. Answering-machine detection is. AMD is
// charged per call LEG whether or not anyone answers, so 5,000 dials costs
// ~$10 in detection before a single second of conversation — and unlike
// minutes, that figure does not care about your answer rate. A busy floor can
// reach the daily spend limit on detection alone while the minutes bill is
// still pocket change.
//
// We run STANDARD AMD (platform_config.amd_detector = detect). Premium is
// roughly 2.5x the per-leg rate and is deliberately not in use.
//
// These are Telnyx list rates as of the Telnyx migration. If a custom rate is
// negotiated, change them here and every surface follows.
// =============================================================================

/** Outbound US termination, per minute. */
export const COST_PER_MINUTE_USD = 0.002

/**
 * Answering-machine detection, per call leg.
 *
 * Charged on every leg AMD runs against, including calls nobody picks up,
 * which is why it dominates the bill at volume rather than minutes.
 *
 * This is the STANDARD rate, which is what we run. Premium is roughly $0.005
 * per leg; if platform_config.amd_detector is ever switched to premium this
 * must change with it, or every margin figure understates cost by 2.5x.
 */
export const COST_PER_AMD_LEG_USD = 0.002

/** Recording storage and processing, per minute recorded. */
export const COST_PER_RECORDED_MINUTE_USD = 0.0005

/** What a seat bills at, weekly. Never expressed monthly — billing is weekly. */
export const SEAT_PRICE_WEEKLY_USD = 35
export const MANAGER_PLUS_WEEKLY_USD = 75

export interface CostInputs {
  /** Total connected seconds. */
  talkSeconds: number
  /** Call legs AMD ran against. */
  amdLegs: number
  /** Seconds of audio recorded. */
  recordedSeconds: number
}

export interface CostBreakdown {
  minutesUsd: number
  amdUsd: number
  recordingUsd: number
  totalUsd: number
}

export function computeCost(input: CostInputs): CostBreakdown {
  const minutesUsd = (input.talkSeconds / 60) * COST_PER_MINUTE_USD
  const amdUsd = input.amdLegs * COST_PER_AMD_LEG_USD
  const recordingUsd = (input.recordedSeconds / 60) * COST_PER_RECORDED_MINUTE_USD
  return {
    minutesUsd,
    amdUsd,
    recordingUsd,
    totalUsd: minutesUsd + amdUsd + recordingUsd,
  }
}

/** One line, shown wherever a cost is, so the assumptions travel with it. */
export const COST_ASSUMPTIONS_NOTE =
  `Assumes $${COST_PER_MINUTE_USD.toFixed(3)}/min outbound, ` +
  `$${COST_PER_AMD_LEG_USD.toFixed(3)} per standard AMD leg, ` +
  `$${COST_PER_RECORDED_MINUTE_USD.toFixed(4)}/min recorded. ` +
  `Carrier list rates, does not include number rental or platform costs.`
