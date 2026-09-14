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

// ── THE 30-SECOND MINIMUM, AND WHY IT IS THE WHOLE STORY ──────────────────
// The August ledger billed 52,692 termination seconds. Our own legs for that
// month total 14,843 seconds of actual duration. Four billing models were
// tested against that target:
//
//   actual duration, no minimum      14,843
//   6-second increments only         20,400
//   30s minimum, then 6s             48,096   <- within 9%
//   60s minimum, then 6s             90,522
//
// Only one is close. This account bills a 30-SECOND MINIMUM on every outbound
// leg, then in 6-second increments.
//
// WHAT THAT MEANS, AND IT IS NOT SMALL. A dial costs half a minute of
// termination whether it is answered, rings out, or is torn down after two
// seconds. At $0.0056 a minute that is $0.0028 a dial before anybody says
// hello, and with detection on top every dial has a floor near half a cent
// regardless of outcome.
//
// It also explains why a floor's bill barely moves with TALK time and moves
// hard with DIAL COUNT — and why the old model, which costed only answered
// minutes, read a bill three times lower than the one that arrived.

/** Seconds every outbound leg bills at minimum, answered or not. */
export const BILLING_MINIMUM_SECONDS = 30

/** Increment above the minimum. A 31-second call bills 36. */
export const BILLING_INCREMENT_SECONDS = 6

/**
 * What a leg of `seconds` actually bills at, under this account's 30/6 terms.
 *
 * Use this rather than raw duration anywhere a cost is derived, or the figure
 * will be the one that has been wrong all along.
 */
export function billableSeconds(seconds: number | null | undefined): number {
  const s = Math.max(0, seconds ?? 0)
  if (s <= 0) return 0
  const rounded = Math.ceil(s / BILLING_INCREMENT_SECONDS) * BILLING_INCREMENT_SECONDS
  return Math.max(BILLING_MINIMUM_SECONDS, rounded)
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
 * Half a minute of termination at the 30-second minimum, plus one detection
 * leg. This is what MOST calls cost in full on a floor with a 20% connect
 * rate, which makes it the number to project a dialing day from — not the
 * per-minute rate, which only applies to the fifth of calls that connect.
 *
 * Declared after the detection rates rather than beside the other minute
 * constants, because it is built from both.
 */
export const COST_PER_DIAL_FLOOR_USD =
  (BILLING_MINIMUM_SECONDS / 60) * COST_PER_MINUTE_USD + COST_PER_AMD_LEG_USD

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
