import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * Owner changes the access_mode of a team-campaign link.
 *
 * Per Q1=A: when changing TO 'agent_pays' OR 'free', existing owner-paid
 * agents lose access immediately (their team_campaign_access rows get
 * is_active=false). Owner-paid Stripe subs tied to those rows are NOT
 * canceled here — that's pre-existing behavior (the original handler only
 * revoked the access rows on agent_pays switch and left Stripe alone).
 * The free mode reuses the exact same revocation path for consistency.
 *
 * Body:
 *   teamId:     uuid (required)
 *   campaignId: uuid (required)
 *   accessMode: 'owner_pays' | 'agent_pays' | 'public' | 'free' (required)
 */
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

    // Verify ownership
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

    // Update the access_mode
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

    // If switched to agent_pays OR free, revoke all owner-paid access for
    // this campaign on this team. In both modes the owner stops paying,
    // so leaving owner-paid access rows live would either keep billing
    // (in the case of unhandled Stripe subs) or grant access the new mode
    // doesn't authorize. Agents who want continued access must subscribe
    // themselves (agent_pays) or be re-granted under free.
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
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}