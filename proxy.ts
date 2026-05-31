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

const isProtectedAppRoute = createRouteMatcher([
  '/dashboard(.*)',
])

// ── HARD-LOCK ALLOWLIST (Phase D2) ────────────────────────────────────
// Manager+ users with wl_onboarding_status != 'complete' are locked OUT
// of every route EXCEPT these. The allowlist covers:
//   1. The onboarding page itself (so they can complete it)
//   2. Onboarding APIs (so the page can save)
//   3. Billing + cancel APIs (so they can get a refund if regret)
//   4. Sign-out (so they can leave)
//   5. Stripe webhooks (always allowed, public route)
//
// Everything else → 307 redirect to /onboarding/whitelabel.
const isOnboardingAllowedRoute = createRouteMatcher([
  '/onboarding/whitelabel(.*)',
  '/api/whitelabel/onboarding(.*)',
  '/api/whitelabel/upload-logo(.*)',
  '/api/whitelabel/check-subdomain(.*)',
  '/billing(.*)',
  '/api/stripe/(.*)',
])

const ACTIVE_STATUSES = ['trialing', 'active', 'past_due']

type AccessTier = 'active' | 'lapsed' | 'new'

interface AccessState {
  tier: AccessTier
  isAdmin: boolean
  isPreserved: boolean
  /** True if this user has paid for WL but not completed onboarding. */
  wlOnboardingPending: boolean
}

interface UserBrandAccess {
  accessibleSlugs: Set<string>
  selectedSlug: string | null
  canSeeStandard: boolean
}

// =============================================================================
// SUBDOMAIN ROUTING (v23 — Phase C)
// + ACCESS ENFORCEMENT  (v24 — Phase D1)
// + ONBOARDING HARD-LOCK (v25 — Phase D2)
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
    if (host.endsWith('.' + p)) { primary = p; break }
  }
  if (!primary) return null
  const subdomain = host.slice(0, -1 - primary.length)
  if (subdomain.includes('.')) return null
  if (RESERVED_SUBDOMAINS.has(subdomain)) return null
  if (!/^[a-z0-9][a-z0-9-]{0,28}[a-z0-9]$/.test(subdomain)) return null
  return subdomain
}

// ─── TENANT ROUTE CACHE ─────────────────────────────────────────────────
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
    state = { status: 'active' }
  }

  TENANT_ROUTE_CACHE.set(slug, { state, expires: Date.now() + CACHE_TTL_MS })
  return state
}

// ─── USER BRAND ACCESS CACHE (Phase D1) ─────────────────────────────────
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
      supabase.from('users').select('active_tenant_id').eq('clerk_id', clerkId).maybeSingle(),
      supabase.from('white_label_tenants').select('id, slug')
        .eq('owner_clerk_id', clerkId).eq('status', 'active').eq('is_active', true).maybeSingle(),
      supabase.from('team_members').select('team_id, teams!inner(owner_id)')
        .eq('user_id', clerkId).eq('status', 'active'),
      supabase.from('subscriptions').select('status, current_period_end').eq('user_id', clerkId),
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
        .eq('status', 'active').eq('is_active', true)

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

  const { tier, isAdmin, isPreserved, wlOnboardingPending } = await getAccessState(userId)

  // ── PHASE D2: ONBOARDING HARD-LOCK ─────────────────────────────────────
  // Manager+ user paid for WL but hasn't finished onboarding → lock them
  // to the allowlist. Admins bypass.
  if (wlOnboardingPending && !isAdmin) {
    if (!isOnboardingAllowedRoute(request)) {
      const lockUrl = new URL('/onboarding/whitelabel', request.url)
      return NextResponse.redirect(lockUrl, 307)
    }
    // They're on an allowed route — let it through. We still set the
    // tenant header if applicable.
    return withTenantHeader(NextResponse.next())
  }

  // Existing billing/onboarding bypass for non-locked users
  if (isBillingOrOnboardingRoute(request)) {
    return withTenantHeader(NextResponse.next())
  }

  if (isAdmin) {
    const res = NextResponse.next()
    res.headers.set('x-access-tier', 'active')
    res.headers.set('x-is-admin', '1')
    return withTenantHeader(res)
  }

  // ── PHASE D1: BRAND ACCESS ENFORCEMENT ─────────────────────────────────
  if (isProtectedAppRoute(request)) {
    const brandAccess = await lookupUserBrandAccess(userId)

    if (tenantSlug) {
      if (!brandAccess.accessibleSlugs.has(tenantSlug)) {
        const dest = pickRedirectDestination(brandAccess, url.pathname + url.search)
        return NextResponse.redirect(dest, 307)
      }
    } else {
      if (!brandAccess.canSeeStandard) {
        const dest = pickRedirectDestination(brandAccess, url.pathname + url.search)
        if (dest.host !== url.host) {
          return NextResponse.redirect(dest, 307)
        }
      }
    }
  }

  // ── NORMAL TIER GATES ──────────────────────────────────────────────────
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
        .select('status, current_period_end, stripe_subscription_id')
        .eq('user_id', clerkId)
        .order('created_at', { ascending: false }),
      supabase
        .from('users')
        .select('is_admin, wl_onboarding_status, wl_subscription_id')
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

    // ── WL ONBOARDING PENDING CHECK ──────────────────────────────────────
    // User has paid for WL (wl_subscription_id set) but hasn't completed
    // setup yet (wl_onboarding_status != 'complete'). They must finish
    // the wizard before they can use anything else.
    const wlOnboardingPending =
      !!userRow?.wl_subscription_id &&
      userRow?.wl_onboarding_status !== 'complete'

    // Determine tier from subscriptions
    let tier: AccessTier = 'new'
    if (subs && subs.length > 0) {
      const now = Date.now()
      tier = 'lapsed'
      for (const sub of subs) {
        if (ACTIVE_STATUSES.includes(sub.status)) {
          tier = 'active'
          break
        }
        if (
          sub.status === 'canceled' &&
          sub.current_period_end &&
          new Date(sub.current_period_end).getTime() > now
        ) {
          tier = 'active'
          break
        }
      }
    }

    return { tier, isAdmin, isPreserved, wlOnboardingPending }
  } catch (err) {
    console.error('[proxy] access state lookup failed:', err)
    return { tier: 'active', isAdmin: false, isPreserved: true, wlOnboardingPending: false }
  }
}

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|jsx?|json|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docb?x?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}