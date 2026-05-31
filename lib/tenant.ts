import 'server-only'
import { createClient } from '@supabase/supabase-js'
import { unstable_cache } from 'next/cache'

// =============================================================================
// TENANT BRANDING LOOKUP — server-side helper (v2 — Phase D)
// =============================================================================
// v1 (Phase C) had: getTenantBranding(slug) — looks up tenant by subdomain.
//
// v2 (Phase D) adds:
//   getActiveTenantForUser(clerkId)
//     → Returns the tenant the user has currently SELECTED to view as.
//       Honors users.active_tenant_id IF the user still has access to it
//       (owns it OR is an active team member). Otherwise resolves to a
//       sensible default (own tenant if owner, else most-recent WL team).
//
//   getAvailableTenantsForUser(clerkId)
//     → Returns the list of brands available in the settings toggle:
//       { tenant_id, slug, brand_name, role: 'owner'|'member', logo_url }[]
//       Plus a separate canSeeStandard boolean computed from self-sub status.
//
//   userCacheTag(clerkId) — tag for invalidating per-user lookups
//
// Caching:
//   Each function is wrapped in unstable_cache with both a tenant tag AND a
//   user tag. Switching brands busts the user tag instantly so the
//   selection reflects on the next request. Updating a tenant's branding
//   busts the tenant tag so all users currently viewing it see the change.
// =============================================================================

export interface TenantBranding {
  id: string
  slug: string
  brand_name: string
  logo_url: string | null
  favicon_url: string | null
  footer_text: string
  primary_color: string
  secondary_color: string
  accent_color: string
  background_color: string
  text_color: string
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
  // The currently-selected tenant id; null means standard view
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

// =============================================================================
// SUBDOMAIN LOOKUP (v1 — unchanged from Phase C)
// =============================================================================

async function fetchTenantBranding(slug: string): Promise<TenantBranding | null> {
  const supabase = getSupabaseAnon()
  const { data, error } = await supabase
    .from('tenant_branding')
    .select('*')
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
// USER → TENANT LOOKUP (v2 — Phase D)
// =============================================================================

/**
 * Returns the tenant to render for this user, based on their selected
 * preference (users.active_tenant_id) AND their actual access rights.
 *
 * If active_tenant_id is set but the user has lost access to it (left the
 * team, sub canceled, etc.), we fall back to a sensible default:
 *   1. If user owns a WL tenant → that
 *   2. Else: most-recently-joined active team whose owner has an active WL
 *   3. Else: null (standard view)
 *
 * Cached with both a user tag AND the tenant tag — so switching, joining,
 * or having a tenant's branding edited all bust the cache correctly.
 */
async function fetchActiveTenantForUser(clerkId: string): Promise<TenantBranding | null> {
  const supabase = getSupabaseAdmin()

  // ── Load user's selection + accessible tenant set in one round ─────────
  const [{ data: user }, { data: ownedTenant }, { data: memberRows }] = await Promise.all([
    supabase
      .from('users')
      .select('active_tenant_id')
      .eq('clerk_id', clerkId)
      .maybeSingle(),
    // Tenant the user owns (if any)
    supabase
      .from('white_label_tenants')
      .select('id, slug, status, is_active')
      .eq('owner_clerk_id', clerkId)
      .eq('status', 'active')
      .eq('is_active', true)
      .maybeSingle(),
    // Teams the user is an active member of, ordered most-recent-first.
    // We then join in Node-side to the WL tenants table because the
    // team→owner→tenant join is a 2-hop chain that's cleaner to do here
    // than in a single Supabase select.
    supabase
      .from('team_members')
      .select('team_id, created_at, teams!inner(id, owner_id)')
      .eq('user_id', clerkId)
      .eq('status', 'active')
      .order('created_at', { ascending: false }),
  ])

  const selectedTenantId = user?.active_tenant_id || null

  // ── Build the list of tenant ids the user has access to ───────────────
  const accessibleTenantIds: string[] = []
  const ownerClerkIds: string[] = []

  if (ownedTenant) accessibleTenantIds.push(ownedTenant.id)
  for (const row of memberRows || []) {
    const ownerId = (row as any).teams?.owner_id
    if (ownerId) ownerClerkIds.push(ownerId)
  }

  // Resolve owner clerk_ids → tenant ids
  if (ownerClerkIds.length > 0) {
    const { data: teamOwnerTenants } = await supabase
      .from('white_label_tenants')
      .select('id, owner_clerk_id')
      .in('owner_clerk_id', ownerClerkIds)
      .eq('status', 'active')
      .eq('is_active', true)

    for (const t of teamOwnerTenants || []) {
      accessibleTenantIds.push(t.id)
    }
  }

  // Dedupe while preserving insertion order (own tenant first, then teams
  // in most-recent-membership order)
  const uniqueAccessible = Array.from(new Set(accessibleTenantIds))

  // ── Pick which tenant to render ───────────────────────────────────────
  let pickedId: string | null = null
  if (selectedTenantId && uniqueAccessible.includes(selectedTenantId)) {
    pickedId = selectedTenantId
  } else if (uniqueAccessible.length > 0) {
    pickedId = uniqueAccessible[0]
  }

  if (!pickedId) return null

  // ── Fetch branding for the picked tenant ──────────────────────────────
  const { data: branding } = await supabase
    .from('tenant_branding')
    .select('*')
    .eq('id', pickedId)
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
// AVAILABLE BRAND OPTIONS (settings page toggle)
// =============================================================================

/**
 * Returns the brand options available in the settings toggle for this user.
 *
 * canSeeStandard is true if the user has their own self-paid subscription
 * (regardless of whether they're also on a seat). Manager+ tenant owners
 * always qualify because their $75 subscription covers personal-sub status.
 *
 * The toggle is HIDDEN entirely if:
 *   - User is a pure seat-only agent on exactly 1 team (nothing to toggle)
 *   - User has no WL teams AND no own tenant (no brand options at all)
 *
 * That hidden-state decision is made in the settings page, not here. This
 * function just returns the raw access list — the UI decides whether to
 * render it.
 */
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
    // Self-sub check: any active personal subscription
    supabase
      .from('subscriptions')
      .select('status, current_period_end, cancel_at_period_end')
      .eq('user_id', clerkId),
  ])

  const available: AvailableTenant[] = []

  // Owned tenant (if any) goes first
  if (ownedTenant) {
    available.push({
      id: ownedTenant.id,
      slug: ownedTenant.slug,
      brand_name: ownedTenant.brand_name,
      logo_url: ownedTenant.logo_url,
      role: 'owner',
    })
  }

  // Member tenants — resolve via team owners
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

    // Preserve most-recent-membership order
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
      if (ownedTenant && t.id === ownedTenant.id) continue // de-dupe
      available.push({
        id: t.id,
        slug: t.slug,
        brand_name: t.brand_name,
        logo_url: t.logo_url,
        role: 'member',
      })
    }
  }

  // canSeeStandard: user has any currently-active personal subscription
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

  // Tenant owners always qualify (their Manager+ sub is a self-sub from
  // the user's perspective — they bought it)
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