import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { apiError } from '@/lib/apiError'
import { requireAdmin } from '@/lib/admin'
import { isSubscriptionTrulyActive } from '@/lib/subscriptionStatus'
import { isEntitledStatus, isTrialing } from '@/lib/entitlement'

const supabase = getServiceClient('admin/users')

export async function GET(req: NextRequest) {
  try {
    await requireAdmin()
  } catch (res) {
    return res as Response
  }

  const { data: users, error } = await supabase
    .from('users')
    .select('clerk_id, email, username, first_name, last_name, stripe_customer_id, created_at, is_admin, exclude_from_analytics')
    .order('created_at', { ascending: false })

  if (error) {
    return apiError(error, { route: 'admin/users' })
  }

  if (!users || users.length === 0) {
    return NextResponse.json({ success: true, users: [] })
  }

  const userIds = users.map(u => u.clerk_id)

  const { data: subs } = await supabase
    .from('subscriptions')
    .select('user_id, status, current_period_end, cancel_at_period_end, discount_coupon, created_at, plan')
    .in('user_id', userIds)

  // Always use each user's most recent subscription row as the current one.
  // A user can accumulate multiple rows over time (resubscribes, retries,
  // etc.) — only the latest reflects their real, current state. Picking
  // whichever row happened to be "live" (the old behavior) let a stale
  // historical row outrank the actual current one.
  const subByUser = new Map<string, any>()
  for (const s of subs || []) {
    const existing = subByUser.get(s.user_id)
    if (!existing || new Date(s.created_at).getTime() > new Date(existing.created_at).getTime()) {
      subByUser.set(s.user_id, s)
    }
  }

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

  // Recordings per user, for the Data Explorer column beside LEADS.
  // A recording only exists once recording_url is populated by the
  // call.recording.saved webhook, so this counts real playable recordings
  // rather than calls that merely had recording enabled.
  const recordingCounts = new Map<string, number>()
  await Promise.all(
    userIds.map(async (uid) => {
      const { count } = await supabase
        .from('calls')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', uid)
        .not('recording_url', 'is', null)
      recordingCounts.set(uid, count || 0)
    })
  )

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

  // ── HOW THEY GOT IN, AND WHO IS PAYING ──────────────────────────────────
  // The SUBSCRIPTION column answers "do they have their own plan", which is
  // not the same question as "can this person dial" — an agent on an
  // owner-paid seat has no subscription of their own and was showing as a
  // flat INACTIVE, indistinguishable from someone who never paid and cannot
  // work. That is the single most misread row in the admin table.
  //
  // So the seat itself comes back: which team, the code they redeemed, who
  // is on the hook for it, and whether the owner has since suspended it.
  const teamMemberCounts = new Map<string, number>()
  const seatsByUser = new Map<string, any[]>()
  {
    const { data: memberRows } = await supabase
      .from('team_members')
      .select('user_id, team_id, status, joined_via_code, billing_override, seat_suspended_at, seat_suspend_reason, created_at, accepted_at')
      .in('user_id', userIds)
      .in('status', ['active', 'pending'])

    const rows = memberRows || []
    const teamIds = Array.from(new Set(rows.map((m: any) => m.team_id).filter(Boolean)))
    const codes = Array.from(
      new Set(rows.map((m: any) => m.joined_via_code).filter((c: any): c is string => !!c))
    )

    const teamNameById = new Map<string, string>()
    if (teamIds.length > 0) {
      const { data: teamRows } = await supabase
        .from('teams')
        .select('id, name')
        .in('id', teamIds)
      for (const t of teamRows || []) teamNameById.set(t.id, t.name)
    }

    // joined_via_code stores the code TEXT, not a foreign key, so the payer
    // has to be looked up rather than embedded.
    const codeMeta = new Map<string, { payer: string | null; codeType: string | null }>()
    if (codes.length > 0) {
      const { data: codeRows } = await supabase
        .from('team_codes')
        .select('code, payer, code_type')
        .in('code', codes)
      for (const c of codeRows || []) {
        codeMeta.set(c.code, { payer: c.payer ?? null, codeType: c.code_type ?? null })
      }
    }

    for (const m of rows) {
      teamMemberCounts.set(m.user_id, (teamMemberCounts.get(m.user_id) || 0) + 1)
      const meta = m.joined_via_code ? codeMeta.get(m.joined_via_code) : undefined
      // An explicit override on the membership beats the code it came from —
      // that is the whole point of an override.
      const payer: 'owner' | 'agent' | null =
        m.billing_override === 'owner' || m.billing_override === 'agent'
          ? m.billing_override
          : meta?.payer === 'agent'
          ? 'agent'
          : meta?.payer === 'owner'
          ? 'owner'
          : null
      const list = seatsByUser.get(m.user_id) || []
      list.push({
        team_id: m.team_id,
        team_name: teamNameById.get(m.team_id) || 'Unknown team',
        status: m.status,
        joined_via_code: m.joined_via_code || null,
        code_type: meta?.codeType ?? null,
        payer,
        suspended: !!m.seat_suspended_at,
        suspend_reason: m.seat_suspend_reason || null,
        joined_at: m.accepted_at || m.created_at,
      })
      seatsByUser.set(m.user_id, list)
    }
  }

  const rows = users.map(u => {
    const sub = subByUser.get(u.clerk_id)
    // Active means: currently billing AND not on its way out.
    // - status must be the literal Stripe 'active' (not trialing/past_due/etc.)
    // - cancel_at_period_end must not be true (a user who's already told
    //   Stripe to cancel is not an active, recurring customer, even though
    //   Stripe leaves status='active' until the current period ends)
    const isActive = !!sub && isSubscriptionTrulyActive(sub)
    // exclude_from_analytics is already set true on known demo/test
    // accounts — reusing the same flag Logs already uses to keep these out of
    // admin-facing counts, rather than hardcoding specific emails. This
    // ONLY overrides what this row DISPLAYS as active — `sub` itself and
    // everything in the `subscription` object below is untouched, so the
    // real subscription stays exactly as it is.
    // ── BILLING AND ACCESS ARE DIFFERENT QUESTIONS ───────────────────────
    // isSubscriptionTrulyActive answers "is this money arriving", and it is
    // deliberately narrow: analytics divides revenue by it, so widening it to
    // include trials would book income nobody has paid. Left alone.
    //
    // The overview asks something else — can this person use the product —
    // and by that measure a trial IS active. Showing a live trial as INACTIVE
    // next to a green ONLINE dot, on somebody dialing right now, is simply
    // wrong. Answered with the same ENTITLED_STATUSES the proxy gates on, so
    // the badge and the door agree.
    const entitled = !!sub && isEntitledStatus(sub.status) && !sub.cancel_at_period_end
    const trialing = !!sub && isTrialing(sub.status)
    const displayAsActive = isActive && !u.exclude_from_analytics
    const displayAsEntitled = entitled && !u.exclude_from_analytics
    return {
      clerk_id: u.clerk_id,
      email: u.email,
      username: u.username,
      first_name: u.first_name,
      last_name: u.last_name,
      created_at: u.created_at,
      is_admin: !!u.is_admin,
      lead_count: leadCounts.get(u.clerk_id) || 0,
      recording_count: recordingCounts.get(u.clerk_id) || 0,
      last_active_at: lastActivity.get(u.clerk_id) || null,
      team_member_count: teamMemberCounts.get(u.clerk_id) || 0,
      seats: seatsByUser.get(u.clerk_id) || [],
      // Access without a subscription of their own: somebody else is paying.
      // Kept as its own flag so the table can say that plainly instead of
      // leaving an working agent labelled INACTIVE.
      owner_funded_seat: (seatsByUser.get(u.clerk_id) || []).some(
        (sm: any) => sm.payer === 'owner' && !sm.suspended
      ),
      subscription: sub
        ? {
            status: sub.status,
            current_period_end: sub.current_period_end,
            cancel_at_period_end: sub.cancel_at_period_end,
            discount_coupon: sub.discount_coupon,
            plan: sub.plan ?? null,
            subscribed_since: sub.created_at,
          }
        : null,
      is_active_subscription: displayAsActive,
      // Has access right now — includes a live trial. The pill reads this.
      has_access: displayAsEntitled,
      is_trialing: trialing,
    }
  })

  return NextResponse.json({ success: true, users: rows })
}