import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * Owner attaches one of their campaigns to one of their teams.
 *
 * Body:
 *   teamId:     uuid (required)
 *   campaignId: uuid (required)
 *   accessMode: 'owner_pays' | 'agent_pays' | 'public' (default 'owner_pays')
 *
 * Note: this just creates the team_campaigns link. Per-agent access is granted
 * separately via redemption or manual grant. Existing team members do NOT get
 * access to a newly attached campaign automatically (snapshot semantics).
 */
export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { teamId, campaignId, accessMode } = body

    if (!teamId || !campaignId) {
      return NextResponse.json(
        { success: false, error: 'teamId and campaignId required' },
        { status: 400 }
      )
    }

    const mode = accessMode || 'owner_pays'
    if (!['owner_pays', 'agent_pays', 'public'].includes(mode)) {
      return NextResponse.json(
        { success: false, error: 'accessMode must be owner_pays, agent_pays, or public' },
        { status: 400 }
      )
    }

    // Verify owner owns both team and campaign
    const [{ data: team }, { data: campaign }] = await Promise.all([
      supabaseAdmin.from('teams').select('id, owner_id').eq('id', teamId).maybeSingle(),
      supabaseAdmin.from('campaigns').select('id, user_id').eq('id', campaignId).maybeSingle(),
    ])

    if (!team) {
      return NextResponse.json({ success: false, error: 'Team not found' }, { status: 404 })
    }
    if (team.owner_id !== userId) {
      return NextResponse.json(
        { success: false, error: 'You do not own this team' },
        { status: 403 }
      )
    }

    if (!campaign) {
      return NextResponse.json({ success: false, error: 'Campaign not found' }, { status: 404 })
    }
    if (campaign.user_id !== userId) {
      return NextResponse.json(
        { success: false, error: 'You do not own this campaign' },
        { status: 403 }
      )
    }

    const { data, error } = await supabaseAdmin
      .from('team_campaigns')
      .insert({ team_id: teamId, campaign_id: campaignId, access_mode: mode })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { success: false, error: 'Campaign is already attached to this team' },
          { status: 409 }
        )
      }
      throw error
    }

    return NextResponse.json({ success: true, teamCampaign: data })
  } catch (error: any) {
    console.error('Attach campaign error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}