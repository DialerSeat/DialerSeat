import 'server-only'
import { createClient } from '@supabase/supabase-js'
import { unstable_cache } from 'next/cache'

// =============================================================================
// TENANT BRANDING LOOKUP — server-side helper
// =============================================================================
// proxy.ts attaches x-tenant-slug to every request. The root layout reads
// that header and calls getTenantBranding(slug) to fetch the actual brand
// data from Supabase. The result is passed into ThemeProvider, which injects
// CSS variables and makes the brand info available to all components via
// useBranding().
//
// We use Next.js's unstable_cache (which IS stable for our use case — it's
// just labeled "unstable" because of API churn) with a 60-second TTL and
// per-slug tags. When an admin updates branding in the dashboard, the
// admin API route calls revalidateTag(`tenant:${slug}`) to bust the cache
// immediately. This is the standard pattern for read-heavy / write-rare data.
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

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    // Anon key is sufficient — the tenant_branding view is granted to anon
    // and contains only brand fields, no sensitive data. Using the anon key
    // here means we don't have to worry about leaking the service role key
    // into any client-component bundle (server-only is enforced above, but
    // belt-and-suspenders).
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// Internal uncached fetcher. Kept separate so unstable_cache can wrap it.
async function fetchTenantBranding(slug: string): Promise<TenantBranding | null> {
  const supabase = getSupabase()
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

  // Normalize custom_landing to an object even if Supabase returns null
  return {
    ...data,
    custom_landing: (data.custom_landing as Record<string, unknown>) || {},
  } as TenantBranding
}

/**
 * Look up a tenant's branding by subdomain slug. Cached for 60 seconds.
 *
 * Pass null/undefined to short-circuit and get null back (lets callers
 * skip a null-check on the slug).
 */
export async function getTenantBranding(
  slug: string | null | undefined
): Promise<TenantBranding | null> {
  if (!slug) return null

  // Wrap in unstable_cache with per-slug tag for surgical revalidation
  const cached = unstable_cache(
    () => fetchTenantBranding(slug),
    ['tenant-branding', slug],
    {
      revalidate: 60,
      tags: [`tenant:${slug}`],
    }
  )

  return cached()
}

/**
 * Revalidate cached branding for a specific tenant. Call this from the
 * admin API after updating a tenant's branding so changes show up
 * immediately instead of waiting up to 60s for the cache to expire.
 *
 * Usage from an admin API route:
 *   import { revalidateTag } from 'next/cache'
 *   revalidateTag(`tenant:${slug}`)
 */
export const tenantCacheTag = (slug: string) => `tenant:${slug}`