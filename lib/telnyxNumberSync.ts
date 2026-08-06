import { createClient } from '@supabase/supabase-js'
import { extractAreaCode, getAreaCodeInfo } from '@/lib/areaCode'
import { DEFAULT_DAILY_CAP } from '@/lib/numberPool'

// =============================================================================
// NUMBER POOL ↔ TELNYX RECONCILIATION
// =============================================================================
// THE PROBLEM
//
// The number pool was populated while this app ran on SignalWire. After the
// move to Telnyx those rows are still sitting there marked 'active', and
// pickNumberForLead happily hands one to Telnyx as the outbound caller ID.
// Telnyx will not originate a call from a number it doesn't own, so the lead
// leg dies with:
//
//     403  D51  Unverified origination number.
//               The source number is a non-Telnyx number that has not been verified.
//
// Note what that costs: the AGENT leg is placed first and succeeds, so the
// agent's browser is already ringing when the lead leg is rejected. The
// failure is orphaned-leg cleanup plus a confusing error, on every dial, for
// a reason that has nothing to do with the lead being dialed.
//
// THE FIX
//
// Telnyx is the authority on which numbers we own, so ask it, and make the
// pool match. Numbers Telnyx owns are usable; numbers it doesn't are retired
// so they can never be selected as a caller ID again. Numbers Telnyx owns
// that we don't have a row for are imported — which is what makes this work
// on a fresh account where somebody bought a number in the portal and never
// told the app about it.
//
// SAFETY: NEVER RETIRE ON A FAILED OR EMPTY FETCH
//
// The retire step is driven by absence from Telnyx's list, so a failed
// request or an unexpectedly empty response would retire the ENTIRE pool and
// leave the app with no caller ID at all — turning a recoverable problem into
// a total outage. Both cases are therefore treated as "no information" and
// change nothing. Retirement only ever happens against a successful response
// containing at least one number.
// =============================================================================

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const TELNYX_BASE = 'https://api.telnyx.com/v2'

/** Marks a pool row as not-ours-on-this-provider. */
const RETIRED_STATUS = 'released'
const RETIRED_REASON = 'Not owned on Telnyx — retired automatically by number pool sync'

export interface NumberSyncResult {
  ok: boolean
  /** Numbers Telnyx confirms we own. */
  ownedCount: number
  /** Pool rows newly inserted from Telnyx. */
  imported: string[]
  /** Pool rows retired because Telnyx doesn't own them. */
  retired: string[]
  /** Pool rows reactivated because Telnyx does own them after all. */
  reactivated: string[]
  error?: string
}

interface TelnyxNumber {
  id?: string
  phone_number?: string
  status?: string
}

/**
 * Fetch every phone number this Telnyx account owns, following pagination.
 * Returns null (not an empty array) on failure, so callers can distinguish
 * "we own nothing" from "we couldn't find out" — a distinction the retire
 * step depends on completely.
 */
async function fetchOwnedTelnyxNumbers(apiKey: string): Promise<TelnyxNumber[] | null> {
  const owned: TelnyxNumber[] = []
  const PAGE_SIZE = 250
  const MAX_PAGES = 20 // 5,000 numbers; a circuit breaker, not a real ceiling

  for (let page = 1; page <= MAX_PAGES; page++) {
    try {
      const res = await fetch(
        `${TELNYX_BASE}/phone_numbers?page[number]=${page}&page[size]=${PAGE_SIZE}`,
        { headers: { Authorization: `Bearer ${apiKey}` }, cache: 'no-store' }
      )
      if (!res.ok) {
        const text = await res.text()
        console.error(
          `[telnyxNumberSync] listing owned numbers failed (page ${page}, ${res.status}): ${text.slice(0, 300)}`
        )
        return null
      }
      const body = (await res.json()) as { data?: TelnyxNumber[] }
      const batch = Array.isArray(body?.data) ? body.data : []
      owned.push(...batch)
      if (batch.length < PAGE_SIZE) break
    } catch (err) {
      console.error(`[telnyxNumberSync] listing owned numbers threw on page ${page}:`, err)
      return null
    }
  }

  return owned
}

/** Digits-only, so +1 555… and 1555… and 555… all compare equal. */
function normalizeForCompare(phone: string): string {
  return (phone || '').replace(/\D/g, '')
}

/**
 * Reconcile the pool against the numbers Telnyx actually owns.
 *
 * Safe to run repeatedly — it is a convergence operation, not a migration.
 */
