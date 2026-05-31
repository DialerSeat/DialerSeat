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

// Routes that REQUIRE access enforcement. Dashboard, API mutations, etc.
// Sign-in/up/billing/onboarding etc. are deliberately excluded — those are
// reachable from any host regardless of tenant membership.
const isProtectedAppRoute = createRouteMatcher([
  '/dashboard(.*)',
])

const ACTIVE_STATUSES = ['trialing', 'active', 'past_due']

type AccessTier = 'active' | 'lapsed' | 'new'

interface AccessState {
  tier: AccessTier
  isAdmin: boolean
  isPreserved: boolean
}

interface UserBrandAccess {
  /** Tenant slugs the user is allowed to view branded as (own + active teams' tenants). */
  accessibleSlugs: Set<string>
  /** The slug of the user's active_tenant_id selection (null if standard). */
  selectedSlug: string | null
  /** True if user has a self-paid sub OR owns a tenant (eligible for standard view). */
  canSeeStandard: boolean
}

// =============================================================================
// SUBDOMAIN ROUTING (v23 — Phase C)
// + ACCESS ENFORCEMENT  (v24 — Phase D)
// =============================================================================
// v23 (Phase C) — subdomain extraction, marketing redirect, cancelled
// tenant redirect, subdomain_history grace-period redirect.
//
// v24 (Phase D) — adds enforcement for logged-in users:
//
//   1. If user visits acme.dialerseat.com but isn't an active member of
//      acme's tenant (and doesn't own it) → 307 redirect to their actual
//      tenant subdomain OR dialerseat.com if they're a standard user.
//
//   2. If user is a seat-only agent (no self-sub) visiting
//      dialerseat.com/dashboard* → 307 redirect to their tenant subdomain.
//      Seat-only agents are locked to their tenant. They can't see
//      standard DialerSeat unless they pay for their own subscription.
//
// Manual URL entry to a subdomain you DO belong to is always honored —
// the active_tenant_id selection is a default, not a hard lock. If you're
// a member of both 3 and 4 and have 4 selected, manually navigating to
// 3.dialerseat.com works fine; only the default LOGIN destination is
// driven by the selection.
// =============================================================================

const RESERVED_SUBDOMAINS = new Set([
  'www', 'app', 'api', 'admin', 'dashboard', 'static', 'cdn', 'assets',
  'mail', 'email', 'smtp', 'imap', 'pop',
  'docs', 'blog', 'help', 'support', 'status',
  'demo',
])

const PRIMARY_DOMAINS = ['dialerseat.com', 'localhost']

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

// ─── TENANT ROUTE CACHE (v23) ──────────────────────────────────────────
type TenantRouteState =
  | { status: 'active' }
  | { status: 'inactive' }
  | { status: 'missing' }
  | { status: 'history'; newSlug: string }

const TENANT_ROUTE_CACHE = new Map<string, { state: TenantRouteState; expires: number }>()
const CACHE_TTL_MS = 60 * 1000

async function lookupTenantRoute(slug: string): Promise<TenantRouteState> {
  const cached = TENANT_ROUTE_CACHE.get(slug)
  if (cached && cached.expires > Date.now()) return cached.state

  let state: TenantRouteState
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: tenant } = await supabase
      .from('white_label_tenants')
      .select('slug, status, is_active')
      .eq('slug', slug)
      .maybeSingle()

    if (tenant) {
      state = (tenant.status === 'active' && tenant.is_active === true)
        ? { status: 'active' }
        : { status: 'inactive' }
    } else {
      const { data: history } = await supabase
        .from('subdomain_history')
        .select('new_slug, redirects_until')
        .eq('old_slug', slug)
        .gt('redirects_until', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      state = history
        ? { status: 'history', newSlug: history.new_slug }
        : { status: 'missing' }
    }
  } catch (err) {
    console.error('[proxy] tenant route lookup failed:', err)
    state = { status: 'active' } // fail-open
  }

  TENANT_ROUTE_CACHE.set(slug, { state, expires: Date.now() + CACHE_TTL_MS })
  return state
}

