import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/admin'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// =============================================================================
// ADMIN IMPERSONATE — demo-view resolver (v1, NEW)
// =============================================================================
// POST /api/admin/impersonate  { team_id }
//   → { success, redirect_url, tenant_slug, scope }
//
// HONEST SCOPE — this is a DEMO VIEW resolver, not auth impersonation:
//   - Validates the team exists, resolves its tenant, and returns the URL
//     where that team's experience lives (tenant subdomain, or the main
//     dashboard for tenant-less teams).
//   - It does NOT sign you in as the team's owner. True sign-in-as-user
//     requires Clerk actor tokens + a session-banner + audit trail — a
//     separate dedicated push if wanted.
//   - Branded rendering on the subdomain also depends on the wildcard
//     subdomain infrastructure (Vercel domains + DNS + Clerk cookie domain),
//     which is still on the backlog. Until that ships, the subdomain URL is
//     returned but may not resolve in production.
//
// scope field values:
//   'tenant-site' — team belongs to a tenant; redirect_url is its subdomain
//   'main-site'   — tenant-less team; redirect_url is the standard dashboard
// =============================================================================

const ROOT_DOMAIN = 'dialerseat.com'

export async function POST(req: NextRequest) {
  try {
    await requireAdmin()

    const body = await req.json().catch(() => ({}))
    const teamId = String(body.team_id ?? '').trim()
    if (!teamId) {
      return NextResponse.json({ success: false, error: 'team_id is required' }, { status: 400 })
    }

    const { data: team, error: teamErr } = await supabase
      .from('teams')
      .select('id, name, owner_id, tenant_id')
      .eq('id', teamId)
      .maybeSingle()
    if (teamErr) throw teamErr
    if (!team) {
      return NextResponse.json({ success: false, error: 'Team not found' }, { status: 404 })
    }

    if (!team.tenant_id) {
      return NextResponse.json({
        success: true,
        scope: 'main-site',
        tenant_slug: null,
        redirect_url: `https://${ROOT_DOMAIN}/dashboard/analytics`,
        team: { id: team.id, name: team.name },
      })
    }

    const { data: tenant, error: tenantErr } = await supabase
      .from('white_label_tenants')
      .select('id, slug, brand_name, status, is_active')
      .eq('id', team.tenant_id)
      .maybeSingle()
    if (tenantErr) throw tenantErr
    if (!tenant) {
      return NextResponse.json(
        { success: false, error: 'Team references a tenant that no longer exists' },
        { status: 409 }
      )
    }

    return NextResponse.json({
      success: true,
      scope: 'tenant-site',
      tenant_slug: tenant.slug,
      tenant_status: tenant.status,
      redirect_url: `https://${tenant.slug}.${ROOT_DOMAIN}`,
      team: { id: team.id, name: team.name },
    })
  } catch (err: any) {
    console.error('[admin/impersonate] failed:', err)
    const status = err?.status === 401 || err?.status === 403 ? err.status : 500
    return NextResponse.json(
      { success: false, error: err?.message || 'Failed to resolve demo view' },
      { status }
    )
  }
}