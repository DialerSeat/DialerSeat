// =============================================================================
// TELNYX CONFIG — one place that resolves and NORMALIZES every Telnyx env var
// =============================================================================
// WHY THIS FILE EXISTS
//
// The Telnyx env vars were being read raw, independently, in at least three
// places (lib/placeOutboundCall.ts, app/api/calls/events/route.ts's fanout
// agent dial, app/api/calls/sip-credentials/route.ts). Each one built the
// agent's SIP URI with its own `sip:${user}@${domain}` template string off
// whatever was in the environment, with no normalization — so a single
// mistyped value produced a different, differently-confusing failure in
// each path, and fixing one didn't fix the others.
//
// The concrete production failure this was written for: TELNYX_SIP_DOMAIN
// held an 11-character value with no dot in it (a connection NAME, not a
// domain). Every outbound dial returned 500 with Telnyx error 10016,
// "Phone number must be in +E164 format" — which is technically true (a
// malformed SIP URI isn't a SIP endpoint, so Telnyx falls back to
// complaining the `to` isn't a phone number) but points at entirely the
// wrong field. The agent leg is dialed BEFORE the lead leg, so this broke
// 100% of calls while the error text talked about phone number formatting.
//
// DESIGN DECISION — TELNYX_SIP_DOMAIN IS NOW OPTIONAL:
//   There is exactly one correct value per Telnyx region, and it is
//   published (see REGIONAL_SIP_DOMAINS below). Making the operator supply
//   a value that has one right answer is pure surface area for exactly the
//   bug above, so the domain now DEFAULTS to sip.telnyx.com and a value
//   that cannot be a real domain is discarded (loudly) rather than being
//   passed through to Telnyx to fail on. Set TELNYX_SIP_DOMAIN only to
//   pick a non-US region.
// =============================================================================

/**
 * Telnyx's published regional SIP domains. Credential connections register
 * against these, and `sip:<sip_username>@<one of these>` is the dialable
 * SIP endpoint for a registered WebRTC/softphone client.
 */
export const REGIONAL_SIP_DOMAINS = [
  'sip.telnyx.com',      // US
  'sip.telnyx.eu',       // Europe
  'sip.telnyx.com.au',   // Australia
  'sip.telnyx.ca',       // Canada
  'sip.telnyx.me',       // Middle East
  'sip.telnyx.asia',     // Asia (beta)
] as const

export const DEFAULT_SIP_DOMAIN = 'sip.telnyx.com'

/**
 * Telnyx's SIP-over-WebSocket port. NOT part of the SIP domain — the URI
 * `sip:user@sip.telnyx.com` is an identity and stays port-free, while the
 * transport address `wss://sip.telnyx.com:7443` is a network address. These
 * are different things that happen to share a hostname, which is why the
 * port lives here and never in TELNYX_SIP_DOMAIN.
 */
export const SIP_WSS_PORT = 7443

export interface TelnyxConfig {
  apiKey: string
  /** Call Control Application id — see the note in resolveTelnyxConfig. */
  connectionId: string
  sipUsername: string
  sipDomain: string
  appUrl: string
  /** `sip:<username>@<domain>` — the agent leg's dial target. */
  agentSipUri: string
  /** `wss://<domain>:7443` — the browser softphone's transport address. */
  sipWssUrl: string
  /** Webhook URL every call leg reports to. */
  webhookUrl: string
  /**
   * Non-fatal normalizations that were applied to the raw env values, in
   * human-readable form. Empty means everything was already well-formed.
   * Surfaced by /api/calls/diagnostics so a misconfiguration is visible
   * even when it was auto-corrected and calls are working.
   */
  warnings: string[]
}

export type TelnyxConfigResult =
  | { ok: true; config: TelnyxConfig }
  | { ok: false; errors: string[] }

/**
 * Strip everything that is legitimately part of a SIP URI but must NOT be
 * part of a bare hostname: scheme, userinfo, port, path, brackets, case.
 *
 * Every one of these is a real thing an operator pastes into a field
 * labelled "SIP domain", because Telnyx's portal shows the full URI
 * `sip:username@sip.telnyx.com` in several places and copying it wholesale
 * is the obvious move.
 */
function normalizeSipDomain(raw: string): string {
  let v = raw.trim()
  v = v.replace(/^sips?:/i, '')          // sip: / sips: scheme
  v = v.replace(/^.*@/, '')              // userinfo (user@ or user:pass@)
  v = v.replace(/[/?;].*$/, '')          // path / query / SIP uri-parameters
  v = v.replace(/:\d+$/, '')             // :7443, :5060, :5061
  v = v.replace(/^<|>$/g, '')            // angle brackets from a name-addr
  v = v.replace(/\.+$/, '')              // trailing dot(s)
  return v.toLowerCase()
}

