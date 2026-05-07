import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * Owner detaches a campaign from a team.
 *
 * Cascades:
 *   - team_codes pointing at this campaign get hard-deleted (FK CASCADE on
 *     campaigns.id since team_codes.campaign_id references campaigns)
 *     Note: codes pointing at OTHER campaigns on the same team survive.
 *   - team_campaign_access rows for this campaign on this team get
 *     soft-revoked (is_active: false, revoked_at set).
 *
 * Body:
 *   teamId:     uuid (required)
 *   campaignId: uuid (required)
 *   confirm:    'remove' (required)
 */
export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const { teamId, campaignId, confirm } = body

    if (!teamId || !campaignId) {
      return NextResponse.json(
        { success: false, error: 'teamId and campaignId required' },
        { status: 400 }
      )
    }

    if (confirm !== 'remove') {
      return NextResponse.json(
        { success: false, error: 'Type "remove" to confirm detachment' },
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

    // Soft-revoke active access rows
    await supabaseAdmin
      .from('team_campaign_access')
      .update({ is_active: false, revoked_at: new Date().toISOString() })
      .eq('team_id', teamId)
      .eq('campaign_id', campaignId)
      .eq('is_active', true)

    // Delete team-specific codes pointing at this campaign
    await supabaseAdmin
      .from('team_codes')
      .delete()
      .eq('team_id', teamId)
      .eq('campaign_id', campaignId)

    // Detach the campaign from the team
    const { error } = await supabaseAdmin
      .from('team_campaigns')
      .delete()
      .eq('team_id', teamId)
      .eq('campaign_id', campaignId)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Detach campaign error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}