import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { requireAdmin } from '@/lib/admin'
import { stripe } from '@/lib/stripe'

const supabase = getServiceClient('admin/analytics')

// =============================================================================
// ADMIN ANALYTICS (Phase D3 — correctness pass on plan-aware revenue)
// =============================================================================
// Changes vs Phase D2:
// 1. NEVER-PAID EXCLUSION — `incomplete` / `incomplete_expired` subs (checkout
//    never completed) are excluded from ALL revenue, conversion, and WoW math.
//    Previously the WoW count and the chart's bucket-revenue loop only skipped
//    status === 'canceled', so incomplete_expired rows counted as paying
//    revenue forever and as "paid conversions" in range. Verified live: 4 such
//    rows existed in prod inflating the chart.
// 2. PER-STRIPE-SUB DEDUP — rows are deduped by stripe_subscription_id first
//    (defensive against duplicate webhook writes), THEN the current-state view
//    keeps one sub per (user_id, plan). A Manager+ owner carrying a personal
//    Pro sub now correctly registers BOTH ($75 + $35 = $110/wk). Phase D2
//    collapsed to one sub per user and silently dropped the other.
// 3. STRIPE-TRUTH PRICING — if a sub's stripe_price_id doesn't match
//    STRIPE_PRICE_ID ($35 Pro) or STRIPE_PRICE_WL_BASE ($75 Manager+), we
//    retrieve the price from Stripe (cached per price_id for the lambda's
//    lifetime) and use its real unit_amount converted to weekly dollars.
//    A stale/missing env var can no longer zero out revenue. Subs whose
//    real amount is neither $35 nor $75 are counted at their actual amount
//    and surfaced via summary.unknownPriceSubs + a console.warn.
// 4. CONSISTENT DATASETS — summary, WoW, and the time-series chart all use the
//    same deduped sub list and the same isLiveAt(sub, t) liveness rule.
//    Phase D2 mixed deduped and raw lists between sections.
//
// REMINDER (carried from D2): if the Stripe webhook ever fails to write
// `discount_coupon` onto the subscriptions row, fully-couponed subs look like
// paying subs here. The exclusion logic is correct — it just needs the field
// populated. (Verified live: the column IS being written, e.g. 'admin_free'.)
//
// NOTE: test accounts with users.exclude_from_analytics = true (currently
// whitelabel@dialerseat.com and joshuacribbffl@gmail.com) are filtered out of
// EVERYTHING here by design. Their subs will never appear on this dashboard
// while the flag is set.
// =============================================================================

const PRO_PRICE_ID = process.env.STRIPE_PRICE_ID || ''
const WL_PRICE_ID = process.env.STRIPE_PRICE_WL_BASE || ''

const PRO_WEEKLY = 35
const WL_WEEKLY = 75

const ACTIVE_STATUSES = ['active', 'trialing', 'past_due']
// Checkout never completed — these subs never paid and never count anywhere.
const NEVER_PAID_STATUSES = ['incomplete', 'incomplete_expired']
const AT_RISK_DAYS = 14

type Plan = 'pro' | 'manager_plus' | 'unknown'

interface PriceInfo {
  weeklyDollars: number
  plan: Plan
}

// Module-level cache — survives warm lambda invocations. Prices are immutable
// in Stripe (you create new price objects rather than editing), so this never
// goes stale.
const priceInfoCache = new Map<string, PriceInfo>()

function classifyByWeekly(weeklyDollars: number): Plan {
  if (weeklyDollars === WL_WEEKLY) return 'manager_plus'
  if (weeklyDollars === PRO_WEEKLY) return 'pro'
  return 'unknown'
}

