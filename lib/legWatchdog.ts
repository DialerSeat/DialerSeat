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
//   runaway       Past an absolute ceiling, whatever else is true. A pure
//                 backstop for the case both rules above miss. The default is
//                 deliberately far above the longest real conversation this
//                 account has ever recorded (63 minutes, carrier-confirmed).
//
// Everything else is left alone. The default verdict is always 'leave'.

export type WatchdogRule = 'row_finished' | 'untracked' | 'runaway'

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
  // Checked first so it applies even to a leg whose row looks perfectly
  // healthy. If a call has been up this long, something is wrong with it
  // whatever the row says.
  if (ageSeconds >= thresholds.runawaySeconds) {
    return end('runaway', `up ${ageSeconds}s, past the ${thresholds.runawaySeconds}s ceiling`)
  }

  // ── 2. ROW SAYS THE CALL IS OVER ───────────────────────────────────────
  if (row) {
    const finished = (row.duration ?? 0) > 0 || row.disposition !== null
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
    row_finished: 0, untracked: 0, runaway: 0,
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
