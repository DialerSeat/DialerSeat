import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// ============================================================
// Public routes — no auth, no sub check
// ============================================================
const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/terms',
  '/api/stripe/webhook',
  // SignalWire webhooks (TwiML, recording status callbacks) — must be public
  '/api/calls/twiml(.*)',
  '/api/calls/twiml-agent(.*)',
  '/api/calls/status(.*)',
  '/api/calls/recording(.*)',
])

// ============================================================
// Billing routes — auth required, but no sub check
// (you have to be able to reach /billing while lapsed)
// ============================================================
const isBillingRoute = createRouteMatcher([
  '/billing(.*)',
  '/onboarding(.*)',
  '/api/stripe/(.*)',
])

// ============================================================
// Read-only routes — lapsed users CAN reach these
// (they need to view & export their own data)
// ============================================================
const isReadOnlyAllowedRoute = createRouteMatcher([
  '/dashboard',
  '/dashboard/leads(.*)',
  '/dashboard/recordings(.*)',
  '/dashboard/analytics(.*)',
  '/dashboard/team(.*)',
  '/dashboard/settings(.*)',
  '/dashboard/admin(.*)',
  // Read-only API endpoints lapsed users can hit
  '/api/leads/list',
  '/api/leads/export',
  '/api/campaigns/list',
  '/api/admin/(.*)',
  '/api/heartbeat',
])

// ============================================================
// Mutation routes that REQUIRE active subscription
// (lapsed users blocked here at middleware level — second line of defense
// after each route's own requireActive() check)
// ============================================================
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

// ============================================================
// Dashboard routes that lapsed users CAN'T reach UI-side
// (dialer + campaigns mutation-heavy pages — keep them read-only via UI gates,
// but middleware doesn't redirect them; the page itself shows the lapsed state)
// ============================================================

const ACTIVE_STATUSES = ['trialing', 'active', 'past_due']

type AccessTier = 'active' | 'lapsed' | 'new'

export default clerkMiddleware(async (auth, request) => {
  // Public routes — pass through
  if (isPublicRoute(request)) {
    return NextResponse.next()
  }

  // Auth required for everything else
  const { userId } = await auth()
  if (!userId) {
    await auth.protect()
    return NextResponse.next()
  }

  // Billing & onboarding — auth-only, no tier check
  if (isBillingRoute(request)) {
    return NextResponse.next()
  }

  // Compute access tier
  const tier = await getAccessTier(userId)

  // ============================================================
  // Tier: 'new' — never subscribed → force to /billing
  // ============================================================
  if (tier === 'new') {
    const billingUrl = new URL('/billing', request.url)
    return NextResponse.redirect(billingUrl)
  }

  // ============================================================
  // Tier: 'lapsed' — has paid before, now read-only
  // ============================================================
  if (tier === 'lapsed') {
    // Hard-block mutation API routes
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

    // Allow read-only pages and read-only API routes
    // Pass tier downstream via header so pages can render the lapsed UI
    const res = NextResponse.next()
    res.headers.set('x-access-tier', 'lapsed')
    return res
  }

  // ============================================================
  // Tier: 'active' — full access
  // ============================================================
  const res = NextResponse.next()
  res.headers.set('x-access-tier', 'active')
  return res
})

// ============================================================
// Tier lookup — duplicated from lib/subscription.ts
// because middleware runs in Edge runtime and can't import
// from app code that uses node-only Stripe SDK.
// Keep this in sync with lib/subscription.ts!
// ============================================================
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
    // Fail open — Supabase outage shouldn't lock everyone out
    return 'active'
  }
}

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docb?x?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}