import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'

// =============================================================================
// TENANT SCOPE — the security + data-resolution layer for the Manager+ desktop
// =============================================================================
// Two jobs, both reused by every /api/manager/* (a.k.a. tenant) route so each
// future app-API swap is trivial:
//
//   1. requireTenantOwner() — the GUARD. Resolves the signed-in user to the
//      active white-label tenant they OWN. Throws if they're not signed in or
//      don't own an active tenant. This is the boundary: tenant routes call
//      this FIRST, exactly like admin routes call requireAdmin(). The security
//      boundary is the ROUTE, never a query param — a tenant can never reach
//      sitewide data because these routes only ever resolve THEIR tenant.
//
//   2. getTenantUserIds() — the RESOLVER. leads and campaigns are scoped ONLY
//      by user_id (no tenant_id/team_id on them), so "all of this tenant's
//      data" means: the owner's own user_id, PLUS every active member of every
//      team linked to the tenant. Chain:
//        tenant.id
//          → teams WHERE tenant_id = tenant.id
//          → team_members WHERE team_id IN (...) AND status='active'
//          → distinct user_id  (+ the owner's own clerk id)
//      Hand that array to any query as `.in('user_id', ids)` and you've scoped
//      it to the whole tenant, aggregated across every seat.
//
// NOTE: today every team has tenant_id = NULL, so getTenantUserIds() returns
// just the owner until teams are linked. To test the aggregated path, set a
// team's tenant_id to the demo tenant id (91789e76-6d7c-4cf5-af52-06b47a6b5c53).
// =============================================================================

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

export interface OwnedTenant {
  id: string
  slug: string
  brand_name: string
  owner_clerk_id: string
  primary_color: string
  sidebar_color: string
  header_bg_color: string
  page_bg_color: string
  logo_url: string | null
}

// Thrown when the caller isn't a Manager+ owner. Route handlers catch this and
// return 401/403 — mirrors how requireAdmin() throws for non-admins.
export class TenantOwnerError extends Error {
  status: number
  constructor(message: string, status = 403) {
    super(message)
    this.name = 'TenantOwnerError'
    this.status = status
  }
}

// THE GUARD. Call at the top of every tenant route. Returns the owned tenant
// or throws TenantOwnerError. Optionally pass an expected tenantId to assert
// the caller owns THAT specific tenant (defense in depth if a route ever takes
// a tenant id from the client — it must match what they actually own).
export async function requireTenantOwner(expectTenantId?: string): Promise<OwnedTenant> {
  const { userId } = await auth()
  if (!userId) throw new TenantOwnerError('Not authenticated', 401)

  const { data, error } = await supabase
    .from('white_label_tenants')
    .select('id, slug, brand_name, owner_clerk_id, primary_color, sidebar_color, header_bg_color, page_bg_color, logo_url, status')
    .eq('owner_clerk_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (error) throw new TenantOwnerError('Tenant lookup failed', 500)
  if (!data) throw new TenantOwnerError('Not a Manager+ owner', 403)

  if (expectTenantId && expectTenantId !== data.id) {
    // They asked for a tenant that isn't theirs. Refuse.
    throw new TenantOwnerError('Tenant does not belong to caller', 403)
  }

  return {
    id: data.id,
    slug: data.slug,
    brand_name: data.brand_name,
    owner_clerk_id: data.owner_clerk_id,
    primary_color: data.primary_color || '#4a9eff',
    sidebar_color: data.sidebar_color || '#1a1a2e',
    header_bg_color: data.header_bg_color || '#1a1a2e',
    page_bg_color: data.page_bg_color || '#0a0a14',
    logo_url: data.logo_url ?? null,
  }
}

// THE RESOLVER. Every user_id whose leads/campaigns/etc. belong to this tenant:
// the owner plus all active members of all teams linked to the tenant. Always
// includes the owner even if no teams are linked yet. De-duplicated.
export async function getTenantUserIds(tenantId: string, ownerClerkId: string): Promise<string[]> {
  const ids = new Set<string>()
  ids.add(ownerClerkId) // the owner's own data always counts

  // tenant → teams
  const { data: teams, error: teamsErr } = await supabase
    .from('teams')
    .select('id')
    .eq('tenant_id', tenantId)

  if (teamsErr) {
    console.error('[getTenantUserIds] teams lookup error:', teamsErr)
    return Array.from(ids)
  }
  const teamIds = (teams ?? []).map(t => t.id)
  if (teamIds.length === 0) return Array.from(ids)

  // teams → active members
  const { data: members, error: memErr } = await supabase
    .from('team_members')
    .select('user_id')
    .in('team_id', teamIds)
    .eq('status', 'active')

  if (memErr) {
    console.error('[getTenantUserIds] members lookup error:', memErr)
    return Array.from(ids)
  }
  for (const m of members ?? []) {
    if (m.user_id) ids.add(m.user_id)
  }
  return Array.from(ids)
}

// Convenience: guard + resolve in one call for the common case.
export async function requireTenantScope(): Promise<{ tenant: OwnedTenant; userIds: string[] }> {
  const tenant = await requireTenantOwner()
  const userIds = await getTenantUserIds(tenant.id, tenant.owner_clerk_id)
  return { tenant, userIds }
}