async function resolvePriceInfo(priceId: string | null): Promise<PriceInfo> {
  if (!priceId) return { weeklyDollars: 0, plan: 'unknown' }

  // Env fast-path — no Stripe round trip when env vars are correct
  if (WL_PRICE_ID && priceId === WL_PRICE_ID) {
    return { weeklyDollars: WL_WEEKLY, plan: 'manager_plus' }
  }
  if (PRO_PRICE_ID && priceId === PRO_PRICE_ID) {
    return { weeklyDollars: PRO_WEEKLY, plan: 'pro' }
  }

  const cached = priceInfoCache.get(priceId)
  if (cached) return cached

  let info: PriceInfo = { weeklyDollars: 0, plan: 'unknown' }
  try {
    const price = await stripe.prices.retrieve(priceId)
    const cents = price.unit_amount ?? 0
    const interval = price.recurring?.interval
    const intervalCount = price.recurring?.interval_count || 1
    let weekly = 0
    if (interval === 'week') weekly = cents / 100 / intervalCount
    else if (interval === 'month') weekly = cents / 100 / (4.345 * intervalCount)
    else if (interval === 'year') weekly = cents / 100 / (52.18 * intervalCount)
    weekly = Number(weekly.toFixed(2))
    info = { weeklyDollars: weekly, plan: classifyByWeekly(weekly) }
    if (info.plan === 'unknown' && weekly > 0) {
      console.warn(
        `[admin/analytics] price ${priceId} resolves to $${weekly}/wk — ` +
        `not $${PRO_WEEKLY} (Pro) or $${WL_WEEKLY} (Manager+). Counting at actual amount. ` +
        `Check STRIPE_PRICE_ID / STRIPE_PRICE_WL_BASE env vars.`
      )
    }
  } catch (err) {
    console.warn(`[admin/analytics] Stripe price lookup failed for "${priceId}":`, err)
    // Leave at 0/unknown — surfaced via unknownPriceSubs in the summary
  }
  priceInfoCache.set(priceId, info)
  return info
}

type Range = '7d' | '30d' | '90d' | '1y' | 'all' | 'custom' | 'week' | 'month'

function rangeToBounds(range: Range, customStart: string | null, customEnd: string | null) {
  const now = Date.now()
  const day = 86400000
  if (range === 'custom' && customStart && customEnd) {
    return { start: new Date(customStart).getTime(), end: new Date(customEnd).getTime() }
  }
  if (range === '7d' || range === 'week') {
    const d = new Date(now)
    d.setDate(d.getDate() - d.getDay())
    d.setHours(0, 0, 0, 0)
    return { start: d.getTime(), end: now }
  }
  if (range === '30d' || range === 'month') {
    const d = new Date(now)
    const start = new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0)
    return { start: start.getTime(), end: now }
  }
  if (range === '90d')  return { start: now - 90 * day, end: now }
  if (range === '1y')   return { start: now - 365 * day, end: now }
  if (range === 'all')  return { start: 0, end: now }
  return { start: now - 30 * day, end: now }
}

function dayKey(ms: number) {
  const d = new Date(ms)
  d.setHours(0, 0, 0, 0)
  return d.toISOString().slice(0, 10)
}

// ── COUPON COVERAGE ──────────────────────────────────────────────────
// Coupons can be percent_off (always universal) or amount_off (only fully
// discounts if amount >= sub price). We cache the raw coverage and decide
// per-sub whether it's a full discount based on the sub's own weekly price.
interface CouponCoverage {
  percent_off: number | null
  amount_off: number | null  // in cents
}

async function getCouponCoverage(
  code: string,
  cache: Map<string, CouponCoverage | null>
): Promise<CouponCoverage | null> {
  if (cache.has(code)) return cache.get(code) || null
  let coverage: CouponCoverage | null = null
  try {
    try {
      const coupon = await stripe.coupons.retrieve(code)
      coverage = {
        percent_off: coupon.percent_off,
        amount_off: coupon.amount_off,
      }
    } catch {
      const promos = await stripe.promotionCodes.list({
        code,
        limit: 1,
        expand: ['data.coupon'],
      })
      if (promos.data.length > 0) {
        const c = (promos.data[0] as unknown as {
          coupon: { percent_off: number | null; amount_off: number | null }
        }).coupon
        coverage = {
          percent_off: c.percent_off,
          amount_off: c.amount_off,
        }
      }
    }
  } catch (err) {
    console.warn(`[admin/analytics] coupon lookup failed for "${code}":`, err)
    // On lookup failure, conservatively treat as fully discounted so we
    // don't count it as paying revenue
    coverage = { percent_off: 100, amount_off: null }
  }
  cache.set(code, coverage)
  return coverage
}

