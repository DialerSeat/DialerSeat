import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/terms',
  '/dialing-modes',
  '/api/stripe/webhook',
  '/api/calls/twiml(.*)',
  '/api/calls/twiml-agent(.*)',
  '/api/calls/status(.*)',
  '/api/calls/recording(.*)',
  '/api/calls/inbound(.*)',
  '/api/calls/amd-result(.*)',
  '/api/calls/amd-result',
  '/api/cron/(.*)',
])

// Auth required, no tier check needed.
// IMPORTANT: /onboarding is here so brand-new users see the walkthrough
// before being redirected to /billing.
const isBillingOrOnboardingRoute = createRouteMatcher([
  '/billing(.*)',
  '/onboarding(.*)',
  '/api/stripe/(.*)',
])

const isReadOnlyAllowedRoute = createRouteMatcher([
  '/dashboard',
  '/dashboard/leads(.*)',
  '/dashboard/recordings(.*)',
  '/dashboard/analytics(.*)',
  '/dashboard/team(.*)',
  '/dashboard/settings(.*)',
  '/dashboard/admin(.*)',
  '/api/leads/list',
  '/api/leads/export',
  '/api/campaigns/list',
  '/api/recordings/(.*)',
  '/api/admin/(.*)',
  '/api/heartbeat',
])

const isActiveOnlyRoute = createRouteMatcher([
  '/api/calls/outbound',
  '/api/calls/check',
  '/api/calls/hangup',
  '/api/campaigns/create',
  '/api/campaigns/update',
  '/api/leads/upload',
  '/api/leads/next',
  '/api/leads/dispose',
  '/api/leads/update',
])

const ACTIVE_STATUSES = ['trialing', 'active', 'past_due']

type AccessTier = 'active' | 'lapsed' | 'new'

export default clerkMiddleware(async (auth, request) => {
  if (isPublicRoute(request)) {
    return NextResponse.next()
  }

  const { userId } = await auth()
  if (!userId) {
    await auth.protect()
    return NextResponse.next()
  }

  // Billing & onboarding bypass tier check — both new and lapsed users
  // need to reach these to (re)subscribe.
  if (isBillingOrOnboardingRoute(request)) {
    return NextResponse.next()
  }

  const tier = await getAccessTier(userId)

  // 'new' users (never subscribed) → force to /billing.
  // The Clerk SIGN_UP_FORCE_REDIRECT_URL points to /onboarding, which is in
  // isBillingOrOnboardingRoute above, so they reach onboarding fine. After
  // clicking GET STARTED, they hit /billing (also allowed). It's only when
  // they try to bypass straight to /dashboard that this redirect kicks in.
  if (tier === 'new') {
    const billingUrl = new URL('/billing', request.url)
    return NextResponse.redirect(billingUrl)
  }

  if (tier === 'lapsed') {
    if (isActiveOnlyRoute(request)) {
      return NextResponse.json(
        {
          error: 'Active subscription required',
          tier: 'lapsed',
          redirectTo: '/billing',
        },
        { status: 403 }
      )
    }

    const res = NextResponse.next()
    res.headers.set('x-access-tier', 'lapsed')
    return res
  }

  const res = NextResponse.next()
  res.headers.set('x-access-tier', 'active')
  return res
})

async function getAccessTier(clerkId: string): Promise<AccessTier> {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: subs } = await supabase
      .from('subscriptions')
      .select('status, current_period_end')
      .eq('user_id', clerkId)
      .order('created_at', { ascending: false })

    if (!subs || subs.length === 0) {
      return 'new'
    }

    const now = Date.now()
    for (const sub of subs) {
      if (ACTIVE_STATUSES.includes(sub.status)) {
        return 'active'
      }
      if (
        sub.status === 'canceled' &&
        sub.current_period_end &&
        new Date(sub.current_period_end).getTime() > now
      ) {
        return 'active'
      }
    }
    return 'lapsed'
  } catch (err) {
    console.error('[proxy] tier lookup failed:', err)
    return 'active'
  }
}

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docb?x?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}