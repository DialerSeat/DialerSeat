import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * Owner manually grants a specific agent access to a specific campaign.
 *
 * Per spec: owner picks the payer at grant time (just like code creation).
 * If payer='owner', a pending team_seat_charges row is staged for Batch 4
 * Stripe wiring. If payer='agent', no charge is staged — agent's own $35
 * sub gates downstream.
 *
 * Body:
 *   memberId:   uuid (required) — must be an active member of the team
 *   campaignId: uuid (required) — must be attached to the same team
 *   payer:      'owner' | 'agent' (required)
 */
export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { memberId, campaignId, payer } = body

    if (!memberId || !campaignId) {
      return NextResponse.json(
        { success: false, error: 'memberId and campaignId required' },
        { status: 400 }
      )
    }

    if (!payer || !['owner', 'agent'].includes(payer)) {
      return NextResponse.json(
        { success: false, error: 'payer must be "owner" or "agent"' },
        { status: 400 }
      )
    }

    // Verify member exists and is active
    const { data: member } = await supabaseAdmin
      .from('team_members')
      .select('id, team_id, user_id, status, teams!inner(owner_id)')
      .eq('id', memberId)
      .maybeSingle()

    if (!member) {
      return NextResponse.json({ success: false, error: 'Member not found' }, { status: 404 })
    }

    if ((member as any).teams.owner_id !== userId) {
      return NextResponse.json(
        { success: false, error: 'Only the team owner can grant access' },
        { status: 403 }
      )
    }

    if (member.status !== 'active') {
      return NextResponse.json(
        { success: false, error: 'Member is not active on this team' },
        { status: 400 }
      )
    }

    // Verify campaign is attached to this team
    const { data: tc } = await supabaseAdmin
      .from('team_campaigns')
      .select('team_id')
      .eq('team_id', member.team_id)
      .eq('campaign_id', campaignId)
      .maybeSingle()

    if (!tc) {
      return NextResponse.json(
        { success: false, error: 'Campaign is not attached to this team' },
        { status: 400 }
      )
    }

    // Check if active access already exists
    const { data: existing } = await supabaseAdmin
      .from('team_campaign_access')
      .select('id')
      .eq('team_member_id', memberId)
      .eq('campaign_id', campaignId)
      .eq('is_active', true)
      .maybeSingle()

    if (existing) {
      return NextResponse.json(
        { success: false, error: 'Member already has active access to this campaign' },
        { status: 409 }
      )
    }

    // Insert access row
    const { data: granted, error: grantErr } = await supabaseAdmin
      .from('team_campaign_access')
      .insert({
        team_id: member.team_id,
        team_member_id: memberId,
        campaign_id: campaignId,
        access_source: 'manual',
        granted_via_code_id: null,
        payer,
        is_active: true,
      })
      .select()
      .single()

    if (grantErr) throw grantErr

    // Stage seat charge for owner-pays grants (Batch 4 wires Stripe)
    if (payer === 'owner') {
      await supabaseAdmin.from('team_seat_charges').insert({
        team_id: member.team_id,
        owner_id: userId,
        agent_id: member.user_id,
        team_member_id: memberId,
        amount_cents: 3500,
        status: 'pending',
        period_start: new Date().toISOString(),
        period_end: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      })
    }

    return NextResponse.json({
      success: true,
      access: granted,
      stripeChargePending: payer === 'owner',
    })
  } catch (error: any) {
    console.error('Grant access error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}