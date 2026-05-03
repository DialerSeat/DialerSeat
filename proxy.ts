import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/terms',
  '/api/calls/(.*)',
  '/api/stripe/webhook',
])

const isBillingRoute = createRouteMatcher([
  '/billing(.*)',
  '/api/stripe/(.*)',
])

const isDashboardRoute = createRouteMatcher([
  '/dashboard(.*)',
])

const ACTIVE_STATUSES = ['trialing', 'active', 'past_due']

export default clerkMiddleware(async (auth, request) => {
  // Public routes — skip everything
  if (isPublicRoute(request)) {
    return NextResponse.next()
  }

  // All other routes require Clerk auth
  const { userId } = await auth()
  if (!userId) {
    await auth.protect()
    return NextResponse.next()
  }

  // Billing/Stripe routes — auth required, but no subscription gate
  // (otherwise you couldn't reach /billing to fix a lapsed subscription)
  if (isBillingRoute(request)) {
    return NextResponse.next()
  }

  // Dashboard routes — require active subscription
  if (isDashboardRoute(request)) {
    const subscriptionStatus = await getSubscriptionStatus(userId)

    if (!subscriptionStatus || !ACTIVE_STATUSES.includes(subscriptionStatus)) {
      const billingUrl = new URL('/billing', request.url)
      return NextResponse.redirect(billingUrl)
    }
  }

  return NextResponse.next()
})

async function getSubscriptionStatus(clerkId: string): Promise<string | null> {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data } = await supabase
      .from('users')
      .select('subscription_status')
      .eq('clerk_id', clerkId)
      .maybeSingle()

    return data?.subscription_status ?? null
  } catch (err) {
    console.error('Subscription gate DB error:', err)
    // On DB error, fail open (allow access) so a Supabase outage doesn't lock everyone out
    // Webhook still source of truth — chargeback defense unaffected
    return 'active'
  }
}

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docb?x?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}