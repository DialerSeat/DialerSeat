// =============================================================================
// WHO IS PAYING FOR THIS SEAT — ONE DEFINITION, IMPORTED EVERYWHERE
// =============================================================================
// Three columns carry who-pays and they had drifted into contradicting each
// other, which is how an owner who issued an agent-pays recruiting code ended
// up billed for a recruit who cancelled. The precedence lives here so billing
// and access cannot disagree about it.
//
//   team_members.billing_override   the decision, once one has been made
//     'owner'   the team owner pays for this seat
//     'agent'   the agent pays for their own seat
//     'free'    costs the OWNER nothing — the agent self-funds, or another
//               seat of the same owner already covers them. NOT "free to
//               everybody".
//     null      no decision recorded; the join decides
//
//   team_codes.payer                what the join said
//     'agent' | 'owner'
//
// The check constraint also permits 'agency_pays' and 'agent_pays_self'.
// Nothing reads or writes either and no row holds one — dead vocabulary, named
// here so nobody reaches for it without deciding what it would mean.
//
// ── WHY THIS GOVERNS ACCESS AND NOT JUST BILLING ────────────────────────────
// A team seat should only GRANT platform access when somebody is actually
// paying for it, and on an agent-funded seat that somebody is the agent — via
// their own subscription, which checkSelfSubActive already answers first.
//
// getActiveTeamSeats used to return every active, unsuspended membership, on
// the stated reasoning that "agent-pays members stay 'pending' until their own
// checkout succeeds, so they are excluded by the status filter". That holds at
// JOIN time and nowhere else. An agent who joined on an agent-pays code, was
// approved, and LATER cancelled is 'active' with an unsuspended seat — so the
// seat kept handing out access nobody was paying for.
//
// 15 Sept: exactly that. An agent cancelled at 05:58 and dialed 147 calls that
// day against the platform's own carrier balance. Suspending the seat closed
// that instance; excluding agent-funded seats from the access grant closes the
// whole class, and means the team never has to be involved in an agent's
// billing at all.

export type SeatFunder = 'owner' | 'agent'

export interface SeatFundingInput {
  billing_override?: string | null
  joined_via_code?: string | null
}

/**
 * Who funds this seat?
 *
 * `codePayer` maps a team code to its `payer`. A code that is missing from the
 * map is treated as OWNER-funded, which is the safe direction for the access
 * path: the common case is owner-funded, and briefly granting a seat we cannot
 * classify is far less damaging than cutting off a paying team's agent
 * mid-shift. Billing has its own, stricter guard — createSeatSubscription
 * refuses when it cannot read the membership at all.
 */
export function seatFunder(
  member: SeatFundingInput,
  codePayer: Map<string, string | null>
): SeatFunder {
  if (member.billing_override === 'owner') return 'owner'
  if (member.billing_override === 'agent') return 'agent'
  if (member.billing_override === 'free') return 'agent'

  if (!member.joined_via_code) return 'owner'
  return codePayer.get(member.joined_via_code) === 'agent' ? 'agent' : 'owner'
}

/** Convenience: is the OWNER the one being billed for this seat? */
export function isOwnerFunded(
  member: SeatFundingInput,
  codePayer: Map<string, string | null>
): boolean {
  return seatFunder(member, codePayer) === 'owner'
}
