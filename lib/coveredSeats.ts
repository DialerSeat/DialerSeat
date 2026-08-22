import { supabaseAdmin } from '@/lib/supabase'

// ─────────────────────────────────────────────────────────────────────────
// ONE SEAT PER PERSON PER OWNER
//
// A seat used to be billed per MEMBERSHIP. An owner putting the same agent on
// two of their own teams paid twice — $70 a week for one person who can only
// be on one call at a time — and nothing anywhere said so. Add to team made
// that a two-click mistake.
//
// A DIFFERENT OWNER IS A DIFFERENT MATTER and is deliberately unchanged. Owner
// B is paying for access to B's campaigns; they cannot ride on a seat A bought,
// and expecting them to would make one owner's billing depend on another's.
//
// THE INVARIANT: among one owner's active memberships for one agent, exactly
// one carries a paid seat. The rest point at it through seat_covered_by and
// are not billed.
//
// KEEPING IT TRUE IS THE HARD PART. The paying membership can end — the agent
// leaves that team, the owner removes them, the seat is suspended for
// non-payment — while the covered ones carry on. Without a promotion step the
// owner would then have several active memberships and be paying for none of
// them, which is the same leak in the opposite direction.
//
// So this runs after anything that can end a seat, and again on the nightly
// enforcement pass as a net under all of them.
// ─────────────────────────────────────────────────────────────────────────

export interface CoveringSeat {
  /** The membership that carries the paid seat. */
  memberId: string
  teamId: string
  chargeId: string
}

/**
 * Does this owner already pay for this agent somewhere else?
 *
 * Returns the membership carrying that seat, or null. `exceptMemberId` is the
 * membership being considered, which must never count as covering itself.
 */
export async function findCoveringSeat(
  ownerId: string,
  agentClerkId: string,
  exceptMemberId?: string
): Promise<CoveringSeat | null> {
  const { data: charges } = await supabaseAdmin
    .from('team_seat_charges')
    .select('id, team_member_id, team_id')
    .eq('owner_id', ownerId)
    .eq('agent_id', agentClerkId)
    .eq('status', 'paid')
    .not('team_member_id', 'is', null)

  const candidates = (charges || []).filter(c => c.team_member_id !== exceptMemberId)
  if (candidates.length === 0) return null

  // A paid charge is not enough on its own. The membership behind it has to
  // still be active and unsuspended, or a seat that ended months ago would go
  // on "covering" memberships nobody is paying for.
  const { data: members } = await supabaseAdmin
    .from('team_members')
    .select('id, status, seat_suspended_at')
    .in('id', candidates.map(c => c.team_member_id))

  const live = new Set(
    (members || [])
      .filter(m => m.status === 'active' && !m.seat_suspended_at)
      .map(m => m.id)
  )

  const hit = candidates.find(c => live.has(c.team_member_id))
  if (!hit) return null

  return { memberId: hit.team_member_id, teamId: hit.team_id, chargeId: hit.id }
}

/**
 * Mark a membership as covered by an existing seat, and drop its charge.
 *
 * billing_override 'free' as well as seat_covered_by: 'free' is what every
 * existing reader already understands as "not billed" — the roster, the seat
 * counts and the volume tier all key off it — and seat_covered_by is what says
 * WHY, so a covered seat can never be confused with an agent who funds
 * themselves.
 */
export async function markSeatCovered(
  memberId: string,
  covering: CoveringSeat,
  pendingChargeId?: string | null
): Promise<void> {
  if (pendingChargeId) {
    await supabaseAdmin
      .from('team_seat_charges')
      .update({
        status: 'voided',
        void_reason: `Covered by the seat on membership ${covering.memberId}`,
      })
      .eq('id', pendingChargeId)
  }

  await supabaseAdmin
    .from('team_members')
    .update({ billing_override: 'free', seat_covered_by: covering.memberId })
    .eq('id', memberId)
}

export interface ReconcileResult {
  /** A covered membership was promoted and now carries the paid seat. */
  promotedMemberId: string | null
  billingIssue: string | null
}

/**
 * Make sure this owner still pays for this agent exactly once.
 *
 * Called after a seat ends. If the membership that was carrying the charge is
 * gone and others are still active and covered, the oldest of them is promoted
 * to a real seat.
 *
 * Never throws. A promotion that fails leaves the membership covered by a seat
 * that no longer exists, which the nightly pass tries again — and which is a
 * far better outcome than an exception thrown from inside somebody leaving a
 * team.
 */
export async function reconcileCoveredSeats(
  ownerId: string,
  agentClerkId: string
): Promise<ReconcileResult> {
  const out: ReconcileResult = { promotedMemberId: null, billingIssue: null }

  try {
    // Still covered elsewhere? Then there is nothing to do — the invariant
    // already holds.
    const covering = await findCoveringSeat(ownerId, agentClerkId)
    if (covering) return out

    // Nobody is paying. Find an active membership that was relying on a seat
    // which has since ended.
    const { data: teams } = await supabaseAdmin
      .from('teams')
      .select('id, name')
      .eq('owner_id', ownerId)

    const teamIds = (teams || []).map(t => t.id)
    if (teamIds.length === 0) return out

    const { data: orphans } = await supabaseAdmin
      .from('team_members')
      .select('id, team_id, created_at')
      .in('team_id', teamIds)
      .eq('user_id', agentClerkId)
      .eq('status', 'active')
      .is('seat_suspended_at', null)
      .not('seat_covered_by', 'is', null)
      .order('created_at', { ascending: true })

    const promote = (orphans || [])[0]
    if (!promote) return out

    const teamName = (teams || []).find(t => t.id === promote.team_id)?.name || 'Team'

    // Cleared BEFORE the charge is attempted. If the charge fails the
    // membership must not still claim to be covered by a seat that is gone —
    // the enforcement job needs to see an ordinary unpaid seat so its grace
    // period and suspension apply as they would to any other.
    await supabaseAdmin
      .from('team_members')
      .update({ seat_covered_by: null, billing_override: null })
      .eq('id', promote.id)

    const { approvePendingMember } = await import('@/lib/approveTeamMember')
    const outcome = await approvePendingMember({
      ownerId,
      memberId: promote.id,
      teamId: promote.team_id,
      teamName,
      agentClerkId,
      // Already active — this is only here to raise and settle the seat.
      skipActivation: true,
    })

    if (outcome.ok) {
      out.promotedMemberId = promote.id
    } else {
      out.billingIssue = outcome.billingIssue
    }
  } catch (err: any) {
    console.error('[coveredSeats] reconcile failed', err?.message || err)
  }

  return out
}
