import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { headers } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

// =============================================================================
// /api/auth/post-signin — smart cross-subdomain redirect after Clerk sign-in
// =============================================================================
// Clerk's <SignIn /> is configured with forceRedirectUrl="/api/auth/post-signin"
// so every successful sign-in lands here first. This handler decides which
// {subdomain}.dialerseat.com to land the user on based on tenant affiliation.
//
// Routing rules (JC item 1, post-signin):
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
// Tiebreaker for multiple-tenant affiliation (Q3): users.active_tenant_id.
// Then earliest owned, then any membership tenant.
//
// Dev safety: when host is localhost/127.0.0.1, skip cross-subdomain bouncing
// and just land on /dashboard/analytics on the current host. Subdomain
// resolution in dev needs more setup than this handler can do.
// =============================================================================

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'dialerseat.com'
const TARGET_PATH = '/dashboard/analytics'

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
    // In dev, can't safely jump subdomains. Just land on current host.
    const protocol = host.startsWith('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https'
    return `${protocol}://${host}${TARGET_PATH}`
  }
  if (slug) {
    return `https://${slug}.${ROOT_DOMAIN}${TARGET_PATH}`
  }
  return `https://${ROOT_DOMAIN}${TARGET_PATH}`
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

  // Get user's active team memberships.
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

  // Check if any of those teams belong to the tenant in question.
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
  // 1. users.active_tenant_id (JC's Q3 tiebreaker)
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
      // Not actually signed in — send back to sign-in on this host.
      return NextResponse.redirect(new URL('/sign-in', req.url))
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
          // Stay on this subdomain.
          return NextResponse.redirect(buildDest(currentTenant.slug, host), 302)
        }
        // Else: user landed on a subdomain they aren't part of.
        // Fall through to preferred-tenant routing.
      }
      // currentTenant null means the slug doesn't match an active tenant.
      // Also fall through.
    }

    // Step 2: Resolve user's preferred tenant.
    const preferred = await resolvePreferredTenant(userId)
    if (preferred) {
      return NextResponse.redirect(buildDest(preferred.slug, host), 302)
    }

    // Step 3: No tenant affiliation — regular DialerSeat user.
    return NextResponse.redirect(buildDest(null, host), 302)
  } catch (err) {
    console.error('[post-signin] unexpected error:', err)
    // Safe fallback: stay on current host dashboard.
    return NextResponse.redirect(new URL(TARGET_PATH, req.url))
  }
}