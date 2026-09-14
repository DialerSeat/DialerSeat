import { NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { apiError } from '@/lib/apiError'

const supabase = getServiceClient('cron/dial-performance')

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 120

// =============================================================================
// DIAL PERFORMANCE ROLLUP — make the questions answerable at scale
// =============================================================================
// Every question worth asking about this dialer has so far been answered by a
// full scan of `calls`: is this number reaching people, is Saturday worth
// dialing, does this list convert, what did the 30-second minimum cost. That
// works at nine thousand rows. At the forty-five million a month this platform
// sees at three thousand seats, those questions stop being askable — and the
// question nobody can compute is the question nobody asks.
//
// This collapses each day into one row per number, per campaign, per hour.
// A few thousand rows a day, and every comparison above becomes a sum.
//
// ── WHY THE GRAIN INCLUDES CAMPAIGN ─────────────────────────────────────────
// Because leaving it out produced a real, shipped mistake. Number selection was
// changed this morning to prefer numbers with a high answer rate, on the
// reasoning that a healthy number gets picked up. Two things were wrong, and
// the second was only visible once this table existed:
//
//   answer rate counts ANSWERS, and answering machines answer. The pool's
//   "healthiest" number reached a human 2.5% of the time; its "worst" reached
//   one 12.3% of the time. The metric ran backwards.
//
//   and human rate is not a property of the number at all. The same FL number
//   reached humans 14.3% of the time on one campaign and 2.6% on another —
//   5.6x apart, same caller ID. It was measuring the list.
//
// A per-number rate that does not hold campaign constant is a statement about
// whichever lists that number happened to dial. The grain is the control.
//
// ── COUNTS AND SECONDS, NEVER DOLLARS ───────────────────────────────────────
// Rates live in lib/telephonyCosts.ts and have been corrected twice this month.
// A dollar frozen into a row is a dollar computed under a rate we have since
// learned was wrong. Storing billable seconds and pricing them at read time
// means correcting a rate re-answers every day of history at once.
//
// ── WHY IT RE-DOES THE LAST FEW DAYS ────────────────────────────────────────
// refresh_dial_performance deletes and rebuilds a day, so re-running is free
// and always correct. Hangup webhooks arrive late, dispositions land hours
// after the call, and recording durations are written when the recording
// finishes. A day is not final when it ends.
// =============================================================================

/** Days re-computed each run. Yesterday alone would freeze late-arriving
 *  dispositions and recording durations into a wrong answer. */
const LOOKBACK_DAYS = 4

export async function GET(req: Request) {
  // Vercel cron requests carry this header; a manual call needs the secret.
  // Neither is a security boundary on its own — the route only writes a
  // rollup it can rebuild — but an open endpoint that scans `calls` is a
  // free way for somebody to spend our database.
  const auth = req.headers.get('authorization')
  const isVercelCron = req.headers.get('x-vercel-cron') !== null
  const secret = process.env.CRON_SECRET
  if (!isVercelCron && secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const days: string[] = []
    for (let i = 0; i < LOOKBACK_DAYS; i++) {
      const d = new Date()
      d.setUTCDate(d.getUTCDate() - i)
      days.push(d.toISOString().slice(0, 10))
    }

    const results: Array<{ day: string; rows: number | null; error?: string }> = []
    for (const day of days) {
      const { data, error } = await supabase.rpc('refresh_dial_performance', { p_day: day })
      if (error) {
        // One bad day must not stop the rest. A missing day is visible in the
        // table as an absence; a crashed cron is visible nowhere.
        console.error('[cron/dial-performance] failed for', day, error)
        results.push({ day, rows: null, error: error.message })
      } else {
        results.push({ day, rows: typeof data === 'number' ? data : 0 })
      }
    }

    const failed = results.filter(r => r.error).length
    return NextResponse.json({
      success: failed === 0,
      refreshed: results,
      note: 'Counts and seconds only. Price them with lib/telephonyCosts.ts.',
    }, { status: failed === results.length ? 500 : 200 })
  } catch (err) {
    return apiError(err, { route: 'cron/dial-performance' })
  }
}
