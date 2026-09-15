// =============================================================================
// WHAT EACH NUMBER IS COSTING, ASKED OF TELNYX DIRECTLY
// =============================================================================
// Number rental is the one line on the bill that does not care how much you
// dial — and it was in no cost model until 15 Sept. Thirteen numbers at
// $1.00/month is roughly a third of the entire Telnyx bill, and there are two
// per-number FEATURE fees on top that nothing in this codebase sets, so their
// state is unknowable from here:
//
//   emergency_enabled      E911.  $1.50/month/number.  Thirteen numbers is
//                          $19.50/month — MORE than the rental itself, and half
//                          the entire usage bill. Often enabled at provisioning.
//   cnam_listing_enabled   Outbound caller ID name. FREE, per Telnyx's own
//                          article. Fifteen characters. Nothing has ever set it,
//                          so every number displays as a bare number.
//
// Both were found by reading the published price list rather than the invoice,
// and neither can be answered from our database — they live on Telnyx's side of
// the number. So ask Telnyx. See docs/COST-FINDINGS.md §1o and §1t.
//
// WHY THIS EXISTS AS CODE RATHER THAN AN INSTRUCTION TO GO LOOK. The answer is
// thirteen separate pages in Mission Control, and it changes every time a number
// is bought or released. A number that quietly arrives with E911 enabled adds
// $1.50/month forever and appears nowhere anyone reads.
//
// READ-ONLY BY DEFAULT. The audit reports; enabling CNAM is a separate,
// explicit call. Nothing here ever disables E911 — that is a safety feature on
// somebody's phone line, not a cost lever, and turning it off is a decision for
// a person who knows whether these numbers can ever be dialled back.

const TELNYX_BASE = 'https://api.telnyx.com/v2'

/** Fields we care about. Telnyx returns many more; these are the billable ones. */
export interface TelnyxNumberSettings {
  id?: string
  phone_number?: string
  status?: string
  connection_id?: string | null
  connection_name?: string | null
  billing_group_id?: string | null
  /** E911. $1.50/month/number when true. */
  emergency_enabled?: boolean
  emergency_status?: string | null
  emergency_address_id?: string | null
  /** Outbound caller ID name listing. Free. */
  cnam_listing_enabled?: boolean
  caller_id_name_enabled?: boolean
  /** Blocks accidental deletion of the number. Free. */
  deletion_lock_enabled?: boolean
}

export interface NumberAuditRow {
  phone_number: string
  telnyx_id: string | null
  status: string | null
  e911_enabled: boolean
  e911_monthly_usd: number
  cnam_enabled: boolean
  deletion_locked: boolean
  connection_name: string | null
}

export interface NumberAuditResult {
  ok: boolean
  error?: string
  numbers: NumberAuditRow[]
  totals: {
    owned: number
    /** The whole point of the exercise. */
    e911_enabled: number
    e911_monthly_usd: number
    rental_monthly_usd: number
    cnam_missing: number
    deletion_unlocked: number
    /** Rental + E911. The part of the bill that arrives whether or not anyone dials. */
    fixed_monthly_usd: number
  }
}

const E911_MONTHLY_USD = 1.5
const RENTAL_MONTHLY_USD = 1.0

/**
 * Every number Telnyx says we own, with the settings that cost money.
 *
 * Returns ok:false rather than throwing or returning a partial list. A
 * half-read page would understate the E911 count, and understating it is the
 * failure mode that matters — the whole reason this exists is that a charge was
 * invisible.
 */
