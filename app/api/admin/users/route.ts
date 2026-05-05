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

  // 1) Pull all users — newest first
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

  // 2) Pull all active-ish subscriptions for these users in one query
  const { data: subs } = await supabase
    .from('subscriptions')
    .select('user_id, status, current_period_end, cancel_at_period_end')
    .in('user_id', userIds)

  const subByUser = new Map<string, any>()
  for (const s of subs || []) {
    // If a user has multiple sub rows, prefer the live one
    const existing = subByUser.get(s.user_id)
    const isLive = ['active', 'trialing', 'past_due'].includes(s.status)
    if (!existing || isLive) subByUser.set(s.user_id, s)
  }

  // 3) Lead counts per user
  const leadCounts = new Map<string, number>()
  const { data: leadRows } = await supabase
    .from('leads')
    .select('user_id')
    .in('user_id', userIds)
  for (const r of leadRows || []) {
    leadCounts.set(r.user_id, (leadCounts.get(r.user_id) || 0) + 1)
  }

  // 4) Campaign counts per user
  const campaignCounts = new Map<string, number>()
  const { data: campRows } = await supabase
    .from('campaigns')
    .select('user_id')
    .in('user_id', userIds)
  for (const r of campRows || []) {
    campaignCounts.set(r.user_id, (campaignCounts.get(r.user_id) || 0) + 1)
  }

  // 5) Team member counts — placeholder. Returns 0 until the team feature ships.
  // When `team_members` table exists, swap the Map below for a real query.
  const teamMemberCounts = new Map<string, number>()

  // Compose rows
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
      campaign_count: campaignCounts.get(u.clerk_id) || 0,
      team_member_count: teamMemberCounts.get(u.clerk_id) || 0,
      subscription: sub
        ? {
            status: sub.status,
            current_period_end: sub.current_period_end,
            cancel_at_period_end: sub.cancel_at_period_end,
          }
        : null,
      is_active_subscription: !!isActive,
    }
  })

  return NextResponse.json({ success: true, users: rows })
}