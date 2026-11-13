// =============================================================================
// WHICH LIVE LEGS SHOULD NOT STILL BE LIVE
// =============================================================================
// There are already three things that end a call — the hangup webhook, the AMD
// verdict path, and the stale-call reaper — and all three have failed here at
// some point. The reaper covers one failure mode: an agent session whose
// heartbeat died while it still held a call. It starts from OUR table.
//
// The expensive failure is the opposite one. A leg the carrier has up that our
// table has already lost track of is invisible to every query over `calls`,
// because the row either says the call ended or was never written at all. It
// bills by the minute regardless, and the only place it exists is Telnyx's own
// active-call listing. That is the gap this closes.
//
// ── WHY AGE IS MEASURED WITH OUR CLOCK ──────────────────────────────────────
// The obvious design ages a leg from a carrier-supplied start time. This does
// not, because that field was never verified: the Telnyx reference for listing
// active calls 404s, and the credentials in this checkout are redacted, so
// there was no way to confirm the response shape. Building the safety net on an
// assumed field would mean it silently never fires.
//
// So age comes from two sources we control: the `calls` row's created_at when
// there is one, and otherwise the first time this process saw the leg
// (live_leg_sightings). The second is a LOWER BOUND — a leg first seen five
// minutes ago may be an hour old — which is the correct direction for a
// function whose mistakes hang up phone calls. It waits too long rather than
// too little.
//
// ── THE RULES, AND WHY EACH ONE IS SAFE ─────────────────────────────────────
// Every rule has to survive the same question: could this end a real
// conversation between two people?
//
//   row_finished  Our row says the call is over — a duration was written, or a
//                 disposition was set — and the leg is still up. We already
//                 believe nobody is on it. This is the safest rule in the file
//                 and the one that catches the bridged-call-whose-agent-leg-
//                 dropped case, where the prospect is left on an open billing
//                 line. A grace period absorbs webhook ordering.
//
//   untracked     No `calls` row at all, in a twelve-hour correlation window.
//                 Nothing on our side is holding it, nothing can disposition
//                 it, and no agent screen is pointed at it. Requires TWO
//                 separate sightings, so a leg racing its own insert is never
//                 caught by it.
//
//   runaway       Past an absolute ceiling, and ONLY for a leg that is not part
//                 of a live call. A backstop for the case both rules above
//                 miss, never a limit on how long anyone may talk.
//
// Everything else is left alone. The default verdict is always 'leave'.

//   seat          A predictive seat (docs/PREDICTIVE.md): the agent's one line
//                 for a whole session, in a conference of its own. It has no
//                 calls row BY DESIGN, so it used to read as untracked and was
//                 ended at 120s — every four minutes on 28 Oct 2026 the engine
//                 placed a seat, this ended it, and the engine placed another,
//                 and the browser halves of those killed seats were what stayed
//                 up for hours. A seat is now left alone while its agent's
//                 heartbeat is fresh, and ended the moment it is not: a seat
//                 with nobody behind it is the most expensive leg there is.
export type WatchdogRule = 'row_finished' | 'untracked' | 'runaway' | 'seat_abandoned'

/** A seat whose agent has not beaten in this long has nobody on it. Beats are
 *  5s apart, but a browser throttles timers in a background tab to about one
 *  a minute, so an agent who switched tabs mid-session can go ~60s between
 *  beats while still on their seat. Three minutes clears that with room, and
 *  is still minutes, not the hours a forgotten seat ran for before. */
export const SEAT_ABANDONED_AFTER_SECONDS = 180

/** Telnyx ends a conference at four hours and the engine rotates the seat at
 *  3.5 (lib/predictive/seat SEAT_ROTATE_AFTER_MS). Past this it is a runaway. */
export const SEAT_MAX_SECONDS = 4 * 60 * 60 + 10 * 60

export interface WatchdogThresholds {
  /** Gates the hangup itself. False still produces verdicts, for reporting. */
  enabled: boolean
  /** Absolute ceiling, in seconds, past which any leg is ended. */
  runawaySeconds: number
  /** How long a leg with no calls row must be observed before ending it. */
  untrackedSeconds: number
  /** Grace after our row says the call ended, before ending its live leg. */
  finishedSeconds: number
}

