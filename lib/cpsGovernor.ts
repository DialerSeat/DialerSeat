import { getServiceClient } from '@/lib/supabase'

const supabase = getServiceClient('cpsGovernor')

// =============================================================================
// CPS GOVERNOR — spread originations so the carrier never sees a spike
// =============================================================================
// Telnyx bills calls-per-second on the 95th PERCENTILE OF HOURLY PEAKS, tiered:
// the first 5 CPS are free, then $12/CPS to 25, $16 to 200, $24 to 250, $30
// beyond. Their own worked example is a peak of 163 CPS costing $2,448/month.
// Because it is billed on sustained peaks rather than averages, a pattern that
// bursts regularly is expensive even when the average rate is trivial.
//
// Measured on this account: the P95 hourly peak is 5.4 CPS — barely over the
// free tier — but every burst above two calls in a second came from ONE agent,
// because a predictive fan-out places three to five lines on a single tick.
// The same physics reaches progressive at headcount: a hundred agents whose
// dials happen to coincide produce the same second as twenty fanning out.
//
// ── THIS ONLY EVER DELAYS. IT CANNOT REFUSE A DIAL. ────────────────────────
// That is not a nicety, it is the whole design, and lib/concurrency.ts records
// why. A previous guard COULD say no: it counted `duration = 0` as "in flight",
// which is the permanent resting value of every unanswered call, so within
// about five minutes of a session it was refusing every dial while the carrier
// still had capacity. Its own epitaph: "a guard that is wrong in the
// restrictive direction is worse than no guard."
//
// So the worst case here is milliseconds. If the RPC is slow, wrong, or gone,
// the dial proceeds immediately — every failure path returns rather than
// throws, and the caller is never told to stop.
//
// ── WHY THE AGENT NEVER FEELS IT ──────────────────────────────────────────
// An agent-initiated dial is capped far tighter than a fan-out line, because
// somebody is watching the first and nobody is waiting on the second. At the
// caps below an agent can lose at most a fifth of a second, and only when the
// platform is already placing more calls in that second than the free tier
// allows — which on today's traffic essentially never happens.
// =============================================================================

/**
 * Originations per second we aim to stay under.
 *
 * Four rather than five: the free tier is 5 CPS and the billing metric is a
 * percentile of peaks, so sitting exactly on the line means half the hours
 * round the wrong way. One slot of headroom is cheaper than one billed CPS.
 */
const CPS_TARGET = 4

/**
 * How long each kind of origination may be held back.
 *
 * A fan-out line is placed by the server with nobody attached and nobody
 * watching, so it can absorb a real delay. An agent pressing dial is watching
 * the screen, and 200ms is under the threshold where a UI feels sluggish.
 */
const MAX_DELAY_MS = {
  fanout: 1_500,
  agent: 200,
} as const

export type OriginationKind = keyof typeof MAX_DELAY_MS

/**
 * How long the slot claim itself may take before the dial goes ahead unpaced.
 *
 * THE GOVERNOR MUST NEVER BE ABLE TO SLOW A DIAL BY MORE THAN IT SAVES. The
 * claim is a single-row update in the same region as this function, normally
 * ten to fifteen milliseconds — but "normally" is not a guarantee, and a
 * database under load, a cold connection or a network hiccup must not turn
 * into a hesitation the agent can feel. Past this budget the answer stops
 * being worth waiting for and the call goes.
 *
 * With the caps below, the absolute worst case for an agent-initiated dial is
 * this plus MAX_DELAY_MS.agent — a quarter of a second, and only when the
 * platform is genuinely placing more calls that second than the free tier
 * allows. The typical case is the round trip and no delay at all.
 */
const CLAIM_TIMEOUT_MS = 50

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

/** Resolves to null if the promise has not settled within `ms`. */
async function withTimeout<T>(p: PromiseLike<T>, ms: number): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      p,
      new Promise<null>(resolve => { timer = setTimeout(() => resolve(null), ms) }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

/**
 * Hold this origination back far enough that the current second stays under
 * target. Resolves when it is this call's turn, or immediately on any problem.
 *
 * Returns the milliseconds actually waited, for logging. Never throws.
 */
export async function paceOrigination(kind: OriginationKind): Promise<number> {
  try {
    // Raced, not awaited. A slow claim is abandoned rather than waited on —
    // the dial is worth more than the measurement. The update still lands and
    // still counts toward the second; we simply stop waiting to hear about it.
    const res = await withTimeout(supabase.rpc('claim_cps_slot'), CLAIM_TIMEOUT_MS)
    if (res === null) {
      console.warn('[cps] slot claim exceeded its budget, proceeding unpaced')
      return 0
    }

    const { data, error } = res
    if (error || typeof data !== 'number') {
      // Fail open, loudly enough to notice but without touching the dial.
      if (error) console.warn('[cps] slot claim failed, proceeding unpaced:', error.message)
      return 0
    }

    const position = data
    if (position <= CPS_TARGET) return 0

    // How far into the future this call belongs if the second were evenly
    // filled. Position 9 against a target of 4 is one full second of backlog,
    // so it waits a second — unless its cap says otherwise.
    const idealMs = ((position - CPS_TARGET) / CPS_TARGET) * 1000
    const waitMs = Math.min(idealMs, MAX_DELAY_MS[kind])

    // Jittered, and this matters more than it looks. Delaying every backlogged
    // call by the SAME amount rebuilds the spike one second later — the burst
    // is moved, not flattened. A uniform spread over the window is what
    // actually lowers the peak.
    const jittered = waitMs * (0.5 + Math.random() * 0.5)

    await sleep(jittered)
    return Math.round(jittered)
  } catch (err) {
    console.warn('[cps] governor threw, proceeding unpaced:', err)
    return 0
  }
}

/** Peak originations-per-second seen since the counter was last reset. */
export async function cpsPeak(): Promise<{ peak: number; at: string | null } | null> {
  try {
    const { data } = await supabase
      .from('cps_governor')
      .select('peak_observed, peak_at')
      .eq('id', 1)
      .maybeSingle()
    if (!data) return null
    return { peak: Number(data.peak_observed) || 0, at: data.peak_at ?? null }
  } catch {
    return null
  }
}

export const CPS_GOVERNOR_TARGET = CPS_TARGET
