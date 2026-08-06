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
export async function searchAvailableNumbers(
  areaCode: string,
  limit = 30
): Promise<AvailableNumber[]> {
  const params = new URLSearchParams({
    'filter[country_code]': 'US',
    'filter[national_destination_code]': areaCode,
    'filter[phone_number_type]': 'local',
    'filter[limit]': String(limit),
    'filter[voice_enabled]': 'true',
  })

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
  const available = await searchAvailableNumbers(areaCode, 5)
  if (available.length === 0) return null

  for (const candidate of available) {
    try {
      return await purchaseNumber(candidate.phone_number)
    } catch (err) {
      console.warn(`[telnyxProvision] Failed to purchase ${candidate.phone_number}, trying next:`, err)
      continue
    }
  }

  return null
}
