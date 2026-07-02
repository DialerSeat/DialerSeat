import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)





















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


export async function isManagerPlus(): Promise<boolean> {
  return (await getManagerTenant()) !== null
}