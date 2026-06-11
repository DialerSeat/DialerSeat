import 'server-only'
import { createClient } from '@supabase/supabase-js'
import { unstable_cache } from 'next/cache'

// =============================================================================
// TENANT BRANDING LOOKUP — server-side helper (v6 — strict NULL semantics)
// =============================================================================
// v6 (Push B): fetchActiveTenantForUser respects NULL.
//
// Before: if active_tenant_id was NULL but the user had ANY accessible
// tenant (owned WL OR active team membership of a WL-owner team), the
// function silently picked the first accessible tenant. Result: a user
// could not see the standard DialerSeat view by setting active_tenant_id
// to NULL — the resolver always overrode their preference. The settings-
// page "switch to DialerSeat default" bug lived here.
//
// After: NULL means "show standard view". The fallback is gone. If
// active_tenant_id is a uuid AND the user has access to it → use it.
// Otherwise → return null and let the caller render the standard view.
//
// To preserve existing users' implicit-WL view, migration 010 backfills
// active_tenant_id from owned WL and most-recent active team membership
// for users whose value was NULL before this push.
//
// v5 (migration 004): adds header_bg_color so the dashboard header strip
// can be themed independently of the sidebar.
// v4 (migration 003): added page_bg_color.
// v3 (Phase B2): trimmed the interface down.
//
// Caching unchanged. Tags unchanged. Other functions byte-for-byte v5.
// =============================================================================

export interface TenantBranding {
  id: string
  slug: string
  brand_name: string
  logo_url: string | null
  favicon_url: string | null
  footer_text: string
  primary_color: string
  sidebar_color: string
  header_bg_color: string
  page_bg_color: string
  custom_landing: Record<string, unknown>
}

export interface AvailableTenant {
  id: string
  slug: string
  brand_name: string
  logo_url: string | null
  role: 'owner' | 'member'
}

export interface UserBrandOptions {
  available: AvailableTenant[]
  canSeeStandard: boolean
  currentTenantId: string | null
}

function getSupabaseAnon() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const TENANT_BRANDING_COLS =
  'id, slug, brand_name, logo_url, favicon_url, footer_text, primary_color, sidebar_color, header_bg_color, page_bg_color, custom_landing'

// =============================================================================
// SUBDOMAIN LOOKUP (v1 contract preserved)
// =============================================================================

async function fetchTenantBranding(slug: string): Promise<TenantBranding | null> {
  const supabase = getSupabaseAnon()
  const { data, error } = await supabase
    .from('tenant_branding')
    .select(TENANT_BRANDING_COLS)
    .eq('slug', slug)
    .maybeSingle()

  if (error) {
    console.error(`[tenant] branding lookup failed for ${slug}:`, error)
    return null
  }
  if (!data) return null
  return {
    ...data,
    custom_landing: (data.custom_landing as Record<string, unknown>) || {},
  } as TenantBranding
}

export async function getTenantBranding(
  slug: string | null | undefined
): Promise<TenantBranding | null> {
  if (!slug) return null

  const cached = unstable_cache(
    () => fetchTenantBranding(slug),
    ['tenant-branding-by-slug', slug],
    {
      revalidate: 60,
      tags: [`tenant:${slug}`],
    }
  )

  return cached()
}

export const tenantCacheTag = (slug: string) => `tenant:${slug}`
export const userCacheTag = (clerkId: string) => `user-tenant:${clerkId}`

// =============================================================================
// USER → TENANT LOOKUP — v6 (strict NULL)
// =============================================================================

/**
 * Returns the tenant to render for this user, based on their selected
 * preference (users.active_tenant_id) AND their actual access rights.
 *
 *   active_tenant_id IS NULL  → return null (standard DialerSeat view)
 *   active_tenant_id is uuid AND user has access → return that tenant
 *   active_tenant_id is uuid AND user lost access → return null
 *     (stale value, user can re-pick from settings or join again)
 *
 * The previous fall-through to uniqueAccessible[0] is GONE — it was the
 * reason "switch to DialerSeat default" silently did nothing for any
 * user who also owned or belonged to a WL tenant.
 *
 * Cached with a user tag. Switching brands, joining a team, or editing
 * tenant branding all bust the cache via revalidateTag(userCacheTag).
 */
