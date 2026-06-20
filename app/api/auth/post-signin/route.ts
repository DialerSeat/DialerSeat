import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { headers } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { getAccessTier } from '@/lib/subscription'

// =============================================================================
// /api/auth/post-signin — smart cross-subdomain redirect + tenant cookie
// =============================================================================
// Clerk's <SignIn /> is configured with forceRedirectUrl="/api/auth/post-signin"
// so every successful sign-in lands here first. This handler decides which
// {subdomain}.dialerseat.com to land the user on based on tenant affiliation.
//
// v3 (this push): SHOWCASE DIVERSION FOR BRAND-NEW USERS. Right after the admin
// short-circuit, we check the user's access tier (lib/subscription.getAccessTier).
// A 'new' user — never subscribed AND never on a paid team seat — is sent to
// /welcome (the post-signup product showcase) BEFORE anything else, so they see
// the pitch before billing. 'active' and 'lapsed' users fall through to the
// existing tenant routing completely untouched: active users reach their
// dashboard, lapsed users go wherever they went before (and hit the normal
// billing gate as they do today). Only brand-new users are diverted.
//
//   - /welcome is a standalone full-screen route (app/welcome/page.tsx). Its
//     GET STARTED / SKIP buttons push the user forward to /billing. It is NOT
//     behind the billing gate, so there is no redirect loop: the user only
//     reaches it via this diversion and leaves it via its own buttons. A small
//     server guard on /welcome bounces any non-'new' user who lands there
//     manually, so an active/lapsed user can't sit on it.
//
// v2: ADMIN SHORT-CIRCUIT. Before any tenant routing, if the signed-in user is
// an admin (users.is_admin = true) we send them straight to the admin desktop
// (/dashboard/admin/desktop) on the current host.
//
// Push D: also drops a ds_last_tenant cookie at the parent domain so the
// NEXT visit to dialerseat.com/sign-in from this browser can be branded for
// the tenant the user belongs to, even before they're signed in.
//
// Routing rules:
//   0a. Signed in AND user is an admin → /dashboard/admin/desktop. [v2]
//   0b. Signed in AND access tier is 'new' → /welcome (showcase). [v3]
//   1. Signed in on blank.dialerseat.com AND user is part of blank →
//      stay on blank.dialerseat.com/dashboard/analytics
//   2. Signed in on blank.dialerseat.com AND user is NOT part of blank →
//      redirect to their tenant's subdomain (active_tenant_id > owned > member)
//   3. Signed in on dialerseat.com AND user is affiliated with a tenant →
//      auto-redirect to that tenant's subdomain
//   4. No tenant affiliation anywhere → dialerseat.com/dashboard/analytics
//
// Dev safety: when host is localhost/127.0.0.1, skip cross-subdomain bouncing
// and just land on /dashboard/analytics on the current host.
// =============================================================================

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'dialerseat.com'
const TARGET_PATH = '/dashboard/analytics'
const ADMIN_PATH = '/dashboard/admin/desktop' // v2: the admin desktop
const WELCOME_PATH = '/welcome'               // v3: the post-signup showcase
const TENANT_COOKIE_NAME = 'ds_last_tenant'
const TENANT_COOKIE_MAX_AGE = 60 * 60 * 24 * 90 // 90 days

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

type Tenant = {
  id: string
  slug: string
  status?: string
  owner_clerk_id?: string | null
}

function isDevHost(host: string): boolean {
  return host.startsWith('localhost') || host.startsWith('127.0.0.1')
}

