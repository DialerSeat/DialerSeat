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
 * Fetch the account balance from Telnyx.
 *
 * Returns nulls rather than zeros when the lookup fails. A balance gauge
 * reading a confident $0.00 because a request timed out would be read as "we
 * are out of money" and acted on, which is worse than showing nothing.
 */
export async function getTelnyxBalance(): Promise<TelnyxBalance> {
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
    return {
      availableCredit: money(d.available_credit),
      balance: money(d.balance),
      pending: money(d.pending),
      creditLimit: money(d.credit_limit),
      currency: typeof d.currency === 'string' ? d.currency : null,
      raw: d,
      authoritative: true,
      error: null,
    }
  } catch (e) {
    console.warn('[telnyxBalance] lookup threw:', e)
    return { ...UNAVAILABLE, error: e instanceof Error ? e.message : 'Lookup failed' }
  }
}
