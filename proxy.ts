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
// SUBDOMAIN / TENANT EXTRACTION (v23 — Phase C)
// =============================================================================
// White-label tenants live at <slug>.dialerseat.com. We extract the slug
// from the request hostname and attach it as the x-tenant-slug header.
//
// v23 (Phase C) ADDS subdomain-level routing decisions:
//
//   1. If a request comes in on a tenant subdomain and the tenant DOES NOT
//      EXIST or is CANCELLED or INACTIVE → redirect to dialerseat.com{path}
//      (so typo'd subdomains and cancelled tenants gracefully bounce to
//      the main site instead of 404'ing).
//
//   2. If a request comes in on a tenant subdomain for a marketing route
//      (/, /faq, /vs, /dialing-modes, /terms, /privacy) → redirect to
//      dialerseat.com{path}. Marketing pages live ONLY under the main
//      domain; tenant subdomains are for the app experience (sign-in /
//      sign-up / dashboard / billing / onboarding).
//
//   3. If a request comes in on a subdomain that matches subdomain_history
//      (i.e. the tenant CHANGED their slug in the last 30 days) →
//      redirect to {new_slug}.dialerseat.com{path}. Preserves bookmarks
//      across subdomain edits.
//
// In-memory cache (60s TTL) keeps Supabase load reasonable. Cache scope
// is the serverless function instance — so caches don't share across
// regional invocations, which is fine because each region's cache fills
// quickly under normal traffic patterns.
// =============================================================================

const RESERVED_SUBDOMAINS = new Set([
  'www', 'app', 'api', 'admin', 'dashboard', 'static', 'cdn', 'assets',
  'mail', 'email', 'smtp', 'imap', 'pop',
  'docs', 'blog', 'help', 'support', 'status',
  'demo',
])

const PRIMARY_DOMAINS = ['dialerseat.com', 'localhost']

// Routes that should NEVER appear on a tenant subdomain. Marketing,
// comparison pages, legal — all live on the main domain only. If a
// tenant subdomain requests one of these, redirect to dialerseat.com
// at the SAME path.
const MARKETING_ONLY_PATHS = [
  /^\/$/,
  /^\/faq(\/.*)?$/,
  /^\/vs(\/.*)?$/,
  /^\/dialing-modes(\/.*)?$/,
  /^\/terms$/,
  /^\/privacy$/,
  /^\/managers(\/.*)?$/,
  /^\/white-label(\/.*)?$/,
]

function isMarketingOnlyPath(pathname: string): boolean {
  return MARKETING_ONLY_PATHS.some((re) => re.test(pathname))
}

function extractTenantSlug(hostname: string): string | null {
  const host = hostname.split(':')[0].toLowerCase()

  let primary: string | null = null
  for (const p of PRIMARY_DOMAINS) {
    if (host === p) return null
    if (host.endsWith('.' + p)) {
      primary = p
      break
    }
  }
  if (!primary) return null

  const subdomain = host.slice(0, -1 - primary.length)

  if (subdomain.includes('.')) return null
  if (RESERVED_SUBDOMAINS.has(subdomain)) return null
  if (!/^[a-z0-9][a-z0-9-]{0,28}[a-z0-9]$/.test(subdomain)) return null

  return subdomain
}

// ─── TENANT LOOKUP CACHE ────────────────────────────────────────────────
// Per-instance in-memory cache for tenant resolution. Keys are slugs.
// Values are { status, redirectTo? } where status is one of:
//   'active'      — tenant exists and is currently rendering
//   'inactive'    — tenant exists but cancelled/inactive
//   'missing'     — no tenant with this slug
//   'history'     — slug points at a recent old-slug redirect
// We cache for 60 seconds. Branding edits don't matter here (those are
// re-fetched by the layout via lib/tenant.ts which has its own cache);
// what we cache here is just "should we redirect or proceed?"
// ────────────────────────────────────────────────────────────────────────

type TenantRouteState =
  | { status: 'active' }
  | { status: 'inactive' }
  | { status: 'missing' }
  | { status: 'history'; newSlug: string }

interface CacheEntry {
  state: TenantRouteState
  expires: number
}

const TENANT_ROUTE_CACHE = new Map<string, CacheEntry>()
const TENANT_ROUTE_CACHE_TTL_MS = 60 * 1000

