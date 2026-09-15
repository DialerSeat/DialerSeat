/**
 * Pure decision logic for the agent-socket breaker. No database, no config, no
 * network — see vitest.config.ts on why that separation is deliberate, and
 * lib/agentSocketBreaker.ts for the side-effecting half and the full argument.
 *
 * This is the only logic on the dial path that can REFUSE a call rather than
 * delay it, which is why it lives somewhere it can be tested exhaustively.
 */

export type SocketVerdict = {
  /** True only when the dial should be refused. Defaults false on every error. */
  broken: boolean
  /** Consecutive AGENT_LEG_FAILED dials seen, most recent first. */
  consecutive: number
  /** The limit in force, echoed so the caller can explain itself. */
  limit: number
}

export const SOCKET_OK: SocketVerdict = { broken: false, consecutive: 0, limit: 0 }

/**
 * Below this the guard is treated as off. A healthy session fails about 2.7%
 * of dials, which throws two in a row roughly once every 1,400 dials — often
 * enough that a limit of 2 would stop working agents for no reason.
 */
export const MIN_USEFUL_LIMIT = 3

/**
 * Length of the AGENT_LEG_FAILED run at the head of `rows`, newest first.
 *
 * Counting the run rather than totalling the window is the whole point. A
 * socket that failed five times and then took a call is alive; a socket that
 * has failed the last five in a row is not. A window total cannot tell those
 * apart, and the first shape is far more common — it is what a mid-session
 * reload looks like.
 *
 * Anything that is not AGENT_LEG_FAILED ends the run, including a NULL
 * disposition. NULL means in-flight or undispositioned: the call got far
 * enough to be waiting on something, which is evidence the socket IS working.
 * Treating unknown as failure is how a guard that refuses becomes an outage.
 */
export function consecutiveFailures(rows: { disposition: string | null }[]): number {
  let n = 0
  for (const row of rows) {
    if (row.disposition !== 'AGENT_LEG_FAILED') break
    n += 1
  }
  return n
}

/** Applies the limit to a run. Separated so both halves are testable. */
export function verdictFor(
  rows: { disposition: string | null }[],
  limit: number
): SocketVerdict {
  if (!Number.isFinite(limit) || limit < MIN_USEFUL_LIMIT) return SOCKET_OK
  const consecutive = consecutiveFailures(rows)
  return { broken: consecutive >= limit, consecutive, limit }
}

/**
 * Wording shown to the agent. Separate from the verdict so the copy can change
 * without touching the logic.
 *
 * It names the fix rather than the fault — the agent can do nothing about a
 * SIP socket, but they can reload, and reloading is what re-registers them —
 * and it says explicitly that no leads were rung, because an agent who thinks
 * the dialer just burned five leads will go looking for them.
 */
export function agentSocketMessage(v: SocketVerdict): string {
  return (
    `Your phone connection dropped — the last ${v.consecutive} calls could not ` +
    `reach your browser, so they were stopped before any leads were rung. ` +
    `Reload this page to reconnect, then dial again.`
  )
}
