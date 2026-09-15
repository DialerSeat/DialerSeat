import { supabaseAdmin } from '@/lib/supabase'

// ────────────────────────────────────────────────────────────────────────
// WHO PAYS FOR A SEAT — THE ONE PLACE IT IS WRITTEN DOWN
//
// Three columns carry this and they had drifted into contradicting each other.
// The vocabulary, in precedence order, highest first:
//
//   team_members.billing_override   The decision, once one has been made.
//     'owner'   the team owner is paying for this seat
//     'agent'   the agent is paying for their own seat
//     'free'    this seat costs the OWNER nothing — either the agent funds
//               themselves, or another seat of the same owner already covers
//               them. NOT "free of charge to everybody".
//     null      no decision recorded; fall through to the code below.
//
//     The check constraint also permits 'agency_pays' and 'agent_pays_self'.
//     Nothing in this codebase reads or writes either, and no row holds one.
//     They are dead vocabulary — do not start using them without deciding how
//     they differ from 'owner' and 'free', which is exactly the ambiguity this
//     block exists to end.
//
//   team_members.seat_suspend_reason   Why a seat stopped. Constrained to
//     'paused'    a person paused it deliberately
//     'canceled'  the agent's own subscription ended
//     'unpaid'    a seat charge failed
//     Anything else is rejected by team_members_seat_suspend_reason_check,
//     so a new reason needs a migration, not just a string literal.
//
//   team_codes.payer                What the JOIN said, for members with a
//                                   joined_via_code and no override.
//     'agent'   whoever redeems this code pays for their own seat
//     'owner'   the owner is offering to pay
//
//   team_members.billing_takeover_at / _reason
//                                   Audit of the owner CHOOSING to pick up a
//                                   seat they were not originally paying for.
//                                   Never set by anything automatic.
//
// ── WHY THIS FILE NO LONGER MOVES MONEY ─────────────────────────────
// It used to do this: when an agent on a self-funded seat cancelled their own
// subscription, the OWNER was automatically charged $35/week to keep that seat
// alive, on the reasoning that continuity beats an empty chair mid-shift.
//
// The premise was inverted. The condition it selected on was
// `team_codes.payer === 'agent'` — which is the flag that says THE OWNER IS
// NOT PAYING FOR THIS SEAT. It read the setting meaning "not your bill" and
// used it as the trigger to send the owner a bill. An owner who deliberately
// issued an agent-pays recruiting code, precisely so that recruits fund
// themselves, was signed up for every one of them the moment they lapsed.
//
// 15 Sept: an agent on recruiting code S66XJ9XG (payer 'agent') cancelled her
// own plan at 05:58. The owner was charged for her seat four seconds later
// without being asked. That charge failed, nothing suspended the seat, and she
// dialed 169 calls that day on the platform's own carrier balance. She was
// also the only member in the entire table holding the contradiction this
// produced: billing_override 'owner' on a payer 'agent' seat.
//
// The rule is now the plain one: WHEN THE SUBSCRIPTION ENDS, THE SEAT ENDS.
// An agent-funded seat whose funding stops is suspended, not transferred. The
// owner is told and can pick it up deliberately — that is what
// billing_takeover_at records, and it is now only ever written by a person
// choosing it.
//
// Owner-funded seats are untouched: nothing about an agent's personal
// subscription changes a seat the owner was already paying for. Suspended
// seats are skipped, because the owner has already said no to those.
// ────────────────────────────────────────────────────────────────────────

/**
 * What happened to this agent's self-funded seats when their own plan ended.
 *
 * `suspended` replaces the old `takenOver`. Nothing is taken over automatically
 * any more — see the header for why that was inverted — so the outcome of this
 * function is now always "the seat stopped", never "somebody else was billed".
 */
export interface TakeoverResult {
  membershipsChecked: number
  /** Agent-funded seats suspended because the funding stopped. */
  suspended: Array<{ teamId: string; teamName: string; ownerId: string; memberId: string }>
}

/**
 * An agent's own subscription ended. Suspend the seats THEY were funding.
 *
 * Deliberately does not charge anybody. An owner who wants to keep this agent
 * dialing picks the seat up themselves, which stamps billing_takeover_at.
 */
