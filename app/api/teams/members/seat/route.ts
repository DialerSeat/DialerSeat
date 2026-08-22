import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'
import { apiError } from '@/lib/apiError'
import { stripe } from '@/lib/stripe'
import { cancelSeatSubscription } from '@/lib/teamBilling'
import { sendAdminPush } from '@/lib/pushNotify'
import { lookupUserIdentity } from '@/lib/userDisplayName'

export const dynamic = 'force-dynamic'

// =============================================================================
// SEAT PAUSE / RESUME / CANCEL — owner-side control of one seat's billing
// =============================================================================
// Until now the only lever an owner had over a seat was REMOVE, which cancels
// the subscription, revokes campaign access and drops the person off the
// roster. That is the right tool for "this person is gone" and much too blunt
// for "this person is on holiday" or "we're not running that campaign this
// month" — both of which currently cost the owner the whole relationship and
// force a fresh invite to undo.
//
// Three actions, all leaving the member ON the roster:
//   pause   — stop billing, suspend dialing, one click to undo. Stripe
//             pause_collection, so the seat keeps its subscription id and the
//             price the owner signed up at.
//   resume  — undo a pause.
//   cancel  — stop billing permanently and suspend dialing. The seat's
//             subscription is cancelled; bringing this person back means
//             issuing a new seat, which is a new charge.
//
// THE TRAP, same as the account-level pause: Stripe's pause_collection leaves
// subscription.status as 'active', and proxy.ts grants team access purely on
// team_members.status = 'active'. Without the seat_suspended_at marker being
// honoured there, a paused seat would be free unlimited dialing.
// =============================================================================

type SeatAction = 'pause' | 'resume' | 'cancel'

