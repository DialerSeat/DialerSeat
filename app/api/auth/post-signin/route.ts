import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { headers } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

// =============================================================================
// /api/auth/post-signin — smart cross-subdomain redirect + tenant cookie
// =============================================================================
// Clerk's <SignIn /> is configured with forceRedirectUrl="/api/auth/post-signin"
// so every successful sign-in lands here first. This handler decides which
// {subdomain}.dialerseat.com to land the user on based on tenant affiliation.
//
// v2 (this push): ADMIN SHORT-CIRCUIT. Before any tenant routing, if the
// signed-in user is an admin (users.is_admin = true) we send them straight to
// the admin desktop (/dashboard/admin/analytics) on the current host. The
// admin previously fell through to the plain /dashboard/analytics dead page
// because they own no tenant. Admins are never auto-bounced to a tenant
// subdomain; the desktop's Demo View handles viewing tenant sites. We still
// drop/refresh the ds_last_tenant cookie the same way (cleared for the admin,
// since they have no tenant affiliation of their own).
//
// Push D: also drops a ds_last_tenant cookie at the parent domain so the
// NEXT visit to dialerseat.com/sign-in from this browser can be branded for
// the tenant the user belongs to, even before they're signed in. Without
// this cookie the root-domain sign-in page has no way to know which tenant
// the user belongs to, and falls back to default DialerSeat chrome.
//
// Routing rules (JC item 1, post-signin):
//   0. Signed in AND user is an admin → /dashboard/admin/analytics on the
//      current host (the desktop). No subdomain bouncing. [v2]
//   1. Signed in on blank.dialerseat.com AND user is part of blank →
//      stay on blank.dialerseat.com/dashboard/analytics
//   2. Signed in on blank.dialerseat.com AND user is NOT part of blank →
//      redirect to their tenant's subdomain (active_tenant_id > owned > member)
//   3. Signed in on dialerseat.com AND user is affiliated with a tenant →
//      auto-redirect to that tenant's subdomain
//   4. No tenant affiliation anywhere → dialerseat.com/dashboard/analytics
//
// "Part of a tenant" means:
//   - white_label_tenants.owner_clerk_id = userId  (tenant owner), OR
//   - team_members.user_id = userId AND status='active' AND the team's
//     teams.tenant_id matches the tenant in question.
//
// Tiebreaker for multiple-tenant affiliation: users.active_tenant_id.
// Then earliest owned, then any membership tenant.
//
// Dev safety: when host is localhost/127.0.0.1, skip cross-subdomain bouncing
// and just land on /dashboard/analytics on the current host. Subdomain
// resolution in dev needs more setup than this handler can do.
// =============================================================================

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'dialerseat.com'
const TARGET_PATH = '/dashboard/analytics'
const ADMIN_PATH = '/dashboard/admin/analytics' // v2: the admin desktop
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

// Set the ds_last_tenant cookie (or delete it if no slug) so the root-domain
// sign-in page can brand for this browser's tenant on next visit. Cookie
// scoped to the parent domain so subdomains can also see/clear it.
function setOrClearTenantCookie(
  response: NextResponse,
  slug: string | null,
  host: string
): void {
  if (isDevHost(host)) {
    // Dev: skip the domain attribute (won't work cross-port on localhost),
    // skip secure flag. Still useful for same-host testing.
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
    // Delete any stale cookie from a previous tenant affiliation. The
    // delete needs to match the original domain scope to actually clear.
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

    // Step 0 (v2): admins go straight to the desktop, regardless of host or
    // tenant affiliation. Clears any stale tenant cookie on the way.
    if (await isAdmin(userId)) {
      return redirectAdminToDesktop(host)
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