export async function takeOverAgentPaidSeats(agentClerkId: string): Promise<TakeoverResult> {
  const result: TakeoverResult = { membershipsChecked: 0, suspended: [] }

  const { data: rows } = await supabaseAdmin
    .from('team_members')
    .select('id, team_id, user_id, status, billing_override, joined_via_code, seat_suspended_at')
    .eq('user_id', agentClerkId)
    .eq('status', 'active')
    .is('seat_suspended_at', null)

  const memberRows = rows || []
  result.membershipsChecked = memberRows.length
  if (memberRows.length === 0) return result

  // joined_via_code holds the code TEXT, not a foreign key, so who-pays has to
  // be looked up rather than joined.
  const codes = Array.from(
    new Set(memberRows.map(r => r.joined_via_code).filter((c): c is string => !!c))
  )
  const codePayer = new Map<string, string>()
  if (codes.length > 0) {
    const { data: codeRows } = await supabaseAdmin
      .from('team_codes')
      .select('code, payer')
      .in('code', codes)
    for (const c of codeRows || []) codePayer.set(c.code, c.payer)
  }

  // Seats this agent was funding. Precedence is the one written in the header:
  // an explicit override wins, otherwise the code they joined with decides.
  //
  // 'free' is NOT included. It means the seat costs the OWNER nothing, which
  // covers both "the agent funds themselves" and "another seat of the same
  // owner already covers them" — and suspending the second kind would cut off
  // somebody whose seat was never in question. A self-funder on 'free' who
  // genuinely lapses is caught by requireActive(), which checks for a live
  // subscription rather than inferring one from this column.
  const agentFunded = memberRows.filter(r => {
    if (r.billing_override === 'owner') return false
    if (r.billing_override === 'free') return false
    if (r.billing_override === 'agent') return true
    return r.joined_via_code ? codePayer.get(r.joined_via_code) === 'agent' : false
  })

  if (agentFunded.length === 0) return result

  const teamIds = Array.from(new Set(agentFunded.map(r => r.team_id)))
  const { data: teams } = await supabaseAdmin
    .from('teams')
    .select('id, name, owner_id')
    .in('id', teamIds)
  interface TeamRow { id: string; name: string; owner_id: string }
  const teamById = new Map<string, TeamRow>(
    ((teams || []) as TeamRow[]).map(t => [t.id, t])
  )

  const now = new Date().toISOString()
  const memberIds = agentFunded.map(m => m.id)

  // The seat stops. No charge is raised against anyone: the owner never agreed
  // to fund this seat, and an agent-pays code is the owner saying so out loud.
  const { error: suspendErr } = await supabaseAdmin
    .from('team_members')
    .update({ seat_suspended_at: now, seat_suspend_reason: 'canceled' })
    .in('id', memberIds)
    .is('seat_suspended_at', null)

  if (suspendErr) {
    console.error('[seatTakeover] suspend failed', suspendErr)
    return result
  }

  // Campaign access goes with the seat, exactly as it does in
  // cron/seat-billing-enforcement. A suspended seat holding live access rows
  // is a seat that is not really suspended.
  const { error: accessErr } = await supabaseAdmin
    .from('team_campaign_access')
    .update({ is_active: false, revoked_at: now })
    .in('team_member_id', memberIds)
    .eq('is_active', true)

  if (accessErr) {
    console.error('[seatTakeover] access revoke failed', accessErr)
  }

  for (const m of agentFunded) {
    const team = teamById.get(m.team_id)
    if (!team) continue
    result.suspended.push({
      teamId: team.id,
      teamName: team.name,
      ownerId: team.owner_id,
      memberId: m.id,
    })
  }

  if (result.suspended.length > 0) {
    console.log(
      `[seatTakeover] ${agentClerkId} cancelled their own plan; suspended ` +
      `${result.suspended.length} self-funded seat(s). No owner was charged — ` +
      `these seats were agent-funded and an owner picks one up deliberately or not at all.`
    )
  }

  return result
}
