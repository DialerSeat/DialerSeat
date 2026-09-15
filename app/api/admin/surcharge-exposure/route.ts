import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/requireAdmin'
import { getServiceClient } from '@/lib/supabase'
import {
  computeExposure,
  callsToClear,
  SHORT_DURATION_LIMIT,
  ABANDONED_LIMIT,
  type ExposureRow,
} from '@/lib/surchargeExposure'

const supabase = getServiceClient('admin/surcharge-exposure')

// =============================================================================
// THE TWO RATIOS TELNYX BILLS ON, MONTH TO DATE
// =============================================================================
// Short duration (>15% of CONNECTED calls at <=6s) and abandoned (>20% of TOTAL
// OUTBOUND dropped before answer). Both are month-long ratios; crossing either
// applies its fee to EVERY qualifying call that month, not just the excess.
//
// September 2026 breached both at 20.8% and 21.6% — about $3.53 against a
// $28.29 usage bill — and nothing on this platform showed it. The numbers were
// only found by reading Telnyx's surcharge articles and running SQL by hand.
//
// This is also the GO/NO-GO GATE for dial_agent_on_answer. Deferring the agent
// leg means the lead is already answered when the agent's leg is placed, so
// every agent-leg failure becomes a hangup on a live connected call — short
// duration AND abandoned, on a base already over both lines. Worth $0.68 per
// agent per day; the surcharge is retroactive across the month. Do not enable
// it until this screen reads under 20%.
//
// THE PORTAL OUTRANKS THIS. Telnyx shows the abandoned rate as a pie chart on
// the Mission Control dashboard and both figures in the advanced usage reports.
// That is the count that gets billed. This exists so the number is visible
// every day without leaving the app, not because it is more authoritative —
// see docs/COST-FINDINGS.md §1m on why a column we populate is never the
// carrier's state.

export async function GET() {
  try {
    const gate = await requireAdmin()
    if (!gate.ok) return NextResponse.json({ error: gate.message }, { status: gate.status })

    // Month to date in ET, because that is the calendar the invoice uses and
    // the one a person reading this screen is thinking in.
    const now = new Date()
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
    const since = monthStart.toISOString()

    const { data, error } = await supabase
      .from('calls')
      .select('call_control_id, answered_at, created_at, duration, dial_source, disposition, hangup_cause')
      .gte('created_at', since)
      .limit(50000)

    if (error) {
      return NextResponse.json({ error: `Query failed: ${error.message}` }, { status: 500 })
    }

    const toRow = (c: Record<string, unknown>): ExposureRow => {
      const answeredAt = c.answered_at ? Date.parse(c.answered_at as string) : null
      const createdAt = c.created_at ? Date.parse(c.created_at as string) : null
      const duration = typeof c.duration === 'number' ? c.duration : 0
      // Billing starts at ANSWER. `duration` starts at origination and the gap
      // averages 10.5 seconds — counting it as talk time was what understated
      // the whole minimum-waste analysis (§1a).
      const ring = answeredAt && createdAt ? (answeredAt - createdAt) / 1000 : 0
      return {
        placed: !!c.call_control_id,
        answered: !!c.answered_at,
        talkSeconds: Math.max(0, duration - ring),
        dialSource: (c.dial_source as string) ?? null,
        disposition: (c.disposition as string) ?? null,
        hangupCause: (c.hangup_cause as string) ?? null,
      }
    }

    const rows = (data || []).map(toRow)
    const month = computeExposure(rows)

    // The dilution rate comes from the last 3 days, not the month — the point
    // is whether TODAY's quality is good enough to dial the month back under.
    const recentSince = Date.now() - 3 * 24 * 60 * 60 * 1000
    const recent = computeExposure(
      (data || [])
        .filter(c => c.created_at && Date.parse(c.created_at as string) >= recentSince)
        .map(toRow)
    )

    const sdcToClear = callsToClear(
      month.shortDurationCalls, month.totalConnected,
      SHORT_DURATION_LIMIT, recent.shortDurationPct
    )
    const abToClear = callsToClear(
      month.abandonedCalls, month.totalOutbound,
      ABANDONED_LIMIT, recent.abandonedPct
    )

    return NextResponse.json({
      success: true,
      month_to_date: month,
      last_3_days: recent,
      limits: { short_duration: SHORT_DURATION_LIMIT, abandoned: ABANDONED_LIMIT },
      to_clear: {
        short_duration_connected_calls: sdcToClear,
        abandoned_outbound_calls: abToClear,
      },
      // Plain language, so the screen answers rather than needing the surcharge
      // articles open beside it.
      notes: [
        month.shortDurationOver
          ? `SHORT DURATION IS OVER: ${pct(month.shortDurationPct)} of connected calls are 6s or less ` +
            `(limit 15%). That is $${month.shortDurationFeeUsd} — charged on ALL ${month.shortDurationCalls} ` +
            `of them, not just the excess.`
          : `Short duration ${pct(month.shortDurationPct)} of connected calls, under the 15% limit.`,
        month.abandonedOver
          ? `ABANDONED IS OVER: ${pct(month.abandonedPct)} of outbound calls dropped before answer ` +
            `(limit 20%). That is $${month.abandonedFeeUsd} — charged on ALL ${month.abandonedCalls}.`
          : `Abandoned ${pct(month.abandonedPct)} of outbound calls, under the 20% limit.`,
        abToClear === null && month.abandonedOver
          ? `The last 3 days are running at ${pct(recent.abandonedPct)}, which is ALSO over the limit — ` +
            `so dialing more makes this worse, not better. Fix the rate before adding volume.`
          : abToClear
            ? `About ${abToClear} more dials at the last 3 days' rate (${pct(recent.abandonedPct)}) ` +
              `brings abandonment back under 20%.`
            : 'Abandonment needs no dilution.',
        month.abandonedOver || recent.abandonedPct > ABANDONED_LIMIT
          ? 'Do NOT enable dial_agent_on_answer while abandonment is over 20%.'
          : 'Abandonment is under 20% — dial_agent_on_answer can be trialled, watching this screen.',
        'Telnyx’s own count is on the Mission Control dashboard pie chart. It outranks this estimate.',
      ],
    })
  } catch (err) {
    console.error('[admin/surcharge-exposure] threw', err)
    return NextResponse.json({ error: 'Exposure check failed' }, { status: 500 })
  }
}

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`
}