export async function auditTelnyxNumbers(apiKey: string): Promise<NumberAuditResult> {
  const empty: NumberAuditResult['totals'] = {
    owned: 0, e911_enabled: 0, e911_monthly_usd: 0, rental_monthly_usd: 0,
    cnam_missing: 0, deletion_unlocked: 0, fixed_monthly_usd: 0,
  }
  if (!apiKey) return { ok: false, error: 'TELNYX_API_KEY is not set', numbers: [], totals: empty }

  const owned: TelnyxNumberSettings[] = []
  const PAGE_SIZE = 250
  const MAX_PAGES = 20

  for (let page = 1; page <= MAX_PAGES; page++) {
    try {
      const res = await fetch(
        `${TELNYX_BASE}/phone_numbers?page[number]=${page}&page[size]=${PAGE_SIZE}`,
        { headers: { Authorization: `Bearer ${apiKey}` }, cache: 'no-store' }
      )
      if (!res.ok) {
        const text = await res.text()
        return {
          ok: false,
          error: `Telnyx returned ${res.status}: ${text.slice(0, 300)}`,
          numbers: [], totals: empty,
        }
      }
      const body = (await res.json()) as { data?: TelnyxNumberSettings[] }
      const batch = Array.isArray(body?.data) ? body.data : []
      owned.push(...batch)
      if (batch.length < PAGE_SIZE) break
    } catch (err) {
      return {
        ok: false,
        error: `Listing numbers threw: ${err instanceof Error ? err.message : String(err)}`,
        numbers: [], totals: empty,
      }
    }
  }

  const numbers: NumberAuditRow[] = owned.map(n => ({
    phone_number: n.phone_number || '(unknown)',
    telnyx_id: n.id ?? null,
    status: n.status ?? null,
    e911_enabled: n.emergency_enabled === true,
    e911_monthly_usd: n.emergency_enabled === true ? E911_MONTHLY_USD : 0,
    // Telnyx exposes two related flags; either being on means a name is listed.
    cnam_enabled: n.cnam_listing_enabled === true || n.caller_id_name_enabled === true,
    deletion_locked: n.deletion_lock_enabled === true,
    connection_name: n.connection_name ?? null,
  }))

  const e911 = numbers.filter(n => n.e911_enabled).length
  const totals = {
    owned: numbers.length,
    e911_enabled: e911,
    e911_monthly_usd: round2(e911 * E911_MONTHLY_USD),
    rental_monthly_usd: round2(numbers.length * RENTAL_MONTHLY_USD),
    cnam_missing: numbers.filter(n => !n.cnam_enabled).length,
    deletion_unlocked: numbers.filter(n => !n.deletion_locked).length,
    fixed_monthly_usd: round2(numbers.length * RENTAL_MONTHLY_USD + e911 * E911_MONTHLY_USD),
  }

  return { ok: true, numbers, totals }
}

/**
 * Turn on the outbound caller-ID name listing for one number.
 *
 * Free, per Telnyx: *"Outbound caller ID name listing is free."* Fifteen
 * characters, pushed to the US industry databases, live in 12-72 hours.
 *
 * TEMPER THE EXPECTATION IN THE UI, NOT HERE. Telnyx also says "wireless
 * carriers generally don't use CNAM services", so this reaches the landline
 * share of a list and nothing else. It is worth doing because it costs nothing,
 * not because it will move the answer rate — and it is emphatically NOT Branded
 * Calling, which does reach mobile and costs $0.075 a call (§1e, §1t).
 */
export async function setCnamListing(
  apiKey: string,
  telnyxNumberId: string,
  name: string
): Promise<{ ok: boolean; error?: string }> {
  // Telnyx caps the listing at 15 characters and rejects the whole request over
  // it, so trim here rather than hand back a 422 per number.
  const trimmed = (name || '').trim().slice(0, 15)
  if (!trimmed) return { ok: false, error: 'CNAM name is empty' }

  try {
    const res = await fetch(`${TELNYX_BASE}/phone_numbers/${telnyxNumberId}/voice`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        cnam_listing: { cnam_listing_enabled: true, cnam_listing_details: trimmed },
      }),
    })
    if (!res.ok) {
      const text = await res.text()
      return { ok: false, error: `Telnyx returned ${res.status}: ${text.slice(0, 300)}` }
    }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
