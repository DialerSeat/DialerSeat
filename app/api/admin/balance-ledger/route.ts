import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { requireAdmin } from '@/lib/admin'
import { apiError } from '@/lib/apiError'
import {
  COST_PER_MINUTE_USD, COST_PER_AMD_LEG_USD, COST_PER_RECORDED_MINUTE_USD,
} from '@/lib/telephonyCosts'

const supabase = getServiceClient('admin/balance-ledger')

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// =============================================================================
// /api/admin/balance-ledger — the carrier account as a bank statement
// =============================================================================
// Every line is a real movement in the Telnyx balance, taken from
// telnyx_balance_snapshots, with the activity that happened in that interval
// attached to it. Money out, money in, and what we can show for it.
//
// ATTRIBUTION IS EVIDENCE, NOT PROOF. We know what was dialed between two
// readings and what our rates say that should have cost. We do NOT get an
// itemised bill, so a line's explanation is "this is what happened while the
// balance moved", not "this is what they charged for". Where the two disagree
// the remainder is shown as unexplained rather than folded into a category to
// make the row balance — an invented attribution is worse than an honest gap.
//
// WHAT LIVES IN THE GAP. Per-number purchase fees, E911, taxes, regulatory
// surcharges, and number rental posting on Telnyx's own cycle rather than
// evenly. None of those touch our tables. A gap is those before it is an
// overcharge, and the way to tell them apart is shape over time: fees track the
// size of the pool, usage tracks the dialing.
// =============================================================================

interface CallRow {
  id: string
  user_id: string | null
  phone_number: string | null
  created_at: string
  talk_seconds: number | null
  amd_requested: boolean | null
  amd_result: string | null
  recording_duration: number | null
  disposition: string | null
}

