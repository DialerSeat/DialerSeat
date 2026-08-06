import { getPlatformConfig } from '@/lib/platformConfig'

// =============================================================================
// CONCURRENCY — OBSERVATION ONLY
// =============================================================================
// This file used to REFUSE dials at a budget. That has been removed, and the
// reason is worth recording so nobody rebuilds it the same way.
//
// The enforcement counted in-flight legs from the `calls` table using
// `duration = 0` as the "still live" sentinel — the same sentinel the abort
// sweep uses. That sentinel is wrong for counting.
//
// `duration = 0` is not a transient state. It is the PERMANENT resting value
// of every call nobody answered: 1,404 of 1,831 calls over thirty days sit at
// zero forever, and correctly so — an unanswered call has no talk time. Only 3
// rows in that period were genuinely mis-written.
//
// So the count did not measure live calls. It measured "calls placed recently,
// mostly ones that already rang out". One agent on power dial at a 10% answer
// rate leaves roughly eighteen phantom legs inside a ten-minute window. Against
// a carrier budget of 10 the guard would have refused every dial about five
// minutes into a session, while the carrier still had capacity — breaking
// dialing to prevent a problem that had not occurred.
//
// A guard that is wrong in the restrictive direction is worse than no guard.
// The carrier enforces its own ceiling regardless; the only thing ours added
// was a second, less accurate ceiling underneath it.
//
// WHAT REPLACED IT: nothing on the dial path. The gauge below asks TELNYX what
// is actually live, which is authoritative, and is used only by the admin Live
// Ops screen — one API call per refresh on a screen a human is looking at, not
// per dial.
// =============================================================================

const TELNYX_API = 'https://api.telnyx.com/v2'

export interface ConcurrencySnapshot {
  /** Legs live on the connection right now, per the carrier. Null if unknown. */
  inFlightLegs: number | null
  /** The carrier ceiling, as configured. Display only — we do not enforce it. */
  budget: number
  /** True when the figure came from Telnyx rather than being unavailable. */
  authoritative: boolean
}

/**
 * What is actually live on the carrier connection.
 *
 * Asks Telnyx directly rather than inferring from our own tables, because our
 * tables cannot answer the question — see the note above. Returns null rather
 * than a guess when the lookup fails: a concurrency gauge showing a confident
 * wrong number is the thing that caused this rewrite.
 */
export async function getConcurrencySnapshot(): Promise<ConcurrencySnapshot> {
  const config = await getPlatformConfig()
  const budget = Math.max(1, config.concurrency_budget)

  const apiKey = process.env.TELNYX_API_KEY
  const connectionId = process.env.TELNYX_CONNECTION_ID
  if (!apiKey || !connectionId) {
    return { inFlightLegs: null, budget, authoritative: false }
  }

  try {
    const res = await fetch(
      `${TELNYX_API}/connections/${encodeURIComponent(connectionId)}/active_calls?page[size]=250`,
      { headers: { Authorization: `Bearer ${apiKey}` }, cache: 'no-store' }
    )
    if (!res.ok) {
      console.warn('[concurrency] Telnyx active_calls lookup failed:', res.status)
      return { inFlightLegs: null, budget, authoritative: false }
    }
    const json = await res.json().catch(() => null)
    const rows = Array.isArray(json?.data) ? json.data : null
    if (!rows) return { inFlightLegs: null, budget, authoritative: false }

    // Every entry is one leg on the connection, which is exactly the unit the
    // carrier's own limit is expressed in.
    return { inFlightLegs: rows.length, budget, authoritative: true }
  } catch (err) {
    console.warn('[concurrency] Telnyx active_calls lookup threw:', err)
    return { inFlightLegs: null, budget, authoritative: false }
  }
}
