import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/admin'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const WEEKLY_PRICE = 35
const WEEKS_PER_MONTH = 4.33

const ACTIVE_STATUSES = ['active', 'trialing', 'past_due']

export async function GET() {
  try {
    await requireAdmin()
  } catch (res) {
    return res as Response
  }

  const now = Date.now()
  const day = 86400000
  const sevenDaysAgo = new Date(now - 7 * day).toISOString()
  const thirtyDaysAgo = new Date(now - 30 * day).toISOString()
  const sixtyDaysAgo = new Date(now - 60 * day).toISOString()

  // 1) All users (we only need created_at)
  const { data: users } = await supabase
    .from('users')
    .select('clerk_id, created_at')

  const totalUsers = users?.length || 0

  const signupsLast7 = (users || []).filter(
    u => u.created_at >= sevenDaysAgo
  ).length
  const signupsLast30 = (users || []).filter(
    u => u.created_at >= thirtyDaysAgo
  ).length

  // 2) All subscriptions
  const { data: subs } = await supabase
    .from('subscriptions')
    .select('user_id, status, current_period_end, cancel_at_period_end, created_at, canceled_at')

  // Pick the latest sub per user (in case of duplicates from old test rows)
  const subByUser = new Map<string, any>()
  for (const s of subs || []) {
    const existing = subByUser.get(s.user_id)
    const isLive = ACTIVE_STATUSES.includes(s.status)
    if (!existing || isLive) subByUser.set(s.user_id, s)
  }

  const activeSubs = Array.from(subByUser.values()).filter(
    s => ACTIVE_STATUSES.includes(s.status)
  ).length

  const wrr = activeSubs * WEEKLY_PRICE
  const mrr = Math.round(wrr * WEEKS_PER_MONTH)

  // 3) Status breakdown — count distinct users in each status bucket
  const statusBreakdown: Record<string, number> = {
    active: 0,
    trialing: 0,
    past_due: 0,
    canceled: 0,
    incomplete: 0,
    incomplete_expired: 0,
    unpaid: 0,
    none: 0,
  }
  for (const u of users || []) {
    const sub = subByUser.get(u.clerk_id)
    if (!sub) {
      statusBreakdown.none++
    } else {
      const key = sub.status as string
      if (key in statusBreakdown) statusBreakdown[key]++
      else statusBreakdown[key] = 1
    }
  }

  // 4) Churn rate — cancellations in last 30d ÷ active subs at start of window
  // We'll approximate: subs that are now canceled and were canceled in the last 30d
  const cancelledLast30 = (subs || []).filter(s => {
    if (s.status !== 'canceled') return false
    if (!s.canceled_at) return false
    return s.canceled_at >= thirtyDaysAgo
  }).length

  // Active subs 30 days ago = currently active + canceled-in-window
  const activeAtStart = activeSubs + cancelledLast30
  const churnRate = activeAtStart > 0
    ? Number(((cancelledLast30 / activeAtStart) * 100).toFixed(1))
    : 0

  // 5) Signups-over-time — last 30 days, daily buckets
  const dailySignups: { date: string; count: number }[] = []
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now - i * day)
    d.setHours(0, 0, 0, 0)
    const dateKey = d.toISOString().slice(0, 10)
    dailySignups.push({ date: dateKey, count: 0 })
  }

  for (const u of users || []) {
    const created = new Date(u.created_at)
    if (created.getTime() < now - 30 * day) continue
    const dateKey = created.toISOString().slice(0, 10)
    const bucket = dailySignups.find(b => b.date === dateKey)
    if (bucket) bucket.count++
  }

  return NextResponse.json({
    success: true,
    summary: {
      totalUsers,
      activeSubs,
      mrr,
      wrr,
      signupsLast7,
      signupsLast30,
      cancelledLast30,
      churnRate,
    },
    statusBreakdown,
    dailySignups,
  })
}