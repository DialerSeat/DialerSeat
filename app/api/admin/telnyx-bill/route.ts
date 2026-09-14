import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { requireAdmin } from '@/lib/admin'
import { apiError } from '@/lib/apiError'
import {
  COST_PER_MINUTE_USD, COST_PER_AMD_LEG_USD, COST_PER_RECORDED_MINUTE_USD,
} from '@/lib/telephonyCosts'

const supabase = getServiceClient('admin/telnyx-bill')

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// =============================================================================
// /api/admin/telnyx-bill — the month's real invoice, against our estimate
// =============================================================================
// Telnyx issues a ledger at the end of each month. Typing its total in here
// turns every carrier estimate on this platform into a checkable claim, and
// over several months answers the question that actually matters: not whether
// one month had a gap, but whether the gap is STABLE.
//
// A stable gap is fees — per-number purchase charges, E911, tax, regulatory
// surcharges — all of which are roughly fixed per number per month and none of
// which reach our tables. A gap that grows with dialing volume is a different
// animal and worth an email to them.
//
// The usage side is recomputed here from the calls in that month rather than
// stored, so correcting a rate in lib/telephonyCosts.ts re-answers every month
// at once instead of leaving a trail of figures computed under old rates.
// =============================================================================

/** Usage we can evidence for a calendar month, from our own records. */
async function usageFor(monthStart: Date) {
  const end = new Date(monthStart)
  end.setUTCMonth(end.getUTCMonth() + 1)

  const [{ data: calls }, { data: numbers }] = await Promise.all([
    supabase
      .from('calls')
      .select('talk_seconds, amd_requested, amd_result, recording_duration')
      .gte('created_at', monthStart.toISOString())
      .lt('created_at', end.toISOString())
      .limit(200000),
    supabase
      .from('phone_numbers')
      .select('monthly_cost_cents, acquired_at, status')
      .neq('status', 'released'),
  ])

  let talkSeconds = 0, amdLegs = 0, recordedSeconds = 0
  for (const c of (calls || []) as Array<{
    talk_seconds: number | null; amd_requested: boolean | null
    amd_result: string | null; recording_duration: number | null
  }>) {
    talkSeconds += Math.max(0, c.talk_seconds ?? 0)
    if (c.amd_requested || c.amd_result) amdLegs++
    recordedSeconds += Math.max(0, c.recording_duration ?? 0)
  }

  const held = (numbers || []) as Array<{ monthly_cost_cents: number | null; acquired_at: string | null }>
  const rentalUsd = held.reduce((n, r) => n + (r.monthly_cost_cents ?? 0), 0) / 100
  const boughtThisMonth = held.filter(
    r => r.acquired_at
      && new Date(r.acquired_at) >= monthStart
      && new Date(r.acquired_at) < end
  ).length

  const minutesUsd = (talkSeconds / 60) * COST_PER_MINUTE_USD
  const amdUsd = amdLegs * COST_PER_AMD_LEG_USD
  const recordingUsd = (recordedSeconds / 60) * COST_PER_RECORDED_MINUTE_USD

  return {
    minutesUsd, talkMinutes: talkSeconds / 60,
    amdUsd, amdLegs,
    recordingUsd, recordedMinutes: recordedSeconds / 60,
    rentalUsd, numbersHeld: held.length,
    // Counted, not costed: Telnyx charges an upfront fee per number and we have
    // never recorded what it was, so guessing a rate would put an invented
    // figure into a reconciliation whose whole job is separating the known
    // from the unknown.
    numbersBought: boughtThisMonth,
    // Rental is included: it IS on their bill. The purchase fees are not,
    // which is part of why a gap exists.
    estimatedUsd: minutesUsd + amdUsd + recordingUsd + rentalUsd,
  }
}

/** First of the month, UTC, from a YYYY-MM or YYYY-MM-DD string. */
function monthStartOf(raw: string): Date | null {
  const m = /^(\d{4})-(\d{2})/.exec(raw)
  if (!m) return null
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, 1))
  return Number.isNaN(d.getTime()) ? null : d
}

export async function GET(req: NextRequest) {
  try {
    await requireAdmin()
  } catch (res) {
    return res as Response
  }

  try {
    const months = Math.min(24, Math.max(1, parseInt(
      new URL(req.url).searchParams.get('months') || '6', 10
    ) || 6))

    const from = new Date()
    from.setUTCDate(1)
    from.setUTCHours(0, 0, 0, 0)
    from.setUTCMonth(from.getUTCMonth() - (months - 1))

    const { data: bills } = await supabase
      .from('telnyx_monthly_bills')
      .select('*')
      .gte('month', from.toISOString().slice(0, 10))
      .order('month', { ascending: false })

    const byMonth = new Map<string, Record<string, unknown>>()
    for (const b of (bills || []) as Array<Record<string, unknown>>) {
      byMonth.set(String(b.month).slice(0, 7), b)
    }

    const rows = []
    for (let i = 0; i < months; i++) {
      const start = new Date(from)
      start.setUTCMonth(start.getUTCMonth() + i)
      const key = start.toISOString().slice(0, 7)
      const usage = await usageFor(start)
      const bill = byMonth.get(key)
      const actual = bill ? Number(bill.total_usd) : null
      rows.push({
        month: key,
        billed: actual,
        estimated: usage.estimatedUsd,
        // Null when no ledger has been entered, rather than zero: "we have not
        // been told" and "they charged nothing" are different facts.
        gapUsd: actual === null ? null : actual - usage.estimatedUsd,
        usage,
        note: bill?.note ?? null,
      })
    }
    rows.reverse()

    return NextResponse.json({ success: true, months: rows })
  } catch (err) {
    return apiError(err, { route: 'admin/telnyx-bill' })
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin()
  } catch (res) {
    return res as Response
  }

  try {
    const body = await req.json().catch(() => ({}))
    const monthStart = typeof body?.month === 'string' ? monthStartOf(body.month) : null
    if (!monthStart) {
      return NextResponse.json(
        { success: false, error: 'month is required, as YYYY-MM' },
        { status: 400 }
      )
    }
    const total = Number(body?.totalUsd)
    if (!Number.isFinite(total) || total < 0) {
      return NextResponse.json(
        { success: false, error: 'totalUsd is required and must be a number' },
        { status: 400 }
      )
    }

    const num = (v: unknown) => {
      const n = Number(v)
      return Number.isFinite(n) ? n : null
    }

    // Upsert on month, so re-entering a figure corrects it rather than adding a
    // second row for the same period.
    const { error } = await supabase
      .from('telnyx_monthly_bills')
      .upsert({
        month: monthStart.toISOString().slice(0, 10),
        total_usd: total,
        usage_usd: num(body?.usageUsd),
        numbers_usd: num(body?.numbersUsd),
        e911_usd: num(body?.e911Usd),
        tax_usd: num(body?.taxUsd),
        other_usd: num(body?.otherUsd),
        note: typeof body?.note === 'string' ? body.note : null,
        recorded_at: new Date().toISOString(),
      }, { onConflict: 'month' })

    if (error) throw error
    return NextResponse.json({ success: true, month: monthStart.toISOString().slice(0, 7) })
  } catch (err) {
    return apiError(err, { route: 'admin/telnyx-bill' })
  }
}