/** What we know about the `calls` row behind a leg, if there is one. */
export interface LegRow {
  createdAt: string
  /** Written by the hangup webhook. > 0 means the call is over. */
  duration: number | null
  /** Set when an agent dispositioned it. Non-null means the call is over. */
  disposition: string | null
}

/** What we have previously observed about this leg. */
export interface LegSighting {
  firstSeenAt: string
  timesSeen: number
}

export interface WatchdogInput {
  callControlId: string
  /** The matching calls row, or null when the leg is untracked. */
  row: LegRow | null
  /** Prior observations, or null the very first time a leg is seen. */
  sighting: LegSighting | null
  /** Set when this leg is a predictive seat: how long since its agent's last
   *  heartbeat, in seconds (null when the session has none). */
  seat?: { heartbeatAgeSeconds: number | null } | null
  /** True when another leg in the same Telnyx call session is live right now.
   *  A leg with a live partner is half of a call in progress, never a stray. */
  sessionPartnerLive?: boolean
  /** True when a live agent session (fresh heartbeat) is assigned this call.
   *  Reliable for predictive, where the server assigns it. */
  agentOnCall?: boolean
}

export interface WatchdogVerdict {
  callControlId: string
  action: 'end' | 'leave'
  rule: WatchdogRule | null
  /** Best available age in seconds. Null when nothing can date it at all. */
  ageSeconds: number | null
  /** True when age came from a sighting rather than a calls row, so it is a
   *  lower bound rather than the real age. */
  ageIsLowerBound: boolean
  reason: string
}

const SECOND = 1000

function ageFrom(iso: string | null | undefined, now: number): number | null {
  if (!iso) return null
  const t = new Date(iso).getTime()
  if (!Number.isFinite(t)) return null
  return Math.max(0, Math.round((now - t) / SECOND))
}

/**
 * Decide what to do about one live leg.
 *
 * Pure: no network, no database, no clock of its own. `now` is passed in so a
 * whole sweep is judged against a single instant and so this is testable, which
 * matters more here than almost anywhere else in the codebase — the cost of a
 * wrong answer is a call cut off mid-sentence.
 */
