// =============================================================================
// EVERY LEG LIVE ON THE CONNECTION, AND A WAY TO END ONE BY HAND
// =============================================================================
// A manual override for the case the automatic teardown misses. There are
// already three things that end a call — the hangup webhook, the AMD verdict
// path, and the stale-call reaper — and all three have failed at some point in
// this product's history, which is why there was once a report of 100 legs in
// flight with 400 to 500 second durations and a Telnyx balance draining behind
// them. Every one of those is billed by the minute for as long as it is up.
//
// TELNYX IS THE SOURCE OF TRUTH, NOT OUR TABLE. This deliberately does not
// list `calls` rows with the in-flight sentinel. The dangerous leg is exactly
// the one our table has lost track of: a row marked ended whose leg is still
// up bills just as much as one we know about, and would be invisible to a view
// built from our own records. So the list starts from the carrier and our rows
// are joined on afterwards for context — whoever owns it, which number, how
// long ago it started.
//
// A leg the carrier reports with no matching row is therefore not an error to
// hide. It is the most important line in the list.
// =============================================================================

import { parseClientState, hangupCallControlId } from '@/lib/placeOutboundCall'

const TELNYX_API = 'https://api.telnyx.com/v2'

export interface LiveLeg {
  callControlId: string
  /** Clerk id from the leg's client_state, when it carries one. */
  userId: string | null
  /** From our calls row, when one matches. Null means we lost track of it. */
  startedAt: string | null
  ageSeconds: number | null
  phone: string | null
  direction: string | null
  /** Which half of the dial this is, when we can tell. */
  leg: 'lead' | 'agent' | null
  /** True when no calls row matches: live on the carrier, unknown to us. */
  orphaned: boolean
}

const ACTIVE_CALLS_PAGE_SIZE = 250

export interface LiveLegsResult {
  legs: LiveLeg[]
  /** True when the list came from Telnyx rather than being unavailable. */
  authoritative: boolean
  /**
   * True when this is the WHOLE list, not just the first page.
   *
   * Separate from `authoritative` because they fail differently and callers
   * need to tell them apart. Unauthoritative means "we learned nothing".
   * Incomplete means "everything here is real, but absence proves nothing" —
   * only one page is requested, so past that size a live leg can be missing
   * from the list entirely.
   *
   * A caller that acts on a leg being PRESENT (ending a runaway) is safe
   * either way. A caller that acts on a leg being ABSENT (concluding a call
   * is over) must check this, or at scale it will decide that live calls have
   * ended because they were on page two.
   */
  complete: boolean
  error: string | null
}

/**
 * Every leg Telnyx currently reports on our connection.
 *
 * `rowsByCallControlId` is supplied by the caller rather than queried here so
 * this stays free of a Supabase import and the caller can scope the lookup
 * however it likes.
 */