/**
 * Extract the bare SIP username. Same rationale as normalizeSipDomain — if
 * the operator pasted the full URI here, we can recover the username AND
 * learn the real domain from it (returned separately so the caller can
 * prefer it over a bogus TELNYX_SIP_DOMAIN).
 */
function normalizeSipUsername(raw: string): { username: string; embeddedDomain: string | null } {
  let v = raw.trim()
  v = v.replace(/^sips?:/i, '')
  v = v.replace(/^<|>$/g, '')

  let embeddedDomain: string | null = null
  const atIdx = v.indexOf('@')
  if (atIdx !== -1) {
    const after = v.slice(atIdx + 1)
    v = v.slice(0, atIdx)
    const candidate = normalizeSipDomain(after)
    if (candidate.includes('.')) embeddedDomain = candidate
  }

  // A SIP username can't contain whitespace. Anything after a space is
  // contamination (a trailing display name, a stray copy artifact).
  v = v.split(/\s/)[0]
  return { username: v, embeddedDomain }
}

/**
 * Read an env var, treating the literal strings "undefined", "null" and ""
 * as unset.
 *
 * Not paranoia: a CI/deploy step that interpolates a missing value into an
 * env var writes the STRING "undefined", and JS's own
 * `process.env.X = undefined` does the same. Either way the value is
 * truthy, so a plain presence check passes and the bogus text flows all the
 * way to Telnyx — which is how you end up dialing
 * `sip:undefined@sip.telnyx.com` and getting an error about phone number
 * formatting. Catching it here turns that into a normal "not set" error
 * that names the variable.
 */
function readEnv(name: string): string | undefined {
  const v = process.env[name]?.trim()
  if (!v) return undefined
  if (v === 'undefined' || v === 'null') return undefined
  return v
}

