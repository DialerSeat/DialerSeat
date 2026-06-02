import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'
import { getAccessTier } from '@/lib/subscription'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// =============================================================================
// /api/stripe/status — subscription status for the current user
// =============================================================================
// Existing fields preserved exactly:
//   hasSubscription, isActive, status, currentPeriodEnd, trialEnd,
//   cancelAtPeriodEnd, tier
//
// NEW fields (Phase D2 Manager+ awareness):
//   plan          'pro' | 'manager_plus' | 'both' | null
//   wlActive      boolean — has an active wl_subscription_id + completed onboarding
//   weeklyPrice   number — 35 / 75 / 110 / 0 depending on plan
//
// Manager+ subs live on users.wl_subscription_id, NOT in the subscriptions
// table (well, they might be there too, but the source of truth for "is
// this user a Manager+ owner" is users.wl_subscription_id +
// wl_onboarding_status === 'complete').
// =============================================================================

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Personal Pro subscription (existing path)
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('status, current_period_end, trial_end, cancel_at_period_end')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    // Manager+ detection — read from users row directly
    const { data: userRow } = await supabase
      .from('users')
      .select('wl_subscription_id, wl_onboarding_status')
      .eq('clerk_id', userId)
      .maybeSingle()

    const wlActive =
      !!userRow?.wl_subscription_id &&
      userRow?.wl_onboarding_status === 'complete'

    const proActive = !!sub && ['trialing', 'active', 'past_due'].includes(sub.status)

    let plan: 'pro' | 'manager_plus' | 'both' | null = null
    if (wlActive && proActive) plan = 'both'
    else if (wlActive) plan = 'manager_plus'
    else if (proActive) plan = 'pro'

    // Weekly price totals across active plans. A user with both pays both
    // — we don't bundle. If you decide later to bundle, change this here.
    let weeklyPrice = 0
    if (wlActive) weeklyPrice += 75
    if (proActive) weeklyPrice += 35

    const tier = await getAccessTier(userId)

    if (!sub) {
      return NextResponse.json({
        hasSubscription: wlActive,  // Manager+ counts as having a sub even without Pro row
        isActive: wlActive,
        status: wlActive ? 'active' : null,
        currentPeriodEnd: null,
        trialEnd: null,
        cancelAtPeriodEnd: false,
        tier,
        plan,
        wlActive,
        weeklyPrice,
      })
    }

    const isActive = ['trialing', 'active', 'past_due'].includes(sub.status) || wlActive

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
      weeklyPrice,
    })
  } catch (err: any) {
    console.error('status error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}