export async function listLiveLegs(
  rowsByCallControlId: Map<string, {
    created_at: string; phone_number: string | null
    user_id: string | null; leg?: 'lead' | 'agent'
  }>
): Promise<LiveLegsResult> {
  const apiKey = process.env.TELNYX_API_KEY
  const connectionId = process.env.TELNYX_CONNECTION_ID
  if (!apiKey || !connectionId) {
    return { legs: [], authoritative: false, complete: false, error: 'Telnyx credentials are not configured' }
  }

  try {
    const res = await fetch(
      `${TELNYX_API}/connections/${encodeURIComponent(connectionId)}/active_calls`
      + `?page[size]=${ACTIVE_CALLS_PAGE_SIZE}`,
      { headers: { Authorization: `Bearer ${apiKey}` }, cache: 'no-store' }
    )
    if (!res.ok) {
      return { legs: [], authoritative: false, complete: false, error: `Telnyx returned ${res.status}` }
    }
    const json = await res.json().catch(() => null)
    const rows = Array.isArray(json?.data) ? json.data : []
    const now = Date.now()

    const legs: LiveLeg[] = rows
      .filter((c: { call_control_id?: string }) => !!c.call_control_id)
      .map((c: { call_control_id: string; client_state?: string | null; direction?: string | null }) => {
        const owner = parseClientState(c.client_state)
        const row = rowsByCallControlId.get(c.call_control_id)
        const startedAt = row?.created_at ?? null
        return {
          callControlId: c.call_control_id,
          userId: owner?.u ?? row?.user_id ?? null,
          startedAt,
          ageSeconds: startedAt
            ? Math.max(0, Math.round((now - new Date(startedAt).getTime()) / 1000))
            : null,
          phone: row?.phone_number ?? null,
          direction: c.direction ?? null,
          leg: row?.leg ?? null,
          orphaned: !row,
        }
      })

    // Oldest first. The reason anybody opens this list is to find the leg that
    // has been up longest, and an unknown age sorts last rather than first:
    // it is unmeasured, not new.
    legs.sort((a, b) => (b.ageSeconds ?? -1) - (a.ageSeconds ?? -1))

    // A full page means there is very likely another one we did not ask for.
    // Reported rather than fetched: every caller today only needs to know
    // whether absence from this list can be trusted, and none of them wants
    // to page through thousands of legs on a two-minute cron.
    const complete = rows.length < ACTIVE_CALLS_PAGE_SIZE
    if (!complete) {
      console.warn(
        `[liveLegs] Telnyx returned a full page of ${rows.length} active calls — `
        + 'the list is truncated and absence from it means nothing'
      )
    }
    return { legs, authoritative: true, complete, error: null }
  } catch (err) {
    return {
      legs: [], authoritative: false, complete: false,
      error: err instanceof Error ? err.message : 'Lookup failed',
    }
  }
}

export interface KillResult {
  callControlId: string
  ended: boolean
  /**
   * Telnyx still lists this leg as active after the hangup was accepted.
   *
   * Not the same as a failed request: the request succeeded and the leg is
   * still there. It means either the leg cannot be ended through Call Control,
   * or Telnyx's active-calls listing is holding a leg that no longer exists.
   * Either way the operator must not be told it ended.
   */
  stillListed?: boolean
}

/**
 * End specific legs.
 *
 * Sequential rather than parallel. This is a human pressing a button on at most
 * a couple of hundred legs, hangupCallControlId already retries three times per
 * leg, and firing hundreds of retried POSTs at Telnyx at once is how a rescue
 * turns into rate limiting in the middle of the thing it was rescuing.
 */
export async function killLegs(callControlIds: string[]): Promise<KillResult[]> {
  const out: KillResult[] = []
  for (const id of callControlIds) {
    // hangupCallControlId treats 404 and 422 as success: the call is already
    // gone, which is the end state being asked for.
    out.push({ callControlId: id, ended: await hangupCallControlId(id) })
  }

  // ── THEN ASK TELNYX WHETHER IT ACTUALLY WENT ──────────────────────────
  // "Ended" above means the hangup request was accepted OR returned 404/422,
  // and that second case is an inference: a 404 is read as "already gone".
  // Usually true. Not always -- on 17 Sept a leg reported ended, stayed in
  // Telnyx's own active-calls listing, and was still there seven hours later
  // having never emitted a hangup webhook or a cost record. The operator was
  // told it ended, saw it again, and reasonably concluded it had come back.
  // It had never left.
  //
  // So the report is now evidence rather than inference: re-read the listing
  // and say which legs are genuinely gone. A leg still listed is reported
  // `stillListed`, which is the difference between "this did not work" and
  // "this keeps happening" -- two problems with completely different causes.
  //
  // Best effort. If the re-read fails, every leg keeps whatever the hangup
  // claimed rather than being marked falsely as surviving.
  try {
    const after = await listLiveLegs(new Map())
    if (after.authoritative) {
      const stillThere = new Set(after.legs.map(l => l.callControlId))
      for (const r of out) {
        if (stillThere.has(r.callControlId)) {
          r.stillListed = true
          r.ended = false
        }
      }
    }
  } catch { /* the hangup result stands */ }

  return out
}
