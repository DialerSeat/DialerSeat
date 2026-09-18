// =============================================================================
// TELNYX NUMBER PROVISIONING — search / purchase / release
// =============================================================================
// Telnyx equivalent of lib/signalwireProvision.ts. Same shape (search,
// purchase, release, acquireByAreaCode), different underlying API — Telnyx's
// number provisioning is a NATIVE JSON API (not part of the TeXML/TwiML-
// compat surface), so this talks to api.telnyx.com/v2 directly rather than
// through the /texml/ compat layer that lib/telnyxCall.ts uses for calls.
//
// KEY DIFFERENCES FROM SIGNALWIRE, worth knowing before touching this file:
//   - Auth is a Bearer token, not HTTP Basic (no project id in the header).
//   - Numbers are searched/purchased in two steps: search returns candidate
//     numbers (no commitment), purchase happens via a "number order" that
//     can request one or many numbers at once. SignalWire's model buys one
//     number per call; we keep that same one-at-a-time shape here to match
//     acquireNumberByAreaCode()'s existing contract, even though Telnyx
//     supports bulk ordering — no reason to change caller behavior.
//   - Release is DELETE /v2/phone_numbers/{id}, keyed by TELNYX'S internal
//     id (a UUID Telnyx assigns), NOT the phone number string itself. We
//     store that id in phone_numbers.telnyx_id (parallel to today's
//     phone_numbers.provider_number_id) — see the schema migration note in
//     TELNYX-MIGRATION-DESIGN.md.
//   - A number can be assigned to our TeXML Application at purchase time
//     via `connection_id` in the number-order request — this is the
//     Telnyx equivalent of SignalWire's VoiceUrl/StatusCallback being set
//     inline on IncomingPhoneNumbers.json. Once assigned to the
//     connection, inbound calls to that number route to the TeXML
//     Application's configured Voice URL automatically — we don't set a
//     per-number webhook URL the way SignalWire's purchaseNumber() does.
// =============================================================================

const API_KEY = process.env.TELNYX_API_KEY!
const CONNECTION_ID = process.env.TELNYX_CONNECTION_ID! // TeXML Application id

const BASE_URL = 'https://api.telnyx.com/v2'
const authHeader = `Bearer ${API_KEY}`

export interface AvailableNumber {
  phone_number: string
  locality: string | null
  region: string | null // administrative_area (US state) in Telnyx's terms
  cost_information?: { upfront_cost: string; monthly_cost: string; currency: string }
}

export interface PurchasedNumber {
  id: string // Telnyx's internal phone_number id — store this, not just the number
  phone_number: string
  connection_id: string | null
  status: string
}

/**
 * Search available US local numbers by area code (NPA / national
 * destination code). Mirrors signalwireProvision.searchAvailableNumbers.
 */
export interface NumberSearch {
  /** NPA. Omitted when searching a whole state. */
  areaCode?: string
  /** Two-letter state, e.g. 'GA'. Telnyx calls this administrative_area. */
  state?: string
  /**
   * Let Telnyx return approximate matches.
   *
   * Last resort only: a best-effort result may be a neighbouring rate centre,
   * so it is a weaker locality match than an exact one. Better than no number,
   * worse than the right number -- which is exactly the order the fallback
   * chain in numberPool tries them in.
   */
  bestEffort?: boolean
  limit?: number
}

/**
 * Search available US local numbers.
 *
 * ── WHY THIS TAKES A STATE AND NOT JUST AN AREA CODE ───────────────────────
 * It used to accept an area code only, which made buying fail on exactly the
 * area codes worth buying. 404 is the clearest case: Atlanta has been overlaid
 * by 470, 678 and 770 for decades and has essentially no free inventory, so a
 * request for a 404 returned an empty list and the buy surfaced "No numbers
 * available in area code 404. Try another."
 *
 * Accurate, and useless. Nobody wants a 404 specifically; they want a number
 * that reads as Atlanta to somebody in Atlanta. Telnyx has always supported
 * filter[administrative_area] for precisely this and we were not using it.
 */
