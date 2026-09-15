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
// We run STANDARD AMD and it is now enforced rather than assumed: the dial path
// clamps the detector to 'detect' and the config will not accept anything else.
// See STANDARD_AMD_DETECTOR in lib/placeOutboundCall.ts. This note used to say
// premium was "deliberately not in use", which the August invoice disproved —
// 13 premium legs billed on a day the config said standard.
//
// These are Telnyx list rates as of the Telnyx migration. If a custom rate is
// negotiated, change them here and every surface follows.
// =============================================================================

// ── THE RATES BELOW ARE READ OFF A REAL INVOICE ───────────────────────────
// Everything here used to be a published list rate applied by hand. The August
// 2026 ledger arrived as a CSV of actual charges and disagreed with this file
// in three ways that mattered. The figures are now the ones Telnyx actually
// billed, with the cost codes named so the next person can check them against a
// statement rather than take this on faith.

/**
 * An outbound minute, all in.
 *
 * Was 0.002, which is a third of what a minute costs. Telnyx bills the SAME
 * seconds under two codes, and both appeared on every line of the ledger with
 * identical unit counts:
 *
 *   GLOBAL-CONV-RATE0-USAGE          52,692s   $3.17   carrier termination
 *   CALL-CONTROL-RATE0-TERMINATION   52,692s   $1.76   call-control platform
 *
 * $0.0036 and $0.0020 per minute. The old constant was the second of the two on
 * its own, so every minute figure on the platform read at about a third of the
 * truth.
 *
 * The carrier half varies by destination — a RATE0 tier, not one price — so
 * this is the August blend rather than a quoted rate.
 */
export const COST_PER_MINUTE_USD = 0.0056

/**
 * The AGENT leg, per minute. Previously not costed at all.
 *
 * A user dial is two legs and only one was ever counted. The browser leg bills
 * as SIP-URI-ORIGINATION: 15,678 seconds for $0.52 in August, $0.002 a minute.
 *
 * Worth watching rather than simply adding, because the agent leg is parked
 * between calls rather than torn down — so this bills for time nobody is
 * talking on.
 */
export const COST_PER_AGENT_LEG_MINUTE_USD = 0.002

// ── THE BILLING RULES, DERIVED FROM 1,103 OF THEIR OWN COST RECORDS ───────
// This block previously described a 30-second minimum on EVERY outbound leg,
// fitted by testing four candidate models against one August invoice line
// (52,692 termination seconds). 30s+6s landed within 9% and was adopted.
//
// It was wrong, and it was wrong in a way a single aggregate could never
// reveal: it over-counted agent legs, which have no floor at all, and
// under-counted answered lead legs, whose floor is twice what was assumed.
// The two errors very nearly cancel, which is exactly why the fit looked good.
//
// call.cost webhooks now give the per-leg truth. Across 1,103 billed records:
//
//   ANSWERED LEAD LEG    60-second floor. 183 of 192 billed EXACTLY 60,
//                        and not one billed under it. Applies to both halves
//                        (sip-trunking and call-control) independently.
//   AGENT LEG            NO floor. Minimum observed 6 seconds; 185 of 192
//                        billed under 60.
//   RECORDING            60-second floor. 18 of 23 billed exactly 60.
//   UNANSWERED LEAD LEG  FREE. 94 of them billed zero seconds.
//   EVERYTHING           6-second increments. 1,103 of 1,103 are multiples
//                        of 6, with no exceptions in any category.
//
// WHAT THAT CHANGES, AND IT IS NOT SMALL. Dialing is nearly free — an
// unanswered lead leg costs nothing, so dial VOLUME is not the cost driver
// the old model made it. ANSWERING is the charge, and it arrives a whole
// minute at a time. A voicemail identified by AMD at 3.3 seconds and dropped
// by the compliance hold at 9 still bills 60 seconds on both halves, and 54%
// of everything that answers is a voicemail.
//
// The practical consequence: the only way to avoid the floor is not to dial
// the number. See lib/recentDialSuppression.ts.

/** Seconds an ANSWERED lead leg bills at minimum. Agent legs have no floor. */
export const LEAD_ANSWERED_MINIMUM_SECONDS = 60

/** Seconds a recording bills at minimum, once one is made at all. */
export const RECORDING_MINIMUM_SECONDS = 60

/** Increment on everything. A 61-second call bills 66. */
export const BILLING_INCREMENT_SECONDS = 6

/**
 * Deprecated alias for the old flat floor, kept so nothing breaks silently.
 *
 * There is no single "billing minimum" on this account — it depends on which
 * leg and whether it answered. Anything still reading this constant is using
 * a rule that does not exist; use billableSeconds with its options instead.
 */
export const BILLING_MINIMUM_SECONDS = LEAD_ANSWERED_MINIMUM_SECONDS

export interface BillableOptions {
  /** True for the lead's leg, false for the agent's. */
  leadLeg: boolean
  /** Did the LEAD answer? The floor and the charge both hang on this. */
  answered: boolean
}

/**
 * What a leg of `seconds` actually bills at.
 *
 * Use this rather than raw duration anywhere a cost is derived — and pass the
 * options honestly, because the three cases differ by more than rounding:
 * an unanswered lead leg is free, an answered one costs a minute whatever its
 * length, and an agent leg costs exactly what it used.
 */