export function classifyLeg(
  input: WatchdogInput,
  thresholds: WatchdogThresholds,
  now: number,
): WatchdogVerdict {
  const { callControlId, row, sighting } = input

  const rowAge = ageFrom(row?.createdAt, now)
  const seenAge = ageFrom(sighting?.firstSeenAt, now)

  // The row's created_at is the real start. A sighting is only ever a lower
  // bound, so the larger of the two is the better estimate, and when there is
  // no row at all the sighting is all there is.
  const ageSeconds =
    rowAge !== null && seenAge !== null ? Math.max(rowAge, seenAge)
    : rowAge !== null ? rowAge
    : seenAge
  const ageIsLowerBound = rowAge === null

  const leave = (reason: string): WatchdogVerdict => ({
    callControlId, action: 'leave', rule: null, ageSeconds, ageIsLowerBound, reason,
  })
  const end = (rule: WatchdogRule, reason: string): WatchdogVerdict => ({
    callControlId, action: 'end', rule, ageSeconds, ageIsLowerBound, reason,
  })

  // ── A PREDICTIVE SEAT IS JUDGED BY ITS AGENT, NOT BY ITS ROW ───────────
  // Ahead of every other rule: a seat has no calls row on purpose, so the
  // untracked rule below would end it, and that is the bug this replaced.
  if (input.seat) {
    const hb = input.seat.heartbeatAgeSeconds
    if (hb === null || hb >= SEAT_ABANDONED_AFTER_SECONDS) {
      return end(
        'seat_abandoned',
        hb === null
          ? 'predictive seat with no agent heartbeat at all'
          : `predictive seat, agent last heard from ${hb}s ago`,
      )
    }
    if (ageSeconds !== null && ageSeconds >= SEAT_MAX_SECONDS) {
      return end('runaway', `predictive seat up ${ageSeconds}s, past the ${SEAT_MAX_SECONDS}s seat ceiling`)
    }
    return leave(`predictive seat, agent heard from ${hb}s ago`)
  }

  // Nothing can date this leg: no row, and this is the first time it has been
  // seen. It is recorded now and judged on the next pass. A leg that cannot be
  // aged is never ended — that is the same rule the manual sweep already
  // applies, and for the same reason: unmeasured is not the same as old.
  if (ageSeconds === null) {
    return leave('first sighting, no calls row — recorded, judged next pass')
  }

  // ── 0. NOTHING UNTRACKED DIES ON ITS FIRST SIGHTING ────────────────────
  // Checked ahead of every other rule, including the runaway backstop. When
  // there is no calls row, a single sighting is the least information this
  // function can act on, and its age is a lower bound derived from that one
  // observation. Letting the ceiling fire here would mean a leg whose sighting
  // row is stale or corrupt gets hung up on the strength of a number nothing
  // corroborates. One more pass costs a couple of minutes of billing; being
  // wrong costs a conversation.
  //
  // A leg WITH a row is not subject to this: created_at is a real start time,
  // so the backstop below can act on the first pass.
  if (!row && (sighting?.timesSeen ?? 0) < 2) {
    return leave(
      `untracked but seen only ${sighting?.timesSeen ?? 0} time(s) — needs a second sighting`
    )
  }

  // ── 1. RUNAWAY ─────────────────────────────────────────────────────────
  // NEVER A CAP ON CALL LENGTH. This used to end any leg past the ceiling
  // "whatever the row says", which is a time limit on every conversation.
  // Joshua, 12 Nov 2026: there is never a capped call time. A leg that is part
  // of a live call (its row is open, or another leg of its call is live) is
  // never ended by age. The only ceiling left is Telnyx's own four hours per
  // leg, which no setting can lift.
  const rowOpen = !!row && !((row.duration ?? 0) > 0 || row.disposition !== null)
  const partOfLiveCall = rowOpen || !!input.sessionPartnerLive || !!input.agentOnCall
  if (!partOfLiveCall && ageSeconds >= thresholds.runawaySeconds) {
    return end('runaway', `up ${ageSeconds}s, past the ${thresholds.runawaySeconds}s ceiling`)
  }

  // ── 2. ROW SAYS THE CALL IS OVER ───────────────────────────────────────
  if (row) {
    const finished = (row.duration ?? 0) > 0 || row.disposition !== null
    // ── A DISPOSITION IS NOT A HANGUP WHILE THE AGENT IS ON THE LINE ─────
    // Agents set the disposition before hanging up on about a third of human
    // calls (113 of 355, Oct-Nov 2026). Duration is the carrier saying the
    // lead's line ended; a disposition alone is only the agent's screen. With
    // the agent's legs still live on the same call, or the agent's session
    // still assigned it, somebody is talking: never end it. A disposition with
    // nobody on our side is still the stranded-prospect case below.
    if (finished && !((row.duration ?? 0) > 0) && (input.sessionPartnerLive || input.agentOnCall)) {
      return leave(`dispositioned ${row.disposition}, but the agent is still on the line`)
    }
    if (finished) {
      if (ageSeconds < thresholds.finishedSeconds) {
        return leave(
          `row is closed but only ${ageSeconds}s old — inside the ` +
          `${thresholds.finishedSeconds}s grace for webhook ordering`
        )
      }
      const why = (row.duration ?? 0) > 0
        ? `duration ${row.duration}s written`
        : `dispositioned ${row.disposition}`
      return end('row_finished', `our row says the call ended (${why}) but the leg is still up`)
    }
    return leave(`row is open and ${ageSeconds}s old — a live call`)
  }

  // ── 3. UNTRACKED ───────────────────────────────────────────────────────
  // No row in the correlation window. The two-sighting requirement was already
  // enforced at rule 0, so a leg reaching here has been observed at least
  // twice: it is not one racing its own INSERT.
  // ── A LEG WITH A LIVE PARTNER IS PART OF A CALL ────────────────────────
  // The agent's browser holds its own leg of every call, with its own
  // call_control_id and no calls row. This rule used to end it at 120s, which
  // cut 13 of 13 progressive and manual conversations it touched on 10-11 Nov
  // 2026, 95-149s after the lead answered, and left the lead in dead air.
  // Untracked is for a leg nobody is on; a leg whose call is still up is not
  // that, whatever our table says. Runaway above still applies.
  if (input.sessionPartnerLive) {
    return leave('untracked, but another leg of the same call is live — part of a call in progress')
  }

  const times = sighting?.timesSeen ?? 0
  if (ageSeconds < thresholds.untrackedSeconds) {
    return leave(
      `untracked, observed ${ageSeconds}s — under the ${thresholds.untrackedSeconds}s threshold`
    )
  }
  return end(
    'untracked',
    `no calls row in the correlation window, observed for ${ageSeconds}s across ${times} passes`
  )
}

