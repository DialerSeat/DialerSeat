import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { requireAdmin } from '@/lib/admin'
import { apiError } from '@/lib/apiError'
import {
  COST_PER_MINUTE_USD, COST_PER_AMD_LEG_USD, COST_PER_RECORDED_MINUTE_USD,
} from '@/lib/telephonyCosts'

const supabase = getServiceClient('admin/telnyx-reconcile')

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// =============================================================================
// /api/admin/telnyx-reconcile — what they charged, against what we think they should have
// =============================================================================
// Every carrier figure on this platform has been rate times usage. That answers
// "what should this have cost" and cannot answer "what did Telnyx actually
// take", which is the only question that matters when a month comes to $20 and
// our own arithmetic says $15.50.
//
// The balance is the answer, because every charge of any kind ends up there
// eventually — including the ones that never touch our tables: per-number
// purchase fees, E911, taxes, regulatory surcharges. telnyx_balance_snapshots
// records it as it moves, and this endpoint reads the drop over a window and
// sets it beside the usage we DO have records for.
//
// WHAT A GAP MEANS, AND WHAT IT DOES NOT. A drop larger than our accounted
// usage is not evidence of being overcharged. It is the fees above, plus number
// rental posting on its own cycle, plus anything bought by hand in the Telnyx
// console. The number worth watching is the gap's SHAPE over time: fees are
// roughly fixed per number per month, so a gap that grows with dialing volume
// is a different animal from one that grows with the pool.
//
// It is also honest about its own blind spots. A top-up shows as the balance
// going UP, and a window containing one cannot be read as spend at all, so it
// is reported separately rather than netted off.
// =============================================================================

export async function GET(req: NextRequest) {
  try {
    await requireAdmin()
  } catch (res) {
    return res as Response
  }

  try {
    const days = Math.min(365, Math.max(1, parseInt(
      new URL(req.url).searchParams.get('days') || '30', 10
    ) || 30))
    const sinceIso = new Date(Date.now() - days * 24 * 60 * 60_000).toISOString()

    const [snapsRes, callsRes, numbersRes] = await Promise.all([
      supabase
        .from('telnyx_balance_snapshots')
        .select('at, available_credit, balance, pending')
        .gte('at', sinceIso)
        .order('at', { ascending: true })
        .limit(20000),
      supabase
        .from('calls')
        .select('talk_seconds, amd_requested, amd_result, recording_duration')
        .gte('created_at', sinceIso)
        .limit(200000),
      supabase
        .from('phone_numbers')
        .select('monthly_cost_cents, acquired_at, status')
        .neq('status', 'released'),
    ])

    const snaps = (snapsRes.data || []) as Array<{
      at: string; available_credit: string | number | null
      balance: string | number | null; pending: string | number | null
    }>

    // ── WHAT TELNYX ACTUALLY TOOK ─────────────────────────────────────────
    // Walked pair by pair rather than first-minus-last, so a top-up in the
    // middle cannot be silently netted against spend. A fall is spend; a rise
    // is money added, and the two are reported apart because adding them
    // produces a number that is neither.
    let actualSpend = 0
    let toppedUp = 0
    for (let i = 1; i < snaps.length; i++) {
      const prev = Number(snaps[i - 1].available_credit)
      const cur = Number(snaps[i].available_credit)
      if (!Number.isFinite(prev) || !Number.isFinite(cur)) continue
      const delta = cur - prev
      if (delta < 0) actualSpend += -delta
      else toppedUp += delta
    }

    // ── WHAT WE HAVE RECORDS FOR ──────────────────────────────────────────
    let talkSeconds = 0
    let amdLegs = 0
    let recordedSeconds = 0
    for (const c of (callsRes.data || []) as Array<{
      talk_seconds: number | null; amd_requested: boolean | null
      amd_result: string | null; recording_duration: number | null
    }>) {
      talkSeconds += Math.max(0, c.talk_seconds ?? 0)
      if (c.amd_requested || c.amd_result) amdLegs++
      recordedSeconds += Math.max(0, c.recording_duration ?? 0)
    }

    const minutesUsd = (talkSeconds / 60) * COST_PER_MINUTE_USD
    const amdUsd = amdLegs * COST_PER_AMD_LEG_USD
    const recordingUsd = (recordedSeconds / 60) * COST_PER_RECORDED_MINUTE_USD

    const numbers = (numbersRes.data || []) as Array<{
      monthly_cost_cents: number | null; acquired_at: string | null
    }>
    const monthlyUsd = numbers.reduce((n, r) => n + (r.monthly_cost_cents ?? 0), 0) / 100
    // Prorated over the window at 30.44 days, the average month. Rental posts
    // on Telnyx's own cycle rather than evenly, so this is the right figure for
    // a window and the wrong one for any single day inside it.
    const rentalUsd = monthlyUsd * (days / 30.44)
    // Bought inside the window: Telnyx charges an upfront fee per number on top
    // of the monthly, and we do not record what it was. Counted, not costed.
    const acquiredInWindow = numbers.filter(
      r => r.acquired_at && new Date(r.acquired_at).getTime() >= Date.parse(sinceIso)
    ).length

    const accounted = minutesUsd + amdUsd + recordingUsd + rentalUsd
    const covered = snaps.length >= 2

    return NextResponse.json({
      success: true,
      windowDays: days,
      // Without two readings there is no drop to measure. Said plainly rather
      // than returning a confident zero, which would read as "they charged
      // nothing" when it means "we were not watching".
      covered,
      snapshots: snaps.length,
      firstReadingAt: snaps[0]?.at ?? null,
      lastReadingAt: snaps[snaps.length - 1]?.at ?? null,
      actual: {
        spendUsd: covered ? actualSpend : null,
        toppedUpUsd: covered ? toppedUp : null,
        availableNow: snaps.length > 0
          ? Number(snaps[snaps.length - 1].available_credit) : null,
      },
      accounted: {
        totalUsd: accounted,
        minutesUsd, talkMinutes: talkSeconds / 60,
        amdUsd, amdLegs,
        recordingUsd, recordedMinutes: recordedSeconds / 60,
        rentalUsd, numbersHeld: numbers.length,
      },
      unaccountedUsd: covered ? actualSpend - accounted : null,
      // The named things we know Telnyx bills and we do not record, so a gap
      // is read as these rather than as an overcharge.
      knownBlindSpots: {
        numbersAcquiredInWindow: acquiredInWindow,
        note: 'Per-number purchase fees, E911, taxes and regulatory surcharges '
          + 'are billed by Telnyx and never touch our tables. Anything bought '
          + 'by hand in the Telnyx console is invisible here too. A gap is '
          + 'these before it is an overcharge — what is worth watching is '
          + 'whether the gap tracks the pool size or the dialing volume.',
      },
    })
  } catch (err) {
    return apiError(err, { route: 'admin/telnyx-reconcile' })
  }
}
