import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/requireAdmin'
import { supabaseAdmin } from '@/lib/supabase'
import { apiError } from '@/lib/apiError'
import {
  resolveTelnyxConfig,
  REGIONAL_SIP_DOMAINS,
  DEFAULT_SIP_DOMAIN,
  type TelnyxConfig,
} from '@/lib/telnyxConfig'
import { resolveCredentialConnectionId } from '@/lib/agentSipCredentials'

// =============================================================================
// TELNYX DIAGNOSTICS — verify the account config against Telnyx's own API
// =============================================================================
// WHY THIS EXISTS
//
// Every Telnyx setting this app depends on lives in Vercel env vars, and
// every way of getting one wrong surfaces as the same thing: a 500 from
// /api/calls/outbound with a Telnyx error string that describes a symptom
// rather than the cause. The worst example, and the one that motivated this
// route: a bad TELNYX_SIP_DOMAIN produced "Phone number must be in +E164
// format" on every single dial — an error entirely about phone numbers,
// raised because a malformed SIP URI isn't recognized as a SIP endpoint so
// Telnyx falls through to its phone-number validator. Nothing in that
// message points at SIP config, and the failing leg is the AGENT's, not the
// lead's, so the natural next step (staring at the lead's phone number) is
// wasted effort.
//
// Debugging that from the outside meant: change one env var, redeploy, dial,
// read Vercel logs, repeat. This route collapses that loop into one request
// by asking Telnyx directly what our account actually looks like, and
// comparing it to what the code requires.
//
// SECRETS: nothing secret is ever returned. API keys and SIP passwords are
// reported as presence + length only. Connection ids and SIP usernames are
// account identifiers, not credentials, and are shown because they're the
// values being diagnosed. Admin-gated regardless.
//
// USAGE
//   GET  /api/calls/diagnostics        — read-only config audit, no calls placed
//   POST /api/calls/diagnostics        — the above, plus a LIVE agent-leg ring
//                                        test (places a real call to the
//                                        agent's SIP endpoint, then hangs it
//                                        up). Costs a few seconds of a call.
// =============================================================================

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type CheckStatus = 'pass' | 'fail' | 'warn' | 'skip'

interface Check {
  id: string
  label: string
  status: CheckStatus
  detail: string
  /** Concrete, do-this-next remediation. Only set when status isn't 'pass'. */
  fix?: string
}

const TELNYX_BASE = 'https://api.telnyx.com/v2'

interface TelnyxApiError {
  code?: string | number
  title?: string
  detail?: string
}

/**
 * Only the fields this route actually reads. Telnyx returns considerably
 * more on each of these resources; typing the whole surface would be a
 * maintenance burden for no benefit, and everything here is optional
 * because the point of a diagnostics route is to behave sanely when the
 * response is NOT the shape we expect.
 */
interface TelnyxBody {
  data?: unknown
  errors?: TelnyxApiError[]
}

interface TelnyxCallControlApp {
  application_name?: string
  webhook_event_url?: string
}

interface TelnyxTexmlApp {
  friendly_name?: string
}

interface TelnyxConnection {
  record_type?: string
}

interface TelnyxCredential {
  id?: string
  name?: string
  sip_username?: string
  connection_id?: string
  resource_id?: string
  expired?: boolean
}

interface TelnyxOutboundProfile {
  name?: string
  whitelisted_destinations?: string[]
}

interface TelnyxPhoneNumber {
  phone_number?: string
}

interface TelnyxGetResult {
  status: number
  ok: boolean
  body: TelnyxBody | null
  error?: string
}

