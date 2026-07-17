import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/requireAdmin'
import { apiError } from '@/lib/apiError'

// Platform-wide campaign overview for the admin desktop.
//
// A campaign belongs to exactly one owner (`campaigns.user_id`) and has its
// own active/inactive status — the same switch the owner sees in their own
// Campaigns app. A campaign can additionally be attached to zero or more
// teams via `team_campaigns`; that attachment is a separate, per-team
// relationship (with its own access_mode) and does not change who owns the
// campaign or its status.
export async function GET() {
  try {
    const gate = await requireAdmin()
    if (!gate.ok) return NextResponse.json({ success: false, error: gate.message }, { status: gate.status })

    const [
      { data: campaigns },
      { data: teamCampaignRows },
      { data: teams },
    ] = await Promise.all([
      supabaseAdmin
        .from('campaigns')
        .select('id, name, user_id, status, total_leads, called_leads, dialer_mode, created_at, updated_at')
        .order('created_at', { ascending: false }),
      supabaseAdmin.from('team_campaigns').select('team_id, campaign_id, access_mode, created_at'),
      supabaseAdmin.from('teams').select('id, name, owner_id'),
    ])

    const ownerIds = Array.from(new Set((campaigns || []).map((c: any) => c.user_id).filter(Boolean)))
    const userById: Record<string, { email: string; first_name: string | null; last_name: string | null }> = {}
    if (ownerIds.length > 0) {
      const { data: userRows } = await supabaseAdmin
        .from('users')
        .select('clerk_id, email, first_name, last_name')
        .in('clerk_id', ownerIds)
      for (const u of userRows || []) {
        userById[u.clerk_id] = { email: u.email, first_name: u.first_name, last_name: u.last_name }
      }
    }

    const teamById: Record<string, { id: string; name: string }> = {}
    for (const t of teams || []) {
      teamById[t.id] = { id: t.id, name: t.name }
    }

    const attachmentsByCampaign: Record<string, { teamId: string; teamName: string; accessMode: string; attachedAt: string }[]> = {}
    for (const row of teamCampaignRows || []) {
      const team = teamById[row.team_id]
      if (!team) continue // stale row pointing at a deleted team
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
      allTeams: (teams || []).map((t: any) => ({ id: t.id, name: t.name })),
      platformTotals: {
        campaigns: result.length,
        active: result.filter(c => c.status === 'active').length,
        inactive: result.filter(c => c.status !== 'active').length,
        attached: result.filter(c => c.teams.length > 0).length,
      },
    })
  } catch (error: any) {
    return apiError(error, { route: 'admin/campaigns' })
  }
}
