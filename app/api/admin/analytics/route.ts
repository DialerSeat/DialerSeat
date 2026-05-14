import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/admin'
import { stripe } from '@/lib/stripe'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const WEEKLY_PRICE = 35
const WEEKS_PER_MONTH = 4.33
const ACTIVE_STATUSES = ['active', 'trialing', 'past_due']
const AT_RISK_DAYS = 14

type Range = '7d' | '30d' | '90d' | '1y' | 'all' | 'custom'

function rangeToBounds(range: Range, customStart: string | null, customEnd: string | null) {
  const now = Date.now()
  const day = 86400000
  if (range === 'custom' && customStart && customEnd) {
    return { start: new Date(customStart).getTime(), end: new Date(customEnd).getTime() }
  }
  if (range === '7d')   return { start: now - 7 * day, end: now }
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

// ── 100%-off coupon classifier ─────────────────────────────────
// Looks up a coupon code in Stripe and returns true if it nullifies
// the entire $35 price. Results are cached per request lifecycle in
// the passed-in Map so we hit Stripe at most once per distinct code.
//
// Fail-conservative: if Stripe is unreachable, we treat the coupon as
// 100%-off (i.e., exclude the user from monetary metrics). Better to
// under-count revenue than over-count during a Stripe outage.
async function isFullDiscountCoupon(
  code: string,
  cache: Map<string, boolean>
): Promise<boolean> {
  const cached = cache.get(code)
  if (cached !== undefined) return cached

  try {
    // Try as a coupon ID first (admin-created codes like 'owner_free')
    try {
      const coupon = await stripe.coupons.retrieve(code)
      const isFull =
        coupon.percent_off === 100 ||
        (coupon.amount_off !== null && coupon.amount_off >= WEEKLY_PRICE * 100)
      cache.set(code, isFull)
      return isFull
    } catch {
      // Not a coupon ID — try as a promotion code (user-facing)
    }

    const promos = await stripe.promotionCodes.list({
      code,
      limit: 1,
      expand: ['data.coupon'],
    })
    if (promos.data.length > 0) {
      // The Dahlia SDK no longer types `coupon` directly on PromotionCode,
      // but it's present on the response when expanded. Cast through unknown
      // to get a typed view of the coupon fields we need.
      const promo = promos.data[0] as unknown as {
        coupon: { percent_off: number | null; amount_off: number | null }
      }
      const c = promo.coupon
      const isFull =
        c.percent_off === 100 ||
        (c.amount_off !== null && c.amount_off >= WEEKLY_PRICE * 100)
      cache.set(code, isFull)
      return isFull
    }

    // Unknown code — treat as not full discount (partial / legitimate revenue).
    cache.set(code, false)
    return false
  } catch (err) {
    console.warn(`[admin/analytics] coupon lookup failed for "${code}":`, err)
    // Fail-conservative: assume full discount on lookup failure.
    cache.set(code, true)
    return true
  }
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

  // 1) All users
  const { data: users } = await supabase
    .from('users')
    .select('clerk_id, email, first_name, last_name, created_at, last_seen_at')

  const totalUsers = users?.length || 0
  const usersInRange = (users || []).filter(u => {
    const t = new Date(u.created_at).getTime()
    return t >= start && t <= end
  })

  // 2) Subscriptions
  const { data: subs } = await supabase
    .from('subscriptions')
    .select(`
      user_id, status, current_period_end, cancel_at_period_end,
      created_at, canceled_at, discount_coupon
    `)

  const subByUser = new Map<string, any>()
  for (const s of subs || []) {
    const existing = subByUser.get(s.user_id)
    const isLive = ACTIVE_STATUSES.includes(s.status)
    if (!existing || isLive) subByUser.set(s.user_id, s)
  }

  // ── Coupon classification ──────────────────────────────────────
  // For every sub with a discount_coupon, classify it as either:
  //   - 100%-off (exclude from monetary metrics: seats, WRR, MRR, cohorts)
  //   - partial discount (legitimate revenue — keep in monetary metrics)
  // Activity metrics (calls, signups, etc.) still count both types.
  const couponCache = new Map<string, boolean>()
  const uniqueCoupons = new Set<string>()
  for (const s of subs || []) {
    if (s.discount_coupon) uniqueCoupons.add(s.discount_coupon)
  }
  await Promise.all(
    Array.from(uniqueCoupons).map(code => isFullDiscountCoupon(code, couponCache))
  )
  const isFullDiscount = (code: string | null | undefined) =>
    !!code && couponCache.get(code) === true

  const latestSubs = Array.from(subByUser.values())
  const activeSubs = latestSubs.filter(s => ACTIVE_STATUSES.includes(s.status))
  // "Paying" = active sub + NOT on a 100%-off coupon.
  // Partial-discount coupons (e.g., 20% off) count as paying.
  const payingActiveSubs = activeSubs.filter(s => !isFullDiscount(s.discount_coupon))
  const fullDiscountSubs = activeSubs.filter(s => isFullDiscount(s.discount_coupon))
  const payingUserIds = new Set(payingActiveSubs.map(s => s.user_id))

  const wrr = payingActiveSubs.length * WEEKLY_PRICE
  const mrr = Math.round(wrr * WEEKS_PER_MONTH)

  // 3) Range-bound metrics
  const signupsInRange = usersInRange.length

  // Paid conversions = new subs in range that AREN'T 100%-off coupon'd.
  // A partial-discount promo signup is still a real conversion.
  const paidConversionsInRange = (subs || []).filter(s => {
    if (isFullDiscount(s.discount_coupon)) return false
    const t = new Date(s.created_at).getTime()
    return t >= start && t <= end
  }).length

  // Cancellations only count for users who were ever actually paying.
  // A coupon'd test account "cancelling" isn't a real churn event.
  const cancellationsInRange = (subs || []).filter(s => {
    if (isFullDiscount(s.discount_coupon)) return false
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

  // 4) Week-over-week paying users delta — growth velocity
  const oneWeekAgo = now - 7 * day
  const payingUsersOneWeekAgo = (subs || []).filter(s => {
    if (isFullDiscount(s.discount_coupon)) return false
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

  // 5) Avg lifetime — only counts users who were ever actually paying.
  const churned = (subs || []).filter(s =>
    !isFullDiscount(s.discount_coupon) && s.status === 'canceled' && s.canceled_at && s.created_at
  )
  let avgLifetimeWeeks = 0
  if (churned.length > 0) {
    const sum = churned.reduce((acc, s) => {
      const ms = new Date(s.canceled_at).getTime() - new Date(s.created_at).getTime()
      return acc + ms / (7 * day)
    }, 0)
    avgLifetimeWeeks = Number((sum / churned.length).toFixed(1))
  }

  // 6) At-risk paying users — paying but no calls in 14+ days.
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
    const userByClerkId = new Map((users || []).map(u => [u.clerk_id, u]))

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

  // 7) Hot prospects — non-paying users with calls in last 7 days.
  // Note: users on 100%-off coupons are technically non-paying, but
  // we exclude them from hot prospects too — they're test accounts
  // or comped users, not conversion opportunities.
  const hotProspects: any[] = []
  const sevenDaysAgo = now - 7 * day
  const sevenDaysAgoIso = new Date(sevenDaysAgo).toISOString()
  const fullDiscountUserIds = new Set(fullDiscountSubs.map(s => s.user_id))
  const nonPayingUsers = (users || []).filter(u =>
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

  // 8) Daily series — signups + cumulative paying revenue
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
    let activeAtBucket = 0
    for (const s of subs || []) {
      if (isFullDiscount(s.discount_coupon)) continue
      const created = new Date(s.created_at).getTime()
      if (created > bucketEnd) continue
      if (s.status === 'canceled' && s.canceled_at) {
        const cancelled = new Date(s.canceled_at).getTime()
        if (cancelled <= bucketEnd) continue
      }
      activeAtBucket++
    }
    buckets[i].revenue = activeAtBucket * WEEKLY_PRICE
  }

  // 9) Activity heatmap — last 30 days, total calls per day platform-wide.
  // NOTE: Activity metrics (calls, signups) deliberately include
  // coupon'd accounts — only monetary metrics exclude them.
  const heatmapStart = now - 30 * day
  const heatmapStartIso = new Date(heatmapStart).toISOString()
  const { data: heatCalls } = await supabase
    .from('calls')
    .select('created_at')
    .gte('created_at', heatmapStartIso)
    .limit(50000)

  const heatmap: { date: string; calls: number }[] = []
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now - i * day)
    d.setHours(0, 0, 0, 0)
    heatmap.push({ date: d.toISOString().slice(0, 10), calls: 0 })
  }
  for (const c of heatCalls || []) {
    const key = c.created_at.slice(0, 10)
    const bucket = heatmap.find(h => h.date === key)
    if (bucket) bucket.calls++
  }

  // 10) Tenure cohort — split paying users into "new" (≤30d sub age) vs "established" (>30d).
  // 100%-off coupon users are excluded entirely (already filtered out of payingActiveSubs above).
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
    summary: {
      totalUsers,
      payingActiveSubs: payingActiveSubs.length,
      couponSubsCount: fullDiscountSubs.length,
      wrr,
      mrr,
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