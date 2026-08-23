import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'
import { apiError } from '@/lib/apiError'
import { approvePendingMember } from '@/lib/approveTeamMember'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// ─────────────────────────────────────────────────────────────────────────
// AN OWNER PUTTING SOMEBODY ON A TEAM DIRECTLY
//
// Every route into a team went through the agent: they find a code, they
// redeem it, the owner approves. That is the right flow for somebody joining
// from outside, and the wrong one for an owner looking at their own All Users
// list who wants three of these people on a second team. There was no way to
// do it without sending each of them a code and waiting.
//
// ADMITTED IMMEDIATELY, because the owner asking is the person who would have
// approved the request anyway. Asking them to approve their own action is
// ceremony, not a check.
//
// STILL BILLED. Instant means no approval step, not no seat charge — a seat
// opened without one is a seat nobody pays for, and it is the owner's own
// card either way. This runs the same approvePendingMember the approval path
// runs, so the two cannot drift: the charge is raised, a failed one retried,
// skipped entirely for an agent who already pays for DialerSeat, and a
// membership whose seat will not settle is left PENDING rather than let in.
//
// So the outcome per person is one of three, and the response says which:
// added, already there, or waiting on the owner's card.
// ─────────────────────────────────────────────────────────────────────────

const MAX_PER_CALL = 50

export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const teamId = typeof body?.teamId === 'string' ? body.teamId : ''
    const rawIds: unknown[] = Array.isArray(body?.userIds) ? body.userIds : []
    const clean = rawIds.filter(
      (v): v is string => typeof v === 'string' && v.trim().length > 0
    )
    const userIds: string[] = Array.from(new Set(clean)).slice(0, MAX_PER_CALL)

    if (!teamId) {
      return NextResponse.json({ success: false, error: 'teamId required' }, { status: 400 })
    }
    if (userIds.length === 0) {
      return NextResponse.json({ success: false, error: 'Pick at least one person' }, { status: 400 })
    }

    const { data: team } = await supabaseAdmin
      .from('teams')
      .select('id, name, owner_id')
      .eq('id', teamId)
      .maybeSingle()

    if (!team) {
      return NextResponse.json({ success: false, error: 'Team not found' }, { status: 404 })
    }
    if (team.owner_id !== userId) {
      return NextResponse.json(
        { success: false, error: 'Only the team owner can add members.' },
        { status: 403 }
      )
    }

    // Everything already on this team, in one read rather than one per person.
    const { data: existing } = await supabaseAdmin
      .from('team_members')
      .select('id, user_id, status')
      .eq('team_id', teamId)
      .in('user_id', userIds)

    const byUser = new Map((existing || []).map(m => [m.user_id, m]))

    const added: Array<{ userId: string; memberId: string }> = []
    const alreadyOn: string[] = []
    const failed: Array<{ userId: string; reason: string; noCardOnFile: boolean }> = []

    // Sequential. Each one of these can create a Stripe subscription, and a
    // burst of them failing halfway leaves a state nobody can read — the same
    // reason the delete path does not parallelise either.
    for (const agentId of userIds) {
      // The owner is already on their own team by owning it.
      if (agentId === team.owner_id) {
        alreadyOn.push(agentId)
        continue
      }

      const prior = byUser.get(agentId)
      let memberId: string | null = null

      if (prior && (prior.status === 'active' || prior.status === 'pending')) {
        // Active is nothing to do. Pending is somebody who already asked —
        // approving them is exactly what this does next, so let it through
        // rather than reporting a conflict at the owner.
        if (prior.status === 'active') {
          alreadyOn.push(agentId)
          continue
        }
        memberId = prior.id
      } else if (prior) {
        // Removed once, coming back. The row is revived rather than a second
        // one inserted: their history, their seat charges and their campaign
        // grants all hang off this id, and a duplicate membership row is how
        // a person ends up counted twice on the roster and billed twice.
        const { data: revived } = await supabaseAdmin
          .from('team_members')
          .update({
            status: 'pending',
            removed_at: null,
            decision_seen_at: null,
            seat_suspended_at: null,
            seat_suspend_reason: null,
            billing_override: 'owner',
          })
          .eq('id', prior.id)
          .select('id')
          .single()
        memberId = revived?.id ?? null
      } else {
        const { data: created, error } = await supabaseAdmin
          .from('team_members')
          .insert({
            team_id: teamId,
            user_id: agentId,
            status: 'pending',
            // No joined_via_code: they did not join with one.
            joined_via_code: null,
            // ── SAY WHO PAYS, EXPLICITLY ──────────────────────────────
            // Left null at first, on the reasoning that null already means
            // the owner. It does not. ownerSeatDiscount counts a seat as
            // owner-funded when billing_override is 'owner' OR the code they
            // joined with is owner-pays — and somebody added directly
            // matches neither, so every seat added this way counted toward
            // nothing. An owner who built their roster from All Users would
            // never reach the ten-seat tier however many people they added.
            //
            // approvePendingMember still overwrites this with 'free' if they
            // fund themselves or are covered by another of this owner's
            // seats, so stating it here cannot force a charge that should
            // not exist.
            billing_override: 'owner',
          })
          .select('id')
          .single()
        if (error) {
          failed.push({ userId: agentId, reason: error.message, noCardOnFile: false })
          continue
        }
        memberId = created?.id ?? null
      }

      if (!memberId) {
        failed.push({ userId: agentId, reason: 'Could not create the membership', noCardOnFile: false })
        continue
      }

      const outcome = await approvePendingMember({
        ownerId: userId,
        memberId,
        teamId: team.id,
        teamName: team.name,
        agentClerkId: agentId,
      })

      if (outcome.ok) {
        added.push({ userId: agentId, memberId })
      } else {
        failed.push({
          userId: agentId,
          reason: outcome.billingIssue || 'The seat could not be billed',
          noCardOnFile: outcome.noCardOnFile,
        })
      }
    }

    const noCard = failed.some(f => f.noCardOnFile)

    return NextResponse.json({
      success: added.length > 0 || failed.length === 0,
      teamId,
      teamName: team.name,
      added,
      alreadyOn,
      failed,
      // One sentence the UI can show without re-deriving it from three arrays.
      summary:
        failed.length === 0
          ? `${added.length} added to ${team.name}.`
          : noCard
            ? `${added.length} added. ${failed.length} could not be billed — there is no working ` +
              `payment method on your account, so those seats stay pending until you add one.`
            : `${added.length} added. ${failed.length} could not be billed and stay pending — ` +
              `try again, and check the card on file if it keeps failing.`,
    })
  } catch (error: any) {
    console.error('Add members error:', error)
    return apiError(error, { route: 'teams/members/add' })
  }
}
