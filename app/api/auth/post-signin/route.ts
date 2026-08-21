import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { headers, cookies } from 'next/headers'
import { JOIN_CODE_COOKIE } from '@/app/api/join/start/route'
import { createClient } from '@supabase/supabase-js'
import { shouldSeeWelcome } from '@/lib/subscription'







export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
















































const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'dialerseat.com'
const TARGET_PATH = '/dashboard/analytics'
const ADMIN_PATH = '/dashboard/admin/desktop' // v2: the admin desktop
const WELCOME_PATH = '/welcome'               // v3: the post-signup showcase

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




function redirectToTenant(
  slug: string | null,
  host: string
): NextResponse {
  return NextResponse.redirect(buildDest(slug, host), 302)
}


function redirectAdminToDesktop(host: string): NextResponse {
  return NextResponse.redirect(buildAdminDest(host), 302)
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

    // ── A PENDING INVITE OUTRANKS EVERYTHING BELOW ────────────────────────
    // Somebody who arrived on a join link has told us exactly where they were
    // going. Clerk was supposed to carry that in ?redirect_url and does not
    // survive the hosted sign-up flow — a real signup confirmed it: the account
    // was created, no team_members row was ever written, and the person landed
    // on /welcome and then /billing having redeemed nothing.
    //
    // The cookie was set before they ever left for Clerk (see
    // /api/join/start), so it is still here regardless of which route Clerk
    // took to send them back. Reading it here makes the cookie the authority
    // rather than the fallback, which is the right way round: it is OUR record
    // of intent, and it cannot be dropped by somebody else's redirect.
    //
    // Only the shape is trusted, never the contents as a path. The value is
    // constrained to a code and rebuilt into a /join/ URL here, so a tampered
    // cookie cannot become an open redirect.
    try {
      const jar = await cookies()
      const raw = jar.get(JOIN_CODE_COOKIE)?.value || ''
      const code = raw.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 32)
      if (code) {
        console.log('[post-signin] pending join code found, routing to /join/%s', code)
        const protocol = isDevHost(host) ? 'http' : 'https'
        return NextResponse.redirect(`${protocol}://${host}/join/${encodeURIComponent(code)}`, 302)
      }
    } catch (err) {
      // Never block sign-in on this. Worst case is the old behaviour.
      console.error('[post-signin] join cookie read failed', err)
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
          return redirectToTenant(currentTenant.slug, host)
        }
      }
    }

    
    const preferred = await resolvePreferredTenant(userId)
    if (preferred) {
      return redirectToTenant(preferred.slug, host)
    }

    
    
    
    return redirectToTenant(null, host)
  } catch (err) {
    console.error('[post-signin] unexpected error:', err)
    return NextResponse.redirect(new URL(TARGET_PATH, req.url))
  }
}