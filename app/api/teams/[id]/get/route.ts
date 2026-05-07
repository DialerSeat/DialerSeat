import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * Returns full detail for one team.
 * Owners see everything (members list, codes, campaigns, pending requests).
 * Members see limited info (team meta, accessible campaigns, their own membership row only).
 *
 * Anyone else (not owner, not member) gets 403.
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

    // Fetch team
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

    // If not owner, verify active membership before exposing anything
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

    // Owner-only data
    let members: any[] = []
    let codes: any[] = []
    let pendingMembers: any[] = []

    if (isOwner) {
      const [{ data: mAll }, { data: cAll }] = await Promise.all([
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
      ])

      members = (mAll || []).filter((m: any) => m.status === 'active')
      pendingMembers = (mAll || []).filter((m: any) => m.status === 'pending')
      codes = cAll || []
    }

    // Campaigns attached to team — both owner and member see, with access_mode
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
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}