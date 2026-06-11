import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { revalidateTag } from 'next/cache'
import { supabaseAdmin } from '@/lib/supabase'
import { userCacheTag } from '@/lib/tenant'
import { createSeatSubscription, isSeatBillingError } from '@/lib/teamBilling'

/**
 * Owner accepts a pending team member.
 *
 * Flow branches on whether a pending team_seat_charge exists:
 *
 *   1. Owner_pays code → pending seat_charge row exists →
 *      verify owner has card, create Stripe seat sub, mark charge paid.
 *
 *   2. Agent_pays code → no pending seat_charge → skip Stripe entirely,
 *      just activate. Agent's own personal $35/wk DialerSeat sub gates
 *      access platform-side.
 *
 *   3. Free code → no pending seat_charge → skip Stripe entirely. Free
 *      mode means no per-seat fee; agent's personal sub still required.
 *
 * v2 (Push B): after activating the member, set their active_tenant_id
 * to the team owner's WL tenant (if the owner has one). This makes
 * joining a WL team automatically default the new member's brand view
 * to that WL. They see the whitelabel chrome instead of standard
 * DialerSeat on their next page load.
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

    // Fetch member + team
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

    // ── v2: set default view to team owner's WL tenant ────────────────
    // Look up the team owner's active WL tenant. If they have one, stamp
    // it onto the accepted user's active_tenant_id so the next page load
    // renders the whitelabel chrome. Owner without a WL → no change.
    // If the agent had previously picked a different view (e.g. standard
    // or another team's WL), this overrides it on accept. They can switch
    // back via settings if needed.
    let defaultedToTenantId: string | null = null
    const { data: ownerTenant } = await supabaseAdmin
      .from('white_label_tenants')
      .select('id')
      .eq('owner_clerk_id', team.owner_id)
      .eq('status', 'active')
      .eq('is_active', true)
      .maybeSingle()

    if (ownerTenant) {
      const { error: tenantErr } = await supabaseAdmin
        .from('users')
        .update({ active_tenant_id: ownerTenant.id })
        .eq('clerk_id', member.user_id)

      if (tenantErr) {
        // Non-fatal — the member is still active, they just don't
        // get the auto-switch to the WL view. Log and continue.
        console.warn('failed to set active_tenant_id on accept:', tenantErr)
      } else {
        defaultedToTenantId = ownerTenant.id
        // Bust the new member's tenant cache so the next page render
        // picks up the new active_tenant_id without waiting for the
        // 60s revalidate window.
        revalidateTag(userCacheTag(member.user_id), { expire: 0 })
      }
    }

    return NextResponse.json({
      success: true,
      member: updated,
      stripeSubscriptionId: stripeSubId,
      activatedAccessGrants: activated?.length || 0,
      defaultedToTenantId,
    })
  } catch (error: any) {
    console.error('Accept member error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}