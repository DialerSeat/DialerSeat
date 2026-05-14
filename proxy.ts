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

interface AccessState {
  tier: AccessTier
  hasData: boolean
}

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

  const { tier, hasData } = await getAccessState(userId)

  // ── BRAND-NEW USER WITH NO DATA → FORCE TO /billing ──────────────
  // The case: someone signed up but never finished paying, has no leads,
  // no campaigns, no teams. Land them at /billing every time until they
  // either complete payment or upload data. This protects against the
  // confused-empty-dashboard experience for first-time users.
  //
  // Once they have ANY data (lead, campaign, team membership), they
  // qualify for the lapsed-read-only flow below and can return to the
  // dashboard freely.
  if (tier === 'new' && !hasData) {
    const billingUrl = new URL('/billing', request.url)
    return NextResponse.redirect(billingUrl)
  }

  // ── EVERYONE ELSE WITHOUT AN ACTIVE SUB → READ-ONLY DASHBOARD ────
  // - 'new' + hasData: rare path (e.g. team member who joined a team
  //   but never subscribed personally — they have team membership data,
  //   should see the dashboard).
  // - 'lapsed': normal returning user whose sub expired. Always allow.
  // - Active-only API routes (outbound, leads/next, etc.) still 403 for
  //   both groups — they can browse, not dial.
  if (tier === 'new' || tier === 'lapsed') {
    if (isActiveOnlyRoute(request)) {
      return NextResponse.json(
        {
          error: 'Active subscription required',
          tier,
          redirectTo: '/billing',
        },
        { status: 403 }
      )
    }

    const res = NextResponse.next()
    res.headers.set('x-access-tier', tier)
    res.headers.set('x-has-data', hasData ? '1' : '0')
    return res
  }

  // Active sub: full access.
  const res = NextResponse.next()
  res.headers.set('x-access-tier', 'active')
  return res
})

async function getAccessState(clerkId: string): Promise<AccessState> {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Single query: tier from subscriptions + hasData from users.
    // Could be Promise.all'd but Supabase JS client doesn't share a
    // socket per request anyway, so the two awaits are fine.
    const [{ data: subs }, { data: userRow }] = await Promise.all([
      supabase
        .from('subscriptions')
        .select('status, current_period_end')
        .eq('user_id', clerkId)
        .order('created_at', { ascending: false }),
      supabase
        .from('users')
        .select('has_data')
        .eq('clerk_id', clerkId)
        .maybeSingle(),
    ])

    const hasData = !!userRow?.has_data

    if (!subs || subs.length === 0) {
      return { tier: 'new', hasData }
    }

    const now = Date.now()
    for (const sub of subs) {
      if (ACTIVE_STATUSES.includes(sub.status)) {
        return { tier: 'active', hasData }
      }
      if (
        sub.status === 'canceled' &&
        sub.current_period_end &&
        new Date(sub.current_period_end).getTime() > now
      ) {
        return { tier: 'active', hasData }
      }
    }
    return { tier: 'lapsed', hasData }
  } catch (err) {
    console.error('[proxy] access state lookup failed:', err)
    // Fail-open: if Supabase is unreachable, let the user through as if
    // they have an active sub. Better than locking everyone out during
    // a Supabase incident. Active-only API routes will independently
    // fail at their own auth layer if the user genuinely doesn't qualify.
    return { tier: 'active', hasData: true }
  }
}

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docb?x?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}