export async function searchAvailableNumbers(
  search: NumberSearch | string,
  limitArg = 30
): Promise<AvailableNumber[]> {
  // A bare string keeps the five existing callers working unchanged.
  const opts: NumberSearch = typeof search === 'string'
    ? { areaCode: search, limit: limitArg }
    : search
  const limit = opts.limit ?? limitArg

  const params = new URLSearchParams({
    'filter[country_code]': 'US',
    'filter[phone_number_type]': 'local',
    'filter[limit]': String(limit),
    'filter[voice_enabled]': 'true',
  })
  if (opts.areaCode) params.set('filter[national_destination_code]', opts.areaCode)
  if (opts.state) params.set('filter[administrative_area]', opts.state)
  if (opts.bestEffort) params.set('filter[best_effort]', 'true')

  const res = await fetch(`${BASE_URL}/available_phone_numbers?${params}`, {
    headers: { Authorization: authHeader },
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Telnyx number search failed (${res.status}): ${text}`)
  }

  const data = await res.json()
  return (data.data ?? []).map((n: {
    phone_number: string
    region_information?: Array<{ region_type: string; region_name: string }>
    cost_information?: AvailableNumber['cost_information']
  }) => {
    const regionInfo = n.region_information || []
    const locality = regionInfo.find((r) => r.region_type === 'rate_center')?.region_name ?? null
    const region = regionInfo.find((r) => r.region_type === 'administrative_area')?.region_name ?? null
    return {
      phone_number: n.phone_number,
      locality,
      region,
      cost_information: n.cost_information,
    }
  })
}

/**
 * Purchase a specific number and assign it to our TeXML Application
 * (TELNYX_CONNECTION_ID) in the same request, so inbound routing and
 * outbound eligibility are both live the moment the order completes.
 */
export async function purchaseNumber(phoneNumber: string): Promise<PurchasedNumber> {
  const res = await fetch(`${BASE_URL}/number_orders`, {
    method: 'POST',
    headers: {
      Authorization: authHeader,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      phone_numbers: [{ phone_number: phoneNumber }],
      connection_id: CONNECTION_ID,
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Telnyx purchase failed (${res.status}): ${text}`)
  }

  const data = await res.json()
  const order = data.data
  const purchased = order?.phone_numbers?.[0]

  if (!purchased?.id || !purchased?.phone_number) {
    throw new Error(`Telnyx purchase succeeded but response shape was unexpected: ${JSON.stringify(data)}`)
  }

  // Number orders are async on Telnyx's side (regulatory checks etc. for
  // some localities), but for US local numbers with no special
  // requirements this typically completes near-instantly. The order
  // response gives us the id we need to store; status may still read
  // "pending" briefly. We don't block on completion here — callers that
  // need to confirm activation should poll GET /number_orders/{id} or
  // check phone_numbers/{id}.status before relying on the number for
  // outbound traffic. Flagging rather than silently assuming "ordered
  // == immediately dialable" since that gap bit the original SignalWire
  // integration in a different way (see brief's billing-discrepancy
  // section — assumptions about provider state without verification).
  return {
    id: purchased.id,
    phone_number: purchased.phone_number,
    connection_id: order.connection_id ?? null,
    status: order.status ?? 'pending',
  }
}

/**
 * Release (delete) a number by Telnyx's internal id — NOT the phone
 * number string. Idempotent-ish: a 404 (already gone) is treated as
 * success, matching signalwireProvision.releaseNumber's behavior.
 */