export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    let memberId: string
    let action: SeatAction
    try {
      const body = await req.json()
      memberId = body?.memberId
      action = body?.action
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 })
    }

    if (!memberId) {
      return NextResponse.json({ success: false, error: 'memberId required' }, { status: 400 })
    }
    if (action !== 'pause' && action !== 'resume' && action !== 'cancel') {
      return NextResponse.json(
        { success: false, error: 'action must be pause, resume or cancel' },
        { status: 400 }
      )
    }

    const { data: member, error: memberErr } = await supabaseAdmin
      .from('team_members')
      .select('id, team_id, user_id, status, seat_suspended_at, seat_suspend_reason, teams!inner(owner_id, name)')
      .eq('id', memberId)
      .maybeSingle()

    if (memberErr) throw memberErr
    if (!member) {
      return NextResponse.json({ success: false, error: 'Member not found' }, { status: 404 })
    }

    const team = member.teams as unknown as { owner_id: string; name: string }
    if (team.owner_id !== userId) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }
    if (member.status !== 'active') {
      return NextResponse.json(
        { success: false, error: 'Only an active member\'s seat can be changed' },
        { status: 400 }
      )
    }

    // The seat's live charges. Empty for an agent_pays or free seat, which is
    // fine — suspension still applies, there is just no billing to stop.
    const { data: charges } = await supabaseAdmin
      .from('team_seat_charges')
      .select('id, stripe_subscription_item_id')
      .eq('team_member_id', memberId)
      .eq('status', 'paid')

    const now = new Date().toISOString()
    const billing: Array<{ chargeId: string; ok: boolean; detail?: string }> = []

    if (action === 'resume') {
      if (!member.seat_suspended_at) {
        return NextResponse.json({ success: false, error: 'Seat is not suspended' }, { status: 400 })
      }
      // ── A CANCELLED OR UNPAID SEAT IS RE-ISSUED, NOT UN-PAUSED ───────
      // This used to refuse: "issue a new seat to bring them back" — advice
      // pointing at a button that did not exist anywhere in the product, so
      // a cancelled seat was a dead end and the only way back was removing
      // the person and re-inviting them.
      //
      // There is nothing to un-pause because the subscription is gone, so a
      // new one is raised through the same path an approval uses. That means
      // the same rules apply without restating any of them: no charge if the
      // agent funds themselves, no second charge if this owner already pays
      // for them elsewhere, and the seat stays suspended if the card fails.
      const nothingToUnpause =
        member.seat_suspend_reason === 'canceled' ||
        member.seat_suspend_reason === 'unpaid' ||
        (charges || []).length === 0

      if (nothingToUnpause) {
        // Cleared first: approvePendingMember settles a seat for a member it
        // expects to be live, and the enforcement job must see an ordinary
        // unpaid seat rather than a suspended one if the charge fails.
        await supabaseAdmin
          .from('team_members')
          .update({ seat_suspended_at: null, seat_suspend_reason: null })
          .eq('id', memberId)

        const { approvePendingMember } = await import('@/lib/approveTeamMember')
        const outcome = await approvePendingMember({
          ownerId: userId,
          memberId,
          teamId: member.team_id,
          teamName: team.name,
          agentClerkId: member.user_id,
          skipActivation: true,
        })

        if (!outcome.ok) {
          // Put it back. A seat that could not be paid for must not sit
          // active — that is the whole rule this codebase settled on.
          await supabaseAdmin
            .from('team_members')
            .update({ seat_suspended_at: now, seat_suspend_reason: 'unpaid' })
            .eq('id', memberId)

          return NextResponse.json({
            success: false,
            error: outcome.noCardOnFile
              ? 'There is no working payment method on your account, so this seat could not be restarted.'
              : 'The payment for this seat did not go through, so it stays paused.',
            billingIssue: outcome.billingIssue,
            canRetry: !outcome.noCardOnFile,
          }, { status: 402 })
        }

        await notify('resumed', member.user_id, team.name)
        return NextResponse.json({
          success: true,
          action,
          reissued: true,
          stripeSubscriptionId: outcome.stripeSubscriptionId,
        })
      }

      for (const c of charges || []) {
        try {
          await stripe.subscriptions.update(c.stripe_subscription_item_id, { pause_collection: null })
          billing.push({ chargeId: c.id, ok: true })
        } catch (err) {
          billing.push({ chargeId: c.id, ok: false, detail: err instanceof Error ? err.message : String(err) })
        }
      }

      const { error } = await supabaseAdmin
        .from('team_members')
        .update({ seat_suspended_at: null, seat_suspend_reason: null })
        .eq('id', memberId)
      if (error) throw error

      await notify('resumed', member.user_id, team.name)
      return NextResponse.json({ success: true, action, billing })
    }

    // ── pause and cancel both suspend ─────────────────────────────────────
    if (member.seat_suspended_at) {
      return NextResponse.json(
        { success: false, error: `Seat is already ${member.seat_suspend_reason ?? 'suspended'}` },
        { status: 400 }
      )
    }

    for (const c of charges || []) {
      try {
        if (action === 'pause') {
          // void, not 'keep_as_draft': nobody should return from a pause to a
          // stack of accrued invoices for time they didn't use.
          await stripe.subscriptions.update(c.stripe_subscription_item_id, {
            pause_collection: { behavior: 'void' },
          })
        } else {
          await cancelSeatSubscription(c.stripe_subscription_item_id)
          await supabaseAdmin
            .from('team_seat_charges')
            .update({ status: 'voided' })
            .eq('id', c.id)
        }
        billing.push({ chargeId: c.id, ok: true })
      } catch (err) {
        console.error(`[teams/members/seat] ${action} failed for charge ${c.id}:`, err)
        billing.push({ chargeId: c.id, ok: false, detail: err instanceof Error ? err.message : String(err) })
      }
    }

    const { error: updErr } = await supabaseAdmin
      .from('team_members')
      .update({ seat_suspended_at: now, seat_suspend_reason: action === 'pause' ? 'paused' : 'canceled' })
      .eq('id', memberId)
    if (updErr) throw updErr

    // Campaign access is revoked only on cancel. A pause is meant to be
    // reversible without the owner having to re-grant every campaign by hand.
    if (action === 'cancel') {
      await supabaseAdmin
        .from('team_campaign_access')
        .update({ is_active: false, revoked_at: now })
        .eq('team_member_id', memberId)
        .eq('is_active', true)
    }

    await notify(action === 'pause' ? 'paused' : 'canceled', member.user_id, team.name)
    return NextResponse.json({ success: true, action, billing })
  } catch (err) {
    return apiError(err, { route: 'teams/members/seat' })
  }
}

/** Named notification — an unnamed seat event isn't actionable. Never throws. */
async function notify(
  what: 'paused' | 'resumed' | 'canceled',
  memberClerkId: string,
  teamName: string
): Promise<void> {
  try {
    const { name } = await lookupUserIdentity(memberClerkId)
    if (what === 'resumed') {
      await sendAdminPush('sub_resumed', `${name}'s seat on ${teamName} was resumed. Billing has restarted.`)
    } else if (what === 'paused') {
      await sendAdminPush('sub_paused', `${name}'s seat on ${teamName} was paused. Billing is stopped; they stay on the roster.`)
    } else {
      await sendAdminPush('cancel', `${name}'s seat on ${teamName} was cancelled.`)
    }
  } catch (err) {
    console.error('[teams/members/seat] notification failed:', err)
  }
}
