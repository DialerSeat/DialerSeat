// =============================================================================
// SOMEBODY TEXTED STOP AND NOTHING HEARD IT
// =============================================================================
// Found in the 15 September ledger capture, in the `messaging` record type
// nobody had looked at because it showed $0.00 and three rows:
//
//   02:36:24  we called +1 650 290 0972
//   02:37:26  they texted STOP to the number that called them
//
// Sixty-two seconds. Telnyx received it, auto-responded, and recorded
// "autoresponse_type": "STOP". DialerSeat never saw it: there is no inbound
// message webhook anywhere in the app, only webhooks/clerk.
//
// At the time of the finding that person was still in the lead list THREE
// times, was not suppressed, and `suppression_list` held ZERO ROWS in total.
// The enforcement half works fine — checkSuppression runs on every dial — so
// the gap is purely ingestion: nothing ever writes an opt-out down.
//
// ── WHY THIS IS NOT A COST FINDING ──────────────────────────────────────────
// Calling somebody who has revoked consent is a TCPA matter, not a line on an
// invoice. Every other finding in docs/COST-FINDINGS.md is measured in cents;
// this one is measured in $500-$1,500 per call, and unlike the FTC abandonment
// rules there is no safe harbour for "we did not have a webhook".
//
// ── THE KEYWORD SET ─────────────────────────────────────────────────────────
// STOP, STOPALL, UNSUBSCRIBE, CANCEL, END and QUIT are the set the US carriers
// themselves honour and auto-respond to — Telnyx's own auto-response fired on
// exactly this list. Matching a WIDER set than the carriers do is deliberate on
// the safe side: treating "stop calling me" as an opt-out costs one lead;
// missing it costs a claim.

/** The keywords US carriers treat as opt-out and auto-respond to. */
const CARRIER_KEYWORDS = ['STOP', 'STOPALL', 'UNSUBSCRIBE', 'CANCEL', 'END', 'QUIT']

/**
 * Phrases a person actually types. Carriers do not honour these, which is
 * exactly why we must — a carrier auto-response is not the same as the caller
 * knowing to stop dialling.
 */
const HUMAN_PHRASES = [
  'STOP CALLING',
  'STOP TEXTING',
  'DO NOT CALL',
  'DONT CALL',
  "DON'T CALL",
  'REMOVE ME',
  'TAKE ME OFF',
  'OPT OUT',
  'OPTOUT',
  'LEAVE ME ALONE',
  'NO MORE CALLS',
]

export interface OptOutVerdict {
  optOut: boolean
  /** Which rule fired, for the suppression reason and the audit trail. */
  matched: string | null
}

/**
 * Does this inbound message body revoke consent?
 *
 * Deliberately generous. A false positive removes one lead from one list; a
 * false negative is a call to somebody who told you to stop, which is the
 * single most expensive mistake a dialer can make.
 */
export function isOptOut(body: string | null | undefined): OptOutVerdict {
  if (!body) return { optOut: false, matched: null }

  // Normalise hard: carriers and handsets add punctuation, smart quotes and
  // trailing whitespace, and "Stop." must match as surely as "STOP".
  const cleaned = body
    .toUpperCase()
    .replace(/[‘’]/g, "'")
    .replace(/[^A-Z' ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (!cleaned) return { optOut: false, matched: null }

  // A bare carrier keyword, alone, is the classic case. Checked as the WHOLE
  // message so "STOP" opts out but "don't stop sending me deals" does not.
  if (CARRIER_KEYWORDS.includes(cleaned)) {
    return { optOut: true, matched: cleaned }
  }

  // Phrases can sit anywhere in a longer message: people write paragraphs.
  for (const phrase of HUMAN_PHRASES) {
    if (cleaned.includes(phrase)) return { optOut: true, matched: phrase }
  }

  // A carrier keyword as the FIRST word of a longer message ("STOP please").
  const firstWord = cleaned.split(' ')[0]
  if (CARRIER_KEYWORDS.includes(firstWord)) {
    return { optOut: true, matched: firstWord }
  }

  return { optOut: false, matched: null }
}
