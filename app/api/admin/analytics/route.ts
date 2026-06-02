import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/admin'
import { stripe } from '@/lib/stripe'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// =============================================================================
// ADMIN ANALYTICS (Phase D2 — plan-aware)
// =============================================================================
// Changes vs prior version:
// - Reads stripe_price_id and matches against STRIPE_PRICE_ID (Pro $35)
//   and STRIPE_PRICE_WL_BASE (Manager+ $75) to determine per-sub revenue
// - WRR/MRR/bucket revenue compute per-sub instead of count * fixed
// - Summary returns proSubs, wlSubs counts in addition to total
// - Coupon detection compares amount_off against the sub's actual weekly
//   price (so a $35 amount-off coupon no longer "fully discounts" a $75
//   Manager+ sub)
//
// PENDING: Your Stripe webhook isn't writing `discount_coupon` onto the
// `subscriptions` row. Until that's fixed, MANAGERTEST-coupon subs look
// like real paying subs to this route. The exclusion logic here is
// correct — it just has nothing to work with until the webhook populates
// the field.
// =============================================================================

const PRO_PRICE_ID = process.env.STRIPE_PRICE_ID || ''
const WL_PRICE_ID = process.env.STRIPE_PRICE_WL_BASE || ''

const PRO_WEEKLY = 35
const WL_WEEKLY = 75

const ACTIVE_STATUSES = ['active', 'trialing', 'past_due']
const AT_RISK_DAYS = 14

type Plan = 'pro' | 'manager_plus' | 'unknown'

function planFor(sub: { stripe_price_id?: string | null }): Plan {
  if (WL_PRICE_ID && sub.stripe_price_id === WL_PRICE_ID) return 'manager_plus'
  if (PRO_PRICE_ID && sub.stripe_price_id === PRO_PRICE_ID) return 'pro'
  return 'unknown'
}

function weeklyPriceFor(sub: { stripe_price_id?: string | null }): number {
  const p = planFor(sub)
  if (p === 'manager_plus') return WL_WEEKLY
  if (p === 'pro') return PRO_WEEKLY
  return 0  // unknown price — not counted in revenue
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

  // 2) Subscriptions — now selecting stripe_price_id for per-plan pricing
  const { data: rawSubs } = await supabase
    .from('subscriptions')
    .select(`
      user_id, status, current_period_end, cancel_at_period_end,
      created_at, canceled_at, discount_coupon, stripe_price_id
    `)

  const subs = (rawSubs || []).filter(s => !excluded.has(s.user_id))

  const subByUser = new Map<string, any>()
  for (const s of subs) {
    const existing = subByUser.get(s.user_id)
    const isLive = ACTIVE_STATUSES.includes(s.status)
    if (!existing || isLive) subByUser.set(s.user_id, s)
  }

  // Coupon coverage lookup (cached)
  const couponCache = new Map<string, CouponCoverage | null>()
  const uniqueCoupons = new Set<string>()
  for (const s of subs) {
    if (s.discount_coupon) uniqueCoupons.add(s.discount_coupon)
  }
  await Promise.all(
    Array.from(uniqueCoupons).map(code => getCouponCoverage(code, couponCache))
  )

  // Per-sub full-discount check
  const subIsFullyDiscounted = (s: any): boolean => {
    if (!s.discount_coupon) return false
    const cov = couponCache.get(s.discount_coupon) || null
    return isFullyDiscountedForSub(cov, weeklyPriceFor(s))
  }

  const latestSubs = Array.from(subByUser.values())
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
      `[admin/analytics] ${unknownPriceSubs.length} active subs have unrecognized price_id ` +
      `(not STRIPE_PRICE_ID or STRIPE_PRICE_WL_BASE):`,
      unknownPriceSubs.map(s => ({ user: s.user_id, price: s.stripe_price_id }))
    )
  }

  // Revenue — sum actual per-sub weekly prices
  const wrr = payingActiveSubs.reduce((sum, s) => sum + weeklyPriceFor(s), 0)
  const mrr = wrr * 4

  // 3) Range-bound metrics
  const signupsInRange = usersInRange.length

  const paidConversionsInRange = subs.filter(s => {
    if (subIsFullyDiscounted(s)) return false
    const t = new Date(s.created_at).getTime()
    return t >= start && t <= end
  }).length

  const cancellationsInRange = subs.filter(s => {
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

  // 4) Week-over-week
  const oneWeekAgo = now - 7 * day
  const payingUsersOneWeekAgo = subs.filter(s => {
    if (subIsFullyDiscounted(s)) return false
    const created = new Date(s.created_at).getTime()
    if (created > oneWeekAgo) return false
    if (s.status === 'canceled' && s.canceled_at) {
      const cancelled = new Date(s.canceled_at).getTime()
      if (cancelled <= oneWeekAgo) return false
    }
    return true
  }).length

  const wowDelta = payingActiveSubs.length - payingUsersOneWeekAgo
  const wowPct = payingUsersOneWeekAgo > 0
    ? Number(((wowDelta / payingUsersOneWeekAgo) * 100).toFixed(1))
    : (payingActiveSubs.length > 0 ? 100 : 0)

  // 5) Avg lifetime
  const churned = subs.filter(s =>
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

  // 8) Daily series — per-sub revenue
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
    for (const s of subs) {
      if (subIsFullyDiscounted(s)) continue
      const created = new Date(s.created_at).getTime()
      if (created > bucketEnd) continue
      if (s.status === 'canceled' && s.canceled_at) {
        const cancelled = new Date(s.canceled_at).getTime()
        if (cancelled <= bucketEnd) continue
      }
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

  // 10) Tenure cohort
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
      // NEW — per-plan breakdown
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