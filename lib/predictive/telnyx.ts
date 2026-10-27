// =============================================================================
// PREDICTIVE — the Telnyx commands the engine uses, and nothing else
// =============================================================================
// Every call to Telnyx that predictive makes goes through this file, so the
// whole carrier surface of the engine is five functions long:
//
//   dialSeat          ring the agent's browser once for the session
//   createSeatRoom    put that leg in a conference of its own
//   joinSeatRoom      connect an answered lead to the agent
//   leaveSeatRoom     release a lead without hanging it up (parked)
//   gatherOptOut      the abandon message, with its press-9 opt-out
//
// Telnyx, on the two properties the design rests on:
//   create: "Upon creating the conference, the call will be automatically
//            bridged to the conference."
//   leave:  "Removes a call leg from a conference and moves it back to parked
//            state."
// =============================================================================

import { buildClientState } from '@/lib/placeOutboundCall'

const API = 'https://api.telnyx.com/v2'

/** client_state `s` on the agent's seat leg. How every webhook recognises it. */
export const SEAT_SOURCE = 'predictive_seat'

export interface TelnyxResult {
  ok: boolean
  status: number
  data: Record<string, unknown> | null
  error: string | null
  /** Telnyx's own error list, for callers that branch on a specific code. */
  errors: Array<{ code?: string | number; title?: string; detail?: string }>
}

async function post(path: string, body: Record<string, unknown>): Promise<TelnyxResult> {
  const apiKey = process.env.TELNYX_API_KEY
  if (!apiKey) {
    return { ok: false, status: 0, data: null, error: 'TELNYX_API_KEY is not set', errors: [] }
  }
  try {
    const res = await fetch(`${API}${path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
    })
    const json = await res.json().catch(() => null) as { data?: Record<string, unknown>; errors?: Array<{ detail?: string; title?: string; code?: string }> } | null
    if (!res.ok) {
      const e = json?.errors?.[0]
      return {
        ok: false,
        status: res.status,
        data: null,
        error: e ? `${e.code ?? ''} ${e.title ?? ''} ${e.detail ?? ''}`.trim() : `HTTP ${res.status}`,
        errors: json?.errors ?? [],
      }
    }
    return { ok: true, status: res.status, data: json?.data ?? null, error: null, errors: [] }
  } catch (err) {
    return { ok: false, status: 0, data: null, error: err instanceof Error ? err.message : String(err), errors: [] }
  }
}

/**
 * Ring the agent's browser once. The browser answers it like any agent leg
 * (see the dialer's onInvite), and it stays up for the whole session.
 */
export async function dialSeat(params: {
  clerkId: string
  sessionId: string
  connectionId: string
  webhookUrl: string
  to: string
  from: string
}): Promise<{ ok: boolean; callControlId: string | null; error: string | null; status: number; errors: TelnyxResult['errors'] }> {
  const r = await post('/calls', {
    connection_id: params.connectionId,
    to: params.to,
    from: params.from,
    webhook_url: params.webhookUrl,
    client_state: buildClientState({ u: params.clerkId, s: SEAT_SOURCE }),
    // The browser auto-answers in under a second. Thirty is generous and still
    // bounded, the same as every other agent leg.
    timeout_secs: 30,
    // NO time_limit_secs. Setting it on an agent leg made every dial come back
    // rejected within ~200ms (see the reverted note at the top of
    // lib/placeOutboundCall). Telnyx's default ceiling is four hours, and the
    // engine rotates the seat before a conference's own four-hour expiry.
  })
  const ccid = (r.data?.call_control_id as string | undefined) ?? null
  return { ok: r.ok && !!ccid, callControlId: ccid, error: r.error, status: r.status, errors: r.errors }
}

/** Put the answered seat leg in a room of its own. Returns the conference id. */
export async function createSeatRoom(
  seatCallControlId: string,
  sessionId: string
): Promise<{ ok: boolean; conferenceId: string | null; error: string | null }> {
  const r = await post('/conferences', {
    call_control_id: seatCallControlId,
    // Unique per creation: a name Telnyx has already seen would collide with a
    // room that is still winding down after a seat rotation.
    name: `ds-seat-${sessionId}-${Date.now()}`,
    beep_enabled: 'never',
    start_conference_on_create: true,
    // Telnyx defaults comfort_noise to TRUE: a constant low hiss played into
    // the room whenever nobody is speaking. The seat sits alone in this room
    // while lines ring, so the agent heard it as static for the whole dial.
    comfort_noise: false,
  })
  const id = (r.data?.id as string | undefined) ?? null
  return { ok: r.ok && !!id, conferenceId: id, error: r.error }
}

/** Connect an answered lead to the agent. */
export async function joinSeatRoom(conferenceId: string, leadCallControlId: string): Promise<TelnyxResult> {
  return post(`/conferences/${encodeURIComponent(conferenceId)}/actions/join`, {
    call_control_id: leadCallControlId,
    beep_enabled: 'never',
    // The seat is the room. A lead leaving must never end it.
    end_conference_on_exit: false,
  })
}

/** Release a lead from the agent without hanging the lead up. It parks. */
export async function leaveSeatRoom(conferenceId: string, leadCallControlId: string): Promise<TelnyxResult> {
  return post(`/conferences/${encodeURIComponent(conferenceId)}/actions/leave`, {
    call_control_id: leadCallControlId,
    beep_enabled: 'never',
  })
}

/**
 * The abandon message, as a gather so the press-9 opt-out is live while it
 * plays. The leg is hung up by the call.gather.ended handler, never here: a
 * hangup sent alongside the speech cuts the message off.
 */
export async function gatherOptOut(params: {
  callControlId: string
  text: string
  optOutDigit: string
  waitMs: number
}): Promise<TelnyxResult> {
  return post(`/calls/${encodeURIComponent(params.callControlId)}/actions/gather_using_speak`, {
    payload: params.text,
    voice: 'female',
    language: 'en-US',
    valid_digits: params.optOutDigit,
    minimum_digits: 1,
    maximum_digits: 1,
    maximum_tries: 1,
    timeout_millis: params.waitMs,
    terminating_digit: '',
  })
}
