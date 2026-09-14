// =============================================================================
// WHAT IS ACTUALLY LEFT IN THE TELNYX ACCOUNT
// =============================================================================
// Asked of Telnyx directly, for the same reason concurrency is: our tables
// cannot answer it. We know what we think we spent; only the carrier knows what
// it actually charged, what is still pending, and how much credit is behind it.
//
// This exists because a floor can drain a prepaid balance faster than anybody
// notices. Dials cost money whether or not they connect, so the failure mode is
// silent: everything looks busy and productive right up until calls stop being
// placed because the account is empty.
//
// MONEY IS A STRING HERE, DELIBERATELY. Telnyx returns these as decimal strings
// and its docs say in as many words to treat them that way rather than as
// binary floating point. They are parsed to numbers for display and arithmetic,
// and the raw string is carried alongside so the exact figure is never lost to
// a rounding step it did not need.
// =============================================================================

const TELNYX_API = 'https://api.telnyx.com/v2'

/**
 * How long a flat balance goes unrecorded before a heartbeat row is written.
 *
 * Live Ops and the ops map both poll every five seconds. Snapshotting each poll
 * would be seventeen thousand rows a day to record a number that moves a few
 * times an hour, so a row is written when the value CHANGES — plus this, so a
 * genuinely flat balance is distinguishable from nobody having looked.
 */
const HEARTBEAT_MS = 60 * 60_000

export interface TelnyxBalance {
  /**
   * What Telnyx reports as spendable. Passed through, not derived: their own
   * example gives balance 300, credit 100, pending 10 and available 400, so
   * the obvious formula is not the one they use. Recomputing it here would
   * mean shipping a number the carrier disagrees with.
   */
  availableCredit: number | null
  /** Cash balance, before credit. */
  balance: number | null
  /** Charges Telnyx has accrued but not yet settled. */
  pending: number | null
  /** Credit extended on top of the cash balance. */
  creditLimit: number | null
  /** ISO 4217, as reported. Not assumed to be USD. */
  currency: string | null
  /** Exactly what the carrier sent, before any parsing. */
  raw: Record<string, string> | null
  /** True when these came from Telnyx rather than being unavailable. */
  authoritative: boolean
  /** Why the lookup failed, for the admin surface. Never shown to customers. */
  error: string | null
}

const UNAVAILABLE: TelnyxBalance = {
  availableCredit: null, balance: null, pending: null, creditLimit: null,
  currency: null, raw: null, authoritative: false, error: null,
}

