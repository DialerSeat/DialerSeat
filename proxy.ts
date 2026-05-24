import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/terms',
  '/privacy',
  '/faq',
  '/dialing-modes',
  '/vs',
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

// =============================================================================
// SUBDOMAIN / TENANT EXTRACTION
// =============================================================================
// White-label tenants live at <slug>.dialerseat.com. We extract the slug
// from the request hostname and attach it as the x-tenant-slug header,
// which downstream server components read via headers().
//
// We intentionally do NOT do a Supabase lookup here — that would add a
// round-trip to every request including static assets. The header just
// carries the slug; lib/tenant.ts does the actual branding lookup with
// caching when the layout or a page actually needs it.
//
// Reserved subdomains (www, app, api, admin, dashboard) are treated as
// the main DialerSeat experience, not white-label. This protects against
// someone registering 'app.dialerseat.com' as a tenant slug and breaking
// internal routing.
//
// Local development is handled too — slug.localhost:3000 works via
// /etc/hosts edits or .localhost DNS.
// =============================================================================

const RESERVED_SUBDOMAINS = new Set([
  'www', 'app', 'api', 'admin', 'dashboard', 'static', 'cdn', 'assets',
  'mail', 'email', 'smtp', 'imap', 'pop',
  'docs', 'blog', 'help', 'support', 'status',
  'demo', // we use admin "view as team" impersonation instead of demo subdomain
])

const PRIMARY_DOMAINS = ['dialerseat.com', 'localhost']

function extractTenantSlug(hostname: string): string | null {
  // Strip port if present (localhost:3000)
  const host = hostname.split(':')[0].toLowerCase()

  // Find which primary domain this host ends with
  let primary: string | null = null
  for (const p of PRIMARY_DOMAINS) {
    if (host === p) return null // bare domain, not a subdomain
    if (host.endsWith('.' + p)) {
      primary = p
      break
    }
  }
  if (!primary) return null // unknown host, treat as main app

  // Strip the primary domain to get the subdomain portion
  const subdomain = host.slice(0, -1 - primary.length)

  // Multi-level subdomains (e.g. preview.acme.dialerseat.com) are not
  // supported as tenants — treat them as main app.
  if (subdomain.includes('.')) return null

  // Reserved subdomains are never tenants
  if (RESERVED_SUBDOMAINS.has(subdomain)) return null

  // Sanity check the slug shape: lowercase alphanumeric + hyphens,
  // 2-30 chars, doesn't start or end with hyphen. Same regex as the
  // schema CHECK constraint.
  if (!/^[a-z0-9][a-z0-9-]{0,28}[a-z0-9]$/.test(subdomain)) return null

  return subdomain
}

export default clerkMiddleware(async (auth, request) => {
  // ── TENANT EXTRACTION (runs for every request) ──────────────────────────
  // We attach the tenant slug to BOTH the incoming request (so route
  // handlers can read it) AND the outgoing response (so server components
  // can read it via headers()).
  const hostname = request.headers.get('host') || ''
  const tenantSlug = extractTenantSlug(hostname)

  // Helper to consistently attach the header to a response
  const withTenantHeader = (res: NextResponse): NextResponse => {
    if (tenantSlug) {
      res.headers.set('x-tenant-slug', tenantSlug)
    }
    return res
  }

  if (isPublicRoute(request)) {
    return withTenantHeader(NextResponse.next())
  }

  const { userId } = await auth()
  if (!userId) {
    await auth.protect()
    return withTenantHeader(NextResponse.next())
  }

  // Billing & onboarding bypass everything else — both new and lapsed users
  // need to reach these to (re)subscribe.
  if (isBillingOrOnboardingRoute(request)) {
    return withTenantHeader(NextResponse.next())
  }

  const { tier, isAdmin, isPreserved } = await getAccessState(userId)

  // ── ADMIN BYPASS ────────────────────────────────────────────────────────
  // Admins get full access regardless of Stripe state. Admin status is
  // never tied to billing — they manage the platform, they don't pay for it.
  if (isAdmin) {
    const res = NextResponse.next()
    res.headers.set('x-access-tier', 'active')
    res.headers.set('x-is-admin', '1')
    return withTenantHeader(res)
  }

  // ── ACTIVE SUB → FULL ACCESS ────────────────────────────────────────────
  if (tier === 'active') {
    const res = NextResponse.next()
    res.headers.set('x-access-tier', 'active')
    return withTenantHeader(res)
  }

  // ── PRESERVED USER → READ-ONLY DASHBOARD ────────────────────────────────
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
    return withTenantHeader(res)
  }

  // ── EVERYONE ELSE → /billing ────────────────────────────────────────────
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

// =============================================================================
// MIDDLEWARE MATCHER
// =============================================================================
// Excludes static assets from running through Clerk auth. The negative
// lookahead in the regex says "match all paths EXCEPT those that look like
// static files."
//
// Excluded extensions: html, css, js, jsx, json, images, fonts, icons,
// archives, spreadsheets, webmanifest.
//
// HISTORY (May 2026): The original matcher had `js(?!on)` which means "js
// but not json" — i.e. JSON files were NOT excluded and got routed through
// Clerk auth. That caused /manifest.json (and any other public JSON files)
// to 404 because unauthenticated requests got redirected to /billing.
// Fix: `jsx?|json` so .js, .jsx, and .json are all excluded from auth.
// =============================================================================
export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|jsx?|json|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docb?x?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}