import { NextResponse, after } from 'next/server'
import nacl from 'tweetnacl'
import { sendAdminPush } from '@/lib/pushNotify'

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
// ENFORCEMENT: production never fails open. The key is set in Vercel, so the
//   rollout window this file was written during is over. An invalid or missing
//   signature is REJECTED with 403, and a MISSING KEY in production is rejected
//   with 503 rather than waved through — see below. Unlike the old
//   shared-secret scheme there's no "registration side" to keep in sync —
//   Telnyx signs unconditionally on their end the moment the key exists in
//   their portal, independent of us.
// =============================================================================

// ── PRODUCTION NEVER ACCEPTS AN UNVERIFIED CALL EVENT ──────────────────────
// This used to be a flat `FAIL_OPEN_WHEN_UNSET = true`: a missing key meant
// every webhook was waved through unverified. That was a deliberate migration
// convenience, and it was the right call while the key was still being wired
// up. It is the wrong call now that the key is set, because the state it
// permits is indistinguishable from a successful attack — forged "completed"
// events inflating counters, forged "abandoned" events corrupting the FTC
// abandon-rate math, which is a compliance number that would simply be wrong
// with nothing to indicate why.
//
// The condition is the ENVIRONMENT, not the key's presence. Keying it on the
// key means the protection disappears in exactly the scenario it exists for —
// the variable getting dropped, renamed, or lost in a project migration. Keying
// it on the environment means production rejects, loudly, and somebody finds
// out in minutes.
//
// Outside production it still fails open, so local development and preview
// deployments can exercise the handler without the key. Those environments do
// not receive real traffic; if you point Telnyx at a preview URL, give that
// environment the key.
const FAIL_OPEN_WHEN_UNSET = process.env.NODE_ENV !== 'production'

// The missing-key state alarms either way. In production it is now also a hard
// failure, but an alert still matters: a 503'd webhook shows up as calls that
// connect while every metric reads zero, which is a confusing thing to debug
// from the symptom end.
//
// Once an hour, not per webhook — this runs on every event of every call, and
// the point is to be noticed rather than to become the noise it warns about.
let lastUnsetAlarmMs = 0
const UNSET_ALARM_INTERVAL_MS = 60 * 60 * 1000

function alarmUnverified() {
  const now = Date.now()
  if (now - lastUnsetAlarmMs < UNSET_ALARM_INTERVAL_MS) return
  lastUnsetAlarmMs = now
  try {
    // after(), so a live call never waits on a push notification, and never
    // fails because of one.
    after(() =>
      sendAdminPush(
        'webhook_silence',
        'TELNYX_PUBLIC_KEY is not set. In production every call webhook is ' +
        'being REJECTED (503) — calls will connect but talk time, AMD and ' +
        'recordings will all read zero. Set it in Vercel, then redeploy.',
        { title: 'Call webhooks unverified' }
      ).catch(() => {})
    )
  } catch {
    // Outside a request scope, or push unavailable. The warn below still runs.
  }
}

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
 * Returns null if authentic. Returns 403 if the signature is missing, invalid,
 * or replayed. Returns 503 if the key is unset in production. Outside
 * production a missing key returns null (fail-open) so the handler can be
 * exercised without it.
 */
export function verifyTelnyxWebhook(req: Request, rawBody: string): NextResponse | null {
  const publicKeyB64 = process.env.TELNYX_PUBLIC_KEY

  if (!publicKeyB64) {
    if (FAIL_OPEN_WHEN_UNSET) {
      alarmUnverified()
      console.warn(
        '[verifyTelnyxWebhook] TELNYX_PUBLIC_KEY is not set — allowing webhook ' +
        'WITHOUT verification. Set the env var to enable enforcement.'
      )
      return null
    }
    alarmUnverified()
    console.error('[verifyTelnyxWebhook] TELNYX_PUBLIC_KEY not set in production. Rejecting webhook.')
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