function buildDest(slug: string | null, host: string): string {
  if (isDevHost(host)) {
    const protocol = host.startsWith('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https'
    return `${protocol}://${host}${TARGET_PATH}`
  }
  if (slug) {
    return `https://${slug}.${ROOT_DOMAIN}${TARGET_PATH}`
  }
  return `https://${ROOT_DOMAIN}${TARGET_PATH}`
}

// v2: admin always lands on the desktop on the CURRENT host (no subdomain
// bouncing). Works on dev hosts too.
function buildAdminDest(host: string): string {
  const protocol = isDevHost(host) ? 'http' : 'https'
  return `${protocol}://${host}${ADMIN_PATH}`
}

// v3: brand-new user lands on the showcase on the CURRENT host. Same host so
// the (possibly tenant-subdomain) sign-in context is preserved; the showcase
// itself is host-agnostic and just leads to /billing.
function buildWelcomeDest(host: string): string {
  const protocol = isDevHost(host) ? 'http' : 'https'
  return `${protocol}://${host}${WELCOME_PATH}`
}

// Set the ds_last_tenant cookie (or delete it if no slug) so the root-domain
// sign-in page can brand for this browser's tenant on next visit. Cookie
// scoped to the parent domain so subdomains can also see/clear it.
function setOrClearTenantCookie(
  response: NextResponse,
  slug: string | null,
  host: string
): void {
  if (isDevHost(host)) {
    if (slug) {
      response.cookies.set(TENANT_COOKIE_NAME, slug, {
        path: '/',
        maxAge: TENANT_COOKIE_MAX_AGE,
        httpOnly: true,
        sameSite: 'lax',
      })
    } else {
      response.cookies.delete(TENANT_COOKIE_NAME)
    }
    return
  }

  if (slug) {
    response.cookies.set(TENANT_COOKIE_NAME, slug, {
      domain: `.${ROOT_DOMAIN}`,
      path: '/',
      maxAge: TENANT_COOKIE_MAX_AGE,
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
    })
  } else {
    response.cookies.set(TENANT_COOKIE_NAME, '', {
      domain: `.${ROOT_DOMAIN}`,
      path: '/',
      maxAge: 0,
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
    })
  }
}

// Build a redirect response with the tenant cookie attached.
function redirectWithTenantCookie(
  slug: string | null,
  host: string
): NextResponse {
  const response = NextResponse.redirect(buildDest(slug, host), 302)
  setOrClearTenantCookie(response, slug, host)
  return response
}

// v2: admin redirect to the desktop, clearing any stale tenant cookie.
function redirectAdminToDesktop(host: string): NextResponse {
  const response = NextResponse.redirect(buildAdminDest(host), 302)
  setOrClearTenantCookie(response, null, host)
  return response
}

// v3: brand-new user redirect to the showcase. We do NOT touch the tenant
// cookie here — a brand-new user has no tenant affiliation to record.
function redirectToWelcome(host: string): NextResponse {
  return NextResponse.redirect(buildWelcomeDest(host), 302)
}

async function isAdmin(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('users')
    .select('is_admin')
    .eq('clerk_id', userId)
    .maybeSingle()
  if (error) {
    console.error('[post-signin] isAdmin lookup error:', error)
    return false
  }
  return data?.is_admin === true
}

async function findActiveTenantBySlug(slug: string): Promise<Tenant | null> {
  const { data, error } = await supabase
    .from('white_label_tenants')
    .select('id, slug, status, owner_clerk_id')
    .eq('slug', slug)
    .eq('status', 'active')
    .maybeSingle()
  if (error) {
    console.error('[post-signin] findActiveTenantBySlug error:', error)
    return null
  }
  return data as Tenant | null
}

async function isUserAffiliatedWithTenant(
  userId: string,
  tenantId: string,
  ownerClerkId: string | null | undefined
): Promise<boolean> {
  if (ownerClerkId === userId) return true

  const { data: members, error: mErr } = await supabase
    .from('team_members')
    .select('team_id')
    .eq('user_id', userId)
    .eq('status', 'active')
  if (mErr) {
    console.error('[post-signin] team_members lookup error:', mErr)
    return false
  }
  if (!members || members.length === 0) return false

  const teamIds = members.map(m => m.team_id).filter(Boolean)
  if (teamIds.length === 0) return false

  const { data: teams, error: tErr } = await supabase
    .from('teams')
    .select('id')
    .in('id', teamIds)
    .eq('tenant_id', tenantId)
    .limit(1)
  if (tErr) {
    console.error('[post-signin] teams lookup error:', tErr)
    return false
  }
  return (teams?.length || 0) > 0
}

async function resolvePreferredTenant(userId: string): Promise<Tenant | null> {
  // 1. users.active_tenant_id
  const { data: userRow, error: uErr } = await supabase
    .from('users')
    .select('active_tenant_id')
    .eq('clerk_id', userId)
    .maybeSingle()
  if (uErr) {
    console.error('[post-signin] users lookup error:', uErr)
  }

  if (userRow?.active_tenant_id) {
    const { data, error } = await supabase
      .from('white_label_tenants')
      .select('id, slug, status, owner_clerk_id')
      .eq('id', userRow.active_tenant_id)
      .eq('status', 'active')
      .maybeSingle()
    if (!error && data) return data as Tenant
  }

  // 2. Earliest owned tenant
  const { data: owned, error: oErr } = await supabase
    .from('white_label_tenants')
    .select('id, slug, status, owner_clerk_id')
    .eq('owner_clerk_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (oErr) {
    console.error('[post-signin] owned tenant lookup error:', oErr)
  }
  if (owned) return owned as Tenant

  // 3. Any active team membership → tenant
  const { data: members, error: mErr } = await supabase
    .from('team_members')
    .select('team_id')
    .eq('user_id', userId)
    .eq('status', 'active')
  if (mErr) {
    console.error('[post-signin] member tenant lookup (members) error:', mErr)
    return null
  }
  if (!members || members.length === 0) return null

  const teamIds = members.map(m => m.team_id).filter(Boolean)
  if (teamIds.length === 0) return null

  const { data: teams, error: tErr } = await supabase
    .from('teams')
    .select('tenant_id')
    .in('id', teamIds)
    .not('tenant_id', 'is', null)
  if (tErr) {
    console.error('[post-signin] member tenant lookup (teams) error:', tErr)
    return null
  }
  const tenantIds = (teams || []).map(t => t.tenant_id).filter(Boolean) as string[]
  if (tenantIds.length === 0) return null

  const { data: tenant, error: tnErr } = await supabase
    .from('white_label_tenants')
    .select('id, slug, status, owner_clerk_id')
    .in('id', tenantIds)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()
  if (tnErr) {
    console.error('[post-signin] member tenant lookup (tenant) error:', tnErr)
    return null
  }
  return (tenant as Tenant) || null
}

export async function GET(req: NextRequest) {
  const host = req.headers.get('host') || ROOT_DOMAIN

  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.redirect(new URL('/sign-in', req.url))
    }

    // Step 0a (v2): admins go straight to the desktop, regardless of host or
    // tenant affiliation. Clears any stale tenant cookie on the way.
    if (await isAdmin(userId)) {
      return redirectAdminToDesktop(host)
    }

    // Step 0b (v3): brand-new users (never subscribed, never on a paid seat)
    // see the product showcase before anything else. Active and lapsed users
    // fall through to the normal tenant routing below, untouched.
    try {
      const tier = await getAccessTier(userId)
      if (tier === 'new') {
        return redirectToWelcome(host)
      }
    } catch (tierErr) {
      // Fail open: if the tier check errors, don't trap the user on the
      // showcase — fall through to normal routing.
      console.error('[post-signin] access tier check failed:', tierErr)
    }

    const h = await headers()
    const currentSlug = h.get('x-tenant-slug')

    // Step 1: If on a subdomain, check affiliation with that tenant.
    if (currentSlug) {
      const currentTenant = await findActiveTenantBySlug(currentSlug)
      if (currentTenant) {
        const affiliated = await isUserAffiliatedWithTenant(
          userId,
          currentTenant.id,
          currentTenant.owner_clerk_id
        )
        if (affiliated) {
          return redirectWithTenantCookie(currentTenant.slug, host)
        }
      }
    }

    // Step 2: Resolve user's preferred tenant.
    const preferred = await resolvePreferredTenant(userId)
    if (preferred) {
      return redirectWithTenantCookie(preferred.slug, host)
    }

    // Step 3: No tenant affiliation — regular DialerSeat user. Clear
    // any stale cookie so this browser stops branding for a tenant
    // the user no longer belongs to.
    return redirectWithTenantCookie(null, host)
  } catch (err) {
    console.error('[post-signin] unexpected error:', err)
    return NextResponse.redirect(new URL(TARGET_PATH, req.url))
  }
}