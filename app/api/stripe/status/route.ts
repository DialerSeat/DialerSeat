import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getServiceClient } from '@/lib/supabase'
import { getAccessTier } from '@/lib/subscription'
import { apiError } from '@/lib/apiError'

const supabase = getServiceClient('stripe/status')

const PRO_PRICE_ID = process.env.STRIPE_PRICE_ID || ''
const WL_PRICE_ID = process.env.STRIPE_PRICE_WL_BASE || ''

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: sub } = await supabase
      .from('subscriptions')
      .select('status, current_period_end, trial_end, cancel_at_period_end, stripe_price_id')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const { data: userRow } = await supabase
      .from('users')
      .select('wl_subscription_id, wl_onboarding_status')
      .eq('clerk_id', userId)
      .maybeSingle()

    const wlActive =
      !!userRow?.wl_subscription_id &&
      userRow?.wl_onboarding_status === 'complete'

    // Distinct from wlActive: this is true the moment someone has PAID for
    // Manager+, even before they've finished tenant setup. Needed so
    // /billing can send a freshly-paid, not-yet-onboarded Manager+
    // subscriber to /onboarding/whitelabel instead of either creating a
    // duplicate subscription or dumping them on /dashboard for a brand
    // that doesn't exist yet.
    const wlOnboardingPending =
      !!userRow?.wl_subscription_id &&
      userRow?.wl_onboarding_status !== 'complete'

    const subStatusActive = !!sub && sub.status === 'active'  // strict: only active
    const subIsProPrice = !!PRO_PRICE_ID && sub?.stripe_price_id === PRO_PRICE_ID
    const proActive = subStatusActive && subIsProPrice

    let plan: 'pro' | 'manager_plus' | 'both' | null = null
    if (wlActive && proActive) plan = 'both'
    else if (wlActive) plan = 'manager_plus'
    else if (proActive) plan = 'pro'

    let weeklyPrice = 0
    if (wlActive) weeklyPrice += 75
    if (proActive) weeklyPrice += 35

    const tier = await getAccessTier(userId)

    // ── WAITING, AND TOLD SO ─────────────────────────────────────────────
    // Someone admitted on an owner-paid invite that needs approval is inside
    // DialerSeat but cannot dial anything yet. Without a word anywhere, that
    // is indistinguishable from the product being broken — they were told a
    // seat was covered, they got in, and nothing works.
    //
    // Returned from here because the layout already calls this on every page,
    // so the notice follows them wherever they land rather than only appearing
    // on Teams.
    let awaitingApproval: Array<{ teamId: string; teamName: string }> = []
    try {
      const { data: pendingRows } = await supabase
        .from('team_members')
        .select('team_id')
        .eq('user_id', userId)
        .eq('status', 'pending')
        .is('seat_suspended_at', null)
        .limit(10)

      const teamIds = Array.from(new Set((pendingRows || []).map((r: any) => r.team_id)))
      if (teamIds.length > 0) {
        const { data: teamRows } = await supabase
          .from('teams')
          .select('id, name')
          .in('id', teamIds)
        awaitingApproval = (teamRows || []).map((t: any) => ({
          teamId: t.id,
          teamName: t.name,
        }))
      }
    } catch (e) {
      // A notice failing must never take down the access check it rides on.
      console.error('[stripe/status] awaiting-approval lookup failed', e)
    }

    // ── THE SEAT STOPPED, THE ACCOUNT DID NOT ────────────────────────────
    // When an owner suspends a seat or their card stops covering it, the agent
    // loses team access — but they keep their account, their leads, their
    // recordings and their dispositions. Nothing is deleted, because none of
    // it was the owner's to take: the seat paid for access, not for the work.
    //
    // What they need told is narrow and factual: the seat is no longer being
    // paid for, and a subscription of their own restores dialing. Not an
    // error, not a lecture about billing — the same unsubscribed wording
    // anyone else sees, because that is now exactly their situation.
    let seatLapsed: Array<{ teamId: string; teamName: string; reason: string }> = []
    try {
      const { data: suspendedRows } = await supabase
        .from('team_members')
        .select('team_id, seat_suspended_at, seat_suspend_reason')
        .eq('user_id', userId)
        .eq('status', 'active')
        .not('seat_suspended_at', 'is', null)
        .limit(10)

      const rows = suspendedRows || []
      if (rows.length > 0) {
        const { data: teamRows } = await supabase
          .from('teams')
          .select('id, name')
          .in('id', rows.map((r: any) => r.team_id))
        const nameById: Record<string, string> = {}
        for (const t of teamRows || []) nameById[t.id] = t.name
        seatLapsed = rows.map((r: any) => ({
          teamId: r.team_id,
          teamName: nameById[r.team_id] || 'your team',
          reason: r.seat_suspend_reason || 'owner_stopped_paying',
        }))
      }
    } catch (e) {
      console.error('[stripe/status] seat-lapsed lookup failed', e)
    }

    if (!sub) {
      return NextResponse.json({
        hasSubscription: wlActive || wlOnboardingPending,
        isActive: wlActive || wlOnboardingPending,
        status: (wlActive || wlOnboardingPending) ? 'active' : null,
        currentPeriodEnd: null,
        trialEnd: null,
        cancelAtPeriodEnd: false,
        tier,
        plan,
        wlActive,
        wlOnboardingPending,
        weeklyPrice,
        awaitingApproval,
        seatLapsed,
      })
    }

    const isActive = subStatusActive || wlActive || wlOnboardingPending

    return NextResponse.json({
      hasSubscription: true,
      isActive,
      status: sub.status,
      currentPeriodEnd: sub.current_period_end,
      trialEnd: sub.trial_end,
      cancelAtPeriodEnd: sub.cancel_at_period_end,
      tier,
      plan,
      wlActive,
      wlOnboardingPending,
      weeklyPrice,
      awaitingApproval,
      seatLapsed,
    })
  } catch (err: any) {
    console.error('status error:', err)
    return apiError(err, { route: 'stripe/status' })
  }
}