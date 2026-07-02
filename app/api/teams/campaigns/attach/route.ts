import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'
import { apiError } from '@/lib/apiError'

export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { teamId, campaignId, accessMode } = body

    if (!teamId || !campaignId || !accessMode) {
      return NextResponse.json(
        { success: false, error: 'teamId, campaignId, and accessMode required' },
        { status: 400 }
      )
    }

    if (!['owner_pays', 'agent_pays', 'public', 'free'].includes(accessMode)) {
      return NextResponse.json(
        { success: false, error: 'accessMode must be owner_pays, agent_pays, public, or free' },
        { status: 400 }
      )
    }

    const { data: team } = await supabaseAdmin
      .from('teams')
      .select('id, owner_id')
      .eq('id', teamId)
      .maybeSingle()

    if (!team || team.owner_id !== userId) {
      return NextResponse.json(
        { success: false, error: 'Team not found or not owned by you' },
        { status: 404 }
      )
    }

    const { data, error } = await supabaseAdmin
      .from('team_campaigns')
      .update({ access_mode: accessMode })
      .eq('team_id', teamId)
      .eq('campaign_id', campaignId)
      .select()
      .maybeSingle()

    if (error) throw error
    if (!data) {
      return NextResponse.json(
        { success: false, error: 'Campaign is not attached to this team' },
        { status: 404 }
      )
    }

    let revokedCount = 0
    if (accessMode === 'agent_pays' || accessMode === 'free') {
      const { data: revoked } = await supabaseAdmin
        .from('team_campaign_access')
        .update({ is_active: false, revoked_at: new Date().toISOString() })
        .eq('team_id', teamId)
        .eq('campaign_id', campaignId)
        .eq('payer', 'owner')
        .eq('is_active', true)
        .select('id')

      revokedCount = revoked?.length || 0
    }

    return NextResponse.json({
      success: true,
      teamCampaign: data,
      ownerPaidAccessRevoked: revokedCount,
    })
  } catch (error: any) {
    console.error('Update campaign access mode error:', error)
    return apiError(error, { route: 'teams/campaigns/attach' })
  }
}