import 'server-only'
import { createClient } from '@supabase/supabase-js'
import { unstable_cache } from 'next/cache'

// =============================================================================
// TENANT BRANDING LOOKUP — server-side helper (v8 — login link fields)
// =============================================================================
// v8: TenantBranding now carries the optional subdomain-login link
// (login_link_label / login_link_text / login_link_url), and the shared
// TENANT_BRANDING_COLS select pulls them from the tenant_branding view (which
// was extended to expose them). This is what lets the branded sign-in page
// render the partner's "<Brand> × DialerSeat" link. All three may be null.
//
// v7 (Push F): fetchAvailableTenantsForUser returns currentValue + savedThemes.
// v6 (Push B): fetchActiveTenantForUser respects NULL (strict NULL semantics).
// v5 (migration 004): adds header_bg_color.
// v4 (migration 003): added page_bg_color.
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
  // v8: optional partner login link (all null when unset)
  login_link_label: string | null
  login_link_text: string | null
  login_link_url: string | null
}

export interface AvailableTenant {
  id: string
  slug: string
  brand_name: string
  logo_url: string | null
  role: 'owner' | 'member'
}

export interface SavedThemeOption {
  id: string
  name: string
}

export interface UserBrandOptions {
  available: AvailableTenant[]
  savedThemes: SavedThemeOption[]
  canSeeStandard: boolean
  currentTenantId: string | null
  // The value the settings-page <select> should show. Matches the rendered
  // <option> values: a tenant id, `theme:<id>` for a saved theme, or
  // 'standard' for the default DialerSeat view.
  currentValue: string
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
  'id, slug, brand_name, logo_url, favicon_url, footer_text, primary_color, sidebar_color, header_bg_color, page_bg_color, custom_landing, login_link_label, login_link_text, login_link_url'

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
// AVAILABLE BRAND OPTIONS (settings page toggle) — v7
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

  // Saved custom themes aren't modeled yet — return an empty list so the
  // settings page's savedThemes branch renders nothing instead of falling
  // back to an undefined value. Wire this up when themes ship.
  const savedThemes: SavedThemeOption[] = []

  // ── currentValue — THE FIX ──────────────────────────────────────────────
  // The settings <select> shows currentValue and its <option>s are valued by
  // tenant id (or 'standard'). Map the stored active_tenant_id to the value
  // the select can actually match:
  //   - active_tenant_id is set AND it's one of the available tenants → its id
  //   - active_tenant_id is set but NOT accessible (stale) → 'standard'
  //   - active_tenant_id is null → 'standard'
  // This is what makes the dropdown reflect the real selection and persist
  // across reloads instead of snapping back to "DialerSeat Pro".
  const activeTenantId = user?.active_tenant_id || null
  const activeIsAvailable =
    !!activeTenantId && available.some(t => t.id === activeTenantId)
  const currentValue = activeIsAvailable ? (activeTenantId as string) : 'standard'

  return {
    available,
    savedThemes,
    canSeeStandard,
    currentTenantId: activeTenantId,
    currentValue,
  }
}

export async function getAvailableTenantsForUser(
  clerkId: string | null | undefined
): Promise<UserBrandOptions> {
  if (!clerkId) {
    return {
      available: [],
      savedThemes: [],
      canSeeStandard: false,
      currentTenantId: null,
      currentValue: 'standard',
    }
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