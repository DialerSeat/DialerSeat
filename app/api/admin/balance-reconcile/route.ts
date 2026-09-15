import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { requireAdmin } from '@/lib/admin'
import { apiError } from '@/lib/apiError'
import {
  billableSeconds,
  COST_PER_MINUTE_USD,
  COST_PER_AMD_LEG_USD,
  COST_PER_RECORDED_MINUTE_USD,
  TAX_RATE,
} from '@/lib/telephonyCosts'

const supabase = getServiceClient('admin/balance-reconcile')

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// =============================================================================
// /api/admin/balance-reconcile — what left the account vs what can explain it
// =============================================================================
// The Balance app already compares a MONTH to an invoice typed in by hand.
// That settles a month once it is over. It cannot see money leaving right now,
// which is the thing that started this: on 14 Sept the balance fell $6.39 in a
// window whose entire billable activity, priced at this account's own
// invoice-derived terms, tops out near $0.61.
//
// So this walks consecutive balance snapshots and, for each gap between two of
// them, puts three numbers side by side:
//
//   MOVED    what actually left the account, from their own balance API
//   THEIRS   the sum of call.cost webhooks they sent for calls in that gap
//   OURS     our model: billable seconds at 30s/6s, AMD, recording, tax
//
// A window where MOVED sits close to THEIRS is a window nobody needs to read.
// A window where MOVED far exceeds both is the finding, and it is stated as a
// residual with a name rather than left for somebody to notice.
//
// WHY BOTH COMPARISONS. Ours can be wrong, because it is a model. Theirs can
// be incomplete, because call.cost was only captured from 14 Sept and arrives
// up to half an hour after the call. Two independent floors are harder to wave
// away than one, and when the two agree with each other and disagree with the
// balance, it is the balance that needs explaining.
//
// THIS IS NOT A COST ESTIMATOR. Every other cost screen answers "what should
// this cost". This one only answers "can anything at all account for what was
// taken".
// =============================================================================

interface Snapshot { balance: number; at: string }

interface ReconcileWindow {
  from: string
  to: string
  minutes: number
  balanceFrom: number
  balanceTo: number
  /** Negative means money left the account. */
  moved: number
  dials: number
  answered: number
  /** Their own figure, wherever a call.cost webhook has arrived for it. */
  theirsUsd: number
  theirsCalls: number
  /** Our model at this account's invoice-derived terms, tax included. */
  oursUsd: number
  /** What neither figure accounts for. Positive means unexplained spend. */
  unexplainedUsd: number
}

