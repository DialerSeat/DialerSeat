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

    // ── ATTACH MEANS ATTACH ─────────────────────────────────────────────────
    // This only ever UPDATEd, so it could change the access mode of a campaign
    // already linked to the team and could not link a new one. Creating a
    // campaign and attaching it therefore always failed with "Campaign is not
    // attached to this team" — an error describing the precondition it was
    // supposed to establish.
    //
    // Upsert on the primary key (team_id, campaign_id) does both jobs with the
    // same call: first attach inserts, every later call updates the mode.
    const { data, error } = await supabaseAdmin
      .from('team_campaigns')
      .upsert(
        { team_id: teamId, campaign_id: campaignId, access_mode: accessMode },
        { onConflict: 'team_id,campaign_id' }
      )
      .select()
      .maybeSingle()

    if (error) throw error
    if (!data) {
      return NextResponse.json(
        { success: false, error: 'Could not attach the campaign to this team' },
        { status: 500 }
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