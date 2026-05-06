import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/admin'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const WEEKLY_PRICE = 35
const WEEKS_PER_MONTH = 4.33
const ACTIVE_STATUSES = ['active', 'trialing', 'past_due']

type Range = '30d' | '90d' | '1y' | 'all' | 'custom'

function rangeToBounds(range: Range, customStart: string | null, customEnd: string | null) {
  const now = Date.now()
  const day = 86400000
  if (range === 'custom' && customStart && customEnd) {
    return { start: new Date(customStart).getTime(), end: new Date(customEnd).getTime() }
  }
  if (range === '90d') return { start: now - 90 * day, end: now }
  if (range === '1y')  return { start: now - 365 * day, end: now }
  if (range === 'all') return { start: 0, end: now }
  return { start: now - 30 * day, end: now } // default 30d
}

function dayKey(ms: number) {
  const d = new Date(ms)
  d.setHours(0, 0, 0, 0)
  return d.toISOString().slice(0, 10)
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

  const startIso = new Date(start).toISOString()
  const endIso = new Date(end).toISOString()
  const now = Date.now()
  const day = 86400000

  // 1) All users
  const { data: users } = await supabase
    .from('users')
    .select('clerk_id, created_at')

  const totalUsers = users?.length || 0
  const usersInRange = (users || []).filter(u => {
    const t = new Date(u.created_at).getTime()
    return t >= start && t <= end
  })

  // 2) All subscriptions
  const { data: subs } = await supabase
    .from('subscriptions')
    .select(`
      user_id, status, current_period_end, cancel_at_period_end,
      created_at, canceled_at, discount_coupon
    `)

  // Latest sub per user
  const subByUser = new Map<string, any>()
  for (const s of subs || []) {
    const existing = subByUser.get(s.user_id)
    const isLive = ACTIVE_STATUSES.includes(s.status)
    if (!existing || isLive) subByUser.set(s.user_id, s)
  }

  const latestSubs = Array.from(subByUser.values())

  // 3) Active subs — split by paying vs coupon-discounted
  const activeSubs = latestSubs.filter(s => ACTIVE_STATUSES.includes(s.status))
  const payingActiveSubs = activeSubs.filter(s => !s.discount_coupon)
  const couponSubs = activeSubs.filter(s => !!s.discount_coupon)

  const wrr = payingActiveSubs.length * WEEKLY_PRICE
  const mrr = Math.round(wrr * WEEKS_PER_MONTH)

  // 4) Time-bound signup metrics
  const signupsInRange = usersInRange.length

  // Subs created in range that are still alive (paying)
  const paidConversionsInRange = (subs || []).filter(s => {
    if (s.discount_coupon) return false
    const t = new Date(s.created_at).getTime()
    return t >= start && t <= end
  }).length

  // Cancellations in range (only paying ones)
  const cancellationsInRange = (subs || []).filter(s => {
    if (s.discount_coupon) return false
    if (s.status !== 'canceled') return false
    if (!s.canceled_at) return false
    const t = new Date(s.canceled_at).getTime()
    return t >= start && t <= end
  }).length

  // Churn rate calculation
  const activeAtStart = payingActiveSubs.length + cancellationsInRange
  const churnRate = activeAtStart > 0
    ? Number(((cancellationsInRange / activeAtStart) * 100).toFixed(1))
    : 0

  // Net new paying users in range
  const netNewPaying = paidConversionsInRange - cancellationsInRange

  // 5) Funnel: signed up → started subscription → still active (paying only)
  const everSubscribed = (subs || [])
    .filter(s => !s.discount_coupon)
    .map(s => s.user_id)
  const everSubscribedSet = new Set(everSubscribed)
  const stillActiveUserIds = new Set(payingActiveSubs.map(s => s.user_id))

  const funnel = {
    signedUp: totalUsers,
    everSubscribed: everSubscribedSet.size,
    stillActive: stillActiveUserIds.size,
  }

  // 6) Avg customer lifetime in weeks (paying churned users)
  const churned = (subs || []).filter(s =>
    !s.discount_coupon && s.status === 'canceled' && s.canceled_at && s.created_at
  )
  let avgLifetimeWeeks = 0
  if (churned.length > 0) {
    const sum = churned.reduce((acc, s) => {
      const ms = new Date(s.canceled_at).getTime() - new Date(s.created_at).getTime()
      return acc + ms / (7 * day)
    }, 0)
    avgLifetimeWeeks = Number((sum / churned.length).toFixed(1))
  }

  // 7) Conversion rate — % of signups that ever became paying
  const conversionRate = totalUsers > 0
    ? Number(((everSubscribedSet.size / totalUsers) * 100).toFixed(1))
    : 0

  // 8) Active ratio — % of signups currently paying
  const activeRatio = totalUsers > 0
    ? Number(((stillActiveUserIds.size / totalUsers) * 100).toFixed(1))
    : 0

  // 9) Daily series — signups + cumulative paying revenue
  const totalDays = Math.max(1, Math.ceil((end - start) / day))
  // Cap daily granularity at ~120 buckets — switch to weekly for longer ranges
  const useWeekly = totalDays > 120
  const bucketSize = useWeekly ? 7 * day : day

  const buckets: { date: string; signups: number; revenue: number }[] = []
  let cursor = start
  while (cursor <= end) {
    buckets.push({ date: dayKey(cursor), signups: 0, revenue: 0 })
    cursor += bucketSize
  }

  // Bucket signups
  for (const u of usersInRange) {
    const t = new Date(u.created_at).getTime()
    const idx = Math.floor((t - start) / bucketSize)
    if (idx >= 0 && idx < buckets.length) buckets[idx].signups++
  }

  // Compute cumulative paying-active subs at each bucket boundary, multiply by $35
  // For each bucket, count paying subs that were created before bucket-end AND not canceled before bucket-end
  for (let i = 0; i < buckets.length; i++) {
    const bucketEnd = start + (i + 1) * bucketSize
    let activeAtBucket = 0
    for (const s of subs || []) {
      if (s.discount_coupon) continue
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

  // 10) Status breakdown for pie (all-time, paying users only)
  const statusBreakdown: Record<string, number> = {
    active: 0,
    trialing: 0,
    past_due: 0,
    canceled: 0,
    incomplete: 0,
    incomplete_expired: 0,
    unpaid: 0,
    none: 0,
    coupon: 0,
  }

  for (const u of users || []) {
    const sub = subByUser.get(u.clerk_id)
    if (!sub) {
      statusBreakdown.none++
    } else if (sub.discount_coupon) {
      statusBreakdown.coupon++
    } else {
      const k = sub.status as string
      if (k in statusBreakdown) statusBreakdown[k]++
      else statusBreakdown[k] = 1
    }
  }

  return NextResponse.json({
    success: true,
    range,
    bucketSize: useWeekly ? 'week' : 'day',
    summary: {
      totalUsers,
      payingActiveSubs: payingActiveSubs.length,
      couponSubsCount: couponSubs.length,
      wrr,
      mrr,
      signupsInRange,
      paidConversionsInRange,
      cancellationsInRange,
      netNewPaying,
      churnRate,
      avgLifetimeWeeks,
      conversionRate,
      activeRatio,
    },
    funnel,
    statusBreakdown,
    series: buckets,
  })
}