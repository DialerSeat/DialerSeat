import { NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { requireTenantOwner, TenantOwnerError } from '@/lib/tenant-scope'

const supabase = getServiceClient('manager/campaigns/assign-team')

const VALID_ACCESS_MODES = ['owner_pays', 'agent_pays', 'public', 'free'] as const

async function tenantUserIds(tenantId: string): Promise<Set<string>> {
  const { data: teams } = await supabase.from('teams').select('id, owner_id').eq('tenant_id', tenantId)
  const teamList = teams || []
  const teamIds = teamList.map(t => t.id)
  const ids = new Set<string>(teamList.map(t => t.owner_id))
  if (teamIds.length > 0) {
    const { data: members } = await supabase
      .from('team_members')
      .select('user_id')
      .in('team_id', teamIds)
      .eq('status', 'active')
    for (const m of members || []) ids.add(m.user_id)
  }
  return ids
}

async function assertTenantScope(tenantId: string, teamId: string, campaignId: string) {
  const [{ data: team }, { data: campaign }] = await Promise.all([
    supabase.from('teams').select('id, tenant_id').eq('id', teamId).maybeSingle(),
    supabase.from('campaigns').select('id, user_id').eq('id', campaignId).maybeSingle(),
  ])
  if (!team) return { ok: false as const, status: 404, error: 'Team not found' }
  if (team.tenant_id !== tenantId) return { ok: false as const, status: 403, error: 'Team does not belong to your tenant' }
  if (!campaign) return { ok: false as const, status: 404, error: 'Campaign not found' }
  const allowedOwners = await tenantUserIds(tenantId)
  if (!allowedOwners.has(campaign.user_id)) {
    return { ok: false as const, status: 403, error: 'Campaign does not belong to your tenant' }
  }
  return { ok: true as const }
}

export async function POST(req: Request) {
  let tenant
  try {
    tenant = await requireTenantOwner()
  } catch (e) {
    if (e instanceof TenantOwnerError) {
      return NextResponse.json({ success: false, error: e.message }, { status: e.status })
    }
    return NextResponse.json({ success: false, error: 'Tenant check failed' }, { status: 500 })
  }

  const body = await req.json().catch(() => ({}))
  const { teamId, campaignId, accessMode } = body
  if (!teamId || typeof teamId !== 'string' || !campaignId || typeof campaignId !== 'string') {
    return NextResponse.json({ success: false, error: 'teamId and campaignId required' }, { status: 400 })
  }
  const mode = accessMode && VALID_ACCESS_MODES.includes(accessMode) ? accessMode : 'owner_pays'

  const scope = await assertTenantScope(tenant.id, teamId, campaignId)
  if (!scope.ok) return NextResponse.json({ success: false, error: scope.error }, { status: scope.status })

  const { data: existing } = await supabase
    .from('team_campaigns')
    .select('team_id')
    .eq('team_id', teamId)
    .eq('campaign_id', campaignId)
    .maybeSingle()
  if (existing) {
    return NextResponse.json({ success: false, error: 'Campaign is already attached to this team' }, { status: 409 })
  }

  const { data, error } = await supabase
    .from('team_campaigns')
    .insert({ team_id: teamId, campaign_id: campaignId, access_mode: mode })
    .select('team_id, campaign_id, access_mode, created_at')
    .single()
  if (error) {
    console.error('Manager campaign assign error:', error)
    return NextResponse.json({ success: false, error: 'Failed to attach campaign' }, { status: 500 })
  }

  return NextResponse.json({ success: true, teamCampaign: data })
}

export async function DELETE(req: Request) {
  let tenant
  try {
    tenant = await requireTenantOwner()
  } catch (e) {
    if (e instanceof TenantOwnerError) {
      return NextResponse.json({ success: false, error: e.message }, { status: e.status })
    }
    return NextResponse.json({ success: false, error: 'Tenant check failed' }, { status: 500 })
  }

  const body = await req.json().catch(() => ({}))
  const { teamId, campaignId } = body
  if (!teamId || typeof teamId !== 'string' || !campaignId || typeof campaignId !== 'string') {
    return NextResponse.json({ success: false, error: 'teamId and campaignId required' }, { status: 400 })
  }

  const scope = await assertTenantScope(tenant.id, teamId, campaignId)
  if (!scope.ok) return NextResponse.json({ success: false, error: scope.error }, { status: scope.status })

  await supabase
    .from('team_campaign_access')
    .update({ is_active: false, revoked_at: new Date().toISOString() })
    .eq('team_id', teamId)
    .eq('campaign_id', campaignId)
    .eq('is_active', true)

  await supabase
    .from('team_codes')
    .delete()
    .eq('team_id', teamId)
    .eq('campaign_id', campaignId)

  const { error } = await supabase
    .from('team_campaigns')
    .delete()
    .eq('team_id', teamId)
    .eq('campaign_id', campaignId)
  if (error) {
    console.error('Manager campaign detach error:', error)
    return NextResponse.json({ success: false, error: 'Failed to detach campaign' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
