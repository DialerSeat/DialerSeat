// =============================================================================
// PREDICTIVE PACING — how many lines the law allows, and what each round dials
// =============================================================================
// Pure functions only: no database, no network, no clock. Everything the
// engine decides about HOW MANY lines and WHICH leads comes through here, so
// the rule can be read in one place and tested without a phone.
//
// The rule is 16 CFR 310.4(b)(4)(i) and 47 CFR 64.1200(a)(7): abandoned calls
// may not exceed 3% of calls answered by a person, per campaign, measured over
// 30 days. See docs/PREDICTIVE.md for the derivation.
// =============================================================================

import { shouldRedial } from '@/lib/redialDecision'

/** Where the projection is held. The law says 3%; the margin is deliberate. */
export const PREDICTIVE_TARGET_ABANDON_PCT = 2.0

/** A measured 30-day rate at or above this forces one line, whatever else. */
export const PREDICTIVE_DEGRADE_PCT = 2.5

/**
 * How far ahead the projection looks, in answered-by-a-person calls. Long
 * enough that one unlucky round does not flip the line count, short enough
 * that a campaign drifting toward the ceiling is pulled back well before it.
 */
export const PROJECTION_HORIZON_HUMANS = 50

/**
 * Before a campaign has its own history, assume people pick up on 12% of
 * dials. That is at the high end of what this platform measures (11% on
 * agent-attended dials, 5% on the old predictive), and high is the safe side:
 * a higher human rate means more simultaneous answers and fewer lines allowed.
 */
export const HUMAN_RATE_PRIOR = 0.12
/** The prior counts as this many dials of evidence. */
export const HUMAN_RATE_PRIOR_WEIGHT = 50

/** Nothing ever dials more than this many lines for one agent. */
export const HARD_LINE_CAP = 5

/**
 * What an agent can choose: 2 or 3 lines (Joshua, 25 Sept 2026: "either 2
 * lines or 3 lines. not 1"). A choice, not a guarantee: legalLineCount below
 * still runs fewer when the campaign's own 30 days would otherwise break the
 * 3% limit, and says so in the dialer.
 */
export const PREDICTIVE_MIN_LINES = 2
export const PREDICTIVE_MAX_LINES = 3

/**
 * Expected abandoned calls per call answered by a person, for ONE agent
 * running `lines` lines that are dialed together and allowed to ring out.
 *
 * Each line reaches a person with probability h. The first person connects;
 * every other person who picks up in the same round is abandoned, because the
 * agent is on a call and nothing cancels a ringing line. With H ~ Bin(L, h):
 *
 *   abandoned per round = E[H] − P(H ≥ 1) = L·h − (1 − (1 − h)^L)
 *   people per round    = E[H]           = L·h
 *
 * One line is exactly zero. The ratio grows roughly as (L − 1)·h / 2.
 */
export function surplusAbandonRatio(lines: number, h: number): number {
  const L = Math.floor(lines)
  if (L <= 1) return 0
  const p = Math.min(1, Math.max(0, h))
  if (p === 0) return 0
  const people = L * p
  const connected = 1 - Math.pow(1 - p, L)
  return Math.max(0, (people - connected) / people)
}

/**
 * Share of dials a person answers, smoothed toward the prior so a campaign
 * with ten dials does not get a line count from ten dials.
 */
export function estimateHumanRate(humans: number, dials: number): number {
  const hum = Math.max(0, humans || 0)
  const dia = Math.max(0, dials || 0)
  const alpha = HUMAN_RATE_PRIOR * HUMAN_RATE_PRIOR_WEIGHT
  const rate = (hum + alpha) / (dia + HUMAN_RATE_PRIOR_WEIGHT)
  return Math.min(1, Math.max(0, rate))
}

export interface LegalLinesInput {
  /** min(hard cap, platform ceiling, campaign max, the agent's own setting). */
  cap: number
  /** Share of dials a person answers, from estimateHumanRate. */
  humanRate: number
  /** Calls answered by a person on this campaign in the last 30 days. */
  answered30d: number
  /** Of those, abandoned. */
  abandoned30d: number
  /** Seller name and callback number are set, so the abandon message exists. */
  sellerMessageReady: boolean
  targetPct?: number
  degradePct?: number
  horizonHumans?: number
}

export type LineLimit = 'cap' | 'law' | 'degraded' | 'no_seller_message'

export interface LegalLinesResult {
  lines: number
  /** The projected 30-day rate at `lines`, in percent. */
  projectedPct: number
  /** The measured 30-day rate, in percent. */
  measuredPct: number
  limitedBy: LineLimit
  reason: string
}

function pct(n: number): string {
  return `${n.toFixed(2)}%`
}

/**
 * The most lines this campaign may run right now without its 30-day abandon
 * rate being projected past the target.
 */