async function telnyxGet(path: string, apiKey: string): Promise<TelnyxGetResult> {
  try {
    const res = await fetch(`${TELNYX_BASE}${path}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: 'no-store',
    })
    const text = await res.text()
    let body: TelnyxBody | null = null
    try {
      body = text ? (JSON.parse(text) as TelnyxBody) : null
    } catch {
      // Non-JSON response (an HTML error page from a proxy, say). Keep the
      // status; the caller reports it as an unexpected response.
      body = null
    }
    return { status: res.status, ok: res.ok, body }
  } catch (err) {
    return {
      status: 0,
      ok: false,
      body: null,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

/** Narrow a Telnyx list response's `data` to an array of the expected item. */
function listOf<T>(r: TelnyxGetResult): T[] {
  return Array.isArray(r.body?.data) ? (r.body.data as T[]) : []
}

/** Narrow a Telnyx single-resource response's `data`. */
function itemOf<T>(r: TelnyxGetResult): T | null {
  const d = r.body?.data
  return d && typeof d === 'object' && !Array.isArray(d) ? (d as T) : null
}

function formatErrors(errs: TelnyxApiError[] | undefined): string {
  if (!errs || errs.length === 0) return ''
  return errs.map((e) => `${e.code ?? '?'} ${e.title ?? 'error'}`).join('; ')
}

function telnyxErrorSummary(r: TelnyxGetResult): string {
  if (r.error) return `network error: ${r.error}`
  return formatErrors(r.body?.errors) || `HTTP ${r.status}`
}

// =============================================================================
// SIP URI CALLING PREFERENCE
// =============================================================================
// NOTE THE HOST PATH: this setting lives at api.telnyx.com/security/... — NOT
// under /v2 like every other endpoint in this codebase. That is Telnyx's
// layout, not a typo. Getting it wrong returns a 404 that looks like "the
// connection doesn't exist", which is a misleading answer to a different
// question, so it's isolated in these two helpers rather than being open-
// coded next to the /v2 calls.
// =============================================================================

type SipUriCallingPreference = 'disabled' | 'unrestricted' | 'internal'

const SECURITY_BASE = 'https://api.telnyx.com/security'

async function readSipUriCallingPreference(
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
        `[calls/diagnostics] could not read sip_uri_calling_preference for ${connectionId}: HTTP ${res.status}`
      )
      return null
    }
    const body = (await res.json()) as {
      data?: { sip_uri_calling_preference?: string }
      sip_uri_calling_preference?: string
    }
    // Telnyx's non-v2 endpoints are inconsistent about whether the resource
    // is wrapped in `data`, so accept either rather than guessing.
    const pref = body?.data?.sip_uri_calling_preference ?? body?.sip_uri_calling_preference
    if (pref === 'disabled' || pref === 'unrestricted' || pref === 'internal') return pref
    return null
  } catch (err) {
    console.error(`[calls/diagnostics] sip_uri_calling_preference read threw for ${connectionId}:`, err)
    return null
  }
}

async function setSipUriCallingPreference(
  connectionId: string,
  apiKey: string,
  preference: SipUriCallingPreference
): Promise<boolean> {
  try {
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
        `[calls/diagnostics] failed to set sip_uri_calling_preference=${preference} on ${connectionId} ` +
        `(${res.status}): ${text.slice(0, 300)}`
      )
      return false
    }
    console.log(
      `[calls/diagnostics] set sip_uri_calling_preference=${preference} on connection ${connectionId}`
    )
    return true
  } catch (err) {
    console.error(`[calls/diagnostics] sip_uri_calling_preference write threw for ${connectionId}:`, err)
    return false
  }
}

export async function GET() {
  return runDiagnostics({ ringTest: false })
}

export async function POST() {
  return runDiagnostics({ ringTest: true })
}

async function runDiagnostics(opts: { ringTest: boolean }) {
  try {
    const gate = await requireAdmin()
    if (!gate.ok) {
      return NextResponse.json({ success: false, error: gate.message }, { status: gate.status })
    }

    const checks: Check[] = []

    // ── 1. CONFIG RESOLUTION ────────────────────────────────────────────────
    const resolved = resolveTelnyxConfig()

    if (!resolved.ok) {
      checks.push({
        id: 'env',
        label: 'Required Telnyx env vars',
        status: 'fail',
        detail: resolved.errors.join('; '),
        fix: 'Set the listed variables in Vercel → Project → Settings → Environment Variables, then redeploy.',
      })
      // Nothing downstream can be checked without at least an API key.
      return NextResponse.json({
        success: false,
        summary: summarize(checks),
        checks,
        config: null,
      })
    }

    const config = resolved.config

    checks.push({
      id: 'env',
      label: 'Required Telnyx env vars',
      status: 'pass',
      detail: 'All required variables are present.',
    })

    if (config.warnings.length > 0) {
      checks.push({
        id: 'env-normalization',
        label: 'Env var formatting',
        status: 'warn',
        detail: config.warnings.join(' | '),
        fix:
          'These values were auto-corrected at runtime so calls can work, but fix them at ' +
          'the source so the corrected value is what is actually stored.',
      })
    } else {
      checks.push({
        id: 'env-normalization',
        label: 'Env var formatting',
        status: 'pass',
        detail: 'All values were already well-formed; no normalization needed.',
      })
    }

    // ── 2. API KEY ──────────────────────────────────────────────────────────
    // Cheapest authenticated call that proves the key works. A 401 here is
    // the difference between "the variable is set" and "the variable is
    // set to something Telnyx accepts" — two failure modes that a presence
    // check alone cannot tell apart.
    const whoami = await telnyxGet('/phone_numbers?page[size]=1', config.apiKey)
    if (whoami.status === 401 || whoami.status === 403) {
      checks.push({
        id: 'api-key',
        label: 'TELNYX_API_KEY is valid',
        status: 'fail',
        detail: `Telnyx rejected the key (${telnyxErrorSummary(whoami)}). Key length: ${config.apiKey.length}.`,
        fix: 'Telnyx Mission Control → API Keys. Create/copy a V2 key and update TELNYX_API_KEY, then redeploy.',
      })
      return NextResponse.json({
        success: false,
        summary: summarize(checks),
        checks,
        config: publicConfig(config),
      })
    }
    if (!whoami.ok) {
      checks.push({
        id: 'api-key',
        label: 'TELNYX_API_KEY is valid',
        status: 'warn',
        detail: `Unexpected response probing the API: ${telnyxErrorSummary(whoami)}.`,
      })
    } else {
      checks.push({
        id: 'api-key',
        label: 'TELNYX_API_KEY is valid',
        status: 'pass',
        detail: `Authenticated successfully (key length ${config.apiKey.length}).`,
      })
    }

    // ── 3. CONNECTION ID TYPE ───────────────────────────────────────────────
    // POST /v2/calls requires a CALL CONTROL APPLICATION id. TeXML
    // Applications and SIP Connections are separate resources with their own
    // ids, and passing one of those is a real, easy mistake — the portal
    // shows all of them side by side under similar-sounding names. Rather
    // than trusting a code comment (lib/telnyxProvision.ts still describes
    // this same variable as a TeXML Application id, which is wrong), ask
    // Telnyx which resource the id actually is.
    const [ccApp, texmlApp, sipConn] = await Promise.all([
      telnyxGet(`/call_control_applications/${config.connectionId}`, config.apiKey),
      telnyxGet(`/texml_applications/${config.connectionId}`, config.apiKey),
      telnyxGet(`/connections/${config.connectionId}`, config.apiKey),
    ])

    let callControlWebhookUrl: string | null = null

    if (ccApp.ok) {
      const app = itemOf<TelnyxCallControlApp>(ccApp)
      callControlWebhookUrl = app?.webhook_event_url ?? null
      checks.push({
        id: 'connection-type',
        label: 'TELNYX_CONNECTION_ID is a Call Control Application',
        status: 'pass',
        detail: `"${app?.application_name || config.connectionId}" — correct resource type for POST /v2/calls.`,
      })
    } else if (texmlApp.ok) {
      checks.push({
        id: 'connection-type',
        label: 'TELNYX_CONNECTION_ID is a Call Control Application',
        status: 'fail',
        detail:
          `This id is a TeXML Application ("${itemOf<TelnyxTexmlApp>(texmlApp)?.friendly_name || config.connectionId}"), ` +
          `not a Call Control Application. This app dials with native Call Control (POST /v2/calls), ` +
          `which will not accept a TeXML Application id.`,
        fix:
          'Telnyx Mission Control → Voice → Call Control → create (or open) a Call Control Application, ' +
          'copy its ID, and set TELNYX_CONNECTION_ID to that.',
      })
    } else if (sipConn.ok) {
      checks.push({
        id: 'connection-type',
        label: 'TELNYX_CONNECTION_ID is a Call Control Application',
        status: 'fail',
        detail:
          `This id is a SIP Connection (record type "${itemOf<TelnyxConnection>(sipConn)?.record_type || 'connection'}"), ` +
          `not a Call Control Application. The SIP connection is where the agent's browser REGISTERS; ` +
          `it is not what places calls.`,
        fix:
          'Telnyx Mission Control → Voice → Call Control → your Call Control Application → copy its ID ' +
          'into TELNYX_CONNECTION_ID. Keep the SIP connection separate — it backs TELNYX_SIP_USERNAME.',
      })
    } else {
      checks.push({
        id: 'connection-type',
        label: 'TELNYX_CONNECTION_ID is a Call Control Application',
        status: 'fail',
        detail: `No Call Control Application, TeXML Application, or SIP Connection on this account has id "${config.connectionId}".`,
        fix: 'Verify the id was copied in full from Telnyx Mission Control, and that TELNYX_API_KEY belongs to the same Telnyx account.',
      })
    }

    // ── 4. WEBHOOK URL ──────────────────────────────────────────────────────
    // This app sets webhook_url per-call, which overrides the application's
    // own setting, so a mismatch here is not fatal — but a Call Control app
    // pointed somewhere else entirely is a strong sign the wrong
    // application is configured, and it matters for any event Telnyx sends
    // outside a call we placed.
    if (callControlWebhookUrl && callControlWebhookUrl !== config.webhookUrl) {
      checks.push({
        id: 'webhook-url',
        label: 'Call Control Application webhook URL',
        status: 'warn',
        detail: `App is set to "${callControlWebhookUrl}", this deployment expects "${config.webhookUrl}". Per-call webhook_url overrides it for calls we place, so this is not fatal.`,
        fix: `Set the application's webhook URL to ${config.webhookUrl} so out-of-band events (e.g. inbound calls) reach this deployment too.`,
      })
    } else if (callControlWebhookUrl) {
      checks.push({
        id: 'webhook-url',
        label: 'Call Control Application webhook URL',
        status: 'pass',
        detail: callControlWebhookUrl,
      })
    }

    // ── 5. SIP CREDENTIAL / AGENT ENDPOINT ──────────────────────────────────
    // The agent leg is dialed at sip:<TELNYX_SIP_USERNAME>@<sip domain>.
    // That only rings anything if a credential connection or telephony
    // credential on this account actually owns that username.
    const creds = await telnyxGet('/telephony_credentials?page[size]=250', config.apiKey)
    const credList = listOf<TelnyxCredential>(creds)
    const matchingCred = credList.find((c) => c.sip_username === config.sipUsername)

    if (matchingCred) {
      checks.push({
        id: 'sip-username',
        label: 'TELNYX_SIP_USERNAME exists on this account',
        status: matchingCred.expired ? 'fail' : 'pass',
        detail: matchingCred.expired
          ? `Telephony credential "${matchingCred.name || matchingCred.id}" matches, but Telnyx reports it as EXPIRED.`
          : `Matches telephony credential "${matchingCred.name || matchingCred.id}" (connection ${matchingCred.connection_id || matchingCred.resource_id || 'unknown'}).`,
        fix: matchingCred.expired
          ? 'Telnyx Mission Control → Voice → Telephony Credentials → regenerate or extend this credential.'
          : undefined,
      })
    } else if (!creds.ok) {
      checks.push({
        id: 'sip-username',
        label: 'TELNYX_SIP_USERNAME exists on this account',
        status: 'warn',
        detail: `Could not list telephony credentials (${telnyxErrorSummary(creds)}). If your SIP user is defined directly on a Credential Connection rather than as a telephony credential, that is expected — the ring test below is the authoritative check.`,
      })
    } else {
      checks.push({
        id: 'sip-username',
        label: 'TELNYX_SIP_USERNAME exists on this account',
        status: 'warn',
        detail:
          `No telephony credential on this account has sip_username "${config.sipUsername}" ` +
          `(${credList.length} credential(s) checked). This is only conclusive if you provision the ` +
          `agent endpoint as a Telephony Credential; a username defined directly on a Credential ` +
          `Connection will not appear in this list.`,
        fix:
          'Confirm the username in Telnyx Mission Control → Voice → SIP Connections → your credential ' +
          'connection → Credentials, or run the ring test (POST to this endpoint) to test it for real.',
      })
    }

    // ── 5b. PER-AGENT SIP CREDENTIALS ───────────────────────────────────────
    // A single shared SIP username means the server cannot address one
    // specific agent — Telnyx forks the INVITE to every registered browser.
    // Invisible with one agent, actively wrong with two. See
    // lib/agentSipCredentials.ts.
    const credentialConnectionId = await resolveCredentialConnectionId(config)
    const { count: provisionedCount, error: provisionedErr } = await supabaseAdmin
      .from('agent_sip_credentials')
      .select('id', { count: 'exact', head: true })

    if (provisionedErr) {
      checks.push({
        id: 'per-agent-credentials',
        label: 'Per-agent SIP credentials',
        status: 'fail',
        detail: `Could not read agent_sip_credentials: ${provisionedErr.message}. Every agent will fall back to the shared SIP user, which rings all registered browsers for every call.`,
        fix: 'Apply db/migrations/2026-08-05-add-agent-sip-credentials.sql.',
      })
    } else if (!credentialConnectionId) {
      checks.push({
        id: 'per-agent-credentials',
        label: 'Per-agent SIP credentials',
        status: 'fail',
        detail:
          'No parent SIP connection could be determined, so per-agent credentials cannot be provisioned ' +
          `and every agent falls back to the shared SIP user "${config.sipUsername}". ` +
          `${provisionedCount ?? 0} agent(s) currently provisioned.`,
        fix: 'Set TELNYX_CREDENTIAL_CONNECTION_ID to the id of the Telnyx SIP (credential) connection your agents register against.',
      })
    } else {
      checks.push({
        id: 'per-agent-credentials',
        label: 'Per-agent SIP credentials',
        status: (provisionedCount ?? 0) > 0 ? 'pass' : 'warn',
        detail:
          `Parent SIP connection ${credentialConnectionId}. ` +
          `${provisionedCount ?? 0} agent(s) provisioned — each is created automatically the first ` +
          `time that agent's browser registers, so this grows on its own as people use the dialer.`,
        fix:
          (provisionedCount ?? 0) > 0
            ? undefined
            : 'Not an error, just nobody has opened the dialer yet since this shipped. Open the dialer once to provision your own.',
      })
    }

    // ── 5c. SIP URI CALLING (the setting that silently blocks everything) ───
    // Telnyx ships every connection with sip_uri_calling_preference =
    // "disabled", which refuses ALL calls addressed to that connection's SIP
    // URI. The rejection is not "SIP URI calling is disabled" — Telnyx
    // declines to treat the destination as a SIP endpoint at all, falls
    // through to its phone-number validator, and returns
    // 10016 "Phone number must be in +E164 format".
    //
    // So a perfectly-formed sip:user@sip.telnyx.com, a valid credential, and
    // a correct Call Control Application all produce an error message about
    // phone number formatting. There is nothing in that error, or in the
    // request, pointing at an account setting on a different resource.
    //
    // "internal" is the right value here, not "unrestricted": it permits
    // calls from connections on this same Telnyx account (which is exactly
    // what our Call Control Application dialing our own agent credential
    // is) while keeping the agent's browser unreachable from the public
    // internet. "unrestricted" would let anyone who guesses an agent's SIP
    // URI ring their softphone directly.
    const sipUriPrefTarget = credentialConnectionId || config.connectionId
    let sipUriPref = await readSipUriCallingPreference(sipUriPrefTarget, config.apiKey)
    let sipUriPrefFixed = false

    if (opts.ringTest && sipUriPref === 'disabled') {
      // POST is the "do something" verb and already places a real call, so
      // remediate here rather than making this a second manual step.
      const set = await setSipUriCallingPreference(sipUriPrefTarget, config.apiKey, 'internal')
      if (set) {
        sipUriPrefFixed = true
        sipUriPref = 'internal'
      }
    }

    if (sipUriPref === null) {
      checks.push({
        id: 'sip-uri-calling',
        label: 'SIP URI calling enabled on the agent connection',
        status: 'warn',
        detail: `Could not read sip_uri_calling_preference for connection ${sipUriPrefTarget}.`,
        fix: 'Telnyx Mission Control → SIP Connections → edit → Authentication and routing → "Receive SIP URI calls" → set to "Only from my Connections".',
      })
    } else if (sipUriPref === 'disabled') {
      checks.push({
        id: 'sip-uri-calling',
        label: 'SIP URI calling enabled on the agent connection',
        status: 'fail',
        detail:
          `Connection ${sipUriPrefTarget} has sip_uri_calling_preference = "disabled" (Telnyx's default). ` +
          `This blocks every call to ${config.agentSipUri}, and Telnyx reports it as ` +
          `10016 "Phone number must be in +E164 format" rather than as a blocked SIP URI — ` +
          `which is almost certainly the error you are seeing on every dial.`,
        fix: 'POST to this endpoint to set it to "internal" automatically, or set it in Telnyx Mission Control → SIP Connections → Authentication and routing → "Receive SIP URI calls" → "Only from my Connections".',
      })
    } else {
      checks.push({
        id: 'sip-uri-calling',
        label: 'SIP URI calling enabled on the agent connection',
        status: sipUriPref === 'unrestricted' ? 'warn' : 'pass',
        detail:
          `Connection ${sipUriPrefTarget} has sip_uri_calling_preference = "${sipUriPref}"` +
          `${sipUriPrefFixed ? ' (just set automatically by this request)' : ''}.`,
        fix:
          sipUriPref === 'unrestricted'
            ? 'Works, but "unrestricted" lets anyone on the public internet who knows an agent\'s SIP URI ring their browser directly. "internal" allows your own connections only, which is all this app needs.'
            : undefined,
      })
    }

    // ── 6. SIP DOMAIN ───────────────────────────────────────────────────────
    checks.push({
      id: 'sip-domain',
      label: 'SIP domain',
      status: (REGIONAL_SIP_DOMAINS as readonly string[]).includes(config.sipDomain) ? 'pass' : 'warn',
      detail: `Agent endpoint resolves to ${config.agentSipUri}; browser registers at ${config.sipWssUrl}.`,
      fix: (REGIONAL_SIP_DOMAINS as readonly string[]).includes(config.sipDomain)
        ? undefined
        : `"${config.sipDomain}" is not one of Telnyx's regional SIP domains (${REGIONAL_SIP_DOMAINS.join(', ')}). For a US account, unset TELNYX_SIP_DOMAIN or set it to ${DEFAULT_SIP_DOMAIN}.`,
    })

    // ── 7. SIP PASSWORD ─────────────────────────────────────────────────────
    const sipPassword = process.env.TELNYX_SIP_PASSWORD?.trim()
    checks.push({
      id: 'sip-password',
      label: 'TELNYX_SIP_PASSWORD is set',
      status: sipPassword ? 'pass' : 'fail',
      detail: sipPassword
        ? `Present (length ${sipPassword.length}). Served only to signed-in users via /api/calls/sip-credentials.`
        : 'Not set — the agent\'s browser cannot register, so there will be no call audio in either direction.',
      fix: sipPassword ? undefined : 'Copy the password from your Telnyx credential connection into TELNYX_SIP_PASSWORD.',
    })

    // ── 8. OUTBOUND VOICE PROFILE ───────────────────────────────────────────
    // Without a profile attached to the connection, Telnyx rejects outbound
    // calls outright; with one scoped to the wrong countries it rejects
    // specific destinations with the D13 whitelist error that
    // placeOutboundCall.ts special-cases.
    const ovp = await telnyxGet('/outbound_voice_profiles?page[size]=50', config.apiKey)
    const ovpList = listOf<TelnyxOutboundProfile>(ovp)
    if (!ovp.ok) {
      checks.push({
        id: 'outbound-profile',
        label: 'Outbound Voice Profile exists',
        status: 'warn',
        detail: `Could not list outbound voice profiles (${telnyxErrorSummary(ovp)}).`,
      })
    } else if (ovpList.length === 0) {
      checks.push({
        id: 'outbound-profile',
        label: 'Outbound Voice Profile exists',
        status: 'fail',
        detail: 'This account has no Outbound Voice Profile, so Telnyx will reject every outbound call.',
        fix: 'Telnyx Mission Control → Voice → Outbound Voice Profiles → create one and attach it to your Call Control Application.',
      })
    } else {
      const destinations = ovpList
        .map((p) => `${p.name}: ${(p.whitelisted_destinations || []).join(',') || 'none listed'}`)
        .join(' | ')
      checks.push({
        id: 'outbound-profile',
        label: 'Outbound Voice Profile exists',
        status: 'pass',
        detail: `${ovpList.length} profile(s). Whitelisted destinations — ${destinations}. A destination missing here is what produces Telnyx's D13 "not included in whitelisted countries" rejection.`,
      })
    }

    // ── 9. CALLER ID NUMBERS ────────────────────────────────────────────────
    const attached = await telnyxGet(
      `/phone_numbers?filter[connection_id]=${encodeURIComponent(config.connectionId)}&page[size]=50`,
      config.apiKey
    )
    const attachedList = listOf<TelnyxPhoneNumber>(attached)
    checks.push({
      id: 'numbers-attached',
      label: 'Phone numbers attached to the Call Control Application',
      status: attachedList.length > 0 ? 'pass' : 'warn',
      detail:
        attachedList.length > 0
          ? `${attachedList.length} number(s) attached, e.g. ${attachedList.slice(0, 3).map((n) => n.phone_number).join(', ')}.`
          : 'No Telnyx numbers are attached to this connection. Outbound may still work if the from-number is owned by the account, but inbound routing to this app will not.',
      fix:
        attachedList.length > 0
          ? undefined
          : 'Telnyx Mission Control → Numbers → My Numbers → set each number\'s Connection to your Call Control Application.',
    })

    // The from-number actually used when the pool is empty.
    const fallbackNumber = process.env.TELNYX_PHONE_NUMBER?.trim()
    const { count: poolCount } = await supabaseAdmin
      .from('phone_numbers')
      .select('id', { count: 'exact', head: true })

    checks.push({
      id: 'from-number',
      label: 'A caller-ID number is available',
      status: (poolCount || 0) > 0 || fallbackNumber ? 'pass' : 'fail',
      detail: `Number pool rows: ${poolCount ?? 0}. TELNYX_PHONE_NUMBER fallback: ${fallbackNumber || 'not set'}.`,
      fix:
        (poolCount || 0) > 0 || fallbackNumber
          ? undefined
          : 'Add numbers to the pool (admin → numbers) or set TELNYX_PHONE_NUMBER. Without either, every dial fails with "No phone numbers available in pool".',
    })

    // ── 10. WEBHOOK SIGNATURE VERIFICATION ──────────────────────────────────
    const publicKey = process.env.TELNYX_PUBLIC_KEY?.trim()
    checks.push({
      id: 'webhook-signing',
      label: 'TELNYX_PUBLIC_KEY (webhook signature verification)',
      status: publicKey ? 'pass' : 'warn',
      detail: publicKey
        ? `Set (length ${publicKey.length}); webhooks are verified.`
        : 'Not set — lib/verifyTelnyxWebhook.ts fails OPEN, so anyone who knows the webhook URL can post fake call events.',
      fix: publicKey ? undefined : 'Telnyx Mission Control → Account → Keys & Credentials → copy the public key into TELNYX_PUBLIC_KEY.',
    })

    // ── 11. LIVE AGENT-LEG RING TEST (POST only) ────────────────────────────
    // The authoritative test. Everything above infers; this actually asks
    // Telnyx to dial the exact SIP URI the dialer dials, in isolation from
    // the lead leg, so a failure is unambiguously about the agent endpoint.
    let ringTest: Record<string, unknown> | null = null
    if (opts.ringTest) {
      const fromNumber =
        fallbackNumber ||
        attachedList[0]?.phone_number ||
        (
          await supabaseAdmin.from('phone_numbers').select('phone_number').limit(1).maybeSingle()
        ).data?.phone_number

      if (!fromNumber) {
        checks.push({
          id: 'ring-test',
          label: 'Live agent-leg ring test',
          status: 'skip',
          detail: 'Skipped — no caller-ID number available to dial from.',
        })
      } else {
        const res = await fetch(`${TELNYX_BASE}/calls`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${config.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            connection_id: config.connectionId,
            to: config.agentSipUri,
            from: fromNumber,
            webhook_url: config.webhookUrl,
            timeout_secs: 15,
          }),
        })
        const body: TelnyxBody | null = await res.json().catch(() => null)
        const callData = body?.data as { call_control_id?: string } | undefined
        const callControlId = callData?.call_control_id

        ringTest = {
          dialed: config.agentSipUri,
          from: fromNumber,
          httpStatus: res.status,
          telnyxErrors: body?.errors ?? null,
          callControlId: callControlId ?? null,
        }

        if (callControlId) {
          // Accepted by Telnyx. Hang it up immediately — the point was to
          // prove the URI is dialable, not to actually ring the agent for
          // 15 seconds.
          await fetch(`${TELNYX_BASE}/calls/${callControlId}/actions/hangup`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${config.apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({}),
          }).catch(() => {})

          checks.push({
            id: 'ring-test',
            label: 'Live agent-leg ring test',
            status: 'pass',
            detail: `Telnyx accepted a call to ${config.agentSipUri} (call_control_id ${callControlId}); it was hung up immediately. The agent SIP endpoint is dialable. Note this proves Telnyx will ROUTE to the URI — whether the browser softphone is registered and answers is a separate step, visible in the dialer's console as a SIP INVITE.`,
          })
        } else {
          const errs: TelnyxApiError[] = Array.isArray(body?.errors) ? body.errors : []
          const isE164Complaint = errs.some((e) => String(e.code) === '10016')
          checks.push({
            id: 'ring-test',
            label: 'Live agent-leg ring test',
            status: 'fail',
            detail: `Telnyx rejected a call to ${config.agentSipUri} (HTTP ${res.status}): ${formatErrors(errs) || 'no error detail'}.`,
            fix: isE164Complaint
              ? `Error 10016 on a SIP URI means Telnyx did not recognize "${config.agentSipUri}" as a SIP endpoint at all and fell back to validating it as a phone number. The domain must be a Telnyx SIP domain (${DEFAULT_SIP_DOMAIN} for US) and the username must belong to a credential connection on this account.`
              : 'See the Telnyx error above — it applies to the agent SIP endpoint, not to any lead phone number.',
          })
        }
      }
    }

    const summary = summarize(checks)
    return NextResponse.json({
      success: summary.fail === 0,
      summary,
      checks,
      config: publicConfig(config),
      ringTest,
      hint:
        opts.ringTest
          ? undefined
          : 'POST to this same URL to additionally run a live agent-leg ring test (places and immediately hangs up one real call).',
    })
  } catch (error) {
    return apiError(error, { route: 'calls/diagnostics' })
  }
}

function summarize(checks: Check[]) {
  return {
    pass: checks.filter((c) => c.status === 'pass').length,
    warn: checks.filter((c) => c.status === 'warn').length,
    fail: checks.filter((c) => c.status === 'fail').length,
    skip: checks.filter((c) => c.status === 'skip').length,
  }
}

/** Everything safe to show — no keys, no passwords. */
function publicConfig(config: TelnyxConfig) {
  return {
    connectionId: config.connectionId,
    sipUsername: config.sipUsername,
    sipDomain: config.sipDomain,
    agentSipUri: config.agentSipUri,
    sipWssUrl: config.sipWssUrl,
    webhookUrl: config.webhookUrl,
    appUrl: config.appUrl,
    apiKeyLength: config.apiKey.length,
    warnings: config.warnings,
  }
}
