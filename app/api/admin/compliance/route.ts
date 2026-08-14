import { NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { requireAdmin } from '@/lib/admin'
import { apiError } from '@/lib/apiError'

const supabase = getServiceClient('admin/compliance')

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// =============================================================================
// /api/admin/compliance — what Telnyx expects, and where we actually are
// =============================================================================
// THIS MONTH ONLY, and it resets on the 1st. That is not a simplification, it
// is how the rule works: Telnyx assess the short-duration ratio over a calendar
// month and decide at month end whether to surcharge. A rolling 30-day window
// would show a number nobody is being judged on.
//
// Every threshold here is THEIRS, taken from their own correspondence, not a
// target we invented:
//   - short duration is <= 6 seconds of BILLED talk time
//   - the surcharge applies above 15% of connected calls
//   - a further concurrency increase needs higher answer rates and longer
//     average call durations
// =============================================================================

/** Telnyx's definition. Billed time starts at answer, not at dial. */
const SHORT_CALL_SECONDS = 6
/** Above this share of connected calls they may surcharge every short call. */
const SHORT_CALL_THRESHOLD_PCT = 15
/** Current outbound concurrent call limit on the account. */
const CONCURRENCY_LIMIT = 100

export async function GET() {
  try {
    await requireAdmin()
  } catch (res) {
    return res as Response
  }

  try {
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)

    // call_control_id NOT NULL is load-bearing. 1,462 rows in this table are
    // disposition records with no Telnyx call behind them; counting those as
    // calls understates every rate on this page.
    const { data: calls, error } = await supabase
      .from('calls')
      .select('answered_at, talk_seconds, amd_result, dial_source, created_at')
      .not('call_control_id', 'is', null)
      .gte('created_at', monthStart.toISOString())
      .limit(50000)
    if (error) throw error

    const rows = calls ?? []
    const placed = rows.length
    const connected = rows.filter(c => c.answered_at !== null)

    // Only calls we have real talk time for can be judged the way Telnyx judges
    // them. answered_at was not recorded before 2026-08-05, so older calls are
    // excluded rather than counted as zero — a call with unknown talk time is
    // not a short call, it is an unknown one.
    const measured = connected.filter(c => c.talk_seconds !== null)
    const short = measured.filter(c => (c.talk_seconds ?? 0) <= SHORT_CALL_SECONDS)

    const shortPct = measured.length > 0
      ? (short.length / measured.length) * 100
      : null
    const answerRatePct = placed > 0 ? (connected.length / placed) * 100 : null
    const avgTalkSeconds = measured.length > 0
      ? measured.reduce((s, c) => s + (c.talk_seconds ?? 0), 0) / measured.length
      : null

    // Where the short calls come from, because the ratio alone does not tell
    // you what to do about it.
    const byCause = {
      machine: short.filter(c => c.amd_result === 'machine').length,
      noVerdict: short.filter(c => c.amd_result === null).length,
      human: short.filter(c => c.amd_result === 'human').length,
      other: short.filter(
        c => c.amd_result !== null && c.amd_result !== 'machine' && c.amd_result !== 'human'
      ).length,
    }

    // How many of this month's short calls would have to disappear to reach
    // their line. Concrete beats a percentage when deciding whether to act.
    const allowedShort = Math.floor(measured.length * (SHORT_CALL_THRESHOLD_PCT / 100))
    const excessShort = Math.max(0, short.length - allowedShort)

    const msPerDay = 86400000
    const daysElapsed = Math.max(1, Math.ceil((now.getTime() - monthStart.getTime()) / msPerDay))
    const daysRemaining = Math.max(0, Math.ceil((nextMonth.getTime() - now.getTime()) / msPerDay))

    return NextResponse.json({
      success: true,
      period: {
        label: monthStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
        start: monthStart.toISOString(),
        resetsOn: nextMonth.toISOString(),
        daysElapsed,
        daysRemaining,
      },
      checks: [
        {
          key: 'short_calls',
          label: 'Short-duration calls',
          expects: `At or below ${SHORT_CALL_THRESHOLD_PCT}% of connected calls`,
          detail: `Telnyx counts any connected call of ${SHORT_CALL_SECONDS}s or less of talk time. Above ${SHORT_CALL_THRESHOLD_PCT}% they may surcharge every short call on the account.`,
          value: shortPct,
          unit: '%',
          threshold: SHORT_CALL_THRESHOLD_PCT,
          // Lower is better here; every other check is higher-is-better.
          direction: 'below' as const,
          passing: shortPct === null ? null : shortPct <= SHORT_CALL_THRESHOLD_PCT,
          sample: measured.length,
        },
        {
          key: 'answer_rate',
          label: 'Answer rate',
          expects: 'Higher — required for the 200 concurrency tier',
          detail: 'Telnyx said a further increase from 100 to 200 concurrent calls needs higher answer rates and longer average call durations. No fixed number was given.',
          value: answerRatePct,
          unit: '%',
          threshold: null,
          direction: 'above' as const,
          passing: null,
          sample: placed,
        },
        {
          key: 'avg_talk',
          label: 'Average talk time',
          expects: 'Longer — required for the 200 concurrency tier',
          detail: 'Measured from answer to hangup, not from dial. Ring time is excluded.',
          value: avgTalkSeconds,
          unit: 's',
          threshold: null,
          direction: 'above' as const,
          passing: null,
          sample: measured.length,
        },
        {
          key: 'concurrency',
          label: 'Concurrency limit',
          expects: `${CONCURRENCY_LIMIT} simultaneous outbound calls`,
          detail: 'On-net SIP legs count toward this cap, so an agent-attended call consumes two slots — the lead leg and the agent leg.',
          value: CONCURRENCY_LIMIT,
          unit: '',
          threshold: CONCURRENCY_LIMIT,
          direction: 'above' as const,
          passing: true,
          sample: null,
        },
      ],
      shortCalls: {
        count: short.length,
        allowed: allowedShort,
        excess: excessShort,
        byCause,
      },
      volume: { placed, connected: connected.length, measured: measured.length },
    })
  } catch (err) {
    return apiError(err, { route: 'admin/compliance' })
  }
}