/**
 * What every live leg knows through its call session.
 *
 * `inherited`: a leg with no calls row of its own, sharing a session with a leg
 * that has one, takes that row. That is the agent's browser-side leg on a
 * progressive or manual call: it is judged exactly as its call is, so it lives
 * while the call is open and is cleaned up by row_finished once it is over.
 *
 * `partnered`: every leg whose session has at least one other live leg.
 */
export function sessionLinks<R>(
  legs: Array<{ callControlId: string; callSessionId: string | null }>,
  rowById: Map<string, R>,
): { inherited: Map<string, R>; partnered: Set<string> } {
  const legsBySession = new Map<string, string[]>()
  for (const l of legs) {
    if (!l.callSessionId) continue
    const ids = legsBySession.get(l.callSessionId) ?? []
    ids.push(l.callControlId)
    legsBySession.set(l.callSessionId, ids)
  }
  const inherited = new Map<string, R>()
  const partnered = new Set<string>()
  for (const ids of legsBySession.values()) {
    if (ids.length < 2) continue
    for (const id of ids) partnered.add(id)
    const owner = ids.find(id => rowById.has(id))
    if (owner === undefined) continue
    const row = rowById.get(owner) as R
    for (const id of ids) if (!rowById.has(id)) inherited.set(id, row)
  }
  return { inherited, partnered }
}

/**
 * Which live legs belong to a predictive seat, and how long since its agent
 * last beat. A seat is two legs: the one we place (its call_control_id is on
 * agent_sessions) and the browser-side twin Telnyx creates, which has its own
 * call_control_id and no calls row. Keyed on the seat's id alone, the twin
 * read as untracked and was ended two to three minutes in, which dropped the
 * agent's seat: on 30 Oct 2026 one session went through 34 seats in 99
 * minutes, and all 38 legs ended that way from 29 Oct were seat twins.
 *
 * Every live leg sharing a call session with a live seat leg gets that seat's
 * heartbeat age. A twin whose seat leg is no longer live is not covered and
 * stays an ordinary untracked leg, which is right: nobody is behind it.
 */
export function seatLegs(
  legs: Array<{ callControlId: string; callSessionId: string | null }>,
  seatHeartbeatById: Map<string, number | null>,
): Map<string, number | null> {
  const out = new Map<string, number | null>()
  const bySession = new Map<string, number | null>()
  for (const l of legs) {
    if (!seatHeartbeatById.has(l.callControlId)) continue
    const age = seatHeartbeatById.get(l.callControlId) ?? null
    out.set(l.callControlId, age)
    if (l.callSessionId) bySession.set(l.callSessionId, age)
  }
  for (const l of legs) {
    if (out.has(l.callControlId) || !l.callSessionId) continue
    if (bySession.has(l.callSessionId)) out.set(l.callControlId, bySession.get(l.callSessionId) ?? null)
  }
  return out
}

/**
 * Summarise a sweep for the cron's response and the ops log.
 *
 * Counts by rule rather than a bare total, because "ended 4 legs" and "ended 4
 * legs, all of them untracked" are different operational facts.
 */
export function summariseSweep(verdicts: WatchdogVerdict[]): {
  live: number
  ended: number
  byRule: Record<WatchdogRule, number>
  untrackedLive: number
} {
  const byRule: Record<WatchdogRule, number> = {
    row_finished: 0, untracked: 0, runaway: 0, seat_abandoned: 0,
  }
  let ended = 0
  for (const v of verdicts) {
    if (v.action === 'end' && v.rule) { byRule[v.rule]++; ended++ }
  }
  return {
    live: verdicts.length,
    ended,
    byRule,
    untrackedLive: verdicts.filter(v => v.ageIsLowerBound).length,
  }
}