async function lookupTenantRoute(slug: string): Promise<TenantRouteState> {
  const cached = TENANT_ROUTE_CACHE.get(slug)
  if (cached && cached.expires > Date.now()) {
    return cached.state
  }

  let state: TenantRouteState
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // First: active tenant by slug?
    const { data: tenant } = await supabase
      .from('white_label_tenants')
      .select('slug, status, is_active')
      .eq('slug', slug)
      .maybeSingle()

    if (tenant) {
      if (tenant.status === 'active' && tenant.is_active === true) {
        state = { status: 'active' }
      } else {
        state = { status: 'inactive' }
      }
    } else {
      // Second: is this a recent old-slug from a tenant who edited theirs?
      const { data: history } = await supabase
        .from('subdomain_history')
        .select('new_slug, redirects_until')
        .eq('old_slug', slug)
        .gt('redirects_until', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (history) {
        state = { status: 'history', newSlug: history.new_slug }
      } else {
        state = { status: 'missing' }
      }
    }
  } catch (err) {
    console.error('[proxy] tenant route lookup failed:', err)
    // Fail-open: assume active. Better than blocking all subdomains
    // during a Supabase outage. The layout will fall back to default
    // branding if its own lookup fails too.
    state = { status: 'active' }
  }

  TENANT_ROUTE_CACHE.set(slug, {
    state,
    expires: Date.now() + TENANT_ROUTE_CACHE_TTL_MS,
  })
  return state
}

// =============================================================================
// MIDDLEWARE
// =============================================================================

export default clerkMiddleware(async (auth, request) => {
  const hostname = request.headers.get('host') || ''
  const tenantSlug = extractTenantSlug(hostname)
  const url = request.nextUrl

  const withTenantHeader = (res: NextResponse): NextResponse => {
    if (tenantSlug) {
      res.headers.set('x-tenant-slug', tenantSlug)
    }
    return res
  }

  // ── TENANT SUBDOMAIN ROUTING (v23 — Phase C) ────────────────────────────
  // We do this BEFORE auth checks because we may need to redirect to the
  // main domain regardless of auth state. Static assets bypass this whole
  // middleware via the matcher exclusions below, so this only runs on
  // real page / API requests.
  if (tenantSlug) {
    // (1) Marketing-only paths bounce to dialerseat.com
    if (isMarketingOnlyPath(url.pathname)) {
      const mainUrl = new URL(url.pathname + url.search, 'https://dialerseat.com')
      return NextResponse.redirect(mainUrl, 308)
    }

    // (2) Look up the tenant to decide if subdomain is valid
    const route = await lookupTenantRoute(tenantSlug)

    if (route.status === 'missing' || route.status === 'inactive') {
      // Bounce to main site at the same path so a bookmark like
      // acme.dialerseat.com/dashboard becomes dialerseat.com/dashboard
      // (where the auth gate kicks in normally).
      const mainUrl = new URL(url.pathname + url.search, 'https://dialerseat.com')
      return NextResponse.redirect(mainUrl, 307)
    }

    if (route.status === 'history') {
      // Redirect to the new slug, preserving path + query
      const newUrl = new URL(
        url.pathname + url.search,
        `https://${route.newSlug}.dialerseat.com`
      )
      return NextResponse.redirect(newUrl, 308)
    }

    // route.status === 'active' → fall through to the normal auth flow
  }

  // ── NORMAL AUTH FLOW (unchanged from v22) ──────────────────────────────
  if (isPublicRoute(request)) {
    return withTenantHeader(NextResponse.next())
  }

  const { userId } = await auth()
  if (!userId) {
    await auth.protect()
    return withTenantHeader(NextResponse.next())
  }

  if (isBillingOrOnboardingRoute(request)) {
    return withTenantHeader(NextResponse.next())
  }

  const { tier, isAdmin, isPreserved } = await getAccessState(userId)

  if (isAdmin) {
    const res = NextResponse.next()
    res.headers.set('x-access-tier', 'active')
    res.headers.set('x-is-admin', '1')
    return withTenantHeader(res)
  }

  if (tier === 'active') {
    const res = NextResponse.next()
    res.headers.set('x-access-tier', 'active')
    return withTenantHeader(res)
  }

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
    return { tier: 'active', isAdmin: false, isPreserved: true }
  }
}

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|jsx?|json|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docb?x?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}