export async function releaseNumber(telnyxNumberId: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/phone_numbers/${telnyxNumberId}`, {
    method: 'DELETE',
    headers: { Authorization: authHeader },
  })

  if (!res.ok && res.status !== 404) {
    const text = await res.text()
    throw new Error(`Telnyx release failed (${res.status}): ${text}`)
  }
}

/**
 * Search + purchase the first working candidate in an area code. Mirrors
 * signalwireProvision.acquireNumberByAreaCode's try-next-on-failure shape.
 */
export async function acquireNumberByAreaCode(
  areaCode: string
): Promise<PurchasedNumber | null> {
  const result = await acquireNumber({ areaCodes: [areaCode] })
  return result.ok ? result.purchased : null
}

export interface AcquireTarget {
  /** Preferred NPAs, best first. Each is tried before the state fallback. */
  areaCodes?: string[]
  /** Two-letter state. The fallback that makes a buy actually succeed. */
  state?: string
}

export interface AcquireResult {
  purchased: PurchasedNumber
  /** Which rung of the ladder actually produced it. */
  via: 'area_code' | 'state' | 'state_best_effort'
  /** The NPA asked for, when via is 'area_code'. */
  areaCode?: string
  /** Rungs that errored before this one won, for the log. */
  warnings?: string[]
}

export type AcquireOutcome =
  | ({ ok: true } & AcquireResult)
  | { ok: false; reason: string }

/**
 * Buy one number, trying progressively looser searches until one works.
 *
 * ── THE LADDER, AND WHY IT IS IN THIS ORDER ────────────────────────────────
 *   1. each preferred area code, exact      the number somebody actually wants
 *   2. anywhere in the state, exact         still a local match to the lead
 *   3. anywhere in the state, best effort   a neighbouring rate centre
 *
 * Every rung is a weaker locality signal than the one above it, and locality
 * is the whole reason for buying in a particular place. So the ladder is
 * ordered by how good the number is, and descends only when the rung above
 * has no inventory.
 *
 * Without this, a buy was a single exact search that returned nothing on the
 * mature area codes -- 404, 323, 313 -- which are mature precisely BECAUSE
 * they cover the places with the most people in them, which is why they are
 * the ones worth buying. The failure mode selected against the goal.
 *
 * Returns which rung won, so the caller can say "no 404 was free, bought a
 * 470 in Atlanta instead" rather than reporting a plain success and leaving
 * somebody to notice the area code later.
 */
export async function acquireNumber(target: AcquireTarget): Promise<AcquireOutcome> {
  // ── EVERY RUNG IS FAULT TOLERANT, AND THAT IS THE POINT ──────────────────
  // searchAvailableNumbers throws on any non-OK response from Telnyx. The
  // first version of this ladder did not catch it, so a single rejected
  // search -- one bad filter, one rate limit, one 5xx -- threw straight past
  // the loop, aborted the entire batch, and surfaced as the generic "something
  // went wrong, try again" with no indication of which code or why.
  //
  // A ladder whose whole purpose is to keep trying must not be stopped by the
  // first rung failing. Each rung records why it failed and the next one runs.
  const warnings: string[] = []

  const why = (err: unknown) =>
    err instanceof Error ? err.message.slice(0, 200) : String(err).slice(0, 200)

  const search = async (label: string, opts: NumberSearch) => {
    try {
      return await searchAvailableNumbers(opts)
    } catch (err) {
      const msg = `${label}: ${why(err)}`
      console.warn(`[telnyxProvision] search failed, ${msg}`)
      warnings.push(msg)
      return [] as AvailableNumber[]
    }
  }

  const tryBuy = async (candidates: AvailableNumber[]) => {
    for (const candidate of candidates) {
      try {
        return await purchaseNumber(candidate.phone_number)
      } catch (err) {
        const msg = `purchase ${candidate.phone_number}: ${why(err)}`
        console.warn(`[telnyxProvision] ${msg}`)
        warnings.push(msg)
      }
    }
    return null
  }

  for (const areaCode of target.areaCodes ?? []) {
    const available = await search(`search ${areaCode}`, { areaCode, limit: 5 })
    if (available.length === 0) continue
    const purchased = await tryBuy(available)
    if (purchased) return { ok: true, purchased, via: 'area_code', areaCode, warnings }
  }

  if (target.state) {
    const exact = await search(`search ${target.state}`, { state: target.state, limit: 10 })
    const purchased = await tryBuy(exact)
    if (purchased) return { ok: true, purchased, via: 'state', warnings }

    const loose = await search(`search ${target.state} best-effort`, {
      state: target.state, bestEffort: true, limit: 10,
    })
    const fallback = await tryBuy(loose)
    if (fallback) return { ok: true, purchased: fallback, via: 'state_best_effort', warnings }
  }

  // The reason is the real one from Telnyx where there is one, because "no
  // numbers available" is a lie when the truth is that the search was refused.
  return {
    ok: false,
    reason: warnings.length > 0
      ? warnings.join('; ')
      : `no inventory in ${(target.areaCodes ?? []).join('/') || 'the requested codes'}` +
        (target.state ? ` or anywhere in ${target.state}` : ''),
  }
}
