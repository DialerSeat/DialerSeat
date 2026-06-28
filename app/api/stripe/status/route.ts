import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getServiceClient } from '@/lib/supabase'
import { getAccessTier } from '@/lib/subscription'
import { apiError } from '@/lib/apiError'

const supabase = getServiceClient('stripe/status')

// =============================================================================
// /api/stripe/status — subscription status for the current user
// =============================================================================
// Existing fields preserved exactly:
//   hasSubscription, isActive, status, currentPeriodEnd, trialEnd,
//   cancelAtPeriodEnd, tier
//
// NEW (Phase D2 Manager+ awareness):
//   plan          'pro' | 'manager_plus' | 'both' | null
//   wlActive      boolean
//   weeklyPrice   number
//
// PRICE-AWARE PRO DETECTION (fix):
//   proActive only fires when the user has an active sub at the Pro price
//   ID specifically (STRIPE_PRICE_ID). If the sub is at the WL price
//   (STRIPE_PRICE_WL_BASE), it does NOT also count as Pro — otherwise a
//   single Manager+ user would falsely show up as "PRO + MANAGER+".
// =============================================================================

const PRO_PRICE_ID = process.env.STRIPE_PRICE_ID || ''
const WL_PRICE_ID = process.env.STRIPE_PRICE_WL_BASE || ''

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Most recent personal sub (existing path). NOW also selects stripe_price_id
    // so we can tell whether it's a Pro or Manager+ sub.
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('status, current_period_end, trial_end, cancel_at_period_end, stripe_price_id')
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

    // Pro requires both an active status AND that the sub's price is
    // the Pro price (not the WL price). A WL-price sub does not count as
    // Pro even though it's technically "an active subscription."
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
        hasSubscription: wlActive,
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

    // hasSubscription = the user has SOMETHING (Pro sub row OR active WL).
    // isActive — if their Pro sub is in a good state OR they have an active
    // Manager+. A "subscriptions" row that's actually a Manager+ purchase
    // is still reflected here for the UI; we just don't double-count it
    // as Pro for the `plan` field.
    const isActive = subStatusActive || wlActive

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
    return apiError(err, { route: 'stripe/status' })
  }
}