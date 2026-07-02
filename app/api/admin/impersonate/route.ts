import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { requireAdmin } from '@/lib/admin'

const supabase = getServiceClient('admin/impersonate')

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