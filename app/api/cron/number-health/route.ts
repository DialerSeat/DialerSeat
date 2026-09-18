import { NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { apiError } from '@/lib/apiError'
import { sendAdminPush } from '@/lib/pushNotify'
import { neverRang } from '@/lib/dialOutcome'
import { HEALTH_WINDOW_DAYS } from '@/lib/dialerConstants'
import { DEFAULT_DAILY_CAP } from '@/lib/numberPool'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// =============================================================================
// NUMBER HEALTH — catch caller IDs the carriers have turned against you
// =============================================================================
// A dialer does not usually fail loudly. What happens is that carriers start
// labelling some of your numbers "Spam Likely", those numbers stop getting
// answered, and the pool keeps dialing them at full cap. Connect rate sags,
// nobody can point at a cause, and the product looks like it got worse.
//
// Nothing detected that before this route existed, because `calls` did not
// even record WHICH pool number placed a call. It does now (calls.pool_number_id),
// so a number's answer rate is finally computable.
//
// WHAT THIS DOES: computes answered/placed per number over a rolling window,
// compares each number against the POOL MEDIAN rather than a fixed threshold,
// and THROTTLES the ones that have collapsed relative to their peers -- drops
// their daily cap to 15 while leaving them in the pool -- then restores the
// cap when they recover. See THROTTLED_DAILY_CAP for why throttling replaced
// resting on 18 Sept, and why the evidence says the two are opposites rather
// than degrees of the same thing.
//
// WHY A RELATIVE THRESHOLD: absolute answer rates swing enormously by vertical,
// time of day, and list quality. A 12% rate might be excellent for aged
// internet leads and terrible for fresh inbound. What is never normal is one
// number answering far below the others dialing the same lists on the same
// days — that is a property of the number, not the campaign.
//
// SAFETY:
//   - Read-mostly. The only writes are daily_cap and counters. It never
//     releases or buys a number, and it no longer changes status at all; a bad
//     heuristic must not be able to spend money or remove pool capacity.
//   - A false positive now costs a number three quarters of its daily volume
//     for as long as its answer rate stays down, not its place in the pool.
//     The same run that throttles restores anything back above threshold, so
//     the penalty ends on its own.
//   - Needs a real sample before judging anything (MIN_CALLS_FOR_JUDGEMENT).
//   - Refuses to act at all if it would throttle too much of the pool at once —
//     that pattern means something platform-wide is wrong (a webhook outage
//     leaving answered_at unset would look exactly like every number going
//     bad simultaneously), and throttling the whole pool would turn a metrics
//     bug into a capacity outage.
// =============================================================================

const supabase = getServiceClient('cron/number-health')

/**
 * Rolling window for the answer-rate sample.
 *
 * Lives in dialerConstants because cron/pool-reset derives its cooling-off
 * period from it — a resting number's bad sample only ages out once the rest
 * outlasts this window.
 */
const WINDOW_DAYS = HEALTH_WINDOW_DAYS

/** Below this many calls in the window, there isn't enough signal to judge. */
const MIN_CALLS_FOR_JUDGEMENT = 40

/**
 * A number is suspect when its answer rate is below this fraction of the pool
 * median. 0.4 = "answering less than 40% as often as a typical number here".
 */
const RELATIVE_FLOOR = 0.4

/** Never throttle more than this fraction of active numbers in one run. */
const MAX_REST_FRACTION = 0.25

/**
 * The cap a struggling number is dropped to, instead of being taken out.
 *
 * ── WHY THROTTLE AND NOT REST ─────────────────────────────────────────────
 * This route used to set status = 'resting', removing the number from the
 * pool until the next daily reset. Research on 18 Sept says that is the wrong
 * intervention, and this account's own data says so twice, in opposite
 * directions:
 *
 *   rested 8+ days      came back at 16.4%, WORSE than a brand-new number
 *                       at 20.5%
 *   volume cut 109->33  answer rate went 34.4% -> 63.1%, within 1-3 days,
 *                       same number, same lead pool
 *
 * Same problem, two responses, opposite outcomes. Hiya publishes the
 * mechanism: of its four graded factors, Maturity is "do you use established
 * numbers, without rotating", and a number is mature because it is SEEN
 * calling. Rest is the absence of the input, so it cannot heal anything --
 * it just removes the number from view while the old complaints sit there.
 *
 * Throttling improves three of the four -- Connection and Engagement recover
 * as answer rate does, Sentiment recovers because fewer calls mean fewer
 * complaints -- and protects the fourth, because the number keeps calling.
 *
 * 15 rather than 0. High enough to stay visible and keep accruing Maturity,
 * low enough to be a real reduction from 60.
 */
const THROTTLED_DAILY_CAP = 15

/**
 * Sample needed to let a throttled number back up, as opposed to to condemn it.
 *
 * Deliberately far below MIN_CALLS_FOR_JUDGEMENT, and the asymmetry is the
 * point. The window is 3 days and a throttled number is capped at 15/day, so
 * it can place at most 45 calls -- barely over the 40 needed to be judged at
 * all, and under it on any quiet day. Judging restoration by the same bar as
 * condemnation would mean a throttled number frequently could not qualify to
 * be un-throttled, and the penalty would quietly become permanent.
 *
 * Restoring on weaker evidence is the safe direction. If it was wrong, the
 * next run is 24 hours away and will throttle it again. Never restoring has
 * no such correction.
 */
const MIN_CALLS_TO_RESTORE = 15

/** Pool median below this is treated as too weak a baseline to compare against. */
const MIN_MEDIAN_RATE = 0.02

interface NumberStat {
  id: string
  phone_number: string
  placed: number
  answered: number
  rate: number
}

function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid]
}

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60_000).toISOString()

    const { data: active, error: numErr } = await supabase
      .from('phone_numbers')
      .select('id, phone_number')
      .eq('status', 'active')

    if (numErr) throw numErr
    if (!active || active.length === 0) {
      return NextResponse.json({ success: true, skipped: 'no active numbers' })
    }

    // Pull the window's calls and aggregate in JS. At pool scale this is a few
    // hundred thousand narrow rows at most; doing it here keeps the logic
    // reviewable in one place rather than split across a SQL function.
    const { data: calls, error: callErr } = await supabase
      .from('calls')
      .select('pool_number_id, answered_at, duration')
      .gte('created_at', since)
      .not('pool_number_id', 'is', null)
      .limit(500_000)

    if (callErr) throw callErr

    // ── A CALL THAT NEVER RANG IS NOT EVIDENCE ABOUT THE NUMBER ───────────
    // This counted every row as a placed call, and for a long stretch most
    // rows were not calls. The dialer placed the lead leg without waiting to
    // learn whether this browser's SIP socket was up, so a dead socket
    // produced a lead leg that was torn down before it rang and written down
    // as NO_ANSWER against somebody who was never called. That bug is fixed,
    // but its rows are still inside this rolling window and they are what this
    // job has been judging numbers on.
    //
    // What that did, measured on the pool this morning:
    //
    //   +1 415 862 7515  CA   4.48% recorded, rested.  316 of 344 never rang.
    //                         On the calls that did ring: 89.3%.
    //   +1 229 459 3952  GA   6.12% recorded, rested.  41 of 49 never rang.
    //                         On the calls that did ring: 37.5%.
    //
    // So the number with the best answer rate in the pool was rested for
    // having the worst one, and a low_answer_rate rest lasts four days.
    //
    // THE TEST. A lead leg that reached the destination has a duration: it
    // rang, and the ring is wall clock. Of 1,134 NO_ANSWER calls on pool
    // numbers, 1,128 have a duration of exactly zero and two have a normal
    // twenty-to-thirty-second ring-out. Zero duration with nobody answering is
    // not a quiet phone, it is a call that never happened.
    //
    // This also and deliberately excludes calls still in flight, which carry
    // the same signature because duration is written at hangup. A call that is
    // ringing right now is not evidence either way yet, and including it would
    // count it as a miss.
    //
    // Platform-wide the same distortion reads 8.8% against a real 41.7%.
    // The predicate lives in lib/dialOutcome.ts, shared with every other rate
    // on the platform. It was written here first and copying it would have let
    // this job and the dashboards drift into disagreeing about the same calls.
    const tally = new Map<string, { placed: number; answered: number }>()
    let excluded = 0
    for (const c of calls || []) {
      const key = c.pool_number_id as string
      if (neverRang(c)) { excluded++; continue }
      const t = tally.get(key) || { placed: 0, answered: 0 }
      t.placed += 1
      if (c.answered_at !== null) t.answered += 1
      tally.set(key, t)
    }
    if (excluded > 0) {
      console.log(`[number-health] ignored ${excluded} calls that never rang (dead socket or still in flight)`)
    }

    const stats: NumberStat[] = active.map(n => {
      const t = tally.get(n.id) || { placed: 0, answered: 0 }
      return {
        id: n.id,
        phone_number: n.phone_number,
        placed: t.placed,
        answered: t.answered,
        rate: t.placed > 0 ? t.answered / t.placed : 0,
      }
    })

    // Only numbers with a real sample inform the baseline. Including idle ones
    // at a 0% rate would drag the median toward zero and make everything look
    // fine by comparison — the failure mode would hide itself.
    const judgeable = stats.filter(s => s.placed >= MIN_CALLS_FOR_JUDGEMENT)
    if (judgeable.length < 3) {
      await persistCounters(stats)
      return NextResponse.json({
        success: true,
        skipped: `only ${judgeable.length} number(s) with >= ${MIN_CALLS_FOR_JUDGEMENT} calls; need 3 to form a baseline`,
        window_days: WINDOW_DAYS,
      })
    }

    const poolMedian = median(judgeable.map(s => s.rate))

    if (poolMedian < MIN_MEDIAN_RATE) {
      // Everything is answering badly. That is not a per-number problem, and
      // resting numbers would not fix it — it's a list, a webhook outage
      // (answered_at never set), or a carrier-wide issue. Alert, change nothing.
      await persistCounters(stats)
      await sendAdminPush(
        'pool_capacity',
        `Pool-wide answer rate is ${(poolMedian * 100).toFixed(1)}% across ${judgeable.length} numbers ` +
        `over ${WINDOW_DAYS}d. That's too low to be a per-number issue, check webhook delivery ` +
        `(answered_at not being written looks identical to nobody answering) or list quality. ` +
        `No numbers were throttled.`
      )
      return NextResponse.json({
        success: true, action: 'alerted_pool_wide',
        pool_median: poolMedian, judged: judgeable.length,
      })
    }

    const threshold = poolMedian * RELATIVE_FLOOR
    const suspect = judgeable.filter(s => s.rate < threshold)

    const maxToRest = Math.max(1, Math.floor(active.length * MAX_REST_FRACTION))
    if (suspect.length > maxToRest) {
      await persistCounters(stats)
      await sendAdminPush(
        'pool_capacity',
        `${suspect.length} of ${active.length} pool numbers are answering below ${(threshold * 100).toFixed(1)}% ` +
        `(pool median ${(poolMedian * 100).toFixed(1)}%). That's more than ${Math.round(MAX_REST_FRACTION * 100)}% of the pool, ` +
        `so nothing was throttled automatically: this pattern usually means a platform problem, not ${suspect.length} bad numbers.`
      )
      return NextResponse.json({
        success: true, action: 'refused_bulk_rest',
        suspect: suspect.length, max_allowed: maxToRest, pool_median: poolMedian,
      })
    }

    await persistCounters(stats)

    const rested: string[] = []
    for (const s of suspect) {
      const { error } = await supabase
        .from('phone_numbers')
        .update({
          // Throttled, NOT rested. The number stays active and keeps calling.
          daily_cap: THROTTLED_DAILY_CAP,
          last_flagged_at: new Date().toISOString(),
          flag_reason: `answer rate ${(s.rate * 100).toFixed(1)}% vs pool median ${(poolMedian * 100).toFixed(1)}% over ${WINDOW_DAYS}d`,
          rested_reason: 'throttled_low_answer_rate',
        })
        .eq('id', s.id)
        .eq('status', 'active')
      if (!error) rested.push(s.phone_number)
    }

    // ── AND LET THEM BACK UP WHEN THEY RECOVER ──────────────────────────
    // The cron that throttles is the one that must un-throttle: it is the only
    // thing computing the health that justified it. pool-reset deliberately
    // does not touch daily_cap, so without this a throttled number would sit
    // at 15 forever and the intervention would become a life sentence.
    // From `stats`, not `judgeable` -- see MIN_CALLS_TO_RESTORE. A throttled
    // number often cannot clear the judging bar precisely BECAUSE it is
    // throttled, which is the circularity this avoids.
    const restored: string[] = []
    for (const s of stats.filter(x => x.placed >= MIN_CALLS_TO_RESTORE && x.rate >= threshold)) {
      const { data, error } = await supabase
        .from('phone_numbers')
        .update({
          daily_cap: DEFAULT_DAILY_CAP,
          rested_reason: null,
          flag_reason: null,
        })
        .eq('id', s.id)
        .eq('rested_reason', 'throttled_low_answer_rate')
        .select('phone_number')
      if (!error && data && data.length > 0) restored.push(s.phone_number)
    }

    if (rested.length > 0) {
      await sendAdminPush(
        'pool_capacity',
        `Throttled ${rested.length} pool number(s) to ${THROTTLED_DAILY_CAP}/day, answering far below ` +
        `the rest: ${rested.slice(0, 5).join(', ')}` +
        `${rested.length > 5 ? `, +${rested.length - 5} more` : ''}. ` +
        `Pool median ${(poolMedian * 100).toFixed(1)}%. Likely carrier spam-labelled. ` +
        `They keep calling at reduced volume -- that is what recovers them -- and the cap ` +
        `returns to ${DEFAULT_DAILY_CAP} automatically once answer rate does.`
      )
    }

    return NextResponse.json({
      success: true,
      window_days: WINDOW_DAYS,
      judged: judgeable.length,
      pool_median: Number(poolMedian.toFixed(4)),
      threshold: Number(threshold.toFixed(4)),
      // Named for what now happens. A run that restores more than it throttles
      // is the healthy shape, and a response that only reported one half would
      // hide that.
      throttled: rested,
      restored,
    })
  } catch (err) {
    return apiError(err, { route: 'cron/number-health' })
  }
}

/**
 * Store the window's numbers on each row so the admin Numbers app can show
 * them without recomputing. Written even on the paths that decline to rest
 * anything — the visibility is the point, the resting is the reflex.
 */
async function persistCounters(stats: NumberStat[]): Promise<void> {
  const checkedAt = new Date().toISOString()
  await Promise.all(stats.map(s =>
    supabase
      .from('phone_numbers')
      .update({
        health_window_calls: s.placed,
        health_window_answered: s.answered,
        health_answer_rate: s.placed > 0 ? Number((s.rate * 100).toFixed(2)) : null,
        health_checked_at: checkedAt,
      })
      .eq('id', s.id)
  ))
}
