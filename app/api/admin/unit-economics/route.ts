import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { getTelnyxBalance } from '@/lib/telnyxBalance'
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
// reason that matters is not curiosity: the cost that scales is answering-
// machine detection, charged per LEG whether or not anyone picks up. A
// customer who dials heavily and connects rarely can cost more than their seat
// while looking like a great user by every other metric on the platform.
//
// WHAT THE NUMBERS ACTUALLY SAY RIGHT NOW. Over the last seven days: $0.20 of
// minutes, $2.10 of detection, $0.10 of recording, and $2.53 of number rental
// across the 11 numbers actually held.
//
// Detection is already the largest line, and it is the one that grows. Rental
// is FIXED and detection is PER DIAL, so the two cross near 1,265 dials a week
// at this pool size; last week was 1,051, which is why they currently sit so
// close together. One team dialing properly leaves rental behind for good.
//
// Everything above was being misreported before: minutes came from `duration`
// and so billed the ringing, detection counted verdicts rather than legs,
// rental was not on the page at all, and when it was added it counted ten
// released numbers we had already given back. Total shown was $0.78 against
// $4.93 real. The individual fixes are commented where they live.
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

    const [usersRes, callsRes, subsRes, seatsRes, numbersRes] = await Promise.all([
      supabase
        .from('users')
        .select('clerk_id, email, first_name, last_name, exclude_from_analytics, created_at'),
      supabase
        .from('calls')
        .select('user_id, talk_seconds, amd_requested, amd_result, recording_duration')
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
      // ── NUMBER RENTAL IS A REAL BILL AND WAS NOT ON THIS PAGE ──────────
      // The assumptions note used to end "does not include number rental",
      // which is honest but leaves a standing monthly charge invisible on the
      // one page that exists to show what the platform costs. It is read from
      // the pool rather than assumed, so it tracks every number bought.
      supabase
        .from('phone_numbers')
        .select('monthly_cost_cents')
        // A released number is not ours any more: lib/numberPool.ts sets this
        // status only after telnyxReleaseNumber succeeds, and the pool sync
        // sets it for rows Telnyx says we do not own. Counting them billed 10
        // numbers we gave back, $10 of a $21 figure. Every other pool query in
        // the codebase carries this same exclusion.
        .neq('status', 'released')
    ])

    if (usersRes.error) return apiError(usersRes.error, { route: 'admin/unit-economics' })

    // Sum activity per user in one pass.
    const activity = new Map<string, { calls: number; talkSeconds: number; amdLegs: number; recordedSeconds: number }>()
    for (const c of callsRes.data || []) {
      if (!c.user_id) continue
      const a = activity.get(c.user_id) || { calls: 0, talkSeconds: 0, amdLegs: 0, recordedSeconds: 0 }
      a.calls++
      // ── MINUTES ARE BILLED FROM ANSWER, NOT FROM DIAL ──────────────────
      // This added `duration`, which is wall clock from the dial and includes
      // every second of ringing. Telnyx charges from answer, so a call that
      // rang 25 seconds and talked for 5 was costed at 30. Measured over seven
      // days: $0.386 counted against $0.201 actually billable, 93% overstated.
      //
      // talk_seconds IS the billed span, written once at hangup as
      // answered_at -> now. No fallback to duration where it is missing: over
      // seven days 5 answered calls of 309 lacked it, together worth 0.01 of a
      // minute, and no unanswered call has ever carried talk time. Deriving
      // those would add rounding noise to buy nothing.
      a.talkSeconds += typeof c.talk_seconds === 'number'
        ? Math.max(0, c.talk_seconds)
        : 0
      // ── AMD IS BILLED PER LEG IT RAN AGAINST, NOT PER VERDICT ──────────
      // This counted calls that came BACK with a result. AMD is charged for
      // running, and a call torn down before detection finishes has still been
      // billed for it. Seven days: 183 counted against 1,051 actually billed,
      // so 868 legs were free on this page and $1.74 was missing from a
      // week's worth of traffic.
      //
      // It matters more than the arithmetic suggests. The note at the top of
      // lib/telephonyCosts.ts says detection dominates the bill at volume and
      // does not care about answer rate, which is exactly why undercounting it
      // by 5.7x made the cheapest-looking line the largest real one.
      //
      // The amd_result arm is not redundant. The amd_requested flag only
      // starts on 2026-08-11, and 216 older calls carry a verdict without it.
      // This window reaches back 90 days, far enough to include them.
      if (c.amd_requested || c.amd_result) a.amdLegs++
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
    .filter(r => r.calls > 0 || r.paying)
    .sort((a, b) => a.marginUsd - b.marginUsd)

    const totals = rows.reduce((acc, r) => ({
      costUsd: acc.costUsd + r.costUsd,
      revenueUsd: acc.revenueUsd + r.revenueUsd,
      calls: acc.calls + r.calls,
      amdLegs: acc.amdLegs + r.amdLegs,
      talkMinutes: acc.talkMinutes + r.talkMinutes,
    }), { costUsd: 0, revenueUsd: 0, calls: 0, amdLegs: 0, talkMinutes: 0 })

    // ── THE POOL BILLS WHETHER ANYONE DIALS OR NOT ────────────────────────
    // Rental is a standing monthly charge against a pool every customer
    // shares, so it is deliberately NOT pushed down into the per-customer
    // rows. Splitting $21 across users pro-rata by call volume would be an
    // invention, and the rule at the top of this file is that nothing here is
    // estimated. It sits at platform level, where it is a fact.
    //
    // Divided by 30.44, the average month, rather than 30. Over a 90 day
    // window the difference is a day and a half of rental, and a figure that
    // drifts with the length of the month is the kind of thing that gets
    // noticed and mistrusted long before it gets debugged.
    const numbersMonthlyUsd = ((numbersRes.data || []) as Array<{ monthly_cost_cents: number | null }>)
      .reduce((sum, n) => sum + (typeof n.monthly_cost_cents === 'number' ? n.monthly_cost_cents : 0), 0) / 100
    const numberRentalUsd = numbersMonthlyUsd * (days / 30.44)
    const platformCostUsd = totals.costUsd + numberRentalUsd

    // ── HOW LONG THE MONEY LASTS ──────────────────────────────────────────
    // The one number that makes the rest of this page urgent rather than
    // interesting. Both halves are measured: burn is the platform cost above,
    // over a real window of real calls, and the balance comes from Telnyx.
    //
    // Everything here goes null the moment either half is missing or the floor
    // was idle. A runway of "infinite" because nobody dialed last week is a
    // worse answer than no answer, and so is one extrapolated from a balance
    // the carrier never confirmed.
    //
    // It is a straight-line projection of last week's spend and says so on the
    // page. Monday is a team that has not dialed yet, so the honest reading of
    // this figure that day is an upper bound, not a forecast.
    const balance = await getTelnyxBalance()
    const dailyBurnUsd = days > 0 ? platformCostUsd / days : 0
    const runwayDays = balance.availableCredit !== null && dailyBurnUsd > 0
      ? balance.availableCredit / dailyBurnUsd
      : null

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
      // What is left at the carrier, and how long it lasts at the burn this
      // window measured. Null throughout when either half is unknown.
      carrier: {
        availableCredit: balance.availableCredit,
        balance: balance.balance,
        pending: balance.pending,
        currency: balance.currency,
        authoritative: balance.authoritative,
        error: balance.error,
        dailyBurnUsd,
        runwayDays,
      },
      // Costs nobody's row carries. Kept apart from `totals` so the per-
      // customer view stays strictly measured, and reported alongside it so
      // the platform margin is not quietly better than the real one.
      platform: {
        /** Numbers still held, which is what is billed. Released ones are not. */
        numbers: (numbersRes.data || []).length,
        numbersMonthlyUsd,
        numberRentalUsd,
        costUsd: platformCostUsd,
        marginUsd: totals.revenueUsd - platformCostUsd,
        marginPct: totals.revenueUsd > 0
          ? ((totals.revenueUsd - platformCostUsd) / totals.revenueUsd) * 100
          : null,
      },
      rows,
    })
  } catch (err) {
    return apiError(err, { route: 'admin/unit-economics' })
  }
}