// ─── USER BRAND ACCESS CACHE (v24 — Phase D) ───────────────────────────
const USER_BRAND_CACHE = new Map<string, { access: UserBrandAccess; expires: number }>()

async function lookupUserBrandAccess(clerkId: string): Promise<UserBrandAccess> {
  const cached = USER_BRAND_CACHE.get(clerkId)
  if (cached && cached.expires > Date.now()) return cached.access

  let access: UserBrandAccess = {
    accessibleSlugs: new Set(),
    selectedSlug: null,
    canSeeStandard: false,
  }

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const [
      { data: userRow },
      { data: ownedTenant },
      { data: memberRows },
      { data: selfSubs },
    ] = await Promise.all([
      supabase
        .from('users')
        .select('active_tenant_id')
        .eq('clerk_id', clerkId)
        .maybeSingle(),
      supabase
        .from('white_label_tenants')
        .select('id, slug')
        .eq('owner_clerk_id', clerkId)
        .eq('status', 'active')
        .eq('is_active', true)
        .maybeSingle(),
      supabase
        .from('team_members')
        .select('team_id, teams!inner(owner_id)')
        .eq('user_id', clerkId)
        .eq('status', 'active'),
      supabase
        .from('subscriptions')
        .select('status, current_period_end')
        .eq('user_id', clerkId),
    ])

    const accessibleTenantIds: string[] = []
    const slugById = new Map<string, string>()

    if (ownedTenant) {
      accessibleTenantIds.push(ownedTenant.id)
      slugById.set(ownedTenant.id, ownedTenant.slug)
    }

    const ownerClerkIds: string[] = []
    for (const row of memberRows || []) {
      const ownerId = (row as any).teams?.owner_id
      if (ownerId) ownerClerkIds.push(ownerId)
    }

    if (ownerClerkIds.length > 0) {
      const { data: teamTenants } = await supabase
        .from('white_label_tenants')
        .select('id, slug, owner_clerk_id')
        .in('owner_clerk_id', ownerClerkIds)
        .eq('status', 'active')
        .eq('is_active', true)

      for (const t of teamTenants || []) {
        if (!slugById.has(t.id)) {
          accessibleTenantIds.push(t.id)
          slugById.set(t.id, t.slug)
        }
      }
    }

    const accessibleSlugs = new Set(Array.from(slugById.values()))

    const selectedTenantId = userRow?.active_tenant_id || null
    const selectedSlug = selectedTenantId ? slugById.get(selectedTenantId) || null : null

    const now = Date.now()
    const hasSelfSub = (selfSubs || []).some(s => {
      if (ACTIVE_STATUSES.includes(s.status)) return true
      if (s.status === 'canceled' && s.current_period_end &&
          new Date(s.current_period_end).getTime() > now) return true
      return false
    })
    const canSeeStandard = hasSelfSub || !!ownedTenant

    access = { accessibleSlugs, selectedSlug, canSeeStandard }
  } catch (err) {
    console.error('[proxy] user brand access lookup failed:', err)
    // Fail-open: pretend they can see standard and any subdomain. The
    // page-level branding will fall back to default if its lookup also
    // fails. Better than blocking access during an outage.
    access = { accessibleSlugs: new Set(), selectedSlug: null, canSeeStandard: true }
  }

  USER_BRAND_CACHE.set(clerkId, { access, expires: Date.now() + CACHE_TTL_MS })
  return access
}

// =============================================================================
// MIDDLEWARE
// =============================================================================