export async function syncNumberPoolWithTelnyx(apiKey?: string): Promise<NumberSyncResult> {
  const key = apiKey || process.env.TELNYX_API_KEY
  const empty: NumberSyncResult = {
    ok: false,
    ownedCount: 0,
    imported: [],
    retired: [],
    reactivated: [],
  }

  if (!key) {
    return { ...empty, error: 'TELNYX_API_KEY is not set' }
  }

  const owned = await fetchOwnedTelnyxNumbers(key)
  if (owned === null) {
    return { ...empty, error: 'Could not list phone numbers from Telnyx' }
  }

  if (owned.length === 0) {
    // Telnyx answered, and the answer is "you own nothing". Retiring the pool
    // here would be technically correct and operationally catastrophic — it
    // would leave zero caller IDs. Report it loudly and change nothing; the
    // real fix is buying a number, which is a decision, not a sync.
    console.error(
      '[telnyxNumberSync] this Telnyx account owns ZERO phone numbers, so no outbound call can ' +
      'have a valid caller ID. Buy at least one number in Telnyx Mission Control (or via the ' +
      'admin number pool), then dial again. Pool left untouched.'
    )
    return { ...empty, ok: true, error: 'Telnyx account owns no phone numbers' }
  }

  const ownedByDigits = new Map<string, TelnyxNumber>()
  for (const n of owned) {
    if (n.phone_number) ownedByDigits.set(normalizeForCompare(n.phone_number), n)
  }

  const { data: poolRows, error: poolErr } = await supabase
    .from('phone_numbers')
    .select('id, phone_number, status')

  if (poolErr) {
    return { ...empty, error: `Could not read the number pool: ${poolErr.message}` }
  }

  const result: NumberSyncResult = {
    ok: true,
    ownedCount: owned.length,
    imported: [],
    retired: [],
    reactivated: [],
  }

  const poolByDigits = new Map<string, { id: string; phone_number: string; status: string }>()
  for (const row of poolRows || []) {
    poolByDigits.set(normalizeForCompare(row.phone_number), row)
  }

  // ── RETIRE: in the pool, not owned on Telnyx ────────────────────────────
  for (const [digits, row] of poolByDigits) {
    if (ownedByDigits.has(digits)) continue
    if (row.status === RETIRED_STATUS) continue

    const { error } = await supabase
      .from('phone_numbers')
      .update({
        status: RETIRED_STATUS,
        flag_reason: RETIRED_REASON,
        last_flagged_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id)

    if (error) {
      console.error(`[telnyxNumberSync] failed to retire ${row.phone_number}:`, error)
    } else {
      result.retired.push(row.phone_number)
    }
  }

  // ── IMPORT / REACTIVATE: owned on Telnyx ────────────────────────────────
  for (const [digits, telnyxNumber] of ownedByDigits) {
    const existing = poolByDigits.get(digits)
    const phone = telnyxNumber.phone_number!

    if (existing) {
      if (existing.status !== 'active') {
        const { error } = await supabase
          .from('phone_numbers')
          .update({
            status: 'active',
            flag_reason: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id)
        if (error) {
          console.error(`[telnyxNumberSync] failed to reactivate ${phone}:`, error)
        } else {
          result.reactivated.push(phone)
        }
      }
      continue
    }

    const areaCode = extractAreaCode(phone) || ''
    const info = areaCode ? getAreaCodeInfo(areaCode) : null

    const { error } = await supabase.from('phone_numbers').insert({
      phone_number: phone,
      area_code: areaCode,
      state: info?.state ?? null,
      region: info?.region ?? null,
      // Legacy column name reused for Telnyx's number id, exactly as
      // numberPool.addNumberByAreaCode already does (and as
      // calls.call_control_id holds a Telnyx call_control_id).
      provider_number_id: telnyxNumber.id || phone,
      status: 'active',
      daily_call_count: 0,
      daily_cap: DEFAULT_DAILY_CAP,
      monthly_cost_cents: 100,
    })

    if (error) {
      console.error(`[telnyxNumberSync] failed to import ${phone}:`, error)
    } else {
      result.imported.push(phone)
    }
  }

  console.log(
    `[telnyxNumberSync] reconciled pool with Telnyx — ${result.ownedCount} owned, ` +
    `${result.imported.length} imported, ${result.reactivated.length} reactivated, ` +
    `${result.retired.length} retired`
  )

  return result
}

/**
 * True when a Telnyx dial rejection is specifically "this caller ID isn't a
 * number you own" (their D51).
 *
 * Matched on the D51 code and on the message text, because Telnyx surfaces
 * this one inconsistently — sometimes as a structured error code, sometimes
 * only in the prose detail of a generically-titled 403.
 */
export function isUnverifiedOriginationError(
  errors: Array<{ code?: string | number; title?: string; detail?: string }> | undefined
): boolean {
  if (!errors || errors.length === 0) return false
  return errors.some((e) => {
    const blob = `${e.code ?? ''} ${e.title ?? ''} ${e.detail ?? ''}`
    return /D51/.test(blob) || /unverified origination/i.test(blob)
  })
}

/**
 * Memoized so a misconfigured pool triggers ONE reconciliation, not one per
 * dial. Cleared on failure so a transient API problem doesn't permanently
 * disable the self-heal.
 */
let inFlightSync: Promise<NumberSyncResult> | null = null

export function syncNumberPoolOnce(apiKey?: string): Promise<NumberSyncResult> {
  if (inFlightSync) return inFlightSync
  const attempt = syncNumberPoolWithTelnyx(apiKey)
  inFlightSync = attempt
  void attempt.then((r) => {
    if (!r.ok) inFlightSync = null
  })
  return attempt
}
