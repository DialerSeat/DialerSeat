import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'






























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



export class TenantOwnerError extends Error {
  status: number
  constructor(message: string, status = 403) {
    super(message)
    this.name = 'TenantOwnerError'
    this.status = status
  }
}





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




export async function getTenantUserIds(tenantId: string, ownerClerkId: string): Promise<string[]> {
  const ids = new Set<string>()
  ids.add(ownerClerkId) // the owner's own data always counts

  
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


export async function requireTenantScope(): Promise<{ tenant: OwnedTenant; userIds: string[] }> {
  const tenant = await requireTenantOwner()
  const userIds = await getTenantUserIds(tenant.id, tenant.owner_clerk_id)
  return { tenant, userIds }
}