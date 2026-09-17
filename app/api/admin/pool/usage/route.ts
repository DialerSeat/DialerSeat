import { NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { requireAdmin } from '@/lib/requireAdmin'
import { apiError } from '@/lib/apiError'

const supabase = getServiceClient('admin/pool/usage')

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// =============================================================================
// WHICH NUMBERS ARE DOING THE WORK, THIS MONTH
// =============================================================================
// phone_numbers.daily_call_count answers "how hard is this number working right
// now" and is reset every morning by cron/pool-reset. lifetime_call_count
// answers "how hard has it ever worked" and never forgets, so a number bought
// in May and a number bought yesterday are not comparable on it.
//
// Neither answers the question an operator actually asks, which is: over the
// stretch that matters for reputation, is the pool being worked evenly, or is
// one number carrying the floor while six sit idle? An unevenly worked pool is
// how a single number accumulates the call volume that gets it flagged while
// the numbers bought to prevent exactly that go unused.
//
// So this counts real calls per number over the calendar month, in Central,
// and ranks them. Ranking is the point — the top of the list is the number at
// risk and the bottom is capacity already paid for and not spent.
//
// ── ANSWER RATE IS HERE FOR A REASON ───────────────────────────────────────
// Volume alone cannot tell an overworked number from a productive one. A number
// placing 400 calls at a 65% answer rate is fine; one placing 400 at 12% is
// being ignored, which is what carrier filtering looks like from this side
// before anybody tells you about it. The two columns have to be read together,
// so they are returned together.

interface Row {
  id: string
  phoneNumber: string
  state: string | null
  status: string
  restedReason: string | null
  dials: number
  answers: number
  machines: number
  conversations: number
  answerPct: number | null
  lastCalledAt: string | null
  dailyCallCount: number
  dailyCap: number
  /** Health cron's own rolling read, for comparison against the month. */
  healthAnswerRate: number | null
}

export async function GET(req: Request) {
  const gate = await requireAdmin()
  if (!gate.ok) return NextResponse.json({ error: gate.message }, { status: gate.status })

  try {
    const url = new URL(req.url)
    // 'month' is the default because that is the window the question is asked
    // in. 30d exists because the 1st of the month is a useless report.
    const window = url.searchParams.get('window') === '30d' ? '30d' : 'month'

    const since = window === '30d'
      ? new Date(Date.now() - 30 * 24 * 60 * 60_000).toISOString()
      // Start of the current month in Central, expressed as an instant.
      : (() => {
          const now = new Date()
          const central = new Date(now.toLocaleString('en-US', { timeZone: 'America/Chicago' }))
          return new Date(Date.UTC(central.getFullYear(), central.getMonth(), 1, 6, 0, 0)).toISOString()
        })()

    const { data: numbers, error: numErr } = await supabase
      .from('phone_numbers')
      .select('id, phone_number, state, status, rested_reason, daily_call_count, daily_cap, last_called_at, health_answer_rate')
      .neq('status', 'released')
    if (numErr) return apiError(numErr, { route: 'admin/pool/usage' })

    // Pulled as rows and counted here rather than with a group-by RPC: the
    // volumes involved are thousands, not millions, and adding a migration for
    // a read-only panel is a poor trade. Revisit if this ever pages.
    const { data: calls, error: callErr } = await supabase
      .from('calls')
      .select('pool_number_id, answered_at, amd_result, talk_seconds')
      .gte('created_at', since)
      .not('pool_number_id', 'is', null)
      .limit(100000)
    if (callErr) return apiError(callErr, { route: 'admin/pool/usage' })

    const agg = new Map<string, { dials: number; answers: number; machines: number; convos: number }>()
    for (const c of calls ?? []) {
      const key = c.pool_number_id as string
      const a = agg.get(key) ?? { dials: 0, answers: 0, machines: 0, convos: 0 }
      a.dials++
      if (c.answered_at) a.answers++
      if (c.amd_result === 'machine' || c.amd_result === 'fax_detected') a.machines++
      if ((c.talk_seconds ?? 0) >= 30) a.convos++
      agg.set(key, a)
    }

    const rows: Row[] = (numbers ?? []).map(n => {
      const a = agg.get(n.id) ?? { dials: 0, answers: 0, machines: 0, convos: 0 }
      return {
        id: n.id,
        phoneNumber: n.phone_number,
        state: n.state,
        status: n.status,
        restedReason: n.rested_reason,
        dials: a.dials,
        answers: a.answers,
        machines: a.machines,
        conversations: a.convos,
        // Null rather than 0 on an unused number: "no answers out of no calls"
        // is not a 0% answer rate, and showing it as one would put idle numbers
        // at the bottom of a health sort alongside genuinely burned ones.
        answerPct: a.dials > 0 ? Math.round((a.answers / a.dials) * 1000) / 10 : null,
        lastCalledAt: n.last_called_at,
        dailyCallCount: n.daily_call_count ?? 0,
        dailyCap: n.daily_cap ?? 0,
        healthAnswerRate: n.health_answer_rate === null ? null : Number(n.health_answer_rate),
      }
    })

    rows.sort((x, y) => y.dials - x.dials)

    const totalDials = rows.reduce((s, r) => s + r.dials, 0)
    const used = rows.filter(r => r.dials > 0)
    // The spread is the headline: one number doing a third of the work is the
    // finding, and it is invisible in a list sorted any other way.
    const busiestShare = totalDials > 0 && rows.length > 0
      ? Math.round((rows[0].dials / totalDials) * 1000) / 10
      : 0

    return NextResponse.json({
      success: true,
      window,
      since,
      rows,
      summary: {
        numbers: rows.length,
        used: used.length,
        idle: rows.length - used.length,
        totalDials,
        busiestShare,
        avgPerUsedNumber: used.length > 0 ? Math.round(totalDials / used.length) : 0,
      },
    })
  } catch (err) {
    return apiError(err, { route: 'admin/pool/usage' })
  }
}
