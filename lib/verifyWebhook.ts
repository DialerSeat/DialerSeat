import { NextResponse } from 'next/server'

// =============================================================================
// WEBHOOK AUTHENTICITY — shared-secret check for SignalWire callbacks
// =============================================================================
// THE PROBLEM (Step 8):
//   The telephony webhooks (calls/status, calls/amd-result, calls/inbound,
//   calls/recording-status) accept unauthenticated POSTs and act on a CallSid
//   from the body. Anyone who guesses or observes a CallSid can forge a
//   callback — e.g. mark a call abandoned (corrupting the FTC abandon-rate
//   numbers), redirect a call, or disposition a lead. These routes are
//   necessarily PUBLIC (SignalWire must reach them with no Clerk session), so
//   we authenticate them with a shared secret instead.
//
// THE MECHANISM:
//   Every webhook URL we register with SignalWire gets a `?whk=<secret>` (or
//   `&whk=<secret>`) query param. SignalWire preserves the query string when it
//   calls back, so the handler can verify it. We compare in constant time.
//
//   The secret lives in SIGNALWIRE_WEBHOOK_SECRET (server-side env, NOT
//   NEXT_PUBLIC). It is the same value on the registration side
//   (placeOutboundCall, signalwireProvision, twiml) and the verification side
//   (the handlers), so they can never disagree.
//
// SAFE ROLLOUT (fail-open until configured):
//   If SIGNALWIRE_WEBHOOK_SECRET is UNSET, verifyWebhook() ALLOWS the request
//   and logs a warning. This means you can deploy the handler changes first
//   without breaking live calls, then add the env var + redeploy the
//   registration side, and only THEN does enforcement turn on. Once the env var
//   is set, a missing/wrong secret is REJECTED with 403.
//
//   ⚠️ After you've confirmed everything works WITH the secret set, you may
//   optionally flip FAIL_OPEN_WHEN_UNSET to false to hard-fail if the env var
//   ever goes missing in future. Leaving it true is fine and safer for now.
// =============================================================================

const FAIL_OPEN_WHEN_UNSET = true

/**
 * Constant-time string comparison to avoid timing side-channels.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return result === 0
}

/**
 * Verifies the `whk` query param on an incoming webhook request against
 * SIGNALWIRE_WEBHOOK_SECRET.
 *
 * Returns null if the request is authentic (or if the secret is unset and
 * FAIL_OPEN_WHEN_UNSET is true). Returns a 403 NextResponse if the secret is
 * configured and the request's whk is missing or wrong — the caller should
 * return that response immediately.
 *
 * Usage at the top of a webhook handler:
 *
 *   const bad = verifyWebhook(req)
 *   if (bad) return bad
 */
export function verifyWebhook(req: Request): NextResponse | null {
  const secret = process.env.SIGNALWIRE_WEBHOOK_SECRET

  if (!secret) {
    if (FAIL_OPEN_WHEN_UNSET) {
      console.warn(
        '[verifyWebhook] SIGNALWIRE_WEBHOOK_SECRET is not set — allowing webhook ' +
        'WITHOUT verification. Set the env var to enable enforcement.'
      )
      return null
    }
    // Hardened mode: no secret configured = refuse everything.
    console.error('[verifyWebhook] SIGNALWIRE_WEBHOOK_SECRET not set and fail-closed mode on. Rejecting.')
    return NextResponse.json({ error: 'Webhook auth not configured' }, { status: 503 })
  }

  let provided: string | null = null
  try {
    provided = new URL(req.url).searchParams.get('whk')
  } catch {
    provided = null
  }

  if (!provided || !timingSafeEqual(provided, secret)) {
    console.warn('[verifyWebhook] rejected webhook with missing/invalid whk param')
    // 403 with an empty-ish body. SignalWire will log the failure; we don't
    // want to leak anything about why.
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  return null
}

/**
 * Helper for the REGISTRATION side: appends the whk secret to a webhook URL,
 * choosing ? or & automatically. If the secret is unset, returns the URL
 * unchanged (so behavior is identical to today until you configure it).
 *
 *   webhookUrl(`${appUrl}/api/calls/status`)
 *     -> https://.../api/calls/status?whk=SECRET
 *   webhookUrl(`${appUrl}/api/calls/twiml?room=abc`)
 *     -> https://.../api/calls/twiml?room=abc&whk=SECRET
 */
export function webhookUrl(base: string): string {
  const secret = process.env.SIGNALWIRE_WEBHOOK_SECRET
  if (!secret) return base
  const sep = base.includes('?') ? '&' : '?'
  return `${base}${sep}whk=${encodeURIComponent(secret)}`
}