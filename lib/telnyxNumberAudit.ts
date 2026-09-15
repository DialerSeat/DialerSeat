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

/**
 * `GET /phone_numbers` — identity. Carries the number and its status, and NOT
 * the billable feature flags.
 */
export interface TelnyxNumberIdentity {
  id?: string
  phone_number?: string
  status?: string
  connection_name?: string | null
  deletion_lock_enabled?: boolean
}

/**
 * `GET /phone_numbers/voice` — the billable settings, and NOT the phone number.
 *
 * THIS SEPARATION IS THE WHOLE REASON THE FIRST VERSION OF THIS FILE WAS WRONG.
 * It read `emergency_enabled` and `cnam_listing_enabled` as flat fields off the
 * plain number list, where neither exists. Both come back `undefined`, so every
 * number reported E911 OFF and the audit would have confidently answered "$0"
 * to the one question it was built to settle. Verified against Telnyx's own
 * reference: they are NESTED, on a DIFFERENT endpoint, which does not carry the
 * phone number — so both lists are needed and joined on `id`.
 */
export interface TelnyxVoiceSettings {
  id?: string
  connection_id?: string | null
  /** E911. $1.50/month/number when enabled. */
  emergency?: { emergency_enabled?: boolean; emergency_status?: string | null } | null
  /** Outbound caller ID name listing. Free. */
  cnam_listing?: { cnam_listing_enabled?: boolean; cnam_listing_details?: string | null } | null
  /** 'pay-per-minute' or 'channel' — channel billing is inbound-only (§1e). */
  usage_payment_method?: string | null
  /** Telnyx: "This feature has an additional per-number monthly cost." */
  inbound_call_screening?: string | null
}

export interface NumberAuditRow {
  phone_number: string
  telnyx_id: string | null
  status: string | null
  e911_enabled: boolean
  e911_monthly_usd: number
  cnam_enabled: boolean
  cnam_name: string | null
  /** Telnyx charges extra per number for this; default 'disabled'. */
  call_screening: string | null
  deletion_locked: boolean
  connection_name: string | null
  /** True when the voice-settings lookup did not cover this number. */
  settings_unknown: boolean
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
    /** Telnyx charges extra per number for inbound call screening. */
    call_screening_enabled: number
    /** Rental + E911. The part of the bill that arrives whether or not anyone dials. */
    fixed_monthly_usd: number
  }
}

const E911_MONTHLY_USD = 1.5
const RENTAL_MONTHLY_USD = 1.0
const PAGE_SIZE = 250
const MAX_PAGES = 20

/** Page a Telnyx list endpoint. Returns null on ANY failure, never a partial list. */
async function fetchAll<T>(path: string, apiKey: string): Promise<T[] | null> {
  const out: T[] = []
  for (let page = 1; page <= MAX_PAGES; page++) {
    try {
      const sep = path.includes('?') ? '&' : '?'
      const res = await fetch(
        `${TELNYX_BASE}${path}${sep}page[number]=${page}&page[size]=${PAGE_SIZE}`,
        { headers: { Authorization: `Bearer ${apiKey}` }, cache: 'no-store' }
      )
      if (!res.ok) {
        console.error(`[telnyxNumberAudit] ${path} page ${page} → ${res.status}`)
        return null
      }
      const body = (await res.json()) as { data?: T[] }
      const batch = Array.isArray(body?.data) ? body.data : []
      out.push(...batch)
      if (batch.length < PAGE_SIZE) break
    } catch (err) {
      console.error(`[telnyxNumberAudit] ${path} page ${page} threw`, err)
      return null
    }
  }
  return out
}

/**
 * Every number Telnyx says we own, with the settings that cost money.
 *
 * TWO ENDPOINTS, JOINED ON id. `/phone_numbers` has the number and status but
 * none of the billable flags; `/phone_numbers/voice` has the flags but not the
 * number. The first version of this read the flags off the wrong list, got
 * `undefined` for every one, and would have reported "E911 OFF, $0" for an
 * account where it might be $19.50/month — a confident wrong answer to the only
 * question it exists to settle.
 *
 * Returns ok:false rather than a partial list. Understating the E911 count is
 * the failure mode that matters here.
 */
export async function auditTelnyxNumbers(apiKey: string): Promise<NumberAuditResult> {
  const empty: NumberAuditResult['totals'] = {
    owned: 0, e911_enabled: 0, e911_monthly_usd: 0, rental_monthly_usd: 0,
    cnam_missing: 0, deletion_unlocked: 0, call_screening_enabled: 0, fixed_monthly_usd: 0,
  }
  if (!apiKey) return { ok: false, error: 'TELNYX_API_KEY is not set', numbers: [], totals: empty }

  const [identities, voices] = await Promise.all([
    fetchAll<TelnyxNumberIdentity>('/phone_numbers', apiKey),
    fetchAll<TelnyxVoiceSettings>('/phone_numbers/voice', apiKey),
  ])

  if (!identities) {
    return { ok: false, error: 'Could not list numbers from Telnyx', numbers: [], totals: empty }
  }
  // A voice-settings failure is NOT fatal — the rental total is still worth
  // showing — but every row is marked settings_unknown so nobody reads a
  // missing flag as "off". That distinction is the entire bug this replaced.
  const voiceById = new Map<string, TelnyxVoiceSettings>()
  for (const v of voices || []) if (v.id) voiceById.set(String(v.id), v)

  const numbers: NumberAuditRow[] = identities.map(n => {
    const v = n.id ? voiceById.get(String(n.id)) : undefined
    const unknown = !voices || !v
    const e911 = v?.emergency?.emergency_enabled === true
    return {
      phone_number: n.phone_number || '(unknown)',
      telnyx_id: n.id ?? null,
      status: n.status ?? null,
      e911_enabled: e911,
      e911_monthly_usd: e911 ? E911_MONTHLY_USD : 0,
      cnam_enabled: v?.cnam_listing?.cnam_listing_enabled === true,
      cnam_name: v?.cnam_listing?.cnam_listing_details ?? null,
      call_screening: v?.inbound_call_screening ?? null,
      deletion_locked: n.deletion_lock_enabled === true,
      connection_name: n.connection_name ?? null,
      settings_unknown: unknown,
    }
  })

  const known = numbers.filter(n => !n.settings_unknown)
  const e911Count = numbers.filter(n => n.e911_enabled).length
  const totals = {
    owned: numbers.length,
    e911_enabled: e911Count,
    e911_monthly_usd: round2(e911Count * E911_MONTHLY_USD),
    rental_monthly_usd: round2(numbers.length * RENTAL_MONTHLY_USD),
    // Counted over numbers we could actually read. An unreadable number is not
    // a number missing CNAM.
    cnam_missing: known.filter(n => !n.cnam_enabled).length,
    deletion_unlocked: numbers.filter(n => !n.deletion_locked).length,
    // Telnyx: "This feature has an additional per-number monthly cost."
    call_screening_enabled: known.filter(
      n => n.call_screening && n.call_screening !== 'disabled'
    ).length,
    fixed_monthly_usd: round2(numbers.length * RENTAL_MONTHLY_USD + e911Count * E911_MONTHLY_USD),
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
