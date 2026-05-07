import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createSeatSubscription, isSeatBillingError } from '@/lib/teamBilling'

/**
 * Owner accepts a pending team member.
 *
 * Now Stripe-wired:
 *   1. Verify owner has card on file (fail loud if not — 402)
 *   2. Create Stripe seat subscription with metadata + description
 *   3. Update team_seat_charges row with stripe_subscription_id and 'paid'
 *      status (Stripe webhook will override to actual status when invoice settles)
 *   4. Flip team_members.status to 'active'
 *   5. Activate any pre-staged team_campaign_access rows
 *
 * On Stripe failure (no card, decline, etc.): roll back nothing — member stays
 * pending, no charges created. Owner gets a clear error.
 *
 * Body:
 *   memberId: uuid (required)
 */
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

    // Fetch member + team in one query
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

    // Find the pending seat_charges row to attach Stripe sub to.
    // Idempotency guard: if there's already a paid charge for this member,
    // don't double-charge — just activate them.
    const { data: existingPaid } = await supabaseAdmin
      .from('team_seat_charges')
      .select('id, stripe_subscription_id')
      .eq('team_member_id', memberId)
      .eq('status', 'paid')
      .maybeSingle()

    let stripeSubId: string | null = null

    if (existingPaid?.stripe_subscription_id) {
      // Idempotent: already charged, skip Stripe call
      stripeSubId = existingPaid.stripe_subscription_id
    } else {
      // Find pending charge to wire up
      const { data: pendingCharge } = await supabaseAdmin
        .from('team_seat_charges')
        .select('id')
        .eq('team_member_id', memberId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (!pendingCharge) {
        return NextResponse.json(
          { success: false, error: 'No pending seat charge found for this member' },
          { status: 500 }
        )
      }

      // Look up agent's email for the Stripe description
      const { data: agentUser } = await supabaseAdmin
        .from('users')
        .select('email')
        .eq('clerk_id', member.user_id)
        .maybeSingle()

      const agentEmail = agentUser?.email || member.user_id

      // Create the Stripe subscription
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

        // Update the seat charge row with Stripe info + paid status
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

    // Flip member to active
    const { data: updated, error: updateErr } = await supabaseAdmin
      .from('team_members')
      .update({
        status: 'active',
        accepted_at: new Date().toISOString(),
      })
      .eq('id', memberId)
      .select()
      .single()

    if (updateErr) throw updateErr

    // Activate pre-staged access rows
    const { data: activated } = await supabaseAdmin
      .from('team_campaign_access')
      .update({ is_active: true })
      .eq('team_member_id', memberId)
      .eq('is_active', false)
      .is('revoked_at', null)
      .select('id')

    return NextResponse.json({
      success: true,
      member: updated,
      stripeSubscriptionId: stripeSubId,
      activatedAccessGrants: activated?.length || 0,
    })
  } catch (error: any) {
    console.error('Accept member error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}