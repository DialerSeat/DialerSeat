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
    })
  } catch (err: any) {
    console.error('status error:', err)
    return apiError(err, { route: 'stripe/status' })
  }
}