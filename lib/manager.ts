import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

// =============================================================================
// MANAGER+ OWNER CHECK
// =============================================================================
// Single source of truth for "is the signed-in user a Manager+ owner?" Used
// by both the sidebar "Go to Desktop" button (show/hide) and the
// /dashboard/manager/desktop page guard (allow/redirect). Keeping one helper
// means the button and the route can never disagree about who qualifies.
//
// Signal: the user owns at least one ACTIVE white_label_tenants row
// (owner_clerk_id = userId AND status = 'active'). Owning an active tenant is
// what actually grants white-label capability in this system, and it's a
// single stable DB lookup with no per-render Stripe call. If a subscription
// lapses, that should flip the tenant's status/is_active (handled elsewhere),
// which this check already respects.
//
// Returns the tenant (id, slug, brand_name + theme tokens) so callers can
// theme the button and the desktop without a second query, or null if the
// user is not a Manager+ owner.
// =============================================================================

export interface ManagerTenant {
  id: string
  slug: string
  brand_name: string
  primary_color: string
  sidebar_color: string
  header_bg_color: string
  page_bg_color: string
  logo_url: string | null
}

export async function getManagerTenant(): Promise<ManagerTenant | null> {
  const { userId } = await auth()
  if (!userId) return null

  const { data, error } = await supabase
    .from('white_label_tenants')
    .select('id, slug, brand_name, primary_color, sidebar_color, header_bg_color, page_bg_color, logo_url, status')
    .eq('owner_clerk_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('[getManagerTenant] lookup error:', error)
    return null
  }
  if (!data) return null

  return {
    id: data.id,
    slug: data.slug,
    brand_name: data.brand_name,
    primary_color: data.primary_color || '#4a9eff',
    sidebar_color: data.sidebar_color || '#1a1a2e',
    header_bg_color: data.header_bg_color || '#1a1a2e',
    page_bg_color: data.page_bg_color || '#0a0a14',
    logo_url: data.logo_url ?? null,
  }
}

// Convenience boolean for callers that only need yes/no.
export async function isManagerPlus(): Promise<boolean> {
  return (await getManagerTenant()) !== null
}