export async function GET(req: NextRequest) {
  try {
    await requireAdmin()
  } catch (res) {
    return res as Response
  }

  try {
    const url = new URL(req.url)
    const hours = Math.min(720, Math.max(1,
      parseInt(url.searchParams.get('hours') || '24', 10) || 24))
    const since = new Date(Date.now() - hours * 3600_000).toISOString()

    const [snapRes, callRes, costRes] = await Promise.all([
      supabase
        .from('telnyx_balance_snapshots')
        .select('balance, at')
        .gte('at', since)
        .order('at', { ascending: true })
        .limit(5000),
      supabase
        .from('calls')
        .select('created_at, duration, answered_at, amd_result, recording_url, telnyx_cost')
        .gte('created_at', since)
        .limit(50000),
      supabase
        .from('telnyx_ledger_records')
        .select('occurred_at, captured_at, cost')
        .eq('record_type', 'call.cost')
        .gte('captured_at', since)
        .limit(50000),
    ])

    const snaps: Snapshot[] = ((snapRes.data || []) as Array<{
      balance: string | number; at: string
    }>)
      .map(s => ({ balance: Number(s.balance), at: s.at }))
      .filter(s => Number.isFinite(s.balance))

    const calls = (callRes.data || []) as Array<{
      created_at: string; duration: number | null; answered_at: string | null
      amd_result: string | null; recording_url: string | null
      telnyx_cost: number | null
    }>

    const costs = (costRes.data || []) as Array<{
      occurred_at: string | null; captured_at: string; cost: number | null
    }>

    const windows: ReconcileWindow[] = []

    for (let i = 1; i < snaps.length; i++) {
      const a = snaps[i - 1]
      const b = snaps[i]

      const gapCalls = calls.filter(c => c.created_at > a.at && c.created_at <= b.at)
      const gapCosts = costs.filter(c => {
        const t = c.occurred_at || c.captured_at
        return t > a.at && t <= b.at
      })

      // OUR MODEL. billableSeconds per leg, never on a summed duration — the
      // floor is charged per call, and applying it to a total would erase the
      // very thing it exists to capture.
      //
      // Counted as TWO legs per dial, because that is what the carrier sees:
      // the lead's leg, free unless answered and a full minute when it is, and
      // the agent's leg, which has no floor and bills roughly the same wall
      // time. Summing only the lead leg was the omission that made an earlier
      // version of this screen report 87% of spend as unexplained.
      const billedSec = gapCalls.reduce(
        (n, c) =>
          n
          + billableSeconds(c.duration, { leadLeg: true, answered: !!c.answered_at })
          + billableSeconds(c.duration, { leadLeg: false, answered: !!c.answered_at }),
        0
      )
      const amdLegs = gapCalls.filter(c => c.amd_result).length
      const recordedSec = gapCalls
        .filter(c => c.recording_url)
        .reduce((n, c) => n + Math.max(0, c.duration ?? 0), 0)

      const oursPreTax =
        (billedSec / 60) * COST_PER_MINUTE_USD +
        amdLegs * COST_PER_AMD_LEG_USD +
        (recordedSec / 60) * COST_PER_RECORDED_MINUTE_USD
      const oursUsd = oursPreTax * (1 + TAX_RATE)

      const theirsUsd =
        gapCosts.reduce((n, c) => n + Number(c.cost ?? 0), 0) +
        gapCalls.reduce((n, c) => n + Number(c.telnyx_cost ?? 0), 0)

      const moved = b.balance - a.balance
      const spent = moved < 0 ? -moved : 0

      // Deliberately the best case FOR the carrier: whichever of the two
      // explanations is larger is the one used to reduce the residual.
      const explained = Math.max(theirsUsd, oursUsd)

      windows.push({
        from: a.at,
        to: b.at,
        minutes: Math.round((Date.parse(b.at) - Date.parse(a.at)) / 60000),
        balanceFrom: a.balance,
        balanceTo: b.balance,
        moved: round4(moved),
        dials: gapCalls.length,
        answered: gapCalls.filter(c => c.answered_at).length,
        theirsUsd: round4(theirsUsd),
        theirsCalls: gapCosts.length,
        oursUsd: round4(oursUsd),
        unexplainedUsd: round4(Math.max(0, spent - explained)),
      })
    }

    const spentTotal = windows.reduce((n, w) => n + (w.moved < 0 ? -w.moved : 0), 0)
    const unexplainedTotal = windows.reduce((n, w) => n + w.unexplainedUsd, 0)

    // Windows where money left and NOTHING was dialled. These cannot be argued
    // about on rounding, because there is no usage to round. Surfaced on their
    // own so they are not lost in a long table.
    const noCallWindows = windows.filter(w => w.moved < 0 && w.dials === 0)

    return NextResponse.json({
      success: true,
      windowHours: hours,
      snapshots: snaps.length,
      note: snaps.length < 2
        ? 'Balance is only sampled while an admin has the ops map open, so a '
          + 'quiet period leaves no snapshots and cannot be reconciled.'
        : null,
      spentTotalUsd: round4(spentTotal),
      theirsTotalUsd: round4(windows.reduce((n, w) => n + w.theirsUsd, 0)),
      oursTotalUsd: round4(windows.reduce((n, w) => n + w.oursUsd, 0)),
      unexplainedTotalUsd: round4(unexplainedTotal),
      unexplainedPct: spentTotal > 0
        ? Math.round((unexplainedTotal / spentTotal) * 1000) / 10
        : 0,
      spentWithNoCallsUsd: round4(noCallWindows.reduce((n, w) => n + -w.moved, 0)),
      spentWithNoCallsWindows: noCallWindows.length,
      windows: windows.slice().reverse(),
    })
  } catch (err) {
    return apiError(err, { route: 'admin/balance-reconcile' })
  }
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000
}
