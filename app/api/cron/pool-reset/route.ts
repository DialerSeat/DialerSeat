import { NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { apiError } from '@/lib/apiError'

// =============================================================================
// POOL RESET — daily caller-ID counter reset
// =============================================================================
// RUN TIME MATTERS, AND "MIDNIGHT" IS THE WRONG ANSWER.
//
// This was scheduled at `0 0 * * *`. Vercel crons run in UTC, so midnight UTC
// is 8pm Eastern — squarely inside the calling window. Every East Coast agent
// dialing in the evening got all 13+ numbers handed a fresh 125-call budget
// mid-session, and every number that had been put to `resting` for carrier
// protection was revived on the spot. Both halves of this route did the
// opposite of their purpose, nightly.
//
// The safe window is bounded on both sides:
//   - AFTER the last legal call: 9pm Pacific = 04:00 UTC (07:00 UTC if
//     Hawaii is ever in scope)
//   - BEFORE the earliest legal call: 9am Eastern = 13:00 UTC
//
// It is now `0 9 * * *` in vercel.json — 09:00 UTC, which is 5am Eastern and
// 2am Pacific. If you move it, keep it inside 08:00–13:00 UTC.
// =============================================================================

const supabase = getServiceClient('cron/pool-reset')

export async function GET(req: Request) {

  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {

    const { data: resetData, error: resetErr } = await supabase
      .from('phone_numbers')
      .update({ daily_call_count: 0 })
      .neq('status', 'released')
      .select('id')

    if (resetErr) throw resetErr

    // ── REVIVING RESTED NUMBERS ──────────────────────────────────────────
    // Numbers rest for two very different reasons and they must not be
    // revived on the same schedule:
    //
    //   - Hit the daily cap. Purely a counter, meaningless the next day —
    //     revive immediately.
    //   - Rested by cron/number-health for a collapsed answer rate, i.e. the
    //     carriers have probably labelled it. Reviving that every morning
    //     would produce a loop: rest at 10:00, revive at 09:00, dial badly
    //     all day, rest again. The number never recovers and never leaves.
    //
    // Health-rested numbers get a longer cooling-off period and are then
    // revived to re-test them, because carrier labels do decay and a number
    // is an asset we already pay for. If it's still bad, number-health rests
    // it again the same day at no cost beyond one day of its capacity.
    const healthRestDays = 7
    const retestCutoff = new Date(Date.now() - healthRestDays * 24 * 60 * 60_000).toISOString()

    const { data: capRevived, error: capErr } = await supabase
      .from('phone_numbers')
      .update({ status: 'active' })
      .eq('status', 'resting')
      .or('rested_reason.is.null,rested_reason.neq.low_answer_rate')
      .select('id')

    if (capErr) throw capErr

    const { data: healthRevived, error: healthErr } = await supabase
      .from('phone_numbers')
      .update({ status: 'active', rested_reason: null })
      .eq('status', 'resting')
      .eq('rested_reason', 'low_answer_rate')
      .lt('last_flagged_at', retestCutoff)
      .select('id')

    if (healthErr) throw healthErr

    const result = {
      success: true,
      reset_count: resetData?.length ?? 0,
      revived_count: (capRevived?.length ?? 0) + (healthRevived?.length ?? 0),
      revived_from_cap: capRevived?.length ?? 0,
      revived_for_retest: healthRevived?.length ?? 0,
      timestamp: new Date().toISOString(),
    }
    console.log('[cron/pool-reset]', result)

    return NextResponse.json(result)
  } catch (err: any) {
    console.error('[cron/pool-reset] error:', err)
    return apiError(err, { route: 'cron/pool-reset' })
  }
}

export const POST = GET