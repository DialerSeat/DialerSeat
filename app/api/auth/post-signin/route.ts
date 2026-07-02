import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { headers } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { shouldSeeWelcome } from '@/lib/subscription'







export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
















































const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'dialerseat.com'
const TARGET_PATH = '/dashboard/analytics'
const ADMIN_PATH = '/dashboard/admin/desktop' // v2: the admin desktop
const WELCOME_PATH = '/welcome'               // v3: the post-signup showcase
const TENANT_COOKIE_NAME = 'ds_last_tenant'
const TENANT_COOKIE_MAX_AGE = 60 * 60 * 24 * 90 // 90 days

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
    const protocol = host.startsWith('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https'
    return `${protocol}://${host}${TARGET_PATH}`
  }
  if (slug) {
    return `https://${slug}.${ROOT_DOMAIN}${TARGET_PATH}`
  }
  return `https://${ROOT_DOMAIN}${TARGET_PATH}`
}



function buildAdminDest(host: string): string {
  const protocol = isDevHost(host) ? 'http' : 'https'
  return `${protocol}://${host}${ADMIN_PATH}`
}




function buildWelcomeDest(host: string): string {
  const protocol = isDevHost(host) ? 'http' : 'https'
  return `${protocol}://${host}${WELCOME_PATH}`
}




function setOrClearTenantCookie(
  response: NextResponse,
  slug: string | null,
  host: string
): void {
  if (isDevHost(host)) {
    if (slug) {
      response.cookies.set(TENANT_COOKIE_NAME, slug, {
        path: '/',
        maxAge: TENANT_COOKIE_MAX_AGE,
        httpOnly: true,
        sameSite: 'lax',
      })
    } else {
      response.cookies.delete(TENANT_COOKIE_NAME)
    }
    return
  }

  if (slug) {
    response.cookies.set(TENANT_COOKIE_NAME, slug, {
      domain: `.${ROOT_DOMAIN}`,
      path: '/',
      maxAge: TENANT_COOKIE_MAX_AGE,
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
    })
  } else {
    response.cookies.set(TENANT_COOKIE_NAME, '', {
      domain: `.${ROOT_DOMAIN}`,
      path: '/',
      maxAge: 0,
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
    })
  }
}


function redirectWithTenantCookie(
  slug: string | null,
  host: string
): NextResponse {
  const response = NextResponse.redirect(buildDest(slug, host), 302)
  setOrClearTenantCookie(response, slug, host)
  return response
}


function redirectAdminToDesktop(host: string): NextResponse {
  const response = NextResponse.redirect(buildAdminDest(host), 302)
  setOrClearTenantCookie(response, null, host)
  return response
}



function redirectToWelcome(host: string): NextResponse {
  return NextResponse.redirect(buildWelcomeDest(host), 302)
}

async function isAdmin(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('users')
    .select('is_admin')
    .eq('clerk_id', userId)
    .maybeSingle()
  if (error) {
    console.error('[post-signin] isAdmin lookup error:', error)
    return false
  }
  return data?.is_admin === true
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
      return NextResponse.redirect(new URL('/sign-in', req.url))
    }

    
    
    if (await isAdmin(userId)) {
      return redirectAdminToDesktop(host)
    }

    
    
    
    
    
    
    
    
    try {
      const sees = await shouldSeeWelcome(userId)
      console.log('[post-signin][DIAG] userId=%s shouldSeeWelcome=%s host=%s', userId, sees, host)
      if (sees) {
        console.log('[post-signin][DIAG] -> redirecting to /welcome')
        return redirectToWelcome(host)
      }
      console.log('[post-signin][DIAG] -> NOT diverting, falling through to tenant routing')
    } catch (welcomeErr) {
      
      
      console.error('[post-signin][DIAG] shouldSeeWelcome THREW:', welcomeErr)
    }

    const h = await headers()
    const currentSlug = h.get('x-tenant-slug')

    
    if (currentSlug) {
      const currentTenant = await findActiveTenantBySlug(currentSlug)
      if (currentTenant) {
        const affiliated = await isUserAffiliatedWithTenant(
          userId,
          currentTenant.id,
          currentTenant.owner_clerk_id
        )
        if (affiliated) {
          return redirectWithTenantCookie(currentTenant.slug, host)
        }
      }
    }

    
    const preferred = await resolvePreferredTenant(userId)
    if (preferred) {
      return redirectWithTenantCookie(preferred.slug, host)
    }

    
    
    
    return redirectWithTenantCookie(null, host)
  } catch (err) {
    console.error('[post-signin] unexpected error:', err)
    return NextResponse.redirect(new URL(TARGET_PATH, req.url))
  }
}