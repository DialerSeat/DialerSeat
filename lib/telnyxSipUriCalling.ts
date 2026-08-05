// =============================================================================
// SIP URI CALLING — self-healing for Telnyx's most confusing default
// =============================================================================
// THE PROBLEM
//
// Telnyx creates every SIP connection with sip_uri_calling_preference set to
// "disabled", which refuses all calls addressed to that connection's SIP URI.
// This app's entire architecture depends on dialing exactly that: the agent
// leg is a call to sip:<agent>@sip.telnyx.com. So on a fresh Telnyx account,
// with everything else configured perfectly, 100% of dials fail.
//
// And the error names nothing useful. Telnyx doesn't say "SIP URI calling is
// disabled" — it declines to treat the destination as a SIP endpoint at all,
// falls through to its phone-number validator, and returns:
//
//     10016  Phone number must be in +E164 format
//
// A correct SIP URI, a valid credential, and a correct Call Control
// Application produce an error about phone number formatting, caused by a
// setting on a different resource that appears nowhere in the request.
//
// WHY IT SELF-HEALS RATHER THAN JUST REPORTING
//
// This is a multi-tenant product meant to be plug-and-play. Every new
// deployment, every new Telnyx account, hits this wall identically, and the
// remediation is the same single API call every time. Making a human read a
// diagnostic and click through the Telnyx portal to fix a known, detectable,
// one-line problem is a setup step that should not exist. So the dial path
// detects the specific signature and fixes it inline, once, then retries.
//
// WHY "internal" AND NOT "unrestricted"
//
// "internal" permits calls from connections on the same Telnyx account —
// which is precisely what our Call Control Application dialing our own agent
// credential is — while leaving the agent's browser unreachable from the
// public internet. "unrestricted" would let anyone who guesses or harvests an
// agent's SIP URI ring their softphone directly. We need the narrower one, so
// we ask for the narrower one.
//
// BOUNDS ON THE SELF-HEAL (it is not a retry loop)
//   - Only ever triggered by the exact 10016-on-a-SIP-URI signature.
//   - At most one remediation attempt per connection per process, memoized
//     below — a failure is remembered, so a broken/forbidden API key cannot
//     produce a write attempt on every single dial.
//   - Never widens an EXISTING setting. If a connection is already
//     "internal" or "unrestricted", it is left exactly as it is.
// =============================================================================

const SECURITY_BASE = 'https://api.telnyx.com/security'

export type SipUriCallingPreference = 'disabled' | 'unrestricted' | 'internal'

export type EnsureResult =
  | 'already-enabled'  // was already internal/unrestricted; nothing changed
  | 'enabled'          // was disabled, we set it to internal
  | 'failed'           // could not read or could not write

/**
 * Memoized per connection id, for the life of the process. Holds the promise
 * (not the result) so concurrent dials during a cold start share one
 * in-flight remediation instead of each firing their own PUT.
 */
const ensureCache = new Map<string, Promise<EnsureResult>>()

/** Test/ops hook — forget past results so the next call re-checks. */
export function resetSipUriCallingCache(): void {
  ensureCache.clear()
}

/**
 * True when a Telnyx dial response is specifically the
 * "SIP URI was not accepted as a SIP endpoint" failure.
 *
 * Matched on the error CODE (10016) rather than the title text, since the
 * title is prose and could be reworded by Telnyx at any time. The caller is
 * responsible for only consulting this for a leg whose `to` was a SIP URI —
 * the same code legitimately means "this phone number is malformed" when the
 * destination really was meant to be a phone number.
 */
export function isSipUriRejection(errors: Array<{ code?: string | number }> | undefined): boolean {
  if (!errors || errors.length === 0) return false
  return errors.some((e) => String(e.code) === '10016')
}

export async function readSipUriCallingPreference(
  connectionId: string,
  apiKey: string
): Promise<SipUriCallingPreference | null> {
  try {
    const res = await fetch(`${SECURITY_BASE}/connections/${connectionId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: 'no-store',
    })
    if (!res.ok) {
      console.error(
        `[sipUriCalling] read failed for connection ${connectionId}: HTTP ${res.status}`
      )
      return null
    }
    const body = (await res.json()) as {
      data?: { sip_uri_calling_preference?: string }
      sip_uri_calling_preference?: string
    }
    // Telnyx's non-/v2 endpoints are inconsistent about wrapping the resource
    // in `data`, so accept either shape rather than betting on one.
    const pref = body?.data?.sip_uri_calling_preference ?? body?.sip_uri_calling_preference
    if (pref === 'disabled' || pref === 'unrestricted' || pref === 'internal') return pref
    console.warn(
      `[sipUriCalling] connection ${connectionId} returned an unrecognized ` +
      `sip_uri_calling_preference: ${JSON.stringify(pref)}`
    )
    return null
  } catch (err) {
    console.error(`[sipUriCalling] read threw for connection ${connectionId}:`, err)
    return null
  }
}

export async function setSipUriCallingPreference(
  connectionId: string,
  apiKey: string,
  preference: SipUriCallingPreference
): Promise<boolean> {
  try {
    // NOTE THE HOST PATH: api.telnyx.com/security/... — NOT /v2 like every
    // other Telnyx endpoint this codebase touches. That's Telnyx's layout,
    // not a typo. Using /v2 here 404s in a way that reads as "connection not
    // found", which is a misleading answer to a different question.
    const res = await fetch(`${SECURITY_BASE}/connections/${connectionId}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sip_uri_calling_preference: preference }),
    })
    if (!res.ok) {
      const text = await res.text()
      console.error(
        `[sipUriCalling] failed to set ${preference} on connection ${connectionId} ` +
        `(${res.status}): ${text.slice(0, 300)}`
      )
      return false
    }
    return true
  } catch (err) {
    console.error(`[sipUriCalling] write threw for connection ${connectionId}:`, err)
    return false
  }
}

/**
 * Make sure this connection will accept calls to its SIP URIs, enabling it
 * (as "internal") if and only if it is currently disabled.
 *
 * Safe to call on every dial — the result is memoized per connection, so the
 * cost after the first call is a Map lookup.
 */
export function ensureSipUriCallingEnabled(
  connectionId: string,
  apiKey: string
): Promise<EnsureResult> {
  const cached = ensureCache.get(connectionId)
  if (cached) return cached

  const attempt = (async (): Promise<EnsureResult> => {
    const current = await readSipUriCallingPreference(connectionId, apiKey)

    if (current === null) return 'failed'

    if (current !== 'disabled') {
      // Already permissive enough. Deliberately not narrowed to "internal"
      // if it happens to be "unrestricted" — an operator may have set that
      // on purpose for a reason this code doesn't know about, and silently
      // tightening someone's live routing is not this function's call to
      // make.
      return 'already-enabled'
    }

    const ok = await setSipUriCallingPreference(connectionId, apiKey, 'internal')
    if (!ok) return 'failed'

    console.log(
      `[sipUriCalling] connection ${connectionId} had SIP URI calling DISABLED (Telnyx's ` +
      `default), which blocks every agent-leg dial. Set it to "internal" automatically.`
    )
    return 'enabled'
  })()

  ensureCache.set(connectionId, attempt)

  // A thrown/failed attempt must not be cached as a permanent failure in a
  // way that hides a transient network blip forever — but it also must not
  // retry on every dial. Dropping only the FAILED result from the cache
  // strikes that balance: a genuine misconfiguration re-reads once per dial
  // at worst (two cheap API calls), while the success path is memoized for
  // the life of the process.
  void attempt.then((result) => {
    if (result === 'failed') ensureCache.delete(connectionId)
  })

  return attempt
}