/** The most individual charges to itemise. A statement, not an export. */
const CHARGE_ROWS = 500

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
        .select('at, available_credit, balance, pending, heartbeat')
        .gte('at', sinceIso)
        .order('at', { ascending: true })
        .limit(20000),
      supabase
        .from('calls')
        .select('id, user_id, phone_number, created_at, talk_seconds, amd_requested, amd_result, recording_duration, disposition')
        .gte('created_at', sinceIso)
        .order('created_at', { ascending: true })
        .limit(200000),
      supabase
        .from('phone_numbers')
        .select('phone_number, acquired_at, monthly_cost_cents, status')
        .gte('acquired_at', sinceIso),
    ])

    const snaps = (snapsRes.data || []) as Array<{
      at: string; available_credit: string | number | null
      balance: string | number | null; pending: string | number | null
      heartbeat: boolean
    }>
    const calls = (callsRes.data || []) as CallRow[]
    const numbers = (numbersRes.data || []) as Array<{
      phone_number: string; acquired_at: string | null
      monthly_cost_cents: number | null; status: string
    }>

    // Calls are already in time order, so each interval is a walk forward from
    // where the last one stopped rather than a scan of the whole array per row.
    let cursor = 0

    interface Entry {
      at: string
      periodStart: string
      deltaUsd: number
      direction: 'out' | 'in'
      /** A credit we cannot attribute. See the note on totals.unverifiedCreditsUsd. */
      unverifiedCredit: boolean
      balanceAfter: number
      pending: number | null
      activity: {
        calls: number
        amdLegs: number; amdUsd: number
        talkMinutes: number; minutesUsd: number
        recordedMinutes: number; recordingUsd: number
        numbersBought: string[]
      }
      explainedUsd: number
      unexplainedUsd: number | null
    }
    const entries: Entry[] = []
    for (let i = 1; i < snaps.length; i++) {
      const from = snaps[i - 1]
      const to = snaps[i]
      const prev = Number(from.available_credit)
      const cur = Number(to.available_credit)
      if (!Number.isFinite(prev) || !Number.isFinite(cur)) continue

      const delta = cur - prev
      // A heartbeat with no movement is not a statement line. It is proof we
      // were watching, which matters for reading gaps but not for reading money.
      if (delta === 0) continue

      const startMs = Date.parse(from.at)
      const endMs = Date.parse(to.at)

      let talkSeconds = 0
      let amdLegs = 0
      let recordedSeconds = 0
      let callCount = 0
      while (cursor < calls.length && Date.parse(calls[cursor].created_at) < startMs) cursor++
      for (let j = cursor; j < calls.length; j++) {
        const t = Date.parse(calls[j].created_at)
        if (t >= endMs) break
        callCount++
        talkSeconds += Math.max(0, calls[j].talk_seconds ?? 0)
        if (calls[j].amd_requested || calls[j].amd_result) amdLegs++
        recordedSeconds += Math.max(0, calls[j].recording_duration ?? 0)
      }

      const boughtHere = numbers.filter(n => {
        if (!n.acquired_at) return false
        const t = Date.parse(n.acquired_at)
        return t >= startMs && t < endMs
      })

      const minutesUsd = (talkSeconds / 60) * COST_PER_MINUTE_USD
      const amdUsd = amdLegs * COST_PER_AMD_LEG_USD
      const recordingUsd = (recordedSeconds / 60) * COST_PER_RECORDED_MINUTE_USD
      const explainedUsd = minutesUsd + amdUsd + recordingUsd

      entries.push({
        at: to.at,
        periodStart: from.at,
        // Negative is money leaving, positive is money added. Kept signed so
        // the page never has to guess which way a row goes.
        deltaUsd: delta,
        direction: delta < 0 ? 'out' : 'in',
        // ── A CREDIT IS NOT A TOP-UP ────────────────────────────────────
        // Nothing here knows why the balance went UP. Telnyx posts corrections
        // and occasional spurious credits that settle back out, and this
        // account has seen one: +$1.04 at 11:01 on 14 Sept, with available
        // credit and balance both moving and pending at zero, followed by a
        // $0.92 debit six minutes later during a window in which not one call
        // was placed.
        //
        // Counting that as money added makes a glitch look like a deposit and
        // quietly inflates every net-cost figure derived from this ledger.
        // Flagged instead, and kept out of the totals that feed cost analysis.
        // The month-end invoice is the only thing that settles what it was.
        unverifiedCredit: delta > 0,
        balanceAfter: cur,
        pending: to.pending === null ? null : Number(to.pending),
        activity: {
          calls: callCount,
          amdLegs, amdUsd,
          talkMinutes: talkSeconds / 60, minutesUsd,
          recordedMinutes: recordedSeconds / 60, recordingUsd,
          numbersBought: boughtHere.map(n => n.phone_number),
        },
        explainedUsd,
        // Only meaningful on money going OUT. A top-up has nothing to explain.
        unexplainedUsd: delta < 0 ? Math.max(0, -delta - explainedUsd) : null,
      })
    }

    entries.reverse() // newest first, like a statement

    const totalOut = entries.reduce((n, e) => e.deltaUsd < 0 ? n + -e.deltaUsd : n, 0)
    // Deliberately NOT called "topped up". We observe the balance rising; we
    // do not observe a payment. Until a credit is matched to something real,
    // it is an unexplained movement in our favour and nothing more.
    const totalCredited = entries.reduce((n, e) => e.deltaUsd > 0 ? n + e.deltaUsd : n, 0)
    const totalExplained = entries.reduce(
      (n, e) => n + (e.deltaUsd < 0 ? e.explainedUsd : 0), 0)

    // ── EVERY CHARGE, AND WHOSE CALL IT CAME FROM ─────────────────────────
    // Derived from our rates rather than read off a bill, because Telnyx does
    // not give us one per call. What it IS: the charge each call should have
    // produced, attributed to the person who placed it. What it is NOT: proof
    // of what appeared on the invoice — that is what the balance movements
    // above are for, and the difference between the two is the point.
    //
    // A call with no billable component is left out entirely. Most dials are
    // that: no answer means no minutes, and with detection off there is
    // nothing else to charge for. Listing them at $0.00 would bury the ones
    // that cost something.
    const charged = calls
      .map(c => {
        const amd = (c.amd_requested || c.amd_result) ? COST_PER_AMD_LEG_USD : 0
        const mins = (Math.max(0, c.talk_seconds ?? 0) / 60) * COST_PER_MINUTE_USD
        const rec = (Math.max(0, c.recording_duration ?? 0) / 60) * COST_PER_RECORDED_MINUTE_USD
        return { c, amd, mins, rec, total: amd + mins + rec }
      })
      .filter(x => x.total > 0)

    const nameById = new Map<string, string>()
    const chargeUserIds = Array.from(new Set(
      charged.map(x => x.c.user_id).filter(Boolean) as string[]
    ))
    if (chargeUserIds.length > 0) {
      const { data: us } = await supabase
        .from('users')
        .select('clerk_id, first_name, last_name, email')
        .in('clerk_id', chargeUserIds)
      for (const u of (us || []) as Array<{
        clerk_id: string; first_name: string | null; last_name: string | null; email: string | null
      }>) {
        nameById.set(u.clerk_id, [u.first_name, u.last_name].filter(Boolean).join(' ').trim()
          || u.email || u.clerk_id.slice(0, 12))
      }
    }

    // ── WHAT EACH PERSON COSTS ────────────────────────────────────────────
    // The rollup of the same rows. Built from every charged call in the window,
    // not from the 500 itemised below, so the totals stay right however long
    // the statement is truncated.
    const byUser = new Map<string, {
      userId: string; name: string; calls: number
      amdLegs: number; amdUsd: number
      talkMinutes: number; minutesUsd: number
      recordedMinutes: number; recordingUsd: number
      totalUsd: number
    }>()
    for (const x of charged) {
      const uid = x.c.user_id ?? 'unknown'
      const row = byUser.get(uid) ?? {
        userId: uid, name: nameById.get(uid) ?? (uid === 'unknown' ? 'No user on the call' : uid.slice(0, 12)),
        calls: 0, amdLegs: 0, amdUsd: 0, talkMinutes: 0, minutesUsd: 0,
        recordedMinutes: 0, recordingUsd: 0, totalUsd: 0,
      }
      row.calls++
      if (x.amd > 0) { row.amdLegs++; row.amdUsd += x.amd }
      row.talkMinutes += Math.max(0, x.c.talk_seconds ?? 0) / 60
      row.minutesUsd += x.mins
      row.recordedMinutes += Math.max(0, x.c.recording_duration ?? 0) / 60
      row.recordingUsd += x.rec
      row.totalUsd += x.total
      byUser.set(uid, row)
    }

    const charges = charged
      .slice(-CHARGE_ROWS)
      .reverse()
      .map(x => ({
        callId: x.c.id,
        at: x.c.created_at,
        userId: x.c.user_id,
        userName: x.c.user_id ? (nameById.get(x.c.user_id) ?? x.c.user_id.slice(0, 12)) : 'No user',
        phone: x.c.phone_number,
        disposition: x.c.disposition,
        talkMinutes: Math.max(0, x.c.talk_seconds ?? 0) / 60,
        // Itemised so a row says exactly WHY it cost what it did, rather than
        // presenting a total nobody can take apart.
        amdUsd: x.amd,
        minutesUsd: x.mins,
        recordingUsd: x.rec,
        totalUsd: x.total,
      }))

    return NextResponse.json({
      success: true,
      windowDays: days,
      charges,
      chargesTotal: charged.length,
      chargedUsd: charged.reduce((n, x) => n + x.total, 0),
      perUser: [...byUser.values()].sort((a, b) => b.totalUsd - a.totalUsd),
      // Two readings are the minimum for a single movement. Below that the
      // honest answer is that nothing was observed, not that nothing happened.
      covered: snaps.length >= 2,
      snapshots: snaps.length,
      watchingSince: snaps[0]?.at ?? null,
      balanceNow: snaps.length > 0 ? Number(snaps[snaps.length - 1].available_credit) : null,
      currency: 'USD',
      totals: {
        outUsd: totalOut,
        // Kept under the old key so nothing reading this breaks, but it is
        // credits observed, not deposits confirmed.
        inUsd: totalCredited,
        unverifiedCreditsUsd: totalCredited,
        creditNote:
          'Balance increases are reported as observed, not as confirmed top-ups. '
          + 'Telnyx posts corrections and occasional spurious credits that settle '
          + 'back out, so a rise here is not proof money was added. Net spend '
          + 'computed from this ledger will be wrong by the size of any glitch.',
        explainedUsd: totalExplained,
        unexplainedUsd: Math.max(0, totalOut - totalExplained),
      },
      entries,
    })
  } catch (err) {
    return apiError(err, { route: 'admin/balance-ledger' })
  }
}