export default clerkMiddleware(async (auth, request) => {
  const hostname = request.headers.get('host') || ''
  const tenantSlug = extractTenantSlug(hostname)
  const url = request.nextUrl

  const withTenantHeader = (res: NextResponse): NextResponse => {
    if (tenantSlug) res.headers.set('x-tenant-slug', tenantSlug)
    return res
  }

  // ── PHASE C: tenant subdomain validity routing ──────────────────────────
  if (tenantSlug) {
    if (isMarketingOnlyPath(url.pathname)) {
      const mainUrl = new URL(url.pathname + url.search, 'https://dialerseat.com')
      return NextResponse.redirect(mainUrl, 308)
    }

    const route = await lookupTenantRoute(tenantSlug)
    if (route.status === 'missing' || route.status === 'inactive') {
      const mainUrl = new URL(url.pathname + url.search, 'https://dialerseat.com')
      return NextResponse.redirect(mainUrl, 307)
    }
    if (route.status === 'history') {
      const newUrl = new URL(
        url.pathname + url.search,
        `https://${route.newSlug}.dialerseat.com`
      )
      return NextResponse.redirect(newUrl, 308)
    }
    // route.status === 'active' → fall through
  }

  // ── PUBLIC ROUTES ──────────────────────────────────────────────────────
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

  // ── PHASE D: BRAND ACCESS ENFORCEMENT ──────────────────────────────────
  // Runs ONLY on protected app routes (/dashboard*). API routes are gated
  // separately by their own auth + tier checks. Admins already bypassed.
  if (isProtectedAppRoute(request)) {
    const brandAccess = await lookupUserBrandAccess(userId)

    // Case A: user is on a tenant subdomain
    if (tenantSlug) {
      // Block if they don't belong to this tenant's team
      if (!brandAccess.accessibleSlugs.has(tenantSlug)) {
        // Redirect them to their actual destination
        const dest = pickRedirectDestination(brandAccess, url.pathname + url.search)
        return NextResponse.redirect(dest, 307)
      }
      // They belong here — proceed
    } else {
      // Case B: user is on the main domain (no subdomain)
      // If they CAN'T see standard view, redirect them to their tenant.
      // This is the "seat-only agent locked to WL" enforcement.
      if (!brandAccess.canSeeStandard) {
        const dest = pickRedirectDestination(brandAccess, url.pathname + url.search)
        // Don't redirect to dialerseat.com — that's where we are. If we
        // can't find a tenant subdomain to send them to, fall through
        // (better to show the dashboard than infinite-loop redirect).
        if (dest.host !== url.host) {
          return NextResponse.redirect(dest, 307)
        }
      }
    }
  }

  // ── NORMAL TIER GATES (unchanged from v22/v23) ─────────────────────────
  if (tier === 'active') {
    const res = NextResponse.next()
    res.headers.set('x-access-tier', 'active')
    return withTenantHeader(res)
  }

  if (isPreserved) {
    if (isActiveOnlyRoute(request)) {
      return NextResponse.json(
        { error: 'Active subscription required', tier, redirectTo: '/billing' },
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

/**
 * Where should this user be redirected when they hit a subdomain they
 * don't belong to (or when a seat-only agent hits the main domain)?
 *
 * Order:
 *   1. Their selected tenant (active_tenant_id) — if still in their
 *      accessible set, which is the normal case
 *   2. The first accessible tenant slug — fallback if selection is stale
 *   3. dialerseat.com — last resort (only reached if user has NO
 *      accessible tenants at all, which means lookup didn't find anything)
 */
function pickRedirectDestination(
  brandAccess: UserBrandAccess,
  pathAndQuery: string
): URL {
  if (brandAccess.selectedSlug && brandAccess.accessibleSlugs.has(brandAccess.selectedSlug)) {
    return new URL(pathAndQuery, `https://${brandAccess.selectedSlug}.dialerseat.com`)
  }
  const firstSlug = Array.from(brandAccess.accessibleSlugs)[0]
  if (firstSlug) {
    return new URL(pathAndQuery, `https://${firstSlug}.dialerseat.com`)
  }
  return new URL(pathAndQuery, 'https://dialerseat.com')
}

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