export function billableSeconds(
  seconds: number | null | undefined,
  opts: BillableOptions
): number {
  const s = Math.max(0, seconds ?? 0)

  // An unanswered lead leg is not billed at all — ring time is free. Measured
  // across 94 of them, every one at zero seconds. The old model charged these
  // 30 seconds each, which is where most of its error lived.
  if (opts.leadLeg && !opts.answered) return 0

  if (s <= 0) return 0
  const rounded = Math.ceil(s / BILLING_INCREMENT_SECONDS) * BILLING_INCREMENT_SECONDS

  // The floor is the lead leg's alone. An agent leg bills what it used, down
  // to a single 6-second increment.
  return opts.leadLeg
    ? Math.max(LEAD_ANSWERED_MINIMUM_SECONDS, rounded)
    : rounded
}


/**
 * Buying a number, once, on top of the monthly.
 *
 * DID-RATE0-OTC, eight numbers for exactly $8.00 in August. That was the single
 * largest line on the invoice — more than every minute, every detection and
 * every recording put together — and nothing on this platform recorded it.
 */
export const COST_PER_NUMBER_PURCHASE_USD = 1.00

/**
 * Tax and regulatory surcharge, as a share of everything else.
 *
 * Three codes — TAX-CHARGES, TAX-CHARGES-USF, TAX-CHARGES-TRS — totalling
 * $1.27 against $21.90 of charges in August. A multiplier rather than an
 * itemisation, because the split between the three is theirs and not something
 * predictable per call.
 */
export const TAX_RATE = 0.058

/**
 * Answering-machine detection, per call leg.
 *
 * Charged on every leg AMD runs against, including calls nobody picks up,
 * which is why it dominates the bill at volume rather than minutes.
 *
 * CALL-CONTROL-FEATURES-STANDARD-AMD on the ledger: 506 legs for $1.0120 in
 * August, exactly $0.002 each. This constant was already right.
 */
export const COST_PER_AMD_LEG_USD = 0.002

/**
 * Premium detection, per leg. $0.0065, not the $0.005 guessed here before — and
 * it is NOT unused, whatever the note above once claimed.
 *
 * CALL-CONTROL-FEATURES-PREMIUM-AMD billed 13 legs on 2026-08-06. Thirteen legs
 * is eight cents and does not matter; that ANY appeared does, because the config
 * says 'detect' and premium is 3.25x standard. Something asked for premium that
 * day. Worth knowing before a floor runs on it.
 */
export const COST_PER_PREMIUM_AMD_LEG_USD = 0.0065

/**
 * The floor cost of one dial, before anybody answers.
 *
 * Half a minute of termination at the 30-second minimum, and nothing else —
 * detection is NOT included, because it bills per answer rather than per dial.
 * See COST_PER_ANSWERED_AMD_USD below.
 *
 * This is what most calls cost in full on a floor with a 20% connect rate,
 * which makes it the number to project a dialing day from rather than the
 * per-minute rate, which only touches the fifth of calls that connect.
 */
export const COST_PER_DIAL_FLOOR_USD =
  (BILLING_MINIMUM_SECONDS / 60) * COST_PER_MINUTE_USD

// ── DETECTION BILLS PER ANSWER, NOT PER DIAL ──────────────────────────────
// This was added into the per-dial floor above, which overstated it by five
// times. The August invoice billed 519 detection legs against 478 answered
// calls and 1,484 legs placed — it tracks ANSWERS, and mechanically it must:
// detection runs after answer, so a call nobody picks up never starts it.
//
// It matters for projecting a floor. At a 24.6% answer rate, detection costs
// $0.0005 a dial rather than $0.0020, and the weekly figure for one agent at
// 5,000 dials is $2.46 rather than $10. Termination, not detection, is the
// line that dominates.
export const COST_PER_ANSWERED_AMD_USD = COST_PER_AMD_LEG_USD

/**
 * Detection cost spread over dials, given an answer rate.
 *
 * Use this when projecting from a dial count. Multiplying dials by the per-leg
 * rate directly is the mistake this replaces.
 */
export function amdCostPerDial(answerRate: number): number {
  return Math.max(0, Math.min(1, answerRate)) * COST_PER_AMD_LEG_USD
}

/**
 * Recording, per minute recorded.
 *
 * Was 0.0005 here, which was four times under Telnyx's published rate and made
 * recording look like a rounding error next to detection. Confirmed against
 * telnyx.com/pricing/voice-api on 2026-09-13, then again by the August ledger,
 * where CALL-RECORDING-TERMINATION-USAGE billed 7,800 seconds for $0.26 —
 * $0.002 a minute exactly.
 *
 * Storage is genuinely separate at $0.006/GB/month, and genuinely negligible:
 * recorded audio runs roughly 240KB a minute, putting a month of storage for a
 * recorded minute near a millionth of a cent, and recordings carry
 * recording_expires_at so they do not accumulate forever. Left out rather than
 * modelled, because a line that small only adds false precision.
 */
export const COST_PER_RECORDED_MINUTE_USD = 0.002

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
  `$${COST_PER_RECORDED_MINUTE_USD.toFixed(3)}/min recorded. ` +
  `Rates taken from the August 2026 Telnyx invoice, not from list pricing. ` +
  `Minutes include both the carrier and call-control halves, which are billed ` +
  `separately against the same seconds. Number rental and per-number purchase ` +
  `fees are counted as platform costs, since a shared pool belongs to no ` +
  `single customer. Tax adds about ${(TAX_RATE * 100).toFixed(1)}% on top.`
