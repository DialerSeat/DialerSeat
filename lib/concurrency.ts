import { getServiceClient } from '@/lib/supabase'
import { getPlatformConfig } from '@/lib/platformConfig'

// =============================================================================
// CONCURRENCY BUDGET
// =============================================================================
// The carrier caps simultaneous outbound calls at the ACCOUNT level, shared by
// every tenant on the platform. Ours is currently 10. That is not a theoretical
// ceiling — one six-agent floor on progressive needs more than that on its own.
//
// Until this existed there was no backpressure at all. At the limit the carrier
// simply rejected each dial, the predictive controller kept firing into the
// wall on every heartbeat, and the agent saw a generic failure with no
// indication that the platform was full rather than broken. This turns that
// into a refusal we control, with a reason we can show.
//
// WHY THE COUNT IS AN ESTIMATE, AND WHY THAT IS THE RIGHT TRADE
// The authoritative source is the carrier's own active-call list, but that is a
// network round trip and this runs before every single dial. So we count from
// `calls` instead, using the same in-flight sentinel the abort sweep uses
// (duration = 0). It can drift — a row whose insert failed is invisible, and a
// call the hangup webhook has not caught up with lingers a moment too long.
//
// Both drifts are handled by the reserve rather than by pretending the number
// is exact: we stop short of the true ceiling, so an undercount does not become
// a rejected dial. Being approximately right in 20ms beats being exactly right
// in 300ms on a path that runs thousands of times an hour.
// =============================================================================

/**
 * How long a row with duration = 0 is still believed to be live.
 *
 * Past this it is treated as finished regardless, because a stuck row would
 * otherwise consume budget forever and slowly strangle the platform. The
 * stale-call reaper cleans these up properly; this is just the read-side guard
 * so a reaper outage cannot take dialing down with it.
 */
const IN_FLIGHT_MAX_AGE_MS = 10 * 60_000

export interface ConcurrencySnapshot {
  /** Estimated legs currently up across the platform. */
  inFlightLegs: number
  /** The carrier ceiling we are respecting. */
  budget: number
  /** Legs held back from predictive so a human dial is never blocked. */
  reserve: number
  /** Legs a manual/progressive dial may still use. */
  availableForAgent: number
  /** Legs the predictive controller may still use. */
  availableForController: number
}

/**
 * Count what is up right now.
 *
 * Legs, not calls. A user_dial places TWO — the agent's SIP leg and the lead
 * leg — and both occupy carrier capacity. Counting rows instead of legs would
 * understate usage by roughly half on exactly the modes a team uses most, which
 * is the error that lets you sail past the ceiling believing you are at half.
 */
export async function getConcurrencySnapshot(): Promise<ConcurrencySnapshot> {
  const config = await getPlatformConfig()
  const budget = Math.max(1, config.concurrency_budget)
  const reserve = Math.max(0, Math.min(config.concurrency_reserve, budget - 1))

  let inFlightLegs = 0
  try {
    const supabase = getServiceClient('concurrency')
    const sinceIso = new Date(Date.now() - IN_FLIGHT_MAX_AGE_MS).toISOString()

    const { data, error } = await supabase
      .from('calls')
      .select('agent_call_control_id')
      .eq('duration', 0)
      .gte('created_at', sinceIso)

    if (error) {
      // Fail OPEN. A failed count must not stop the platform dialing — the
      // carrier still enforces its own limit, so the worst case on a read
      // failure is the behaviour we had before this file existed.
      console.error('[concurrency] in-flight count failed, allowing dial:', error.message)
      return {
        inFlightLegs: 0, budget, reserve,
        availableForAgent: budget,
        availableForController: Math.max(0, budget - reserve),
      }
    }

    for (const row of data || []) {
      inFlightLegs += row.agent_call_control_id ? 2 : 1
    }
  } catch (err) {
    console.error('[concurrency] in-flight count threw, allowing dial:', err)
    return {
      inFlightLegs: 0, budget, reserve,
      availableForAgent: budget,
      availableForController: Math.max(0, budget - reserve),
    }
  }

  return {
    inFlightLegs,
    budget,
    reserve,
    availableForAgent: Math.max(0, budget - inFlightLegs),
    availableForController: Math.max(0, budget - reserve - inFlightLegs),
  }
}

export interface CapacityDecision {
  allowed: boolean
  /** Shown to the agent verbatim, so it must read like an explanation. */
  reason?: string
  snapshot: ConcurrencySnapshot
}

/**
 * May a dial proceed?
 *
 * `legsNeeded` is 2 for a user_dial (agent leg plus lead leg) and 1 for a
 * controller fan-out line, which has no agent leg until someone answers.
 *
 * The controller is held to a lower ceiling than a person. An agent who presses
 * dial and is refused has been told the product is broken; a background process
 * that pauses for one beat has not. So the reserve always belongs to the human.
 */
export async function checkCapacity(
  legsNeeded: number,
  source: 'agent' | 'controller'
): Promise<CapacityDecision> {
  const snapshot = await getConcurrencySnapshot()
  const available = source === 'controller'
    ? snapshot.availableForController
    : snapshot.availableForAgent

  if (available >= legsNeeded) {
    return { allowed: true, snapshot }
  }

  return {
    allowed: false,
    reason:
      source === 'controller'
        ? `at platform capacity (${snapshot.inFlightLegs}/${snapshot.budget} lines in use)`
        : `All ${snapshot.budget} outbound lines are in use right now. This is a platform-wide ` +
          `limit, not a problem with your account — try again in a few seconds.`,
    snapshot,
  }
}
