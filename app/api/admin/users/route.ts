import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/admin'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  try {
    await requireAdmin()
  } catch (res) {
    return res as Response
  }

  // 1) Pull all users
  const { data: users, error } = await supabase
    .from('users')
    .select('clerk_id, email, first_name, last_name, stripe_customer_id, created_at, is_admin')
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }

  if (!users || users.length === 0) {
    return NextResponse.json({ success: true, users: [] })
  }

  const userIds = users.map(u => u.clerk_id)

  // 2) Subscriptions per user
  const { data: subs } = await supabase
    .from('subscriptions')
    .select('user_id, status, current_period_end, cancel_at_period_end, discount_coupon')
    .in('user_id', userIds)

  const subByUser = new Map<string, any>()
  for (const s of subs || []) {
    const existing = subByUser.get(s.user_id)
    const isLive = ['active', 'trialing', 'past_due'].includes(s.status)
    if (!existing || isLive) subByUser.set(s.user_id, s)
  }

  // 3) Lead counts per user — use exact count to bypass 1000-row limit
  const leadCounts = new Map<string, number>()
  await Promise.all(
    userIds.map(async (uid) => {
      const { count } = await supabase
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', uid)
      leadCounts.set(uid, count || 0)
    })
  )

  // 4) Last activity per user — most recent of (last call, last lead added, last campaign update)
  const lastActivity = new Map<string, string>()
  await Promise.all(
    userIds.map(async (uid) => {
      const [callRes, leadRes, campRes] = await Promise.all([
        supabase.from('calls').select('created_at').eq('user_id', uid)
          .order('created_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('leads').select('created_at').eq('user_id', uid)
          .order('created_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('campaigns').select('updated_at, created_at').eq('user_id', uid)
          .order('updated_at', { ascending: false, nullsFirst: false }).limit(1).maybeSingle(),
      ])

      const candidates: string[] = []
      if (callRes.data?.created_at) candidates.push(callRes.data.created_at)
      if (leadRes.data?.created_at) candidates.push(leadRes.data.created_at)
      if (campRes.data?.updated_at) candidates.push(campRes.data.updated_at)
      else if (campRes.data?.created_at) candidates.push(campRes.data.created_at)

      if (candidates.length > 0) {
        const latest = candidates.sort().pop()!
        lastActivity.set(uid, latest)
      }
    })
  )

  // 5) Team member counts — placeholder until team feature ships
  const teamMemberCounts = new Map<string, number>()

  const rows = users.map(u => {
    const sub = subByUser.get(u.clerk_id)
    const isActive = sub && ['active', 'trialing', 'past_due'].includes(sub.status)
    return {
      clerk_id: u.clerk_id,
      email: u.email,
      first_name: u.first_name,
      last_name: u.last_name,
      created_at: u.created_at,
      is_admin: !!u.is_admin,
      lead_count: leadCounts.get(u.clerk_id) || 0,
      last_active_at: lastActivity.get(u.clerk_id) || null,
      team_member_count: teamMemberCounts.get(u.clerk_id) || 0,
      subscription: sub
        ? {
            status: sub.status,
            current_period_end: sub.current_period_end,
            cancel_at_period_end: sub.cancel_at_period_end,
            discount_coupon: sub.discount_coupon,
          }
        : null,
      is_active_subscription: !!isActive,
    }
  })

  return NextResponse.json({ success: true, users: rows })
}