function normalizeAppUrl(raw: string): string {
  let v = raw.trim().replace(/\/+$/, '')
  if (!/^https?:\/\//i.test(v)) v = `https://${v}`
  return v
}

/**
 * Resolve every Telnyx value the call paths need, normalized, with a single
 * consistent set of errors. Returns errors as a LIST (not the first one) so
 * a multi-variable misconfiguration is fixed in one pass instead of one
 * redeploy per variable.
 *
 * NOTE ON connectionId: `POST /v2/calls` (native Call Control, which is
 * what this app dials with) requires the id of a CALL CONTROL APPLICATION.
 * A TeXML Application id is a different resource in a different id space
 * and will not work here. lib/telnyxProvision.ts's comments still describe
 * TELNYX_CONNECTION_ID as a TeXML Application id — that's a leftover from
 * an earlier draft of the migration; the value must be a Call Control
 * Application. /api/calls/diagnostics verifies which one it actually is
 * against Telnyx's API rather than leaving it to comments.
 */
export function resolveTelnyxConfig(): TelnyxConfigResult {
  const errors: string[] = []
  const warnings: string[] = []

  const apiKey = readEnv('TELNYX_API_KEY')
  const connectionId = readEnv('TELNYX_CONNECTION_ID')
  const rawSipUsername = readEnv('TELNYX_SIP_USERNAME')
  const rawSipDomain = readEnv('TELNYX_SIP_DOMAIN')
  const rawAppUrl = readEnv('NEXT_PUBLIC_APP_URL')

  if (!apiKey) errors.push('TELNYX_API_KEY is not set')
  if (!connectionId) errors.push('TELNYX_CONNECTION_ID is not set (must be a Call Control Application id)')
  if (!rawSipUsername) errors.push('TELNYX_SIP_USERNAME is not set')
  if (!rawAppUrl) errors.push('NEXT_PUBLIC_APP_URL is not set')

  // ── SIP username ────────────────────────────────────────────────────────
  let sipUsername = ''
  let embeddedDomain: string | null = null
  if (rawSipUsername) {
    const parsed = normalizeSipUsername(rawSipUsername)
    sipUsername = parsed.username
    embeddedDomain = parsed.embeddedDomain
    if (sipUsername !== rawSipUsername) {
      warnings.push(
        `TELNYX_SIP_USERNAME was normalized — it should be the bare SIP username ` +
        `(e.g. "genericuser1234"), not a full SIP URI. Using "${sipUsername}".`
      )
    }
    if (!sipUsername) {
      errors.push('TELNYX_SIP_USERNAME contained no usable username after stripping the SIP URI wrapper')
    } else if (/^\d/.test(sipUsername)) {
      // Telnyx REQUIRES the user part of a SIP URI to begin with a
      // non-numeric character, explicitly to stop SIP users from being
      // confusable with phone numbers (their docs give 123456@sip.telnyx.com
      // as an invalid example). A digit-leading username is parsed as a
      // number rather than a SIP endpoint, and the rejection you get is
      // "Phone number must be in +E164 format" — which describes the
      // symptom perfectly and the cause not at all.
      //
      // This is a hard error rather than a warning because the resulting URI
      // provably cannot ever connect: failing here names the real reason,
      // instead of spending a Telnyx round trip to be told something
      // misleading about phone numbers.
      errors.push(
        `TELNYX_SIP_USERNAME ("${sipUsername}") starts with a digit. Telnyx rejects SIP URIs whose ` +
        `user part begins with a number — it parses sip:${sipUsername}@... as a phone number, which ` +
        `is why the dial fails with "must be in +E164 format". Use a SIP username starting with a ` +
        `letter (Telnyx-generated telephony credentials always do).`
      )
    }
  }

  // ── SIP domain ──────────────────────────────────────────────────────────
  // Precedence: an explicit, plausible TELNYX_SIP_DOMAIN wins; else a domain
  // recovered from a full-URI username; else the regional default. A value
  // with no dot in it cannot be a DNS name, so it is discarded rather than
  // sent to Telnyx to fail on — that exact case is what produced the
  // 10016 "must be in +E164 format" storm this module was written for.
  let sipDomain: string
  if (rawSipDomain) {
    const normalized = normalizeSipDomain(rawSipDomain)
    if (normalized !== rawSipDomain) {
      warnings.push(
        `TELNYX_SIP_DOMAIN was normalized from "${rawSipDomain}" to "${normalized}" ` +
        `— it should be a bare hostname, with no sip: scheme, no username@, and no :port.`
      )
    }
    if (normalized.includes('.')) {
      sipDomain = normalized
      if (!(REGIONAL_SIP_DOMAINS as readonly string[]).includes(sipDomain)) {
        warnings.push(
          `TELNYX_SIP_DOMAIN ("${sipDomain}") is not one of Telnyx's published regional ` +
          `SIP domains (${REGIONAL_SIP_DOMAINS.join(', ')}). Calls to the agent leg will ` +
          `fail unless this is a real domain that routes to your Telnyx credential connection.`
        )
      }
    } else {
      sipDomain = embeddedDomain || DEFAULT_SIP_DOMAIN
      warnings.push(
        `TELNYX_SIP_DOMAIN ("${normalized}") has no dot in it, so it cannot be a domain — ` +
        `it looks like a connection name or a placeholder. Ignoring it and using ` +
        `"${sipDomain}" instead. Fix the env var: for a US account the correct value is ` +
        `"${DEFAULT_SIP_DOMAIN}", or unset it entirely to use that default.`
      )
    }
  } else {
    sipDomain = embeddedDomain || DEFAULT_SIP_DOMAIN
  }

  // ── App URL ─────────────────────────────────────────────────────────────
  let appUrl = ''
  if (rawAppUrl) {
    appUrl = normalizeAppUrl(rawAppUrl)
    if (appUrl.startsWith('http://')) {
      warnings.push(
        `NEXT_PUBLIC_APP_URL is http://, so Telnyx cannot deliver webhooks to it ` +
        `(and the browser will refuse the microphone). Use https.`
      )
    }
    if (/localhost|127\.0\.0\.1/.test(appUrl)) {
      warnings.push(
        `NEXT_PUBLIC_APP_URL points at localhost, which Telnyx cannot reach — ` +
        `call.answered / call.hangup / AMD webhooks will never arrive, so calls will ` +
        `connect but never resolve in the UI. Use a public https URL (or a tunnel).`
      )
    }
  }

  if (errors.length > 0) return { ok: false, errors }

  return {
    ok: true,
    config: {
      apiKey: apiKey!,
      connectionId: connectionId!,
      sipUsername,
      sipDomain,
      appUrl,
      agentSipUri: `sip:${sipUsername}@${sipDomain}`,
      sipWssUrl: `wss://${sipDomain}:${SIP_WSS_PORT}`,
      webhookUrl: `${appUrl}/api/calls/events`,
      warnings,
    },
  }
}

/**
 * Resolve config and log the outcome once, in a consistent shape, from
 * whichever call path hit it first. Returns null (never throws) when the
 * config is unusable, so callers keep their existing "return an error
 * result" control flow.
 */
export function resolveTelnyxConfigOrLog(context: string): TelnyxConfig | null {
  const result = resolveTelnyxConfig()
  if (!result.ok) {
    console.error(`[telnyxConfig:${context}] Telnyx is not configured — ${result.errors.join('; ')}`)
    return null
  }
  for (const w of result.config.warnings) {
    console.warn(`[telnyxConfig:${context}] ${w}`)
  }
  return result.config
}
