import { NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { requireTenantOwner, TenantOwnerError } from '@/lib/tenant-scope'

const supabase = getServiceClient('manager/campaigns')

// Campaigns don't carry a tenant_id directly — a campaign belongs to a user,
// not a tenant. "This tenant's campaigns" is therefore: campaigns owned by
// anyone who is the owner or an active member of a team inside this tenant,
// same boundary used for the tenant's calls/roster figures elsewhere.
export async function GET() {
  let tenant
  try {
    tenant = await requireTenantOwner()
  } catch (e) {
    if (e instanceof TenantOwnerError) {
      return NextResponse.json({ success: false, error: e.message }, { status: e.status })
    }
    return NextResponse.json({ success: false, error: 'Tenant check failed' }, { status: 500 })
  }

  const { data: teams } = await supabase
    .from('teams')
    .select('id, name, owner_id')
    .eq('tenant_id', tenant.id)

  const teamList = teams || []
  const teamIds = teamList.map(t => t.id)
  const teamById: Record<string, { id: string; name: string }> = {}
  for (const t of teamList) teamById[t.id] = { id: t.id, name: t.name }

  if (teamIds.length === 0) {
    return NextResponse.json({
      success: true,
      campaigns: [],
      allTeams: [],
      platformTotals: { campaigns: 0, active: 0, inactive: 0, attached: 0 },
    })
  }

  const { data: activeMembers } = await supabase
    .from('team_members')
    .select('team_id, user_id')
    .in('team_id', teamIds)
    .eq('status', 'active')

  const tenantUserIds = Array.from(new Set([
    ...teamList.map(t => t.owner_id),
    ...(activeMembers || []).map((m: any) => m.user_id),
  ]))

  if (tenantUserIds.length === 0) {
    return NextResponse.json({
      success: true,
      campaigns: [],
      allTeams: teamList.map(t => ({ id: t.id, name: t.name })),
      platformTotals: { campaigns: 0, active: 0, inactive: 0, attached: 0 },
    })
  }

  const [{ data: campaigns }, { data: teamCampaignRows }] = await Promise.all([
    supabase
      .from('campaigns')
      .select('id, name, user_id, status, total_leads, called_leads, dialer_mode, created_at, updated_at')
      .in('user_id', tenantUserIds)
      .order('created_at', { ascending: false }),
    supabase.from('team_campaigns').select('team_id, campaign_id, access_mode, created_at').in('team_id', teamIds),
  ])

  const userById: Record<string, { email: string; first_name: string | null; last_name: string | null }> = {}
  if (tenantUserIds.length > 0) {
    const { data: userRows } = await supabase
      .from('users')
      .select('clerk_id, email, first_name, last_name')
      .in('clerk_id', tenantUserIds)
    for (const u of userRows || []) {
      userById[u.clerk_id] = { email: u.email, first_name: u.first_name, last_name: u.last_name }
    }
  }

  const attachmentsByCampaign: Record<string, { teamId: string; teamName: string; accessMode: string; attachedAt: string }[]> = {}
  for (const row of teamCampaignRows || []) {
    const team = teamById[row.team_id]
    if (!team) continue
    ;(attachmentsByCampaign[row.campaign_id] ||= []).push({
      teamId: row.team_id,
      teamName: team.name,
      accessMode: row.access_mode,
      attachedAt: row.created_at,
    })
  }

  const result = (campaigns || []).map((c: any) => {
    const u = userById[c.user_id]
    const ownerName = u ? ([u.first_name, u.last_name].filter(Boolean).join(' ') || u.email || 'Unknown') : 'Unknown'
    return {
      id: c.id,
      name: c.name,
      status: c.status || 'active',
      totalLeads: c.total_leads || 0,
      calledLeads: c.called_leads || 0,
      dialerMode: c.dialer_mode || null,
      createdAt: c.created_at,
      updatedAt: c.updated_at || null,
      owner: { id: c.user_id, name: ownerName, email: u?.email || null },
      teams: attachmentsByCampaign[c.id] || [],
    }
  })

  return NextResponse.json({
    success: true,
    campaigns: result,
    allTeams: teamList.map(t => ({ id: t.id, name: t.name })),
    platformTotals: {
      campaigns: result.length,
      active: result.filter(c => c.status === 'active').length,
      inactive: result.filter(c => c.status !== 'active').length,
      attached: result.filter(c => c.teams.length > 0).length,
    },
  })
}
