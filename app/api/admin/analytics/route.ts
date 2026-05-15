import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/admin'
import { stripe } from '@/lib/stripe'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const WEEKLY_PRICE = 35
const ACTIVE_STATUSES = ['active', 'trialing', 'past_due']
const AT_RISK_DAYS = 14

// '7d'/'30d' accepted for backward compat with existing admin page tabs, but
// they now resolve to calendar week / calendar month (same as agent analytics).
// 'week' and 'month' are the new canonical names — rename the admin page tab
// labels at your convenience.
type Range = '7d' | '30d' | '90d' | '1y' | 'all' | 'custom' | 'week' | 'month'

function rangeToBounds(range: Range, customStart: string | null, customEnd: string | null) {
  const now = Date.now()
  const day = 86400000
  if (range === 'custom' && customStart && customEnd) {
    return { start: new Date(customStart).getTime(), end: new Date(customEnd).getTime() }
  }
  if (range === '7d' || range === 'week') {
    // Current CALENDAR week — Sunday 00:00 of this week → now.
    // Resets every Sunday at midnight. getDay() returns 0=Sun, 6=Sat.
    const d = new Date(now)
    d.setDate(d.getDate() - d.getDay())
    d.setHours(0, 0, 0, 0)
    return { start: d.getTime(), end: now }
  }
  if (range === '30d' || range === 'month') {
    // Current CALENDAR month — 1st 00:00 of this month → now.
    // Resets on the 1st of every month.
    const d = new Date(now)
    const start = new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0)
    return { start: start.getTime(), end: now }
  }
  if (range === '90d')  return { start: now - 90 * day, end: now }
  if (range === '1y')   return { start: now - 365 * day, end: now }
  if (range === 'all')  return { start: 0, end: now }
  return { start: now - 30 * day, end: now }  // safety default
}

function dayKey(ms: number) {
  const d = new Date(ms)
  d.setHours(0, 0, 0, 0)
  return d.toISOString().slice(0, 10)
}

async function isFullDiscountCoupon(
  code: string,
  cache: Map<string, boolean>
): Promise<boolean> {
  const cached = cache.get(code)
  if (cached !== undefined) return cached

  try {
    try {
      const coupon = await stripe.coupons.retrieve(code)
      const isFull =
        coupon.percent_off === 100 ||
        (coupon.amount_off !== null && coupon.amount_off >= WEEKLY_PRICE * 100)
      cache.set(code, isFull)
      return isFull
    } catch {
      // Not a coupon ID — try as a promotion code
    }

    const promos = await stripe.promotionCodes.list({
      code,
      limit: 1,
      expand: ['data.coupon'],
    })
    if (promos.data.length > 0) {
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

    cache.set(code, false)
    return false
  } catch (err) {
    console.warn(`[admin/analytics] coupon lookup failed for "${code}":`, err)
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

  // 1) All users — and a Set of excluded clerk_ids (admins + dev accounts).
  // Excluded users contribute to nothing: not signups, not seats, not WRR,
  // not series, not heatmap, not hot prospects, not at-risk, not cohort.
  // is_admin and exclude_from_analytics are both honored, either flips you off.
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

  // 2) Subscriptions — drop anything belonging to an excluded user
  const { data: rawSubs } = await supabase
    .from('subscriptions')
    .select(`
      user_id, status, current_period_end, cancel_at_period_end,
      created_at, canceled_at, discount_coupon
    `)

  const subs = (rawSubs || []).filter(s => !excluded.has(s.user_id))

  const subByUser = new Map<string, any>()
  for (const s of subs) {
    const existing = subByUser.get(s.user_id)
    const isLive = ACTIVE_STATUSES.includes(s.status)
    if (!existing || isLive) subByUser.set(s.user_id, s)
  }

  const couponCache = new Map<string, boolean>()
  const uniqueCoupons = new Set<string>()
  for (const s of subs) {
    if (s.discount_coupon) uniqueCoupons.add(s.discount_coupon)
  }
  await Promise.all(
    Array.from(uniqueCoupons).map(code => isFullDiscountCoupon(code, couponCache))
  )
  const isFullDiscount = (code: string | null | undefined) =>
    !!code && couponCache.get(code) === true

  const latestSubs = Array.from(subByUser.values())
  const activeSubs = latestSubs.filter(s => ACTIVE_STATUSES.includes(s.status))
  const payingActiveSubs = activeSubs.filter(s => !isFullDiscount(s.discount_coupon))
  const fullDiscountSubs = activeSubs.filter(s => isFullDiscount(s.discount_coupon))
  const payingUserIds = new Set(payingActiveSubs.map(s => s.user_id))

  const wrr = payingActiveSubs.length * WEEKLY_PRICE
  const mrr = wrr * 4

  // 3) Range-bound metrics
  const signupsInRange = usersInRange.length

  const paidConversionsInRange = subs.filter(s => {
    if (isFullDiscount(s.discount_coupon)) return false
    const t = new Date(s.created_at).getTime()
    return t >= start && t <= end
  }).length

  const cancellationsInRange = subs.filter(s => {
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

  // 4) Week-over-week paying users delta — kept as rolling 7-day for the
  // comparison math regardless of range tab. This is "this week vs last week"
  // and not a calendar-aligned concept.
  const oneWeekAgo = now - 7 * day
  const payingUsersOneWeekAgo = subs.filter(s => {
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

  // 5) Avg lifetime
  const churned = subs.filter(s =>
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

  // 8) Daily series
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
    for (const s of subs) {
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

  // 9) Activity heatmap — exclude calls from excluded users
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