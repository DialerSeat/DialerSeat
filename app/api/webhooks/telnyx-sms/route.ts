import { NextRequest, NextResponse } from 'next/server'
import { addSuppression } from '@/lib/suppression'
import { isOptOut } from '@/lib/smsOptOut'
import { logCallEvent } from '@/lib/callEvents'

// =============================================================================
// INBOUND SMS — the opt-out nobody was listening for
// =============================================================================
// THE FINDING. From the 15 September ledger capture, in the `messaging` record
// type nobody had opened because it showed three rows at $0.00:
//
//   02:36:24  we called +1 650 290 0972
//   02:37:26  they texted STOP to the number that had just called them
//
// Sixty-two seconds. Telnyx received it and auto-responded
// ("autoresponse_type": "STOP"). This application never saw it, because until
// now the only webhook route in the entire app was webhooks/clerk.
//
// At the time of the finding that person was still in the lead list three
// times, was not suppressed, and `suppression_list` contained ZERO rows in
// total. The enforcement half has always worked — checkSuppression runs on
// every dial and would have refused — so the gap was purely that nothing ever
// wrote an opt-out down.
//
// A TCPA opt-out is not a cost line. Every other finding tonight is measured in
// cents; this is $500-$1,500 per subsequent call, and there is no safe harbour
// for not having built the listener.
//
// ── TO FINISH WIRING THIS UP ────────────────────────────────────────────────
// Telnyx must be told where to send it: Mission Control -> Messaging -> your
// messaging profile -> Inbound Settings -> Webhook URL:
//
//     https://<your-domain>/api/webhooks/telnyx-sms
//
// Until that is set, this route is correct and receives nothing. Deploying it
// changes nothing on its own, which is why it is safe to ship immediately and
// why the pointing step belongs on the list rather than in this file.
//
// ── DELIBERATELY DOES ALMOST NOTHING ELSE ───────────────────────────────────
// It does not reply, does not store message bodies, and does not try to thread
// conversations. Storing the text of inbound messages is a data-retention
// decision nobody has made. This records the FACT of an opt-out and the
// keyword that triggered it, which is what suppression needs and what an
// auditor would ask for.

/** Telnyx wraps everything as { data: { event_type, payload } }. */
interface TelnyxMessageWebhook {
  data?: {
    event_type?: string
    payload?: {
      direction?: string
      text?: string
      from?: { phone_number?: string }
      to?: Array<{ phone_number?: string }>
      id?: string
    }
  }
}

export async function POST(req: NextRequest) {
  // ALWAYS 200. Telnyx retries a non-2xx, and a retry storm on a route that
  // cannot succeed is how a webhook outage becomes an incident. Every failure
  // below is logged and swallowed.
  try {
    const body = (await req.json().catch(() => ({}))) as TelnyxMessageWebhook
    const eventType = body?.data?.event_type
    const p = body?.data?.payload

    // Only inbound. An outbound delivery receipt is not an opt-out, and
    // treating one as such would suppress our own numbers.
    if (p?.direction !== 'inbound') {
      return NextResponse.json({ received: true, ignored: 'not inbound' })
    }

    const from = p?.from?.phone_number
    const to = p?.to?.[0]?.phone_number ?? null
    const text = p?.text ?? ''
    if (!from) {
      return NextResponse.json({ received: true, ignored: 'no sender' })
    }

    const verdict = isOptOut(text)
    if (!verdict.optOut) {
      // Recorded rather than dropped. An inbound message that is NOT an opt-out
      // is still somebody replying to a call, and the platform currently has no
      // other trace that it happened at all.
      void logCallEvent({
        event_type: 'sms_inbound',
        source: 'webhook',
        status: eventType ?? 'message.received',
        detail: { from, to, opt_out: false, message_id: p?.id ?? null },
      })
      return NextResponse.json({ received: true, optOut: false })
    }

    // PLATFORM scope, not user scope. We cannot reliably attribute an inbound
    // text to the agent who dialled — several agents share the pool, and the
    // person is asking the BUSINESS to stop, not one seat. Scoping it to one
    // user would leave every other agent free to dial them tomorrow, which is
    // precisely the hole suppression exists to close.
    const result = await addSuppression({
      phone: from,
      scope: 'platform',
      reason: `Texted "${verdict.matched}" to ${to ?? 'one of our numbers'}`,
      source: 'sms_opt_out',
    })

    void logCallEvent({
      event_type: 'sms_inbound',
      source: 'webhook',
      status: 'opt_out',
      detail: {
        from,
        to,
        opt_out: true,
        matched: verdict.matched,
        suppressed: result.ok,
        error: result.error ?? null,
        message_id: p?.id ?? null,
      },
    })

    if (!result.ok) {
      // Loud. A failed opt-out write is the one failure here that has legal
      // consequences, and it must not be inferred from silence.
      console.error(
        `[telnyx-sms] OPT-OUT NOT RECORDED for ${from} (matched "${verdict.matched}"): ${result.error}`
      )
    } else {
      console.log(`[telnyx-sms] suppressed ${from} — texted "${verdict.matched}"`)
    }

    return NextResponse.json({ received: true, optOut: true, suppressed: result.ok })
  } catch (err) {
    console.error('[telnyx-sms] handler threw', err)
    return NextResponse.json({ received: true, error: 'handled' })
  }
}

/** Telnyx verifies a webhook URL with a GET before it will save it. */
export async function GET() {
  return NextResponse.json({ ok: true, route: 'telnyx-sms inbound' })
}
