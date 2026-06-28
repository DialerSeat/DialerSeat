import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'
import { apiError } from '@/lib/apiError'

/**
 * Returns full detail for one team.
 * Owners see everything (members list + per-member campaign access + codes
 * + campaigns + pending requests).
 * Members see limited info (team meta, accessible campaigns, their own
 * membership row only).
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { id: teamId } = await params

    const { data: team, error: teamErr } = await supabaseAdmin
      .from('teams')
      .select('*')
      .eq('id', teamId)
      .maybeSingle()

    if (teamErr) throw teamErr
    if (!team) {
      return NextResponse.json({ success: false, error: 'Team not found' }, { status: 404 })
    }

    const isOwner = team.owner_id === userId

    let viewerMembership: any = null
    if (!isOwner) {
      const { data: m } = await supabaseAdmin
        .from('team_members')
        .select('id, status, accepted_at, joined_via_code, created_at')
        .eq('team_id', teamId)
        .eq('user_id', userId)
        .eq('status', 'active')
        .maybeSingle()

      if (!m) {
        return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
      }
      viewerMembership = m
    }

    let members: any[] = []
    let codes: any[] = []
    let pendingMembers: any[] = []

    if (isOwner) {
      const [
        { data: mAll },
        { data: cAll },
        { data: accessAll },
      ] = await Promise.all([
        supabaseAdmin
          .from('team_members')
          .select('id, user_id, status, accepted_at, removed_at, joined_via_code, created_at')
          .eq('team_id', teamId)
          .order('created_at', { ascending: false }),
        supabaseAdmin
          .from('team_codes')
          .select('*')
          .eq('team_id', teamId)
          .eq('is_active', true)
          .order('created_at', { ascending: false }),
        supabaseAdmin
          .from('team_campaign_access')
          .select('id, team_member_id, campaign_id, payer, is_active, access_source, created_at')
          .eq('team_id', teamId)
          .eq('is_active', true),
      ])

      // Resolve identities
      const memberClerkIds = Array.from(new Set((mAll || []).map((m: any) => m.user_id)))
      let userById: Record<string, any> = {}
      if (memberClerkIds.length > 0) {
        const { data: userRows } = await supabaseAdmin
          .from('users')
          .select('clerk_id, email, first_name, last_name')
          .in('clerk_id', memberClerkIds)
        for (const u of userRows || []) userById[u.clerk_id] = u
      }

      const accessByMember: Record<string, any[]> = {}
      for (const a of accessAll || []) {
        if (!accessByMember[a.team_member_id]) accessByMember[a.team_member_id] = []
        accessByMember[a.team_member_id].push(a)
      }

      const enrich = (m: any) => ({
        ...m,
        user: userById[m.user_id]
          ? {
              email: userById[m.user_id].email,
              first_name: userById[m.user_id].first_name,
              last_name: userById[m.user_id].last_name,
            }
          : { email: null, first_name: null, last_name: null },
        campaignAccess: (accessByMember[m.id] || []).map((a: any) => ({
          id: a.id,
          campaignId: a.campaign_id,
          payer: a.payer,
          accessSource: a.access_source,
          createdAt: a.created_at,
        })),
      })

      members = (mAll || []).filter((m: any) => m.status === 'active').map(enrich)
      pendingMembers = (mAll || []).filter((m: any) => m.status === 'pending').map(enrich)
      codes = cAll || []
    }

    const { data: tcRows } = await supabaseAdmin
      .from('team_campaigns')
      .select('campaign_id, access_mode, created_at, campaigns(id, name, total_leads, called_leads, status)')
      .eq('team_id', teamId)

    const teamCampaigns = (tcRows || []).map((row: any) => ({
      campaignId: row.campaign_id,
      accessMode: row.access_mode,
      createdAt: row.created_at,
      campaign: row.campaigns,
    }))

    return NextResponse.json({
      success: true,
      team: {
        ...team,
        viewerRole: isOwner ? 'owner' : 'member',
        viewerMembership,
        members,
        pendingMembers,
        codes,
        teamCampaigns,
      },
    })
  } catch (error: any) {
    console.error('Team get error:', error)
    return apiError(error, { route: 'teams/[id]/get' })
  }
}