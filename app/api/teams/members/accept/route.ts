import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createSeatSubscription, isSeatBillingError, agentPaysForThemselves } from '@/lib/teamBilling'
import { activatePendingTeamMember } from '@/lib/teamMembership'
import { apiError } from '@/lib/apiError'
import { syncIfTierChanged } from '@/lib/seatDiscount'

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
      // Same wrong column. Here the failure ran the other way: the lookup for
      // an existing paid seat always came back empty, so approving somebody who
      // already had one opened a SECOND subscription and billed the owner twice
      // for one person.
      .select('id, stripe_subscription_item_id')
      .eq('team_member_id', memberId)
      .eq('status', 'paid')
      .maybeSingle()

    let billingIssue: string | null = null
  let stripeSubId: string | null = null

    if (existingPaid?.stripe_subscription_item_id) {
      stripeSubId = existingPaid.stripe_subscription_item_id
    } else {
      // ── A FAILED CHARGE IS A RETRY, NOT AN ABSENCE ──────────────────────
      // This looked for 'pending' only. The first accept marks a charge
      // 'failed' when the card is declined, so on the SECOND accept there was
      // no pending row, the whole billing block below was skipped,
      // billingIssue stayed null, and the member was activated — with nobody
      // charged and nothing recording that.
      //
      // It looked like the retry had worked. It had only stopped trying.
      //
      // 'failed' is included, and reset to 'pending' before the attempt so a
      // charge is never left claiming to have failed while it is in flight.
      const { data: retryCharge } = await supabaseAdmin
        .from('team_seat_charges')
        .select('id, status')
        .eq('team_member_id', memberId)
        .in('status', ['pending', 'failed'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      // No row at all — an approval-mode join always writes one at redeem, so
      // this is a member who arrived some other way. Raise it now rather than
      // letting them through unbilled, which is the same hole in a different
      // shape.
      let pendingCharge = retryCharge
      if (!pendingCharge) {
        const { data: created } = await supabaseAdmin
          .from('team_seat_charges')
          .insert({
            team_id: team.id,
            owner_id: userId,
            agent_id: member.user_id,
            team_member_id: memberId,
            amount_cents: 3500,
            status: 'pending',
            period_start: new Date().toISOString(),
            period_end: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          })
          .select('id, status')
          .single()
        pendingCharge = created ?? null
      } else if (pendingCharge.status === 'failed') {
        await supabaseAdmin
          .from('team_seat_charges')
          .update({ status: 'pending', last_attempt_at: new Date().toISOString() })
          .eq('id', pendingCharge.id)
      }

      // Already paying for DialerSeat? Then there is no seat to buy. Raising a
      // charge here would bill the owner for access the agent already funds,
      // and failing that charge would then block an approval that has nothing
      // to do with money.
      const selfFunded = await agentPaysForThemselves(member.user_id)
      if (selfFunded && pendingCharge) {
        await supabaseAdmin
          .from('team_seat_charges')
          .update({ status: 'voided' })
          .eq('id', pendingCharge.id)
        await supabaseAdmin
          .from('team_members')
          .update({ billing_override: 'free' })
          .eq('id', memberId)
      }

      if (pendingCharge && !selfFunded) {
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
              stripe_subscription_item_id: result.stripeSubscriptionId,
              status: 'paid',
              period_start: result.currentPeriodStart,
              period_end: result.currentPeriodEnd,
            })
            .eq('id', pendingCharge.id)
        } catch (err: any) {
          // ── A BILLING PROBLEM IS NOT A REASON TO REFUSE SOMEBODY ────────
          // This returned 402 and abandoned the approval, so an owner without a
          // card on file could not accept anyone at all — and the agent sat
          // waiting, told to contact the very person who was stuck.
          //
          // The charge is marked failed and the approval goes through. The
          // daily enforcement job retries it every day, and if it still has not
          // settled after the grace period the seat suspends on its own. That
          // is the same rule already applied everywhere else here: a card
          // problem is chased, not used to lock people out.
          const reason = isSeatBillingError(err)
            ? `${err.code}: ${err.message}`
            : (err?.message || 'unknown')
          console.error(`[teams/accept] seat charge failed for member ${memberId}: ${reason}`)
          await supabaseAdmin
            .from('team_seat_charges')
            .update({
              status: 'failed',
              failure_reason: reason,
              last_attempt_at: new Date().toISOString(),
            })
            .eq('id', pendingCharge.id)
          billingIssue = reason
        }
      }
    }

    // ── NO SEAT WITHOUT THE MONEY ─────────────────────────────────────────
    // This used to approve regardless and chase the card afterwards, on the
    // reasoning that a billing problem should not stop an owner accepting
    // anyone. The rule is now the opposite, and it is the right way round: a
    // seat that opens without a charge is a seat nobody is paying for, and the
    // agent starts dialling on it before anyone notices.
    //
    // The member stays pending — not rejected. Nothing is lost: the owner
    // fixes their card and accepts again, and the awaiting-approval banner
    // keeps telling the agent exactly where things stand in the meantime.
    if (billingIssue) {
      // ── SAY WHICH KIND OF FAILURE, AND WHAT TO DO ABOUT IT ──────────────
      // "This seat could not be billed" told an owner nothing they could act
      // on. The two situations behind it need opposite responses: a card
      // problem needs a new card, and a transient Stripe or network failure
      // needs the same button pressed again.
      //
      // isSeatBillingError already distinguishes them — no_card and
      // no_customer mean there is nothing to charge, everything else is the
      // attempt itself failing.
      const noCardOnFile = /^(no_card|no_customer):/.test(billingIssue)

      return NextResponse.json({
        success: false,
        error: noCardOnFile
          ? 'There is no working payment method on your account, so this seat could not be billed.'
          : 'The payment for this seat did not go through, so the member has not been accepted yet.',
        detail: noCardOnFile
          ? 'Add or update your card in Billing, then accept them again. They stay ' +
            'in Requests until you do, and their invite is not lost.'
          : 'Try accepting again — this is often temporary. If it keeps failing, ' +
            'check the card on file in Billing. They stay in Requests either way, ' +
            'and their invite is not lost.',
        // The raw Stripe message, for the owner who wants to know exactly what
        // their bank said rather than a paraphrase of it.
        billingIssue,
        canRetry: !noCardOnFile,
        memberStatus: 'pending',
      }, { status: 402 })
    }

    const { activatedAccessGrants, defaultedToTenantId } = await activatePendingTeamMember(memberId)

    // Approving somebody is how a seat opens on the approval path, so it is
    // also where an owner can cross a tier. Only fires on an actual boundary.
    await syncIfTierChanged(userId)

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