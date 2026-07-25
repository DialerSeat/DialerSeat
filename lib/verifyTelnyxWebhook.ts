import { NextResponse } from 'next/server'
import nacl from 'tweetnacl'

// =============================================================================
// TELNYX WEBHOOK AUTHENTICITY — Ed25519 signature verification
// =============================================================================
// SignalWire's setup (lib/verifyWebhook.ts) used a shared secret we invented
// ourselves, appended to the webhook URL as a query param. Telnyx does this
// natively and more strongly: every webhook is signed with Ed25519. Telnyx
// sends two headers:
//
//   telnyx-timestamp          — unix seconds when the webhook was sent
//   telnyx-signature-ed25519  — base64-encoded signature
//
// The signed message is the exact string `${timestamp}|${rawBody}` (pipe-
// separated, raw body BEFORE any JSON.parse — whitespace/key-order changes
// would break verification). We verify it against Telnyx's published
// public key (Mission Control Portal → Auth V2 → your Call Control
// Application's public key, or account-wide — confirm which at signup).
//
// WHY THIS MATTERS MORE HERE THAN IT DID FOR SIGNALWIRE:
//   The original SignalWire billing-discrepancy investigation (152 calls
//   logged vs 2 shown on our dashboard) was never conclusively resolved as
//   webhook forgery — but it's exactly the failure mode a forged webhook
//   would produce (fake "call completed" events inflating counters, or
//   fake "abandoned" events corrupting the FTC 30-day abandon-rate math).
//   Cryptographic signing closes that door outright, instead of relying on
//   a string nobody can prove wasn't leaked.
//
// SAFE ROLLOUT (same fail-open-until-configured shape as verifyWebhook.ts):
//   If TELNYX_PUBLIC_KEY is unset, verifyTelnyxWebhook() ALLOWS the request
//   and logs a warning, so handler code can ship before the key is wired up
//   in Vercel. Once the env var is set, an invalid/missing signature is
//   REJECTED with 403. Unlike the old shared-secret scheme there's no
//   "registration side" to keep in sync — Telnyx signs unconditionally on
//   their end the moment the key exists in their portal, independent of us.
// =============================================================================

const FAIL_OPEN_WHEN_UNSET = true

// Replay-attack guard: reject webhooks whose timestamp is further from now
// than this, even if the signature is otherwise valid. 5 minutes matches
// Telnyx's own documented recommendation.
const MAX_TIMESTAMP_SKEW_SECONDS = 5 * 60

function base64ToUint8Array(b64: string): Uint8Array {
  return new Uint8Array(Buffer.from(b64, 'base64'))
}

/**
 * Verifies a Telnyx webhook request against TELNYX_PUBLIC_KEY.
 *
 * IMPORTANT: must be called with the RAW request body text, read before any
 * JSON.parse — the signature is computed over the exact bytes Telnyx sent.
 * Route handlers should do:
 *
 *   const rawBody = await req.text()
 *   const bad = verifyTelnyxWebhook(req, rawBody)
 *   if (bad) return bad
 *   const body = JSON.parse(rawBody)
 *
 * Returns null if authentic (or fail-open with no key configured).
 * Returns a 403 NextResponse if the signature is configured and invalid.
 */
export function verifyTelnyxWebhook(req: Request, rawBody: string): NextResponse | null {
  const publicKeyB64 = process.env.TELNYX_PUBLIC_KEY

  if (!publicKeyB64) {
    if (FAIL_OPEN_WHEN_UNSET) {
      console.warn(
        '[verifyTelnyxWebhook] TELNYX_PUBLIC_KEY is not set — allowing webhook ' +
        'WITHOUT verification. Set the env var to enable enforcement.'
      )
      return null
    }
    console.error('[verifyTelnyxWebhook] TELNYX_PUBLIC_KEY not set and fail-closed mode on. Rejecting.')
    return NextResponse.json({ error: 'Webhook auth not configured' }, { status: 503 })
  }

  const signatureB64 = req.headers.get('telnyx-signature-ed25519')
  const timestampStr = req.headers.get('telnyx-timestamp')

  if (!signatureB64 || !timestampStr) {
    console.warn('[verifyTelnyxWebhook] rejected webhook missing signature/timestamp headers')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const timestamp = parseInt(timestampStr, 10)
  if (!Number.isFinite(timestamp)) {
    console.warn('[verifyTelnyxWebhook] rejected webhook with malformed timestamp')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const nowSeconds = Math.floor(Date.now() / 1000)
  if (Math.abs(nowSeconds - timestamp) > MAX_TIMESTAMP_SKEW_SECONDS) {
    console.warn(`[verifyTelnyxWebhook] rejected webhook — timestamp skew ${Math.abs(nowSeconds - timestamp)}s exceeds ${MAX_TIMESTAMP_SKEW_SECONDS}s (possible replay)`)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const signedMessage = `${timestampStr}|${rawBody}`
    const messageBytes = new TextEncoder().encode(signedMessage)
    const signatureBytes = base64ToUint8Array(signatureB64)
    const publicKeyBytes = base64ToUint8Array(publicKeyB64)

    const valid = nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes)
    if (!valid) {
      console.warn('[verifyTelnyxWebhook] rejected webhook — signature verification failed')
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  } catch (err) {
    console.error('[verifyTelnyxWebhook] verification threw, rejecting:', err)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  return null
}
