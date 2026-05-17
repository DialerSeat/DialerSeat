import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/terms',
  '/dialing-modes',
  '/vs/(.*)',
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
const isBillingOrOnboardingRoute = createRouteMatcher([
  '/billing(.*)',
  '/onboarding(.*)',
  '/api/stripe/(.*)',
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
  isAdmin: boolean
  isPreserved: boolean
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

  // Billing & onboarding bypass everything else — both new and lapsed users
  // need to reach these to (re)subscribe.
  if (isBillingOrOnboardingRoute(request)) {
    return NextResponse.next()
  }

  const { tier, isAdmin, isPreserved } = await getAccessState(userId)

  // ── ADMIN BYPASS ─────────────────────────────────────────────────
  // Admins get full access regardless of Stripe state. Admin status is
  // never tied to billing — they manage the platform, they don't pay for it.
  if (isAdmin) {
    const res = NextResponse.next()
    res.headers.set('x-access-tier', 'active')
    res.headers.set('x-is-admin', '1')
    return res
  }

  // ── ACTIVE SUB → FULL ACCESS ─────────────────────────────────────
  if (tier === 'active') {
    const res = NextResponse.next()
    res.headers.set('x-access-tier', 'active')
    return res
  }

  // ── PRESERVED USER → READ-ONLY DASHBOARD ─────────────────────────
  // User has uploaded leads, created a campaign, joined a team, or otherwise
  // has data in the system. They can view their dashboard in read-only mode
  // but active-only routes still 403 them.
  if (isPreserved) {
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
    res.headers.set('x-data-preserved', '1')
    return res
  }

  // ── EVERYONE ELSE → /billing ─────────────────────────────────────
  // No active sub, not an admin, no preserved data. They must subscribe
  // or abandon (which signs them out and returns them to the landing page).
  const billingUrl = new URL('/billing', request.url)
  return NextResponse.redirect(billingUrl)
})

async function getAccessState(clerkId: string): Promise<AccessState> {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const [
      { data: subs },
      { data: userRow },
      { data: preservedRow },
    ] = await Promise.all([
      supabase
        .from('subscriptions')
        .select('status, current_period_end')
        .eq('user_id', clerkId)
        .order('created_at', { ascending: false }),
      supabase
        .from('users')
        .select('is_admin')
        .eq('clerk_id', clerkId)
        .maybeSingle(),
      supabase
        .from('data_preserved_users')
        .select('clerk_id')
        .eq('clerk_id', clerkId)
        .maybeSingle(),
    ])

    const isAdmin = !!userRow?.is_admin
    const isPreserved = !!preservedRow

    if (!subs || subs.length === 0) {
      return { tier: 'new', isAdmin, isPreserved }
    }

    const now = Date.now()
    for (const sub of subs) {
      if (ACTIVE_STATUSES.includes(sub.status)) {
        return { tier: 'active', isAdmin, isPreserved }
      }
      if (
        sub.status === 'canceled' &&
        sub.current_period_end &&
        new Date(sub.current_period_end).getTime() > now
      ) {
        return { tier: 'active', isAdmin, isPreserved }
      }
    }
    return { tier: 'lapsed', isAdmin, isPreserved }
  } catch (err) {
    console.error('[proxy] access state lookup failed:', err)
    // Fail-open: if Supabase is unreachable, let the user through.
    // Better than locking everyone out during a Supabase outage.
    return { tier: 'active', isAdmin: false, isPreserved: true }
  }
}

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docb?x?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}