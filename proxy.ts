import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const isPublicRoute = createRouteMatcher([
  '/',
  '/sitemap.xml',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/welcome(.*)',
  '/api/auth/(.*)',
  '/terms',
  '/privacy',
  '/faq(.*)',
  '/dialing-modes(.*)',
  '/managers(.*)',
  '/white-label(.*)',
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

const ACTIVE_STATUSES = ['active']  // strict: only a paid, active sub grants access (no trials; past_due is locked)

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
// + TENANT ROOT ROUTING  (v26)
// + WELCOME SHOWCASE PUBLIC (v27)
// + POST-SIGNIN ROUTE PUBLIC (v28)
// =============================================================================
// v27: added '/welcome(.*)' to isPublicRoute. The post-signup showcase route
// (app/welcome) is diverted to by /api/auth/post-signin for brand-new users
// BEFORE billing. It must be public here so middleware doesn't intercept it
// and bounce a 'new'/'lapsed' user to /billing before the page renders — the
// page has its own server guard (lib/subscription.shouldSeeWelcome) that sends
// non-eligible users to /billing, so this is safe.
//
// v28: added '/api/auth/(.*)' to isPublicRoute. The matcher runs middleware on
// all /api/* routes, and /api/auth/post-signin was NOT public — so middleware
// ran the full tier gate and 307-redirected signed-in non-active users to
// /billing BEFORE the post-signin route handler ever executed. That's why the
// route's shouldSeeWelcome diversion never ran (the route was never reached).
// Making /api/auth/* public lets the request reach the handler, which then does
// its own auth() check and decides the destination (/welcome, tenant dashboard,
// or — by falling through — wherever). The handler is the intended owner of
// post-signin routing; middleware must not pre-empt it.
//
// v26: a live tenant subdomain now hosts its OWN branded auth/landing instead
// of bouncing the root to the apex.
//   - The root "/" was removed from MARKETING_ONLY_PATHS so it no longer
//     308s to dialerseat.com. (The true marketing pages — /vs, /faq,
//     /dialing-modes, /terms, /privacy, /managers, /white-label — still do.)
//   - On a live tenant subdomain, the root "/" is handled explicitly:
//       signed-out → /sign-in ON the subdomain (branded via x-tenant-slug;
//                    the sign-in page links to /sign-up)
//       signed-in  → /dashboard ON the subdomain
//     so visitors land on the tenant's branded experience, and members land
//     on their dashboard, all without leaving water.dialerseat.com.
// =============================================================================

const RESERVED_SUBDOMAINS = new Set([
  'www', 'app', 'api', 'admin', 'dashboard', 'static', 'cdn', 'assets',
  'mail', 'email', 'smtp', 'imap', 'pop',
  'docs', 'blog', 'help', 'support', 'status',
])

const PRIMARY_DOMAINS = ['dialerseat.com', 'localhost']

// NOTE (v26): the root "/" is intentionally NOT in this list. On a tenant
// subdomain the root hosts the branded auth/landing; only these true
// marketing pages are forced back to the apex.
const MARKETING_ONLY_PATHS = [
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
    // True marketing pages (/vs, /faq, etc.) live only on the apex — bounce
    // them. The root "/" is intentionally excluded (v26) so the subdomain can
    // host its own branded auth/landing below.
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

    // route.status === 'active' from here.
    // ── ROOT-PATH HANDLING on a live tenant subdomain (v26) ───────────────
    // Signed-out → branded /sign-in on this subdomain (the sign-in page links
    //   to /sign-up). Signed-in → /dashboard on this subdomain. Both stay on
    //   the subdomain so the experience is branded end to end.
    if (url.pathname === '/') {
      const { userId } = await auth()
      if (!userId) {
        const signInUrl = new URL('/sign-in', request.url)
        return withTenantHeader(NextResponse.redirect(signInUrl, 307))
      }
      const dashUrl = new URL('/dashboard', request.url)
      return withTenantHeader(NextResponse.redirect(dashUrl, 307))
    }
  }

  // ── PUBLIC ROUTES ──────────────────────────────────────────────────────
  if (isPublicRoute(request)) {
    const res = NextResponse.next()
    // Signal layout.tsx to skip whitelabel branding on the landing view
    // so logged-in WL users see default DialerSeat styles on /?view=landing.
    if (url.searchParams.get('view') === 'landing') {
      res.headers.set('x-landing-view', '1')
    }
    return withTenantHeader(res)
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
  // Strict rule: only an 'active' (paid) sub grants full access. Anyone else is
  // either READ-ONLY (they have preserved data — can view + export it) or has no
  // data and is sent to /welcome.
  if (tier === 'active') {
    const res = NextResponse.next()
    res.headers.set('x-access-tier', 'active')
    return withTenantHeader(res)
  }

  // Not active. If they have data on the account, they get READ-ONLY access:
  // they can view their data and export it, but cannot mutate anything.
  if (isPreserved) {
    const method = request.method.toUpperCase()
    const isMutating = method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE'
    const isApi = request.nextUrl.pathname.startsWith('/api/')

    // Allowlist of write-ish endpoints a read-only user must still reach:
    // data export/download, billing actions (to resubscribe), auth, and Stripe.
    const readOnlyAllowed =
      request.nextUrl.pathname.startsWith('/api/leads/export') ||
      request.nextUrl.pathname.startsWith('/api/campaigns/compliance-export') ||
      request.nextUrl.pathname.startsWith('/api/account/export') ||
      request.nextUrl.pathname.startsWith('/api/account/delete') ||
      request.nextUrl.pathname.startsWith('/api/stripe/') ||
      request.nextUrl.pathname.startsWith('/api/auth/') ||
      request.nextUrl.pathname.startsWith('/api/users/me')

    // Block every mutating API call that isn't on the allowlist — this is the
    // single enforcement point for read-only mode (no per-page wiring needed).
    if (isApi && isMutating && !readOnlyAllowed) {
      return NextResponse.json(
        { error: 'Read-only mode: an active subscription is required to make changes.', tier, readOnly: true },
        { status: 403 }
      )
    }

    // Reads and allowlisted writes pass through, flagged read-only so the UI can
    // hide/disable write controls.
    const res = NextResponse.next()
    res.headers.set('x-access-tier', tier)
    res.headers.set('x-data-preserved', '1')
    res.headers.set('x-read-only', '1')
    return withTenantHeader(res)
  }

  // No active sub AND no data on the account → /welcome every time (never
  // straight to billing). The welcome page is where they decide to subscribe.
  const welcomeUrl = new URL('/welcome', request.url)
  return NextResponse.redirect(welcomeUrl)
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