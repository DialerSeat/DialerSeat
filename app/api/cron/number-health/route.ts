import { NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { apiError } from '@/lib/apiError'
import { sendAdminPush } from '@/lib/pushNotify'
import { HEALTH_WINDOW_DAYS } from '@/lib/dialerConstants'

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
// and rests the ones that have collapsed relative to their peers.
//
// WHY A RELATIVE THRESHOLD: absolute answer rates swing enormously by vertical,
// time of day, and list quality. A 12% rate might be excellent for aged
// internet leads and terrible for fresh inbound. What is never normal is one
// number answering far below the others dialing the same lists on the same
// days — that is a property of the number, not the campaign.
//
// SAFETY:
//   - Read-mostly. The only write is status -> 'resting' plus counters. It
//     never releases or buys a number; a bad heuristic must not be able to
//     spend money or destroy pool capacity.
//   - Rested numbers are revived by the existing pool-reset cron, so a false
//     positive costs one day of that number's capacity, not the number.
//   - Needs a real sample before judging anything (MIN_CALLS_FOR_JUDGEMENT).
//   - Refuses to act at all if it would rest too much of the pool at once —
//     that pattern means something platform-wide is wrong (a webhook outage
//     leaving answered_at unset would look exactly like every number going
//     bad simultaneously), and resting the whole pool would turn a metrics
//     bug into a total outage.
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

/** Never rest more than this fraction of active numbers in one run. */
const MAX_REST_FRACTION = 0.25

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
      .select('pool_number_id, answered_at')
      .gte('created_at', since)
      .not('pool_number_id', 'is', null)
      .limit(500_000)

    if (callErr) throw callErr

    const tally = new Map<string, { placed: number; answered: number }>()
    for (const c of calls || []) {
      const key = c.pool_number_id as string
      const t = tally.get(key) || { placed: 0, answered: 0 }
      t.placed += 1
      if (c.answered_at !== null) t.answered += 1
      tally.set(key, t)
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
        `No numbers were rested.`
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
        `so nothing was rested automatically: this pattern usually means a platform problem, not ${suspect.length} bad numbers.`
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
          status: 'resting',
          last_flagged_at: new Date().toISOString(),
          flag_reason: `answer rate ${(s.rate * 100).toFixed(1)}% vs pool median ${(poolMedian * 100).toFixed(1)}% over ${WINDOW_DAYS}d`,
          rested_reason: 'low_answer_rate',
        })
        .eq('id', s.id)
        .eq('status', 'active') // don't fight a concurrent status change
      if (!error) rested.push(s.phone_number)
    }

    if (rested.length > 0) {
      await sendAdminPush(
        'pool_capacity',
        `Rested ${rested.length} pool number(s) answering far below the rest: ${rested.slice(0, 5).join(', ')}` +
        `${rested.length > 5 ? `, +${rested.length - 5} more` : ''}. ` +
        `Pool median ${(poolMedian * 100).toFixed(1)}%. Likely carrier spam-labelled. ` +
        `They return to active at the next daily pool reset.`
      )
    }

    return NextResponse.json({
      success: true,
      window_days: WINDOW_DAYS,
      judged: judgeable.length,
      pool_median: Number(poolMedian.toFixed(4)),
      threshold: Number(threshold.toFixed(4)),
      rested,
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
