import { getServiceClient } from '@/lib/supabase'

const supabase = getServiceClient('cpsGovernor')

// =============================================================================
// CPS GOVERNOR — a leaky bucket, so the carrier never sees a spike
// =============================================================================
// Telnyx bills calls-per-second on the 95th PERCENTILE OF HOURLY PEAKS: the
// first 5 CPS free, then $12/CPS to 25, $16 to 200, $24 to 250, $30 beyond.
// Their own worked example is a peak of 163 CPS costing $2,448/month. Peaks,
// not averages — so a pattern that bursts is expensive even when the average
// is trivial, and flattening the bursts is the entire saving.
//
// ── WHY THIS IS THE SECOND DESIGN ─────────────────────────────────────────
// The first returned a call's POSITION within the current second and let the
// caller derive a delay proportional to how far over target it was. That
// approximates a rate. It cannot guarantee one, and clipping the delay broke
// it outright: in a second carrying eight legs, the eighth needs a full second
// of delay to land in the next one, against an agent cap of 200ms. A 200ms
// shift only crosses a second boundary if the call was already within 200ms of
// one. It smoothed the shoulders of a burst and left the burst.
//
// A leaky bucket does not approximate. Every origination is handed the next
// free slot at FIXED spacing — at 4/second, one slot every 250ms — and waits
// for it. Verified against the RPC: a burst of eight returns 0, 247, 496, 746,
// 996, 1246, 1496, 1746ms. Eight arrivals drain across 1.75 seconds at exactly
// the target, because the slots were never available faster.
//
// The bucket is pulled forward to now whenever the platform has been idle, so
// quiet time banks no credit that would release as a burst later — which is
// what a token bucket does, and exactly what the carrier bills for.
//
// ── IT STILL CANNOT REFUSE A DIAL ─────────────────────────────────────────
// lib/concurrency.ts records what happened the last time anything on this path
// could say no: a guard counting `duration = 0` as "in flight" — the permanent
// resting value of every unanswered call — refused every dial about five
// minutes into a session while the carrier still had capacity. Its epitaph is
// "a guard that is wrong in the restrictive direction is worse than no guard."
//
// So every failure path here returns and the dial proceeds: a slow claim, a
// missing config, an unreadable row, a thrown error. The worst this can do is
// wait, and the wait is capped.
// =============================================================================

/**
 * Originations per second the bucket drains at.
 *
 * Four rather than five: the free tier is 5 CPS and the billing metric is a
 * percentile of peaks, so sitting exactly on the line rounds the wrong way
 * half the time. One slot of headroom is cheaper than one billed CPS.
 */
const CPS_TARGET = 4

/**
 * How long an origination may be held back before the bucket gives up on it.
 *
 * THESE ARE GENEROUS ON PURPOSE, and that is the correction over the first
 * version. A cap below the spacing the bucket needs does not make the pacing
 * gentler — it disables it, silently, exactly when a burst is happening.
 *
 * What that costs in practice, measured against real traffic after predictive
 * was withdrawn: only 7 seconds out of 404 carried more than four legs. A cap
 * this size is reached on a fraction of dials, and only while the platform is
 * genuinely placing more calls than the free tier allows — which is precisely
 * when pacing is worth something.
 *
 * Fan-out is placed by the server with nobody watching, so it can absorb more.
 * Beyond either figure the call goes and the peak is accepted: an unbounded
 * queue in front of a phone call is worse than a billing tier.
 */
const MAX_DELAY_MS = {
  fanout: 5_000,
  agent: 2_000,
} as const

export type OriginationKind = keyof typeof MAX_DELAY_MS

/** Budget for the claim itself, after which the dial goes unpaced. */
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
 * Hold this origination until the bucket has a slot for it.
 *
 * Returns the milliseconds actually waited, for logging. Never throws, never
 * refuses, and never waits longer than this kind's cap.
 */
export async function paceOrigination(kind: OriginationKind): Promise<number> {
  try {
    // The claim is raced, not awaited. A slow database must not become a
    // hesitation an agent can feel — the dial is worth more than the
    // measurement. The row still advances, so the slot is still consumed;
    // we simply stop waiting to hear which one it was.
    const res = await withTimeout(
      supabase.rpc('claim_cps_slot_ms', { p_rate: CPS_TARGET }),
      CLAIM_TIMEOUT_MS
    )
    if (res === null) {
      console.warn('[cps] slot claim exceeded its budget, proceeding unpaced')
      return 0
    }

    const { data, error } = res
    if (error || typeof data !== 'number') {
      if (error) console.warn('[cps] slot claim failed, proceeding unpaced:', error.message)
      return 0
    }

    const waitMs = Math.min(Math.max(0, data), MAX_DELAY_MS[kind])
    if (waitMs <= 0) return 0

    // No jitter, and its absence is deliberate. The first design needed it
    // because equal delays rebuilt the spike one second later. Fixed spacing
    // already produces a uniform distribution — adding noise on top would only
    // let two calls collide inside a slot that was reserved for one.
    await sleep(waitMs)
    return waitMs
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
export const CPS_MAX_DELAY_MS = MAX_DELAY_MS
