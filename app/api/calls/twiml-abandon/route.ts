import { NextRequest } from 'next/server'

// =============================================================================
// ABANDON NOTICE TWIML — FTC TSR § 310.4(b)(4) compliance
// =============================================================================
// When a predictive dial connects to a human but no agent is available
// (typical "predictive abandon" scenario), federal law requires us to play
// a pre-recorded message identifying the caller and indicating the call
// was for a sales/marketing purpose. We can't just silently hang up.
//
// 16 CFR § 310.4(b)(4)(iii):
//   The seller or telemarketer must, within two (2) seconds of the
//   completed greeting of the person called, play a recorded message
//   that states the name and telephone number of the seller on whose
//   behalf the call was placed.
//
// This endpoint returns TwiML that:
//   1. Plays a brief identification message (TTS via <Say>)
//   2. Hangs up the call
//
// The amd-result handler points an abandoned call's URL here instead of
// the normal /api/calls/twiml conference join.
//
// CALLER ID:
//   We say "DialerSeat" as a placeholder. When we launch under an LLC,
//   replace with the legal entity name. Phone number is dynamically
//   pulled from the request (the From= number SignalWire is calling out as).
//
// IMPORTANT — keep this message SHORT (< 4 seconds):
//   The 2-second TSR window is strict. Long messages = TSR violation.
//   Current script: ~12 words, ~3 seconds of TTS. Within limits.
// =============================================================================

// Quick XML escape for the From number (paranoia — should never contain
// special chars but defensive coding)
function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export async function POST(req: NextRequest) {
  return handleAbandon(req)
}

export async function GET(req: NextRequest) {
  // SignalWire sometimes fetches TwiML via GET — support both.
  return handleAbandon(req)
}

async function handleAbandon(req: NextRequest): Promise<Response> {
  // SignalWire posts form-urlencoded data including the From number.
  // We use that in the message so the recipient sees our caller ID.
  let fromNumber = ''
  try {
    if (req.method === 'POST') {
      const form = await req.formData()
      fromNumber = (form.get('From') as string) || ''
    } else {
      fromNumber = req.nextUrl.searchParams.get('From') || ''
    }
  } catch {
    // Best-effort — if we can't read From, the message still plays
    // without it. TSR doesn't require the number specifically, just
    // identification of the caller.
  }

  // Format the phone number for spoken TTS. "12015550123" reads better
  // as "+1, 201, 555, 0123" than as a run-on string.
  const spokenNumber = formatNumberForSpeech(fromNumber)
  const fallback = process.env.SIGNALWIRE_PHONE_NUMBER || ''
  const spokenFallback = formatNumberForSpeech(fallback)

  const phoneFragment = spokenNumber
    ? `You can reach us at ${spokenNumber}.`
    : spokenFallback
      ? `You can reach us at ${spokenFallback}.`
      : ''

  // The message itself. Brief, identifies caller, complies with TSR.
  // Voice "Polly.Joanna" is SignalWire's standard female English TTS.
  const message = escapeXml(
    `We apologize, this call was placed by DialerSeat regarding a sales offer. ` +
    `Our representative is unavailable. ${phoneFragment} Goodbye.`
  )

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">${message}</Say>
  <Hangup/>
</Response>`

  return new Response(twiml, {
    status: 200,
    headers: {
      'Content-Type': 'text/xml',
      'Cache-Control': 'no-store',
    },
  })
}

// Formats "+12015550123" → "+1, 201, 555, 0123" for cleaner TTS.
// Returns empty string if input doesn't look like a valid number.
function formatNumberForSpeech(raw: string): string {
  if (!raw) return ''
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 11 && digits.startsWith('1')) {
    // North American: +1 AAA BBB CCCC
    return `plus 1, ${digits.slice(1, 4)}, ${digits.slice(4, 7)}, ${digits.slice(7)}`
  }
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}, ${digits.slice(3, 6)}, ${digits.slice(6)}`
  }
  // Unknown format — just speak the digits in groups of 3
  return digits.replace(/(.{3})/g, '$1, ').trim().replace(/,$/, '')
}