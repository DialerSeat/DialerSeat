import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createSeatSubscription, isSeatBillingError } from '@/lib/teamBilling'
import { activatePendingTeamMember } from '@/lib/teamMembership'
import { apiError } from '@/lib/apiError'

export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { memberId } = body

    if (!memberId) {
      return NextResponse.json({ success: false, error: 'memberId required' }, { status: 400 })
    }

    const { data: member } = await supabaseAdmin
      .from('team_members')
      .select('id, team_id, user_id, status, teams!inner(id, owner_id, name)')
      .eq('id', memberId)
      .maybeSingle()

    if (!member) {
      return NextResponse.json({ success: false, error: 'Member not found' }, { status: 404 })
    }

    const team = (member as any).teams
    if (team.owner_id !== userId) {
      return NextResponse.json(
        { success: false, error: 'Only the team owner can accept members' },
        { status: 403 }
      )
    }

    if (member.status !== 'pending') {
      return NextResponse.json(
        { success: false, error: `Member is ${member.status}, not pending` },
        { status: 400 }
      )
    }

    const { data: existingPaid } = await supabaseAdmin
      .from('team_seat_charges')
      .select('id, stripe_subscription_id')
      .eq('team_member_id', memberId)
      .eq('status', 'paid')
      .maybeSingle()

    let stripeSubId: string | null = null

    if (existingPaid?.stripe_subscription_id) {
      stripeSubId = existingPaid.stripe_subscription_id
    } else {
      const { data: pendingCharge } = await supabaseAdmin
        .from('team_seat_charges')
        .select('id')
        .eq('team_member_id', memberId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (pendingCharge) {
        const { data: agentUser } = await supabaseAdmin
          .from('users')
          .select('email')
          .eq('clerk_id', member.user_id)
          .maybeSingle()

        const agentEmail = agentUser?.email || member.user_id

        try {
          const result = await createSeatSubscription({
            ownerId: userId,
            agentId: member.user_id,
            agentEmail,
            teamId: team.id,
            teamName: team.name,
            seatChargeId: pendingCharge.id,
            teamMemberId: memberId,
          })

          stripeSubId = result.stripeSubscriptionId

          await supabaseAdmin
            .from('team_seat_charges')
            .update({
              stripe_subscription_id: result.stripeSubscriptionId,
              status: 'paid',
              period_start: result.currentPeriodStart,
              period_end: result.currentPeriodEnd,
            })
            .eq('id', pendingCharge.id)
        } catch (err: any) {
          if (isSeatBillingError(err)) {
            if (err.code === 'no_card' || err.code === 'no_customer') {
              return NextResponse.json(
                { success: false, error: err.message, code: err.code },
                { status: 402 }
              )
            }
          }
          console.error('Stripe seat sub creation failed:', err)
          return NextResponse.json(
            { success: false, error: err.message || 'Stripe charge failed' },
            { status: 502 }
          )
        }
      }
    }

    const { activatedAccessGrants, defaultedToTenantId } = await activatePendingTeamMember(memberId)

    const { data: updated } = await supabaseAdmin
      .from('team_members')
      .select()
      .eq('id', memberId)
      .single()

    return NextResponse.json({
      success: true,
      member: updated,
      stripeSubscriptionId: stripeSubId,
      activatedAccessGrants,
      defaultedToTenantId,
    })
  } catch (error: any) {
    console.error('Accept member error:', error)
    return apiError(error, { route: 'teams/members/accept' })
  }
}