import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createSeatSubscription, isSeatBillingError } from '@/lib/teamBilling'
import { apiError } from '@/lib/apiError'

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

    if (!payer || !['owner', 'agent', 'free'].includes(payer)) {
      return NextResponse.json(
        { success: false, error: 'payer must be "owner", "agent", or "free"' },
        { status: 400 }
      )
    }

    const { data: member } = await supabaseAdmin
      .from('team_members')
      .select('id, team_id, user_id, status, teams!inner(id, owner_id, name)')
      .eq('id', memberId)
      .maybeSingle()

    if (!member) {
      return NextResponse.json({ success: false, error: 'Member not found' }, { status: 404 })
    }

    const team: any = (member as any).teams
    if (team.owner_id !== userId) {
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

    const { data: tc } = await supabaseAdmin
      .from('team_campaigns')
      .select('team_id, access_mode')
      .eq('team_id', member.team_id)
      .eq('campaign_id', campaignId)
      .maybeSingle()

    if (!tc) {
      return NextResponse.json(
        { success: false, error: 'Campaign is not attached to this team' },
        { status: 400 }
      )
    }

    if (payer === 'free' && tc.access_mode !== 'free') {
      return NextResponse.json(
        { success: false, error: 'Free payer is only valid on campaigns in free mode' },
        { status: 400 }
      )
    }

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

    const { data: agentUser } = await supabaseAdmin
      .from('users')
      .select('email')
      .eq('clerk_id', member.user_id)
      .maybeSingle()

    const agentEmail = agentUser?.email || 'unknown'

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

    if (payer === 'agent' || payer === 'free') {
      return NextResponse.json({
        success: true,
        access: granted,
        stripeChargeCreated: false,
      })
    }

    const { data: seatCharge, error: seatErr } = await supabaseAdmin
      .from('team_seat_charges')
      .insert({
        team_id: member.team_id,
        owner_id: userId,
        agent_id: member.user_id,
        team_member_id: memberId,
        amount_cents: 3500,
        status: 'pending',
        period_start: new Date().toISOString(),
        period_end: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        stripe_subscription_id: null,
      })
      .select()
      .single()

    if (seatErr) {

      await supabaseAdmin.from('team_campaign_access').delete().eq('id', granted.id)
      throw seatErr
    }

    try {
      const sub = await createSeatSubscription({
        ownerId: userId,
        agentId: member.user_id,
        agentEmail,
        teamId: team.id,
        teamName: team.name,
        seatChargeId: seatCharge.id,
        teamMemberId: memberId,
      })

      await supabaseAdmin
        .from('team_seat_charges')
        .update({
          stripe_subscription_id: sub.stripeSubscriptionId,
          period_start: sub.currentPeriodStart,
          period_end: sub.currentPeriodEnd,
          status: 'paid', // webhook will refine to 'paid'/'failed'/etc but mark as paid optimistically
        })
        .eq('id', seatCharge.id)

      return NextResponse.json({
        success: true,
        access: granted,
        stripeChargeCreated: true,
        stripeSubscriptionId: sub.stripeSubscriptionId,
      })
    } catch (stripeErr: any) {

      await supabaseAdmin.from('team_seat_charges').delete().eq('id', seatCharge.id)
      await supabaseAdmin.from('team_campaign_access').delete().eq('id', granted.id)

      if (isSeatBillingError(stripeErr)) {
        if (stripeErr.code === 'no_card') {
          return NextResponse.json(
            { success: false, error: stripeErr.message, reason: 'no_card' },
            { status: 402 }
          )
        }
        if (stripeErr.code === 'no_customer') {
          return NextResponse.json(
            { success: false, error: stripeErr.message, reason: 'no_customer' },
            { status: 402 }
          )
        }
      }
      console.error('Seat sub creation failed:', stripeErr)
      return NextResponse.json(
        { success: false, error: stripeErr.message || 'Stripe charge failed' },
        { status: 500 }
      )
    }
  } catch (error: any) {
    console.error('Grant access error:', error)
    return apiError(error, { route: 'teams/access/grant' })
  }
}