function isFullyDiscountedForSub(
  coverage: CouponCoverage | null,
  subWeeklyDollars: number
): boolean {
  if (!coverage) return false
  if (coverage.percent_off === 100) return true
  // amount_off is in cents; convert subWeeklyDollars to cents for comparison
  if (coverage.amount_off !== null && subWeeklyDollars > 0 &&
      coverage.amount_off >= subWeeklyDollars * 100) return true
  return false
}

export async function GET(req: NextRequest) {
  try {
    await requireAdmin()
  } catch (res) {
    return res as Response
  }

  const url = new URL(req.url)
  const range = (url.searchParams.get('range') || '30d') as Range
  const customStart = url.searchParams.get('start')
  const customEnd = url.searchParams.get('end')
  const { start, end } = rangeToBounds(range, customStart, customEnd)

  const now = Date.now()
  const day = 86400000

  // 1) Users + exclusions
  const { data: users } = await supabase
    .from('users')
    .select('clerk_id, email, first_name, last_name, created_at, last_seen_at, is_admin, exclude_from_analytics')

  const excluded = new Set<string>()
  for (const u of users || []) {
    if (u.is_admin || u.exclude_from_analytics) excluded.add(u.clerk_id)
  }

  const realUsers = (users || []).filter(u => !excluded.has(u.clerk_id))
  const totalUsers = realUsers.length
  const usersInRange = realUsers.filter(u => {
    const t = new Date(u.created_at).getTime()
    return t >= start && t <= end
  })

  // 2) Subscriptions — selecting stripe_subscription_id + updated_at for dedup
  const { data: rawSubs } = await supabase
    .from('subscriptions')
    .select(`
      user_id, status, current_period_end, cancel_at_period_end,
      created_at, canceled_at, updated_at, discount_coupon,
      stripe_subscription_id, stripe_price_id
    `)

  const visibleSubs = (rawSubs || []).filter(s => !excluded.has(s.user_id))

  // ── Dedup tier 1: one row per Stripe subscription ────────────────────
  // Defensive against duplicate webhook writes for the same Stripe sub.
  // Keeps the most recently updated row.
  const bySubId = new Map<string, any>()
  for (const s of visibleSubs) {
    const key = s.stripe_subscription_id || `${s.user_id}:${s.created_at}`
    const prev = bySubId.get(key)
    if (!prev) {
      bySubId.set(key, s)
      continue
    }
    const sTime = new Date(s.updated_at || s.created_at).getTime()
    const pTime = new Date(prev.updated_at || prev.created_at).getTime()
    if (sTime >= pTime) bySubId.set(key, s)
  }
  // allSubs: every distinct Stripe subscription (one row each) — the source
  // of truth for conversions, cancellations, WoW, and the time series.
  const allSubs = Array.from(bySubId.values())

  // ── Price resolution (batch, cached) ─────────────────────────────────
  const uniquePriceIds = new Set<string>()
  for (const s of allSubs) {
    if (s.stripe_price_id) uniquePriceIds.add(s.stripe_price_id)
  }
  const priceInfoById = new Map<string, PriceInfo>()
  await Promise.all(
    Array.from(uniquePriceIds).map(async (pid) => {
      priceInfoById.set(pid, await resolvePriceInfo(pid))
    })
  )

  const weeklyPriceFor = (s: any): number =>
    (s.stripe_price_id && priceInfoById.get(s.stripe_price_id)?.weeklyDollars) || 0

  const planFor = (s: any): Plan =>
    (s.stripe_price_id && priceInfoById.get(s.stripe_price_id)?.plan) || 'unknown'

  // ── Liveness rule (single source of truth) ───────────────────────────
  // A sub is live (i.e. generating revenue) at time t when:
  //  - it ever completed checkout (not incomplete/incomplete_expired), AND
  //  - it was created at or before t, AND
  //  - it's currently in an active status, OR it ended after t.
  const isLiveAt = (s: any, t: number): boolean => {
    if (NEVER_PAID_STATUSES.includes(s.status)) return false
    const created = new Date(s.created_at).getTime()
    if (created > t) return false
    if (ACTIVE_STATUSES.includes(s.status)) return true
    if (s.canceled_at) return new Date(s.canceled_at).getTime() > t
    return false
  }

  // ── Coupon coverage lookup (cached) ──────────────────────────────────
  const couponCache = new Map<string, CouponCoverage | null>()
  const uniqueCoupons = new Set<string>()
  for (const s of allSubs) {
    if (s.discount_coupon) uniqueCoupons.add(s.discount_coupon)
  }
  await Promise.all(
    Array.from(uniqueCoupons).map(code => getCouponCoverage(code, couponCache))
  )

  const subIsFullyDiscounted = (s: any): boolean => {
    if (!s.discount_coupon) return false
    const cov = couponCache.get(s.discount_coupon) || null
    return isFullyDiscountedForSub(cov, weeklyPriceFor(s))
  }

  // ── Dedup tier 2: current-state view, one sub per (user, plan) ───────
  // A user can legitimately hold a Pro sub AND a Manager+ sub at once
  // (Manager+ owner with a personal Pro seat) — both must count. Within a
  // plan, prefer a live sub over a dead one; tiebreak on recency.
  const byUserPlan = new Map<string, any>()
  for (const s of allSubs) {
    if (NEVER_PAID_STATUSES.includes(s.status)) continue
    const key = `${s.user_id}|${planFor(s)}`
    const prev = byUserPlan.get(key)
    if (!prev) {
      byUserPlan.set(key, s)
      continue
    }
    const sLive = ACTIVE_STATUSES.includes(s.status)
    const pLive = ACTIVE_STATUSES.includes(prev.status)
    if (sLive && !pLive) {
      byUserPlan.set(key, s)
    } else if (sLive === pLive) {
      if (new Date(s.created_at).getTime() >= new Date(prev.created_at).getTime()) {
        byUserPlan.set(key, s)
      }
    }
  }

  const latestSubs = Array.from(byUserPlan.values())
  const activeSubs = latestSubs.filter(s => ACTIVE_STATUSES.includes(s.status))
  const payingActiveSubs = activeSubs.filter(s => !subIsFullyDiscounted(s))
  const fullDiscountSubs = activeSubs.filter(s => subIsFullyDiscounted(s))
  const payingUserIds = new Set(payingActiveSubs.map(s => s.user_id))

  // Plan breakdown
  const proSubs = payingActiveSubs.filter(s => planFor(s) === 'pro')
  const wlSubs = payingActiveSubs.filter(s => planFor(s) === 'manager_plus')
  const unknownPriceSubs = payingActiveSubs.filter(s => planFor(s) === 'unknown')

  if (unknownPriceSubs.length > 0) {
    console.warn(
      `[admin/analytics] ${unknownPriceSubs.length} active subs have price IDs that resolve ` +
      `to neither $${PRO_WEEKLY} nor $${WL_WEEKLY}/wk:`,
      unknownPriceSubs.map(s => ({
        user: s.user_id,
        price: s.stripe_price_id,
        weekly: weeklyPriceFor(s),
      }))
    )
  }

  // Revenue — sum actual per-sub weekly prices
  const wrr = payingActiveSubs.reduce((sum, s) => sum + weeklyPriceFor(s), 0)
  const mrr = wrr * 4

  // 3) Range-bound metrics — over distinct Stripe subs, never-paid excluded
  const signupsInRange = usersInRange.length

  const paidConversionsInRange = allSubs.filter(s => {
    if (NEVER_PAID_STATUSES.includes(s.status)) return false
    if (subIsFullyDiscounted(s)) return false
    const t = new Date(s.created_at).getTime()
    return t >= start && t <= end
  }).length

  const cancellationsInRange = allSubs.filter(s => {
    if (subIsFullyDiscounted(s)) return false
    if (s.status !== 'canceled') return false
    if (!s.canceled_at) return false
    const t = new Date(s.canceled_at).getTime()
    return t >= start && t <= end
  }).length

  const activeAtStart = payingActiveSubs.length + cancellationsInRange
  const churnRate = activeAtStart > 0
    ? Number(((cancellationsInRange / activeAtStart) * 100).toFixed(1))
    : 0

  const netNewPaying = paidConversionsInRange - cancellationsInRange

  // 4) Week-over-week — same liveness rule as everything else
  const oneWeekAgo = now - 7 * day
  const payingSubsOneWeekAgo = allSubs.filter(s =>
    !subIsFullyDiscounted(s) && isLiveAt(s, oneWeekAgo)
  ).length

  const wowDelta = payingActiveSubs.length - payingSubsOneWeekAgo
  const wowPct = payingSubsOneWeekAgo > 0
    ? Number(((wowDelta / payingSubsOneWeekAgo) * 100).toFixed(1))
    : (payingActiveSubs.length > 0 ? 100 : 0)

  // 5) Avg lifetime — only subs that actually paid then canceled
  const churned = allSubs.filter(s =>
    !subIsFullyDiscounted(s) && s.status === 'canceled' && s.canceled_at && s.created_at
  )
  let avgLifetimeWeeks = 0
  if (churned.length > 0) {
    const sum = churned.reduce((acc, s) => {
      const ms = new Date(s.canceled_at).getTime() - new Date(s.created_at).getTime()
      return acc + ms / (7 * day)
    }, 0)
    avgLifetimeWeeks = Number((sum / churned.length).toFixed(1))
  }

  // 6) At-risk paying users
  const atRiskUsers: any[] = []
  if (payingUserIds.size > 0) {
    const lastCallByUser = new Map<string, string>()
    await Promise.all(
      Array.from(payingUserIds).map(async (uid) => {
        const { data } = await supabase
          .from('calls')
          .select('created_at')
          .eq('user_id', uid)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        if (data?.created_at) lastCallByUser.set(uid, data.created_at)
      })
    )

    const cutoff = now - AT_RISK_DAYS * day
    const userByClerkId = new Map(realUsers.map(u => [u.clerk_id, u]))

    for (const uid of payingUserIds) {
      const u = userByClerkId.get(uid)
      if (!u) continue
      const lastCall = lastCallByUser.get(uid)
      const lastCallMs = lastCall ? new Date(lastCall).getTime() : 0
      if (lastCallMs < cutoff) {
        atRiskUsers.push({
          clerk_id: u.clerk_id,
          email: u.email,
          first_name: u.first_name,
          last_name: u.last_name,
          last_call_at: lastCall || null,
          days_silent: lastCall
            ? Math.floor((now - lastCallMs) / day)
            : null,
        })
      }
    }
    atRiskUsers.sort((a, b) => (b.days_silent ?? Infinity) - (a.days_silent ?? Infinity))
  }

  // 7) Hot prospects
  const hotProspects: any[] = []
  const sevenDaysAgo = now - 7 * day
  const sevenDaysAgoIso = new Date(sevenDaysAgo).toISOString()
  const fullDiscountUserIds = new Set(fullDiscountSubs.map(s => s.user_id))
  const nonPayingUsers = realUsers.filter(u =>
    !payingUserIds.has(u.clerk_id) && !fullDiscountUserIds.has(u.clerk_id)
  )

  if (nonPayingUsers.length > 0) {
    const nonPayingIds = nonPayingUsers.map(u => u.clerk_id)
    const { data: recentCalls } = await supabase
      .from('calls')
      .select('user_id, created_at')
      .in('user_id', nonPayingIds)
      .gte('created_at', sevenDaysAgoIso)

    const callsByUser = new Map<string, { count: number; lastCall: string }>()
    for (const c of recentCalls || []) {
      const existing = callsByUser.get(c.user_id)
      if (!existing) {
        callsByUser.set(c.user_id, { count: 1, lastCall: c.created_at })
      } else {
        existing.count++
        if (c.created_at > existing.lastCall) existing.lastCall = c.created_at
      }
    }

    for (const u of nonPayingUsers) {
      const stats = callsByUser.get(u.clerk_id)
      if (stats && stats.count > 0) {
        hotProspects.push({
          clerk_id: u.clerk_id,
          email: u.email,
          first_name: u.first_name,
          last_name: u.last_name,
          calls_7d: stats.count,
          last_call_at: stats.lastCall,
        })
      }
    }
    hotProspects.sort((a, b) => b.calls_7d - a.calls_7d)
  }

  // 8) Daily series — per-sub revenue, same liveness rule as WoW/summary
  const totalDays = Math.max(1, Math.ceil((end - start) / day))
  const useWeekly = totalDays > 120
  const bucketSize = useWeekly ? 7 * day : day

  const buckets: { date: string; signups: number; revenue: number; calls: number }[] = []
  let cursor = start
  while (cursor <= end) {
    buckets.push({ date: dayKey(cursor), signups: 0, revenue: 0, calls: 0 })
    cursor += bucketSize
  }

  for (const u of usersInRange) {
    const t = new Date(u.created_at).getTime()
    const idx = Math.floor((t - start) / bucketSize)
    if (idx >= 0 && idx < buckets.length) buckets[idx].signups++
  }

  for (let i = 0; i < buckets.length; i++) {
    const bucketEnd = start + (i + 1) * bucketSize
    let bucketRevenue = 0
    for (const s of allSubs) {
      if (subIsFullyDiscounted(s)) continue
      if (!isLiveAt(s, bucketEnd)) continue
      bucketRevenue += weeklyPriceFor(s)
    }
    buckets[i].revenue = bucketRevenue
  }

  // 9) Activity heatmap
  const heatmapStart = now - 30 * day
  const heatmapStartIso = new Date(heatmapStart).toISOString()
  const { data: heatCallsRaw } = await supabase
    .from('calls')
    .select('user_id, created_at')
    .gte('created_at', heatmapStartIso)
    .limit(50000)

  const heatCalls = (heatCallsRaw || []).filter(c => !excluded.has(c.user_id))

  const heatmap: { date: string; calls: number }[] = []
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now - i * day)
    d.setHours(0, 0, 0, 0)
    heatmap.push({ date: d.toISOString().slice(0, 10), calls: 0 })
  }
  for (const c of heatCalls) {
    const key = c.created_at.slice(0, 10)
    const bucket = heatmap.find(h => h.date === key)
    if (bucket) bucket.calls++
  }

  // 10) Tenure cohort — per paying sub
  const thirtyDayCutoff = now - 30 * day
  let newPayingUsers = 0
  let establishedPayingUsers = 0
  for (const s of payingActiveSubs) {
    const created = new Date(s.created_at).getTime()
    if (created >= thirtyDayCutoff) newPayingUsers++
    else establishedPayingUsers++
  }

  return NextResponse.json({
    success: true,
    range,
    bucketSize: useWeekly ? 'week' : 'day',
    excludedUserCount: excluded.size,
    summary: {
      totalUsers,
      payingActiveSubs: payingActiveSubs.length,
      // Per-plan breakdown
      proSubs: proSubs.length,
      wlSubs: wlSubs.length,
      unknownPriceSubs: unknownPriceSubs.length,
      // Coupon-only subs (excluded from paying)
      couponSubsCount: fullDiscountSubs.length,
      // Revenue
      wrr,
      mrr,
      proWrr: proSubs.reduce((s, sub) => s + weeklyPriceFor(sub), 0),
      wlWrr: wlSubs.reduce((s, sub) => s + weeklyPriceFor(sub), 0),
      // Existing
      signupsInRange,
      paidConversionsInRange,
      cancellationsInRange,
      netNewPaying,
      churnRate,
      avgLifetimeWeeks,
      wowDelta,
      wowPct,
      newPayingUsers,
      establishedPayingUsers,
    },
    atRiskUsers,
    hotProspects,
    series: buckets,
    heatmap,
  })
}