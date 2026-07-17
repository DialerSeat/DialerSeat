import { NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { requireTenantOwner, TenantOwnerError } from '@/lib/tenant-scope'

const supabase = getServiceClient('manager/campaigns/status')

const VALID_STATUSES = ['active', 'inactive'] as const

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
  const { campaignId, status } = body

  if (!campaignId || typeof campaignId !== 'string') {
    return NextResponse.json({ success: false, error: 'campaignId required' }, { status: 400 })
  }
  if (campaignId.includes(':')) {
    return NextResponse.json(
      { success: false, error: 'Cannot update a virtual sub-campaign. Update the parent instead.' },
      { status: 400 }
    )
  }
  if (!VALID_STATUSES.includes(status)) {
    return NextResponse.json({ success: false, error: 'status must be active or inactive' }, { status: 400 })
  }

  const { data: campaign } = await supabase.from('campaigns').select('id, user_id').eq('id', campaignId).maybeSingle()
  if (!campaign) {
    return NextResponse.json({ success: false, error: 'Campaign not found' }, { status: 404 })
  }

  const allowedOwners = await tenantUserIds(tenant.id)
  if (!allowedOwners.has(campaign.user_id)) {
    return NextResponse.json({ success: false, error: 'Campaign does not belong to your tenant' }, { status: 403 })
  }

  const { data, error } = await supabase
    .from('campaigns')
    .update({ status })
    .eq('id', campaignId)
    .select('id, name, status')
    .single()
  if (error) {
    console.error('Manager campaign status update error:', error)
    return NextResponse.json({ success: false, error: 'Failed to update campaign' }, { status: 500 })
  }

  return NextResponse.json({ success: true, campaign: data })
}
