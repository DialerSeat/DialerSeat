import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'
import { apiError } from '@/lib/apiError'
import { approvePendingMember } from '@/lib/approveTeamMember'

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

    const outcome = await approvePendingMember({
      ownerId: userId,
      memberId,
      teamId: team.id,
      teamName: team.name,
      agentClerkId: member.user_id,
    })

    // ── NO SEAT WITHOUT THE MONEY ─────────────────────────────────────────
    // This used to approve regardless and chase the card afterwards, on the
    // reasoning that a billing problem should not stop an owner accepting
    // anyone. The rule is now the opposite, and it is the right way round: a
    // seat that opens without a charge is a seat nobody is paying for, and
    // the agent starts dialling on it before anyone notices.
    //
    // The member stays pending — not rejected. Nothing is lost: the owner
    // fixes their card and accepts again, and the awaiting-approval banner
    // keeps telling the agent exactly where things stand in the meantime.
    if (!outcome.ok) {
      // ── SAY WHICH KIND OF FAILURE, AND WHAT TO DO ABOUT IT ──────────────
      // "This seat could not be billed" told an owner nothing they could act
      // on. The two situations behind it need opposite responses: a card
      // problem needs a new card, and a transient Stripe or network failure
      // needs the same button pressed again.
      const noCardOnFile = outcome.noCardOnFile

      // ── AUTHENTICATION IS NOT A DECLINE ─────────────────────────────────
      // "Try again" is the wrong advice for a card the bank wants
      // authenticated: the charge is off-session, so every retry fails
      // identically. It needs approving once, and Stripe's hosted invoice
      // page runs the challenge — so the useful response is a link, not a
      // suggestion to press the button again.
      if (outcome.requiresAction) {
        return NextResponse.json({
          success: false,
          error: 'Your bank wants this payment approved before the seat can open.',
          detail: outcome.actionUrl
            ? 'Open the link below and approve it once. Retrying here will keep ' +
              'failing until you do — the charge happens in the background, so ' +
              'there is nobody present for the bank to ask.'
            : 'Approve the pending payment in your Stripe billing history, then ' +
              'accept them again. Retrying here alone will keep failing.',
          actionUrl: outcome.actionUrl,
          billingIssue: outcome.billingIssue,
          canRetry: false,
          memberStatus: 'pending',
        }, { status: 402 })
      }

      return NextResponse.json({
        success: false,
        error: noCardOnFile
          ? 'There is no working payment method on your account, so this seat could not be billed.'
          : 'The payment for this seat did not go through, so the member has not been accepted yet.',
        detail: noCardOnFile
          ? 'Add or update your card in Billing, then accept them again. They stay ' +
            'in Requests until you do, and their invite is not lost.'
          : 'Try accepting again — this is often temporary. They stay in Requests ' +
            'either way, and their invite is not lost.',
        // The raw Stripe message, for the owner who wants to know exactly what
        // their bank said rather than a paraphrase of it.
        billingIssue: outcome.billingIssue,
        canRetry: !noCardOnFile,
        memberStatus: 'pending',
      }, { status: 402 })
    }

    const { data: updated } = await supabaseAdmin
      .from('team_members')
      .select()
      .eq('id', memberId)
      .single()

    return NextResponse.json({
      success: true,
      member: updated,
      stripeSubscriptionId: outcome.stripeSubscriptionId,
      activatedAccessGrants: outcome.activatedAccessGrants,
      defaultedToTenantId: outcome.defaultedToTenantId,
    })
  } catch (error: any) {
    console.error('Accept member error:', error)
    return apiError(error, { route: 'teams/members/accept' })
  }
}