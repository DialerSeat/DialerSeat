/**
 * Is the agent still on this call, as far as the one-call guard in
 * /api/calls/outbound is concerned?
 *
 * The guard exists for one case: a stale tab placing a second dial while the
 * agent is genuinely mid-call. It must not count a call the dialer has
 * already been told is over, or it refuses the dialer's very next move.
 *
 * That is exactly what a machine verdict is. /api/calls/check reports it as
 * 'completed' the moment it lands, so the dialer moves on at once, while the
 * lead's leg is still parked for its compliance hold and has no hangup yet.
 * The next dial (usually the 2x redial of that same voicemail) arrives about
 * 25 seconds after the first was placed, past the guard's age grace, and was
 * refused. The dialer treated each refusal as a bad lead: on 25 Sept it
 * skipped three leads in three seconds and then sat idle, in front of a
 * convention floor.
 *
 * So: a robot verdict, a call the agent hung up or skipped (stamped before
 * the hangup is sent), and a predictive leg left to its recorded message are
 * all over for the agent, whatever the carrier still has up.
 */

// MUST match machineSkipped in app/api/calls/check/route.ts: whatever that
// reports as 'completed' to the dialer is not a call the agent is on.
const ROBOT_VERDICTS = new Set(['machine', 'fax_detected'])

export interface OpenCallRow {
  amd_result: string | null
  ended_by_agent_at: string | null
  was_abandoned: boolean | null
}

export function stillOnTheCall(row: OpenCallRow): boolean {
  if (row.amd_result && ROBOT_VERDICTS.has(row.amd_result)) return false
  if (row.ended_by_agent_at) return false
  if (row.was_abandoned === true) return false
  return true
}
