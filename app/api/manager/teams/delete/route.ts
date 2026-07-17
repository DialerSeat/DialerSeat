import { NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { requireTenantOwner, TenantOwnerError } from '@/lib/tenant-scope'

const supabase = getServiceClient('manager/teams/delete')

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
  const { teamId, confirm } = body

  if (!teamId || typeof teamId !== 'string') {
    return NextResponse.json({ success: false, error: 'teamId required' }, { status: 400 })
  }
  if (confirm !== 'remove') {
    return NextResponse.json({ success: false, error: 'Type "remove" to confirm' }, { status: 400 })
  }

  const { data: team } = await supabase
    .from('teams')
    .select('id, name, owner_id, tenant_id')
    .eq('id', teamId)
    .maybeSingle()

  if (!team) {
    return NextResponse.json({ success: false, error: 'Team not found' }, { status: 404 })
  }
  if (team.tenant_id !== tenant.id) {
    return NextResponse.json({ success: false, error: 'Team does not belong to your tenant' }, { status: 403 })
  }

  const [{ count: memberCount }, { count: campaignCount }, { count: activeSeatCount }] = await Promise.all([
    supabase.from('team_members').select('id', { count: 'exact', head: true }).eq('team_id', teamId),
    supabase.from('team_campaigns').select('id', { count: 'exact', head: true }).eq('team_id', teamId),
    supabase.from('team_seat_charges').select('id', { count: 'exact', head: true }).eq('team_id', teamId).eq('status', 'paid'),
  ])

  const { error } = await supabase.from('teams').delete().eq('id', teamId)
  if (error) {
    console.error('Manager team delete error:', error)
    return NextResponse.json({ success: false, error: 'Failed to delete team' }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    deleted: {
      teamId: team.id,
      teamName: team.name,
      ownerId: team.owner_id,
      membersRemoved: memberCount || 0,
      campaignsDetached: campaignCount || 0,
      activeSeatChargesOrphaned: activeSeatCount || 0,
    },
  })
}