async function fetchActiveTenantForUser(clerkId: string): Promise<TenantBranding | null> {
  const supabase = getSupabaseAdmin()

  const { data: user } = await supabase
    .from('users')
    .select('active_tenant_id')
    .eq('clerk_id', clerkId)
    .maybeSingle()

  const selectedTenantId = user?.active_tenant_id || null

  // NULL means "standard view". Short-circuit — no need to load access
  // lists or branding when the user has explicitly opted out of WL view.
  if (!selectedTenantId) {
    return null
  }

  // Compute the user's accessible tenant set so we can verify their
  // selection is still valid. If they got removed from a team or the
  // tenant got deactivated, fall through to null (standard view).
  const [{ data: ownedTenant }, { data: memberRows }] = await Promise.all([
    supabase
      .from('white_label_tenants')
      .select('id')
      .eq('owner_clerk_id', clerkId)
      .eq('status', 'active')
      .eq('is_active', true)
      .maybeSingle(),
    supabase
      .from('team_members')
      .select('teams!inner(owner_id)')
      .eq('user_id', clerkId)
      .eq('status', 'active'),
  ])

  const accessibleTenantIds = new Set<string>()
  if (ownedTenant) accessibleTenantIds.add(ownedTenant.id)

  const ownerClerkIds: string[] = []
  for (const row of memberRows || []) {
    const ownerId = (row as any).teams?.owner_id
    if (ownerId) ownerClerkIds.push(ownerId)
  }

  if (ownerClerkIds.length > 0) {
    const { data: teamOwnerTenants } = await supabase
      .from('white_label_tenants')
      .select('id')
      .in('owner_clerk_id', ownerClerkIds)
      .eq('status', 'active')
      .eq('is_active', true)

    for (const t of teamOwnerTenants || []) {
      accessibleTenantIds.add(t.id)
    }
  }

  // Selection no longer accessible → fall back to standard view rather
  // than silently switching the user to a different tenant. They can
  // re-pick from settings.
  if (!accessibleTenantIds.has(selectedTenantId)) {
    return null
  }

  const { data: branding } = await supabase
    .from('tenant_branding')
    .select(TENANT_BRANDING_COLS)
    .eq('id', selectedTenantId)
    .maybeSingle()

  if (!branding) return null

  return {
    ...branding,
    custom_landing: (branding.custom_landing as Record<string, unknown>) || {},
  } as TenantBranding
}

export async function getActiveTenantForUser(
  clerkId: string | null | undefined
): Promise<TenantBranding | null> {
  if (!clerkId) return null

  const cached = unstable_cache(
    () => fetchActiveTenantForUser(clerkId),
    ['active-tenant-by-user', clerkId],
    {
      revalidate: 60,
      tags: [userCacheTag(clerkId)],
    }
  )

  return cached()
}

// =============================================================================
// AVAILABLE BRAND OPTIONS (settings page toggle) — Phase D, preserved
// =============================================================================

async function fetchAvailableTenantsForUser(clerkId: string): Promise<UserBrandOptions> {
  const supabase = getSupabaseAdmin()

  const [
    { data: user },
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
      .select('id, slug, brand_name, logo_url, status, is_active')
      .eq('owner_clerk_id', clerkId)
      .eq('status', 'active')
      .eq('is_active', true)
      .maybeSingle(),
    supabase
      .from('team_members')
      .select('team_id, created_at, teams!inner(id, owner_id)')
      .eq('user_id', clerkId)
      .eq('status', 'active')
      .order('created_at', { ascending: false }),
    supabase
      .from('subscriptions')
      .select('status, current_period_end, cancel_at_period_end')
      .eq('user_id', clerkId),
  ])

  const available: AvailableTenant[] = []

  if (ownedTenant) {
    available.push({
      id: ownedTenant.id,
      slug: ownedTenant.slug,
      brand_name: ownedTenant.brand_name,
      logo_url: ownedTenant.logo_url,
      role: 'owner',
    })
  }

  const ownerClerkIds = (memberRows || [])
    .map((r: any) => r.teams?.owner_id)
    .filter(Boolean)

  if (ownerClerkIds.length > 0) {
    const { data: teamTenants } = await supabase
      .from('white_label_tenants')
      .select('id, slug, brand_name, logo_url, owner_clerk_id, status, is_active')
      .in('owner_clerk_id', ownerClerkIds)
      .eq('status', 'active')
      .eq('is_active', true)

    const ownerOrder = new Map<string, number>()
    ownerClerkIds.forEach((id, idx) => {
      if (!ownerOrder.has(id)) ownerOrder.set(id, idx)
    })
    const sortedTenants = (teamTenants || []).sort((a, b) => {
      const aIdx = ownerOrder.get(a.owner_clerk_id) ?? 999
      const bIdx = ownerOrder.get(b.owner_clerk_id) ?? 999
      return aIdx - bIdx
    })

    for (const t of sortedTenants) {
      if (ownedTenant && t.id === ownedTenant.id) continue
      available.push({
        id: t.id,
        slug: t.slug,
        brand_name: t.brand_name,
        logo_url: t.logo_url,
        role: 'member',
      })
    }
  }

  const now = Date.now()
  const hasSelfSub = (selfSubs || []).some(s => {
    if (['trialing', 'active', 'past_due'].includes(s.status)) return true
    if (
      s.status === 'canceled' &&
      s.current_period_end &&
      new Date(s.current_period_end).getTime() > now
    ) return true
    return false
  })

  const canSeeStandard = hasSelfSub || !!ownedTenant

  return {
    available,
    canSeeStandard,
    currentTenantId: user?.active_tenant_id || null,
  }
}

export async function getAvailableTenantsForUser(
  clerkId: string | null | undefined
): Promise<UserBrandOptions> {
  if (!clerkId) {
    return { available: [], canSeeStandard: false, currentTenantId: null }
  }

  const cached = unstable_cache(
    () => fetchAvailableTenantsForUser(clerkId),
    ['available-tenants-by-user', clerkId],
    {
      revalidate: 60,
      tags: [userCacheTag(clerkId)],
    }
  )

  return cached()
}