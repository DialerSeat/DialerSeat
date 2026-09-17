// =============================================================================
// WHICH ARM PICKS THE CALLER ID FOR THIS DIAL
// =============================================================================
// The USAGE tab showed three numbers carrying 48% of all dials and answering at
// 29-34%, while the lightest-used numbers answer at 67-76%. Read one way that is
// number burn: work a number hard enough and carriers start filtering it. Read
// the other way it is the pool doing precisely what it was told — claim_pool_
// number ranks locality above everything but the soft cap, so the 415 number
// takes every California lead, and California is a fifth of the list. Heavy use
// and low answer rate would then both be downstream of which STATES the leads
// live in, and nothing would be wrong with the numbers at all.
//
// The two readings have opposite remedies. One says rotate harder. The other
// says rotating harder costs answer rate, because it calls Californians from a
// Mississippi caller ID. Getting this backwards is expensive in the direction
// that matters most — connects.
//
// ── WHY A PERCENTAGE AND NOT A SWITCH ──────────────────────────────────────
// A switch means comparing this week to last week, and that comparison cannot
// work here: the list changes, the hours change, the agents change. Every
// confound this session has already been caught by once — the resting-numbers
// claim was exactly this mistake — lives in a between-days comparison.
//
// A percentage splits the SAME traffic. The same hour, the same list, the same
// agents feed both arms, so the only systematic difference between them is the
// thing under test.
//
// ── IT DEFAULTS TO DOING NOTHING ───────────────────────────────────────────
// pct 0 means every dial takes the default strategy, which is the ordering that
// has always run here. The experiment is opt-in, per-dial, and reversible by
// setting one number back to zero.

export type PoolStrategy = 'locality' | 'balanced' | 'rotate'

export const POOL_STRATEGIES: readonly PoolStrategy[] = ['locality', 'balanced', 'rotate'] as const

/** What has always run here: locality outranks everything but the soft cap. */
export const DEFAULT_POOL_STRATEGY: PoolStrategy = 'locality'

export interface PoolExperimentConfig {
  /** Percent of dials routed to the experiment arm. 0 disables it entirely. */
  pct: number
  /** Strategy the experiment slice uses. */
  arm: string
  /** Strategy every other dial uses. */
  defaultStrategy: string
}

/**
 * Anything unrecognised becomes 'locality'.
 *
 * A typo in a settings table must not be able to change how the dialer picks
 * caller IDs. Falling back to the default means the worst case of a bad value
 * is that the experiment silently does not run, which is the safe direction.
 */
export function normalizeStrategy(v: string | null | undefined): PoolStrategy {
  return POOL_STRATEGIES.includes(v as PoolStrategy)
    ? (v as PoolStrategy)
    : DEFAULT_POOL_STRATEGY
}

/**
 * Decide which arm this one dial belongs to.
 *
 * `roll` is injected rather than read from Math.random() here so the split is
 * testable. Callers pass Math.random().
 *
 * Returns the strategy AND whether this dial is part of the experiment, because
 * "locality because the experiment sent it there" and "locality because there
 * is no experiment" must not be recorded as the same thing — one belongs in the
 * control group of an analysis and the other belongs nowhere near it.
 */
export function chooseStrategy(
  cfg: PoolExperimentConfig,
  roll: number,
): { strategy: PoolStrategy; inExperiment: boolean } {
  const fallback = normalizeStrategy(cfg.defaultStrategy)

  // Not a finite percentage, zero, or negative: no experiment. Checked before
  // anything else so a broken config costs nothing.
  const pct = Number(cfg.pct)
  if (!Number.isFinite(pct) || pct <= 0) {
    return { strategy: fallback, inExperiment: false }
  }

  const arm = normalizeStrategy(cfg.arm)
  // An arm identical to the default is not an experiment, it is two names for
  // one thing. Recording those dials as "in the experiment" would put identical
  // traffic on both sides of a comparison and make any difference look like
  // noise around zero, which is worse than not running it.
  if (arm === fallback) {
    return { strategy: fallback, inExperiment: false }
  }

  // Clamped rather than rejected: 150 means everything, and a config that says
  // "more than all of it" clearly means all of it.
  const ceiling = Math.min(100, pct)
  const r = Number.isFinite(roll) ? roll : 1

  return r * 100 < ceiling
    ? { strategy: arm, inExperiment: true }
    : { strategy: fallback, inExperiment: true }
}
