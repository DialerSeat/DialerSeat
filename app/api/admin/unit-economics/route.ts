import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { requireAdmin } from '@/lib/admin'
import { apiError } from '@/lib/apiError'
import {
  computeCost, SEAT_PRICE_WEEKLY_USD, MANAGER_PLUS_WEEKLY_USD, COST_ASSUMPTIONS_NOTE,
  COST_PER_MINUTE_USD, COST_PER_AMD_LEG_USD,
} from '@/lib/telephonyCosts'

const supabase = getServiceClient('admin/unit-economics')

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// =============================================================================
// /api/admin/unit-economics — what each customer costs against what they pay
// =============================================================================
// The margin is currently known on paper. This makes it observable, and the
// reason that matters is not curiosity: the dominant cost is answering-machine
// detection, charged per LEG whether or not anyone picks up. A customer who
// dials heavily and connects rarely can cost more than their seat while
// looking like a great user by every other metric on the platform.
//
// NOTHING HERE IS ESTIMATED. Where a figure cannot be computed it is returned
// as null and rendered as a dash. A fabricated margin is worse than none — it
// would get quoted in a pricing decision months later.
// =============================================================================

const WINDOW_DAYS = 7

export async function GET(req: NextRequest) {
  try {
    await requireAdmin()
  } catch (res) {
    return res as Response
  }

  try {
    const days = Math.min(90, Math.max(1, parseInt(
      new URL(req.url).searchParams.get('days') || String(WINDOW_DAYS), 10
    ) || WINDOW_DAYS))
    const sinceIso = new Date(Date.now() - days * 24 * 60 * 60_000).toISOString()

    const [usersRes, callsRes, subsRes, seatsRes] = await Promise.all([
      supabase
        .from('users')
        .select('clerk_id, email, first_name, last_name, exclude_from_analytics, created_at'),
      supabase
        .from('calls')
        .select('user_id, duration, amd_result, recording_duration')
        .gte('created_at', sinceIso)
        .limit(200000),
      supabase
        .from('subscriptions')
        .select('user_id, status, plan, cancel_at_period_end'),
      // ── SEATS ARE REVENUE TOO, AT WHAT THEY ACTUALLY BILLED ────────────
      // An agent on an owner-funded seat holds no subscription, so this page
      // scored them as earning nothing while still charging them for every
      // minute they dialed — a guaranteed loss on a seat somebody is paying
      // for. The owner's row was missing the same money, so both halves of one
      // transaction were wrong in opposite directions.
      //
      // charged_cents, NOT the list price. Six seats are funded here and ten
      // charges have been raised against them, and the total actually
      // collected is $15.00 — the rest are comped to zero. Counting six seats
      // at $35 would invent $195 a week of revenue nobody paid, which is a
      // worse error than the one being fixed.
      supabase
        .from('team_seat_charges')
        .select('owner_id, agent_id, charged_cents, amount_cents, created_at')
        .eq('status', 'paid')
        .gte('created_at', sinceIso),
    ])

    if (usersRes.error) return apiError(usersRes.error, { route: 'admin/unit-economics' })

    // Sum activity per user in one pass.
    const activity = new Map<string, { calls: number; talkSeconds: number; amdLegs: number; recordedSeconds: number }>()
    for (const c of callsRes.data || []) {
      if (!c.user_id) continue
      const a = activity.get(c.user_id) || { calls: 0, talkSeconds: 0, amdLegs: 0, recordedSeconds: 0 }
      a.calls++
      a.talkSeconds += typeof c.duration === 'number' ? Math.max(0, c.duration) : 0
      // AMD is billed per leg it ran against, which is every call that came
      // back with a result — including the ones nobody answered.
      if (c.amd_result) a.amdLegs++
      a.recordedSeconds += typeof c.recording_duration === 'number' ? Math.max(0, c.recording_duration) : 0
      activity.set(c.user_id, a)
    }

    const subByUser = new Map<string, { status: string; plan: string | null }>()
    for (const s of subsRes.data || []) {
      // Prefer an active row when a user has several historical ones.
      const existing = subByUser.get(s.user_id)
      if (!existing || s.status === 'active') {
        subByUser.set(s.user_id, { status: s.status, plan: s.plan })
      }
    }

    const weeks = days / 7

    // What each owner actually paid for seats inside this window, and which
    // agents those seats covered. Both come from the charge rows, so the
    // revenue and the attribution can never disagree.
    const seatRevenueByOwner = new Map<string, number>()
    const coveredBy = new Map<string, string>()
    let seatRevenueUnknown = 0
    for (const c of (seatsRes.data || []) as Array<{
      owner_id: string | null; agent_id: string | null
      charged_cents: number | null; amount_cents: number | null
    }>) {
      if (c.agent_id && c.owner_id) coveredBy.set(c.agent_id, c.owner_id)
      if (!c.owner_id) continue
      if (typeof c.charged_cents !== 'number') {
        // Raised before charged_cents was recorded. Counted as a gap rather
        // than folded in at list price — a total mixing measured and assumed
        // money is worse than one that admits what it does not know.
        seatRevenueUnknown += 1
        continue
      }
      seatRevenueByOwner.set(
        c.owner_id,
        (seatRevenueByOwner.get(c.owner_id) ?? 0) + c.charged_cents / 100
      )
    }

    const rows = (usersRes.data || []).map(u => {
      const a = activity.get(u.clerk_id)
      const sub = subByUser.get(u.clerk_id)
      const isPaying = sub?.status === 'active'
      // A trial earns nothing yet, which is true and worth separating from
      // "not paying": one is a cost with a decision coming, the other is a
      // cost with nothing behind it.
      const isTrialing = sub?.status === 'trialing'
      const weeklyRate = sub?.plan === 'wl' ? MANAGER_PLUS_WEEKLY_USD : SEAT_PRICE_WEEKLY_USD
      const seatRevenue = seatRevenueByOwner.get(u.clerk_id) ?? 0
      const seatPayer = coveredBy.get(u.clerk_id) ?? null

      const cost = a
        ? computeCost({ talkSeconds: a.talkSeconds, amdLegs: a.amdLegs, recordedSeconds: a.recordedSeconds })
        : null

      // Revenue over the SAME window the cost covers, so the two are
      // comparable. Non-paying accounts earn nothing — stated as 0, not null,
      // because that is a known fact rather than missing data.
      const ownRevenue = isPaying ? weeklyRate * weeks : 0
      const revenueUsd = ownRevenue + seatRevenue

      return {
        clerkId: u.clerk_id,
        email: u.email,
        name: `${u.first_name || ''} ${u.last_name || ''}`.trim() || null,
        internal: !!u.exclude_from_analytics,
        paying: isPaying || seatRevenue > 0,
        trialing: isTrialing,
        plan: sub?.plan ?? null,
        subStatus: sub?.status ?? null,
        // Split so the page can show where the money came from. An owner with
        // no personal plan but five funded seats is not a free rider.
        ownRevenueUsd: ownRevenue,
        seatRevenueUsd: seatRevenue,
        // The agent's cost belongs to somebody. Naming the payer stops a
        // covered seat reading as an unexplained loss.
        seatPaidBy: seatPayer,
        calls: a?.calls ?? 0,
        talkMinutes: a ? a.talkSeconds / 60 : 0,
        amdLegs: a?.amdLegs ?? 0,
        costUsd: cost?.totalUsd ?? 0,
        costBreakdown: cost
          ? { minutes: cost.minutesUsd, amd: cost.amdUsd, recording: cost.recordingUsd }
          : null,
        revenueUsd,
        marginUsd: revenueUsd - (cost?.totalUsd ?? 0),
        // Only meaningful with revenue to divide by.
        marginPct: revenueUsd > 0
          ? ((revenueUsd - (cost?.totalUsd ?? 0)) / revenueUsd) * 100
          : null,
      }
    })
    // Trials belong on this page even before they cost anything: the whole
    // question a trial poses is what it will cost.
    .filter(r => r.calls > 0 || r.paying || r.trialing)
    .sort((a, b) => a.marginUsd - b.marginUsd)

    const totals = rows.reduce((acc, r) => ({
      costUsd: acc.costUsd + r.costUsd,
      revenueUsd: acc.revenueUsd + r.revenueUsd,
      calls: acc.calls + r.calls,
      amdLegs: acc.amdLegs + r.amdLegs,
      talkMinutes: acc.talkMinutes + r.talkMinutes,
    }), { costUsd: 0, revenueUsd: 0, calls: 0, amdLegs: 0, talkMinutes: 0 })

    return NextResponse.json({
      success: true,
      windowDays: days,
      generatedAt: new Date().toISOString(),
      rates: {
        perMinuteUsd: COST_PER_MINUTE_USD,
        perAmdLegUsd: COST_PER_AMD_LEG_USD,
        seatWeeklyUsd: SEAT_PRICE_WEEKLY_USD,
        managerPlusWeeklyUsd: MANAGER_PLUS_WEEKLY_USD,
        note: COST_ASSUMPTIONS_NOTE,
        // Seat charges in this window with no recorded amount. Named so the
        // totals below can be read as measured rather than complete.
        seatChargesUnpriced: seatRevenueUnknown,
      },
      totals: {
        ...totals,
        marginUsd: totals.revenueUsd - totals.costUsd,
        marginPct: totals.revenueUsd > 0
          ? ((totals.revenueUsd - totals.costUsd) / totals.revenueUsd) * 100
          : null,
      },
      rows,
    })
  } catch (err) {
    return apiError(err, { route: 'admin/unit-economics' })
  }
}