export function legalLineCount(input: LegalLinesInput): LegalLinesResult {
  const target = input.targetPct ?? PREDICTIVE_TARGET_ABANDON_PCT
  const degrade = input.degradePct ?? PREDICTIVE_DEGRADE_PCT
  const horizon = input.horizonHumans ?? PROJECTION_HORIZON_HUMANS
  const answered = Math.max(0, input.answered30d || 0)
  const abandoned = Math.max(0, input.abandoned30d || 0)
  const cap = Math.max(1, Math.min(HARD_LINE_CAP, Math.floor(input.cap || 1)))
  const measuredPct = answered > 0 ? (abandoned / answered) * 100 : 0

  const project = (lines: number) =>
    ((abandoned + surplusAbandonRatio(lines, input.humanRate) * horizon) /
      (answered + horizon)) * 100

  if (measuredPct >= degrade) {
    return {
      lines: 1, projectedPct: project(1), measuredPct, limitedBy: 'degraded',
      reason: `30-day abandon rate ${pct(measuredPct)} is at or above ${pct(degrade)}, one line until it recovers`,
    }
  }

  if (cap > 1 && !input.sellerMessageReady) {
    return {
      lines: 1, projectedPct: project(1), measuredPct, limitedBy: 'no_seller_message',
      reason: 'no business name or callback number in Settings, so a second line would have no abandon message',
    }
  }

  let lines = 1
  for (let l = cap; l >= 1; l--) {
    if (l === 1 || project(l) <= target) { lines = l; break }
  }

  const limitedBy: LineLimit = lines === cap ? 'cap' : 'law'
  return {
    lines,
    projectedPct: project(lines),
    measuredPct,
    limitedBy,
    reason: limitedBy === 'cap'
      ? `${lines} line${lines === 1 ? '' : 's'}, the most allowed by settings; projected ${pct(project(lines))}`
      : `${lines} line${lines === 1 ? '' : 's'}: ${lines + 1} would project ${pct(project(lines + 1))}, over the ${pct(target)} target`,
  }
}

export interface OwedRepeat {
  leadId: string
  /** Where the lead sits in the queue panel; lower dials first. */
  position: number
}

export interface RoundPlan {
  /** Leads owed another attempt, in the order they go out. */
  repeatIds: string[]
  /** Fresh leads to claim from the top of the queue. */
  freshNeeded: number
}

/**
 * What the next round dials: leads still owed a repeat first, then fresh
 * leads to fill the lines that are left.
 */
export function planRound(lines: number, owed: OwedRepeat[]): RoundPlan {
  const L = Math.max(0, Math.floor(lines))
  const repeatIds = [...owed]
    .sort((a, b) => a.position - b.position)
    .slice(0, L)
    .map(o => o.leadId)
  return { repeatIds, freshNeeded: Math.max(0, L - repeatIds.length) }
}

/**
 * The runaway breaker. A round takes at least the ring of its slowest line, so
 * more than six rounds' worth of dials in a minute means something is looping.
 */
export const BREAKER_ROUNDS_PER_MINUTE = 6
export const BREAKER_PAUSE_MS = 30_000

export function breakerTripped(dialsLastMinute: number, lines: number): boolean {
  return dialsLastMinute > BREAKER_ROUNDS_PER_MINUTE * Math.max(1, Math.floor(lines))
}

// ── WHAT A FINISHED LEG AMOUNTED TO ─────────────────────────────────────────

const ROBOT_RESULTS = new Set(['machine', 'fax_detected'])
/** Hang-up causes that mean the number itself cannot be reached. */
const UNREACHABLE_CAUSES = new Set(['not_found', 'invalid_number_format', 'unallocated_number'])

export type LegOutcome = 'person' | 'voicemail' | 'no_answer' | 'unreachable'

/**
 * 1x/2x/3x for predictive: is this lead dialed again in the next round?
 *
 * The same rule every other mode applies (lib/redialDecision.shouldRedial): a
 * person ends the sequence, and anything else earns another dial until the
 * campaign's count is spent. Predictive adds one case the others never meet:
 * a number that cannot be reached is not redialed at all.
 *
 * attemptsSoFar counts the dial that just ended; maxAttempts is the campaign's
 * 1, 2 or 3 (lib/dialerConstants.backToBackAttempts).
 */
export function repeatOwed(outcome: LegOutcome, attemptsSoFar: number, maxAttempts: number): boolean {
  return outcome !== 'unreachable' && shouldRedial({
    reachedAHuman: outcome === 'person',
    alreadyQueued: false,
    attemptsSoFar,
    maxAttempts,
  })
}

/**
 * The outcome the 1x/2x/3x decision reads. A person ends the sequence;
 * voicemail and no answer earn a redial while repeats remain; a number that
 * cannot be reached is not redialed at all.
 */
export function classifyLeg(leg: {
  answered_at: string | null
  amd_result: string | null
  hangup_cause?: string | null
}): LegOutcome {
  if (leg.answered_at) {
    return leg.amd_result && ROBOT_RESULTS.has(leg.amd_result) ? 'voicemail' : 'person'
  }
  if (leg.hangup_cause && UNREACHABLE_CAUSES.has(leg.hangup_cause)) return 'unreachable'
  return 'no_answer'
}
