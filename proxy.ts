import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const isPublicRoute = createRouteMatcher([
  '/',
  '/sitemap.xml',
  '/sign-in(.*)',
  '/sign-up(.*)',
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

const isOnboardingAllowedRoute = createRouteMatcher([
  '/onboarding/whitelabel(.*)',
  '/api/whitelabel/onboarding(.*)',
  '/api/whitelabel/upload-logo(.*)',
  '/api/whitelabel/check-subdomain(.*)',
  '/billing(.*)',
  '/api/stripe/(.*)',
])

const isWhitelabelOnboardingRoute = createRouteMatcher([
  '/onboarding/whitelabel(.*)',
])

const ACTIVE_STATUSES = ['active']

type AccessTier = 'active' | 'lapsed' | 'new'

interface AccessState {
  tier: AccessTier
  isAdmin: boolean
  isPreserved: boolean

  wlOnboardingPending: boolean

  hasActiveWlSub: boolean
  hasActiveTeamAccess: boolean
}

interface UserBrandAccess {
  accessibleSlugs: Set<string>
  selectedSlug: string | null
  canSeeStandard: boolean
}

const RESERVED_SUBDOMAINS = new Set([
  'www', 'app', 'api', 'admin', 'dashboard', 'static', 'cdn', 'assets',
  'mail', 'email', 'smtp', 'imap', 'pop',
  'docs', 'blog', 'help', 'support', 'status',
])

const PRIMARY_DOMAINS = ['dialerseat.com', 'localhost']

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

export default clerkMiddleware(async (auth, request) => {
  const hostname = request.headers.get('host') || ''
  const tenantSlug = extractTenantSlug(hostname)
  const url = request.nextUrl

  const withTenantHeader = (res: NextResponse): NextResponse => {
    if (tenantSlug) res.headers.set('x-tenant-slug', tenantSlug)
    return res
  }

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

    if (url.pathname === '/') {

      if (url.searchParams.get('view') === 'landing') {
        const mainUrl = new URL(url.pathname + url.search, 'https://dialerseat.com')

        mainUrl.searchParams.set('tenant', tenantSlug)
        return withTenantHeader(NextResponse.redirect(mainUrl, 307))
      }

      const { userId } = await auth()
      if (!userId) {
        const signInUrl = new URL('/sign-in', request.url)
        return withTenantHeader(NextResponse.redirect(signInUrl, 307))
      }
      const dashUrl = new URL('/dashboard', request.url)
      return withTenantHeader(NextResponse.redirect(dashUrl, 307))
    }
  }

  if (
    url.pathname === '/' &&
    !tenantSlug &&
    url.searchParams.get('view') !== 'landing'
  ) {
    const { userId: rootUserId } = await auth()
    if (rootUserId) {
      const brandAccess = await lookupUserBrandAccess(rootUserId)
      const targetSlug = brandAccess.selectedSlug || Array.from(brandAccess.accessibleSlugs)[0] || null
      if (targetSlug) {
        const dashUrl = new URL('/dashboard', `https://${targetSlug}.dialerseat.com`)
        return NextResponse.redirect(dashUrl, 307)
      }
    }
  }

  if (isPublicRoute(request)) {
    const res = NextResponse.next()
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

  const { tier, isAdmin, isPreserved, wlOnboardingPending, hasActiveWlSub } = await getAccessState(userId)

  if (wlOnboardingPending && !isAdmin) {
    if (!isOnboardingAllowedRoute(request)) {
      const lockUrl = new URL('/onboarding/whitelabel', request.url)
      return NextResponse.redirect(lockUrl, 307)
    }
    return withTenantHeader(NextResponse.next())
  }

  if (isWhitelabelOnboardingRoute(request) && !isAdmin) {
    if (!hasActiveWlSub) {
      const billingUrl = new URL('/billing?plan=wl', request.url)
      return NextResponse.redirect(billingUrl, 307)
    }
  }

  if (isBillingOrOnboardingRoute(request)) {
    return withTenantHeader(NextResponse.next())
  }

  if (isAdmin) {
    const res = NextResponse.next()
    res.headers.set('x-access-tier', 'active')
    res.headers.set('x-is-admin', '1')
    return withTenantHeader(res)
  }

  if (isProtectedAppRoute(request)) {
    const brandAccess = await lookupUserBrandAccess(userId)

    if (tenantSlug) {
      if (!brandAccess.accessibleSlugs.has(tenantSlug)) {
        const dest = pickRedirectDestination(brandAccess, url.pathname + url.search)
        return NextResponse.redirect(dest, 307)
      }
    } else {

      const dest = pickRedirectDestination(brandAccess, url.pathname + url.search)
      if (dest.host !== url.host) {
        return NextResponse.redirect(dest, 307)
      }
    }
  }

  if (tier === 'active') {
    const res = NextResponse.next()
    res.headers.set('x-access-tier', 'active')
    return withTenantHeader(res)
  }

  if (isPreserved) {
    const method = request.method.toUpperCase()
    const isMutating = method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE'
    const isApi = request.nextUrl.pathname.startsWith('/api/')

    const readOnlyAllowed =
      request.nextUrl.pathname.startsWith('/api/leads/export') ||
      request.nextUrl.pathname.startsWith('/api/campaigns/compliance-export') ||
      request.nextUrl.pathname.startsWith('/api/account/export') ||
      request.nextUrl.pathname.startsWith('/api/account/delete') ||
      request.nextUrl.pathname.startsWith('/api/stripe/') ||
      request.nextUrl.pathname.startsWith('/api/auth/') ||
      request.nextUrl.pathname.startsWith('/api/users/me')

    if (isApi && isMutating && !readOnlyAllowed) {
      return NextResponse.json(
        { error: 'Read-only mode: an active subscription is required to make changes.', tier, readOnly: true },
        { status: 403 }
      )
    }

    const res = NextResponse.next()
    res.headers.set('x-access-tier', tier)
    res.headers.set('x-data-preserved', '1')
    res.headers.set('x-read-only', '1')
    return withTenantHeader(res)
  }

  if (url.pathname.startsWith('/welcome')) {
    return withTenantHeader(NextResponse.next())
  }

  const welcomeUrl = new URL('/welcome', request.url)
  return withTenantHeader(NextResponse.redirect(welcomeUrl, 307))
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

const ACCESS_STATE_CACHE = new Map<string, { state: AccessState; expires: number }>()

async function getAccessState(clerkId: string): Promise<AccessState> {
  const cached = ACCESS_STATE_CACHE.get(clerkId)
  if (cached && cached.expires > Date.now()) return cached.state

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const WL_PRICE_ID = process.env.STRIPE_PRICE_WL_BASE || ''

    const [
      { data: subs },
      { data: userRow },
      { data: preservedRow },
      { data: activeMembership },
    ] = await Promise.all([
      supabase
        .from('subscriptions')
        .select('status, current_period_end, stripe_subscription_id, stripe_price_id')
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
      // Team members don't carry their own subscription row — billing for
      // a seat is either absorbed by the team owner or handled entirely
      // outside the `subscriptions` table (free/public campaign access).
      // Without this, any active team member with no personal Stripe
      // subscription reads as tier "new" below and gets bounced to
      // /welcome on every single page — a real active member, locked out
      // of the app entirely.
      supabase
        .from('team_members')
        .select('id')
        .eq('user_id', clerkId)
        .eq('status', 'active')
        .limit(1)
        .maybeSingle(),
    ])

    const isAdmin = !!userRow?.is_admin
    const isPreserved = !!preservedRow
    const hasActiveTeamAccess = !!activeMembership

    const now = Date.now()
    let hasActiveWlSub = false
    if (WL_PRICE_ID) {
      hasActiveWlSub = (subs || []).some(
        s => s.stripe_price_id === WL_PRICE_ID && s.status === 'active'
      )
    } else {

      hasActiveWlSub = !!userRow?.wl_subscription_id
    }

    const wlOnboardingPending =
      hasActiveWlSub &&
      userRow?.wl_onboarding_status !== 'complete'

    let tier: AccessTier = 'new'
    if (subs && subs.length > 0) {
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

    // An active team member's access comes from the team, not a personal
    // subscription — never let the personal-billing tier lock them out.
    if (tier !== 'active' && hasActiveTeamAccess) {
      tier = 'active'
    }

    const state: AccessState = { tier, isAdmin, isPreserved, wlOnboardingPending, hasActiveWlSub, hasActiveTeamAccess }

    // Only cache a result that's safe to serve stale for the next minute.
    // "active" (and admin) status rarely flips moment-to-moment, so caching
    // it just saves redundant Supabase round trips. A non-active tier is a
    // different story: this is exactly the state a user is in for a few
    // seconds right after paying, while Stripe's webhook is still in flight.
    // Caching that "not active yet" verdict for a full 60s means every
    // request in that window — including the redirect straight back from
    // /welcome to /billing to /dashboard — keeps reading the same stale
    // answer, which is what produced the /dashboard <-> /welcome bounce.
    // Skipping the cache here means each request re-checks Supabase, so the
    // very next request after the webhook lands sees the real, active state.
    if (tier === 'active' || isAdmin) {
      ACCESS_STATE_CACHE.set(clerkId, { state, expires: Date.now() + CACHE_TTL_MS })
    } else {
      ACCESS_STATE_CACHE.delete(clerkId)
    }

    return state
  } catch (err) {
    console.error('[proxy] access state lookup failed:', err)
    return { tier: 'active', isAdmin: false, isPreserved: true, wlOnboardingPending: false, hasActiveWlSub: false, hasActiveTeamAccess: false }
  }
}

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|jsx?|json|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docb?x?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}