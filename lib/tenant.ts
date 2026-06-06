import 'server-only'
import { createClient } from '@supabase/supabase-js'
import { unstable_cache } from 'next/cache'

// =============================================================================
// TENANT BRANDING LOOKUP — server-side helper (v5 — header/sidebar split)
// =============================================================================
// v5 (migration 004): adds header_bg_color so the dashboard header strip
// can be themed independently of the sidebar. Was a single user-picked
// color (sidebar_color drove both). Now four user-picked Tier-1 colors:
// sidebar, header_bg, primary, page_bg. Backfilled on existing rows to
// header_bg_color = sidebar_color so unchanged tenants look identical.
//
// v4 (migration 003): added page_bg_color (2 → 3 user-picked colors).
//
// v3 (Phase B2): trimmed the interface down from 5 vestigial Pass-1
// color fields (secondary/accent/background/text) to the actual
// user-picked set.
//
// SELECTs use an explicit column list so a missing column in the
// `tenant_branding` view (e.g. migration not yet applied) fails loud
// instead of silently returning undefined.
//
// Function contracts unchanged:
//   getTenantBranding(slug)              — subdomain → branding
//   getActiveTenantForUser(clerkId)      — user → selected tenant
//   getAvailableTenantsForUser(clerkId)  — user → list of brand options
//
// Caching unchanged. Tags unchanged.
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
  header_bg_color: string  // ← NEW v5 (migration 004) — header strip color
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

// Explicit branding column list. Used in both subdomain and user-tenant
// branding fetches. Listing columns explicitly means a missing column
// (e.g. tenant_branding view not yet updated to include header_bg_color)
// surfaces as a query error instead of silently returning undefined.
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
// USER → TENANT LOOKUP (Phase D — preserved)
// =============================================================================

/**
 * Returns the tenant to render for this user, based on their selected
 * preference (users.active_tenant_id) AND their actual access rights.
 *
 * Fallback chain if active_tenant_id is missing or no longer accessible:
 *   1. If user owns a WL tenant → that
 *   2. Else: most-recently-joined active team whose owner has an active WL
 *   3. Else: null (standard view)
 *
 * Cached with both a user tag AND the tenant tag — switching brands,
 * joining a team, or editing a tenant's branding all bust the cache.
 */
async function fetchActiveTenantForUser(clerkId: string): Promise<TenantBranding | null> {
  const supabase = getSupabaseAdmin()

  const [{ data: user }, { data: ownedTenant }, { data: memberRows }] = await Promise.all([
    supabase
      .from('users')
      .select('active_tenant_id')
      .eq('clerk_id', clerkId)
      .maybeSingle(),
    supabase
      .from('white_label_tenants')
      .select('id, slug, status, is_active')
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
  ])

  const selectedTenantId = user?.active_tenant_id || null

  const accessibleTenantIds: string[] = []
  const ownerClerkIds: string[] = []

  if (ownedTenant) accessibleTenantIds.push(ownedTenant.id)
  for (const row of memberRows || []) {
    const ownerId = (row as any).teams?.owner_id
    if (ownerId) ownerClerkIds.push(ownerId)
  }

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

  const uniqueAccessible = Array.from(new Set(accessibleTenantIds))

  let pickedId: string | null = null
  if (selectedTenantId && uniqueAccessible.includes(selectedTenantId)) {
    pickedId = selectedTenantId
  } else if (uniqueAccessible.length > 0) {
    pickedId = uniqueAccessible[0]
  }

  if (!pickedId) return null

  const { data: branding } = await supabase
    .from('tenant_branding')
    .select(TENANT_BRANDING_COLS)
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
// AVAILABLE BRAND OPTIONS (settings page toggle) — Phase D, preserved
// =============================================================================

/**
 * Returns the brand options available in the settings toggle for this user.
 *
 * canSeeStandard is true if the user has their own self-paid subscription
 * (regardless of whether they're also on a seat). Manager+ tenant owners
 * always qualify because their $75 subscription covers personal-sub status.
 *
 * The settings page decides whether to render the toggle (hides it if
 * there's only 1 option). This function just returns the raw access list.
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