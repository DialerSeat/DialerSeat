import { getPlatformConfig } from '@/lib/platformConfig'
import {
  verdictFor,
  SOCKET_OK,
  MIN_USEFUL_LIMIT,
  type SocketVerdict,
} from '@/lib/agentSocketHealth'

export { agentSocketMessage, type SocketVerdict } from '@/lib/agentSocketHealth'

/**
 * WHEN AN AGENT'S BROWSER STOPS ANSWERING ITS OWN LEG, STOP DIALING LEADS.
 *
 * The agent leg is a SIP URI to the browser's registration. When that socket
 * dies, Telnyx accepts the dial (200 OK, call_control_id returned) and only
 * gives up ~1.2 seconds later, when the browser never answers. The lead's leg
 * dies with it ~0.4s after that. app/api/calls/events writes AGENT_LEG_FAILED
 * on the lead row and releases the lead without spending an attempt.
 *
 * That handling is correct and it is not the problem. The problem is that
 * NOTHING STOPS THE NEXT DIAL, so a dead socket keeps dialing.
 *
 * ── WHAT IT ACTUALLY LOOKS LIKE ──────────────────────────────────────────
 * 14 September, per agent-hour, share of dials ending AGENT_LEG_FAILED:
 *
 *     22:00  agent A   112 dials    3 failed    2.7%   <- healthy
 *     17:00  agent C   120 dials   25 failed   20.8%
 *     12:00  agent B    58 dials   41 failed   70.7%   <- dead socket
 *     20:00  agent D    13 dials   10 failed   76.9%   <- dead socket
 *
 * It is bimodal, not a background rate. A healthy session runs ~3%; a broken
 * one runs 70%+ and stays broken until the agent reloads. Agent B made 41
 * failed dials in one hour, each one ringing a lead for ~1.4 seconds.
 *
 * ── WHY IT IS WORTH A GUARD ──────────────────────────────────────────────
 * Three separate costs, and the third is the one that bites:
 *
 *   1. The agent sits there working and nothing happens.
 *   2. Every dial is a wasted origination on both legs.
 *   3. Telnyx surcharges accounts where more than 20% of outbound calls are
 *      "dropped by the originating side before being answered" — $0.005 on
 *      EVERY abandoned call once over, not just the excess. On 14 Sept
 *      AGENT_LEG_FAILED alone was 18.4% of all dials. Removing it takes
 *      abandonment from 33.8% to 15.4%, under the threshold.
 *
 * ── WHY IT IS SAFE TO LET THIS ONE REFUSE ────────────────────────────────
 * docs/CARRIER-ENGINEERING §10 says a guard that can refuse is one bad
 * measurement from an outage, and every cost control on this path delays or
 * downgrades rather than blocking. This one blocks, so it needs the argument:
 *
 *   - It refuses dials that CANNOT SUCCEED. A dead socket does not place
 *     calls; the guard removes the ringing, not the conversation.
 *   - THE LIMIT SITS IN AN EMPTY GAP IN THE REAL DISTRIBUTION. Every run of
 *     consecutive AGENT_LEG_FAILED over thirty days:
 *
 *         run length   1    2    3    4   ...   12    28
 *         times seen  15    3    3    1    0     1     1
 *
 *     Nothing ever ran 5 through 11. Runs are either <=4 (noise, 22 of them)
 *     or >=12 (a dead socket, 2 of them). At a limit of 5 this would have
 *     fired exactly twice in a month, both times correctly, and never once on
 *     noise. That is a measurement, not the 1-in-700-million the per-dial
 *     rate implies — failures cluster, so the arithmetic was never the
 *     argument.
 *   - It cannot latch. One successful dial clears it, and the window is
 *     minutes — an agent who reloads is dialing again immediately.
 *   - Every failure path here RETURNS FALSE and lets the dial through: no
 *     config, no rows, a query error, an unparseable timestamp.
 *   - `agent_leg_failure_limit = 0` disables it with no deploy.
 *
 * It also does not apply to fan-out. A controller_fanout line has no single
 * agent whose socket could be the cause.
 */

/**
 * How far back to look. A socket that failed an hour ago and has been quiet
 * since is not evidence about this dial — the agent almost certainly reloaded.
 * Ten minutes comfortably covers the observed bursts (41 failures inside one
 * hour, clustered) without carrying a stale verdict into a new session.
 */
const WINDOW_MINUTES = 10

/**
 * Rows to inspect. Only the consecutive run from the newest backwards is
 * counted, so this only has to exceed the largest limit worth configuring.
 */
const LOOKBACK_ROWS = 25

export async function checkAgentSocket(userId: string): Promise<SocketVerdict> {
  if (!userId) return SOCKET_OK

  try {
    const cfg = await getPlatformConfig()
    const limit = cfg.agent_leg_failure_limit ?? 0
    // 0 is off, and a limit of 1 or 2 would fire on ordinary noise — a healthy
    // session at 2.7% throws two in a row about once every 1,400 dials.
    if (!Number.isFinite(limit) || limit < MIN_USEFUL_LIMIT) return SOCKET_OK

    // Imported here rather than at the top of the file. `lib/supabase` builds
    // its client at module scope and throws without SUPABASE_URL, so a
    // top-level import would make even this module's name untouchable from a
    // test. The logic worth testing already lives in lib/agentSocketHealth.ts;
    // this keeps the seam clean rather than relying on it.
    const { getServiceClient } = await import('@/lib/supabase')
    const supabase = getServiceClient('agentSocketBreaker')

    const since = new Date(Date.now() - WINDOW_MINUTES * 60_000).toISOString()

    // Only dials that reached Telnyx. A row with no call_control_id never
    // placed a call, so it is evidence about the queue, not about the socket.
    const { data, error } = await supabase
      .from('calls')
      .select('disposition')
      .eq('user_id', userId)
      .eq('dial_source', 'user_dial')
      .not('call_control_id', 'is', null)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(LOOKBACK_ROWS)

    if (error || !data || data.length === 0) return SOCKET_OK

    return verdictFor(data, limit)
  } catch (err) {
    // Fails open, loudly. A broken guard must never be able to stop the phones.
    console.warn('[agentSocketBreaker] check failed, allowing dial', err)
    return SOCKET_OK
  }
}