/** Decimal string to number, or null. Never NaN, which renders as "NaN". */
function money(v: unknown): number | null {
  if (typeof v !== 'string' && typeof v !== 'number') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/**
 * Record this reading, if it says anything the last one did not.
 *
 * Deliberately best-effort and never awaited by the caller's critical path: a
 * balance panel must not fail because a bookkeeping insert did. Errors are
 * swallowed for the same reason.
 *
 * The ledger this builds is the only record of what Telnyx ACTUALLY charged.
 * Every other cost figure on the platform is rate times usage, which answers
 * what something should have cost and cannot answer what was billed — and the
 * difference is every fee that never touches our tables: per-number purchase
 * charges, E911, taxes, regulatory surcharges.
 */
async function snapshot(b: TelnyxBalance, source: string): Promise<void> {
  if (!b.authoritative || b.availableCredit === null) return
  try {
    // Imported here rather than at module scope: this file is imported by the
    // dial path, and a Supabase client built at module load would be
    // constructed on requests that never touch the database.
    const { getServiceClient } = await import('@/lib/supabase')
    const supabase = getServiceClient('telnyxBalance/snapshot')

    const { data: last } = await supabase
      .from('telnyx_balance_snapshots')
      .select('available_credit, at')
      .order('at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const changed = !last || Number(last.available_credit) !== b.availableCredit
    const stale = !last || Date.now() - new Date(last.at).getTime() > HEARTBEAT_MS
    if (!changed && !stale) return

    await supabase.from('telnyx_balance_snapshots').insert({
      available_credit: b.availableCredit,
      balance: b.balance,
      pending: b.pending,
      credit_limit: b.creditLimit,
      currency: b.currency,
      source,
      heartbeat: !changed,
    })
  } catch {
    // A missing snapshot is a gap in a ledger. A thrown one is a screen that
    // will not render, and the screen matters more.
  }
}

/**
 * Fetch the account balance from Telnyx.
 *
 * Returns nulls rather than zeros when the lookup fails. A balance gauge
 * reading a confident $0.00 because a request timed out would be read as "we
 * are out of money" and acted on, which is worse than showing nothing.
 *
 * @param source which surface asked, recorded on the snapshot for diagnostics
 */
// ─────────────────────────────────────────────────────────────────────────
// SAMPLING WHILE THE FLOOR IS DIALING
// ─────────────────────────────────────────────────────────────────────────
// snapshot() only runs when getTelnyxBalance() is called, and that happens
// when somebody opens the balance panel. So the ledger is dense while a human
// is watching and empty the rest of the time: on 14 Sept the average gap
// between readings was 587 seconds.
//
// That resolution cannot answer the question it exists for. Two debits of
// $2.03 and $2.12 landed that afternoon inside a window whose entire billable
// activity was seven cents, and the best that could be said was "somewhere in
// the last ten minutes".
//
// It matters more than it looks, because Telnyx does not expose transaction
// detail until the following month. Until October these snapshots ARE the
// record. A gap in them is not an inconvenience, it is the absence of the
// only evidence there will be.
//
// So: sample on hangup, which is the one event that fires whenever money is
// actually moving. Throttled, never awaited, and it cannot fail a call —
// balance bookkeeping must never be in the path of a phone call.
// ─────────────────────────────────────────────────────────────────────────

/** Shortest gap between call-driven readings. */
const CALL_SAMPLE_MIN_MS = 45_000

/** Per-instance, so several serverless instances may each sample once a
 *  window. The DB write is already guarded by snapshot()'s own change check,
 *  so the cost of that is a few extra Telnyx reads, not duplicate rows. */
let lastCallSampleAt = 0

/**
 * Record the balance if it has been a while, without blocking anything.
 *
 * Deliberately returns void rather than a promise: every caller is on a code
 * path where a phone call is in flight, and the only correct thing to do with
 * this is forget about it.
 */
export function sampleBalanceAfterCall(source = 'call'): void {
  const now = Date.now()
  if (now - lastCallSampleAt < CALL_SAMPLE_MIN_MS) return
  lastCallSampleAt = now
  void getTelnyxBalance(source).catch(() => {
    // Swallowed on purpose. A missed sample is a gap in a ledger; a thrown one
    // would be an unhandled rejection in a webhook that has a call to finish.
  })
}

export async function getTelnyxBalance(source = 'unknown'): Promise<TelnyxBalance> {
  const apiKey = process.env.TELNYX_API_KEY
  if (!apiKey) return { ...UNAVAILABLE, error: 'TELNYX_API_KEY is not set' }

  try {
    const res = await fetch(`${TELNYX_API}/balance`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: 'no-store',
    })
    if (!res.ok) {
      console.warn('[telnyxBalance] lookup failed:', res.status)
      return { ...UNAVAILABLE, error: `Telnyx returned ${res.status}` }
    }
    const json = await res.json()
    const d = json?.data
    if (!d || typeof d !== 'object') {
      return { ...UNAVAILABLE, error: 'Telnyx returned no balance record' }
    }
    const result: TelnyxBalance = {
      availableCredit: money(d.available_credit),
      balance: money(d.balance),
      pending: money(d.pending),
      creditLimit: money(d.credit_limit),
      currency: typeof d.currency === 'string' ? d.currency : null,
      raw: d,
      authoritative: true,
      error: null,
    }
    // Awaited rather than left dangling: on a serverless runtime a floating
    // promise is frozen with the response and the insert may never land.
    await snapshot(result, source)
    return result
  } catch (e) {
    console.warn('[telnyxBalance] lookup threw:', e)
    return { ...UNAVAILABLE, error: e instanceof Error ? e.message : 'Lookup failed' }
  }
}
