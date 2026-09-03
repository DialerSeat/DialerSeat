import { supabaseAdmin } from '@/lib/supabase'
import { resolveTelnyxConfig, type TelnyxConfig } from '@/lib/telnyxConfig'
import { ensureSipUriCallingEnabled } from '@/lib/telnyxSipUriCalling'

// =============================================================================
// PER-AGENT SIP CREDENTIALS — fully automated Telnyx provisioning
// =============================================================================
// THE PROBLEM THIS SOLVES
//
// The app shipped with one account-wide TELNYX_SIP_USERNAME. Every agent's
// browser registered to Telnyx as that same SIP user, which means:
//
//   1. sip:<shared user>@sip.telnyx.com does not address an agent. It
//      addresses ALL of them. Telnyx forks the INVITE to every registered
//      browser and the first to answer wins.
//   2. The server therefore CANNOT route a call to a specific person. The
//      team-overflow path (lib/teamOverflow.ts) carefully claims one exact
//      agent via an atomic DB update — and then dials a URI that rings
//      everybody, so the claim it worked so hard for decides nothing.
//   3. With one agent dialing this is invisible. With two, an agent gets
//      connected to a lead that belongs to a colleague, mid-conversation,
//      with the wrong lead record on screen.
//
// THE FIX, AND WHY IT'S THIS SHAPE
//
// Telnyx's own guidance for multi-agent call centers is to generate one
// "on-demand credential" (a telephony credential) per agent and then use the
// Call Control API to dial the specific credential of the agent you want.
// That is exactly what this module automates.
//
// FULLY AUTOMATIC — no portal clicks, ever:
//   - The parent SIP Connection is discovered from the Telnyx API (or taken
//     from TELNYX_CREDENTIAL_CONNECTION_ID if you'd rather pin it).
//   - An agent's credential is created the first time they need one, as a
//     side effect of their browser asking for its registration details.
//     There is no provisioning step, no admin screen, and nothing to
//     remember when a new user signs up.
//
// NO SECRET AT REST:
//   sip_password is never written to our database. Telnyx returns it on
//   GET /v2/telephony_credentials/{id}, so it's fetched on demand and handed
//   straight to the one authenticated agent it belongs to. Telnyx stays the
//   only system of record for the secret.
//
// ROLLOUT SAFETY:
//   Every lookup falls back to the shared TELNYX_SIP_USERNAME when a user
//   has no credential yet or provisioning fails. So this can deploy against
//   the existing sandbox setup without a flag day — agents migrate to their
//   own identity the first time their browser registers, and anyone who
//   hasn't yet keeps working exactly as before.
// =============================================================================

const TELNYX_BASE = 'https://api.telnyx.com/v2'

export interface AgentSipCredential {
  telnyxCredentialId: string
  sipUsername: string
  /**
   * The Telnyx SIP connection this credential hangs off. Carried so the dial
   * path can verify the connection is actually reachable by SIP URI without
   * re-resolving it — see agentSipUriForClerkId.
   */
  connectionId?: string | null
  /** True when this is the shared fallback rather than a per-agent identity. */
  isSharedFallback: boolean
}

export interface AgentSipRegistration extends AgentSipCredential {
  sipPassword: string
  sipDomain: string
  sipWssUrl: string
}

interface TelnyxCredentialResource {
  id?: string
  sip_username?: string
  sip_password?: string
  connection_id?: string
  resource_id?: string
  expired?: boolean
}

interface TelnyxEnvelope<T> {
  data?: T
  errors?: Array<{ code?: string | number; title?: string; detail?: string }>
}

function describeErrors(env: TelnyxEnvelope<unknown> | null, status: number): string {
  const errs = env?.errors
  if (errs && errs.length > 0) {
    return errs.map((e) => `${e.code ?? '?'} ${e.title ?? 'error'}`).join('; ')
  }
  return `HTTP ${status}`
}

async function telnyxRequest<T>(
  path: string,
  apiKey: string,
  init?: RequestInit
): Promise<{ ok: boolean; status: number; env: TelnyxEnvelope<T> | null }> {
  const res = await fetch(`${TELNYX_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
    cache: 'no-store',
  })
  const text = await res.text()
  let env: TelnyxEnvelope<T> | null = null
  try {
    env = text ? (JSON.parse(text) as TelnyxEnvelope<T>) : null
  } catch {
    env = null
  }
  return { ok: res.ok, status: res.status, env }
}

// =============================================================================
// PARENT SIP CONNECTION
// =============================================================================
// A telephony credential must hang off a SIP Connection. Rather than making
// that yet another env var to get wrong (see lib/telnyxConfig.ts's header for
// how that went last time), it is discovered from the account and cached for
// the life of the process.
//
// Discovery order:
//   1. TELNYX_CREDENTIAL_CONNECTION_ID, if set. Explicit always wins.
//   2. The credential connection whose user_name matches the existing shared
//      TELNYX_SIP_USERNAME. That is by definition the connection today's
//      working softphone registers against, so per-agent credentials created
//      on it inherit exactly the same routing and media settings that are
//      already proven to work.
//   3. If the account has exactly ONE credential connection, use it —
//      unambiguous.
// Deliberately NOT auto-created: creating a SIP Connection is a real change
// to the Telnyx account with its own routing and security settings, and
// guessing those wrong produces calls that connect with no audio. If none is
// found, this returns null and the caller falls back to the shared username,
// which keeps calls working.
// =============================================================================

interface CredentialConnection {
  id?: string
  user_name?: string
  connection_name?: string
  encrypted_media?: string | null
}

/**
 * Make a connection actually reachable by a SIP URI dial.
 *
 * WHY THIS IS PROACTIVE AND NOT ERROR-DRIVEN
 *
 * Telnyx creates every connection with sip_uri_calling_preference =
 * "disabled", which refuses calls addressed to its SIP URIs. There was
 * already a self-heal for this, but it only triggered on Telnyx error 10016 —
 * a REQUEST-time rejection. That is the wrong failure to hang it on.
 *
 * What actually happens when the setting is disabled is subtler and worse:
 * the dial request SUCCEEDS, Telnyx creates the call and returns a
 * call_control_id, and then refuses to route it — hanging the leg up
 * ~100ms later with cause 'user_busy' (SIP 486 Busy Here). No error is ever
 * returned to the caller, so nothing downstream can detect it. From the
 * app's side the agent leg looks placed; the agent's browser never receives
 * an INVITE at all; the lead answers to silence; and every diagnostic points
 * at the browser, which is entirely innocent. That mis-attribution cost
 * several rounds of debugging into SIP guards and registrations.
 *
 * So it is checked when the connection is resolved — once per process, before
 * any call depends on it — rather than waiting for an error that never comes.
 *
 * "internal" not "unrestricted": internal permits calls from connections on
 * this same Telnyx account, which is exactly our Call Control Application
 * dialing our own agent credential, while leaving agents' browsers
 * unreachable from the public internet.
 */
async function ensureAgentConnectionIsDialable(
  connection: CredentialConnection,
  apiKey: string
): Promise<void> {
  if (!connection.id) return
  // Telnyx returns ids in a couple of shapes across its APIs
  // ("3010785211936933233" vs "connection:3010785211936933233"). The
  // /security/connections endpoint wants the bare id.
  const bareId = String(connection.id).replace(/^connection:/, '')

  try {
    const outcome = await ensureSipUriCallingEnabled(bareId, apiKey)
    if (outcome === 'enabled') {
      console.log(
        `[agentSipCredentials] connection ${bareId} had SIP URI calling DISABLED, every agent-leg ` +
        `dial was being hung up by Telnyx with 'user_busy' before reaching the browser. ` +
        `Set to "internal".`
      )
    } else if (outcome === 'failed') {
      // WARN, not ERROR. The read endpoint returns 401 for us, so this fires
      // even when the setting is already correct — which it is, verified in
      // Mission Control. An unverifiable setting is not the same as a broken
      // one, and logging it at error level sends people hunting a fault that
      // is not there. It stays as a hint because if agent legs DO start
      // failing, this is the first thing to check.
      console.warn(
        `[agentSipCredentials] could not verify SIP URI calling on connection ${bareId} ` +
        `(the read endpoint rejects our token). Harmless if it is already set. Only worth ` +
        `acting on if agent legs hang up ~100ms after dial with cause 'user_busy' and the ` +
        `browser never sees an INVITE, then set "Receive SIP URI calls" to ` +
        `"Only from my Connections" on this connection in Telnyx Mission Control.`
      )
    }
  } catch (err) {
    console.error(`[agentSipCredentials] SIP URI calling check threw for ${bareId}:`, err)
  }

  await clearEncryptedMediaIfSet(connection, apiKey)
}

/**
 * Clear encrypted_media on a connection that has it set.
 *
 * Only exists to undo damage from an earlier version of
 * createManagedCredentialConnection that set 'SRTP'. Browsers speak
 * DTLS-SRTP; Telnyx's encrypted_media means SDES-SRTP; the mismatch produces
 * a call that connects and carries no audio. Runs at most once per process
 * (guarded by the connection-id cache that gates its only caller), is a no-op
 * when the field is already clear, and never blocks the dial path — a failure
 * here is logged and dialing continues.
 */
async function clearEncryptedMediaIfSet(
  connection: CredentialConnection,
  apiKey: string
): Promise<void> {
  if (!connection.id || !connection.encrypted_media) return

  const { ok, status, env } = await telnyxRequest<CredentialConnection>(
    `/credential_connections/${connection.id}`,
    apiKey,
    { method: 'PATCH', body: JSON.stringify({ encrypted_media: null }) }
  )

  if (!ok) {
    console.error(
      `[agentSipCredentials] connection ${connection.id} has encrypted_media=` +
      `"${connection.encrypted_media}", which prevents browsers from negotiating media ` +
      `(calls connect with no audio). Automatic repair failed (${describeErrors(env, status)}). ` +
      `Clear "Encrypted Media" on this connection in Telnyx Mission Control.`
    )
    return
  }

  console.log(
    `[agentSipCredentials] cleared encrypted_media on connection ${connection.id}, ` +
    `browsers can now negotiate DTLS-SRTP, which is what was blocking call audio`
  )
}

let cachedConnectionId: string | null | undefined

export async function resolveCredentialConnectionId(
  config: TelnyxConfig
): Promise<string | null> {
  if (cachedConnectionId !== undefined) return cachedConnectionId

  const explicit = process.env.TELNYX_CREDENTIAL_CONNECTION_ID?.trim()
  if (explicit && explicit !== 'undefined' && explicit !== 'null') {
    cachedConnectionId = explicit
    return cachedConnectionId
  }

  const { ok, status, env } = await telnyxRequest<CredentialConnection[]>(
    '/credential_connections?page[size]=100',
    config.apiKey
  )

  if (!ok || !Array.isArray(env?.data)) {
    console.error(
      `[agentSipCredentials] could not list credential connections (${describeErrors(env, status)}), ` +
      `per-agent credentials unavailable, falling back to the shared SIP user`
    )
    cachedConnectionId = null
    return null
  }

  const connections = env.data
  const byUsername = connections.find((c) => c.user_name === config.sipUsername)
  if (byUsername?.id) {
    cachedConnectionId = byUsername.id
    console.log(
      `[agentSipCredentials] using credential connection "${byUsername.connection_name || byUsername.id}" ` +
      `(matched TELNYX_SIP_USERNAME) as the parent for per-agent credentials`
    )
    await ensureAgentConnectionIsDialable(byUsername, config.apiKey)
    return cachedConnectionId
  }

  if (connections.length === 1 && connections[0].id) {
    cachedConnectionId = connections[0].id
    console.log(
      `[agentSipCredentials] using the account's only credential connection ` +
      `"${connections[0].connection_name || connections[0].id}" as the parent for per-agent credentials`
    )
    await ensureAgentConnectionIsDialable(connections[0], config.apiKey)
    return cachedConnectionId
  }

  // ── NOTHING TO ATTACH TO — CREATE ONE ───────────────────────────────────
  // A brand new Telnyx account has a Call Control Application and no
  // Credential Connection at all. Without one there is nowhere to hang agent
  // credentials, so provisioning silently degrades to the shared
  // TELNYX_SIP_USERNAME — a value typed in by hand that, on a fresh account,
  // names a SIP user that does not exist. Telnyx then rejects the agent leg
  // and 100% of dials fail.
  //
  // Creating it is the only step in the whole setup that genuinely cannot be
  // discovered, and it is a hard prerequisite for the product to function at
  // all. Doing it automatically is what makes a bare Telnyx account plus an
  // API key sufficient to run this app.
  //
  // Idempotent by name: the lookup above already ran, and this re-checks by
  // MANAGED_CONNECTION_NAME before creating, so a restart or a concurrent
  // cold start cannot produce a second one.
  const existingManaged = connections.find((c) => c.connection_name === MANAGED_CONNECTION_NAME)
  if (existingManaged?.id) {
    cachedConnectionId = existingManaged.id
    console.log(
      `[agentSipCredentials] using previously auto-created credential connection ` +
      `"${MANAGED_CONNECTION_NAME}" (${existingManaged.id})`
    )
    await ensureAgentConnectionIsDialable(existingManaged, config.apiKey)
    return cachedConnectionId
  }

  const created = await createManagedCredentialConnection(config)
  cachedConnectionId = created
  return created
}

/**
 * Fixed name so the auto-created connection is recognizable in the Telnyx
 * portal AND findable again by this code. Changing it would orphan the
 * existing one and create a duplicate, so it is a constant, not config.
 */
const MANAGED_CONNECTION_NAME = 'dialerseat-agents'

interface CreatedCredentialConnection {
  id?: string
  connection_name?: string
}

async function createManagedCredentialConnection(
  config: TelnyxConfig
): Promise<string | null> {
  // The connection's own SIP user. Distinct from the per-agent telephony
  // credentials that will hang off it — those get their own Telnyx-generated
  // usernames. This one just has to be unique on Telnyx and syntactically
  // valid, so: a letter-leading prefix (Telnyx rejects SIP users that start
  // with a digit, since it parses those as phone numbers) plus randomness.
  const suffix = Math.random().toString(36).slice(2, 10)
  const userName = `dialerseat${suffix}`
  // Telnyx requires 8–128 characters. Generated, never stored, and never
  // used by this app — agents authenticate with their own credentials, not
  // this one — so it exists purely to satisfy the required field.
  const password =
    Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2).toUpperCase()

  const { ok, status, env } = await telnyxRequest<CreatedCredentialConnection>(
    '/credential_connections',
    config.apiKey,
    {
      method: 'POST',
      body: JSON.stringify({
        connection_name: MANAGED_CONNECTION_NAME,
        user_name: userName,
        password,
        active: true,
        // encrypted_media is deliberately NOT set.
        //
        // An earlier version set it to 'SRTP', reasoning that browser media
        // must be encrypted. That was wrong and it broke audio: Telnyx's
        // encrypted_media means SDES-SRTP (a=crypto in the SDP, RTP/SAVP),
        // which browsers do not implement — and Telnyx documents that it
        // cannot be set at all when the transport is TLS, which WSS is. The
        // result was a call that signalled perfectly, connected, and then
        // carried no audio in either direction, because the two sides never
        // agreed on a media profile.
        //
        // Browsers connecting over WSS negotiate DTLS-SRTP, which is
        // mandatory in WebRTC and which Telnyx handles natively. Leaving
        // this unset lets that happen. Media is still encrypted — just by
        // the mechanism the browser actually speaks.
        // Our own Call Control Application dials these credentials, so the
        // connection has to accept calls addressed to its SIP URIs.
        // "internal" = same Telnyx account only, which is exactly our case;
        // "unrestricted" would expose agents' softphones to the public
        // internet. Telnyx defaults this to "disabled", which would block
        // every agent leg — see lib/telnyxSipUriCalling.ts.
        sip_uri_calling_preference: 'internal',
        webhook_event_url: config.webhookUrl,
      }),
    }
  )

  const id = env?.data?.id
  if (!ok || !id) {
    console.error(
      `[agentSipCredentials] could not auto-create the "${MANAGED_CONNECTION_NAME}" credential ` +
      `connection (${describeErrors(env, status)}). Per-agent credentials are unavailable, so ` +
      `dialing falls back to TELNYX_SIP_USERNAME, which must then name a SIP credential that ` +
      `really exists on this Telnyx account. Either grant TELNYX_API_KEY permission to manage ` +
      `connections, or create a Credential Connection in Telnyx and set ` +
      `TELNYX_CREDENTIAL_CONNECTION_ID.`
    )
    return null
  }

  console.log(
    `[agentSipCredentials] auto-created credential connection "${MANAGED_CONNECTION_NAME}" (${id}), ` +
    `per-agent SIP credentials will now be provisioned against it`
  )
  return id
}

/** Test/ops hook — forget the discovered connection so the next call re-resolves. */
export function resetCredentialConnectionCache(): void {
  cachedConnectionId = undefined
}

// =============================================================================
// GET-OR-CREATE
// =============================================================================

/**
 * Returns the agent's own SIP credential, creating it on Telnyx the first
 * time. Falls back to the shared TELNYX_SIP_USERNAME (flagged as such) if
 * per-agent provisioning isn't possible, so a call never fails purely
 * because provisioning is unavailable.
 */
export async function getOrCreateAgentCredential(
  clerkId: string
): Promise<AgentSipCredential | null> {
  const resolved = resolveTelnyxConfig()
  if (!resolved.ok) {
    console.error(
      `[agentSipCredentials] Telnyx not configured, ${resolved.errors.join('; ')}`
    )
    return null
  }
  const config = resolved.config

  const existing = await readStoredCredential(clerkId)
  if (existing) return existing

  // Can't persist what we'd create, so don't create it. (readStoredCredential
  // sets this when the table is missing.)
  if (storageUnavailable) return sharedFallback(config)

  const connectionId = await resolveCredentialConnectionId(config)
  if (!connectionId) return sharedFallback(config)

  const { ok, status, env } = await telnyxRequest<TelnyxCredentialResource>(
    '/telephony_credentials',
    config.apiKey,
    {
      method: 'POST',
      body: JSON.stringify({
        connection_id: connectionId,
        // Identifiable in the Telnyx portal without being a secret. Makes an
        // orphaned credential (user deleted here, credential left there)
        // traceable back to the account it belonged to.
        name: `dialerseat-agent-${clerkId}`,
      }),
    }
  )

  const created = env?.data
  if (!ok || !created?.id || !created?.sip_username) {
    console.error(
      `[agentSipCredentials] Telnyx rejected credential creation for ${clerkId} ` +
      `(${describeErrors(env, status)}), falling back to the shared SIP user`
    )
    return sharedFallback(config)
  }

  const { error: insertErr } = await supabaseAdmin.from('agent_sip_credentials').insert({
    clerk_id: clerkId,
    telnyx_credential_id: created.id,
    sip_username: created.sip_username,
    connection_id: created.connection_id || created.resource_id || connectionId,
  })

  if (insertErr) {
    // Almost certainly the unique-on-clerk_id guard firing because a
    // concurrent request for this same brand-new user won the race. Re-read
    // and use the winner's row; ours is a duplicate that nothing will ever
    // dial, so delete it from Telnyx rather than leaving it billing.
    const winner = await readStoredCredential(clerkId)
    if (winner) {
      void deleteTelnyxCredential(created.id, config.apiKey)
      return winner
    }
    console.error(
      `[agentSipCredentials] created Telnyx credential ${created.id} for ${clerkId} but could not ` +
      `store it:`,
      insertErr
    )
    // The credential exists on Telnyx but we can't address it reliably
    // without a row, so don't pretend it's usable.
    void deleteTelnyxCredential(created.id, config.apiKey)
    return sharedFallback(config)
  }

  console.log(
    `[agentSipCredentials] provisioned SIP credential ${created.id} (${created.sip_username}) for ${clerkId}`
  )

  return {
    telnyxCredentialId: created.id,
    sipUsername: created.sip_username,
    isSharedFallback: false,
  }
}

/**
 * Set once if the table doesn't exist (migration not applied yet).
 *
 * This flag is what stops a missing migration from being expensive rather
 * than merely degraded: without it, every single page load would create a
 * credential on Telnyx, fail to store it, and delete it again — real API
 * traffic and real credential churn on the account, forever, for nothing.
 * One failed read is enough to know provisioning can't work, so after that
 * we go straight to the shared fallback without touching Telnyx at all.
 */
let storageUnavailable = false

/** Postgres "undefined_table" — the migration hasn't been applied. */
const PG_UNDEFINED_TABLE = '42P01'

async function readStoredCredential(clerkId: string): Promise<AgentSipCredential | null> {
  if (storageUnavailable) return null

  const { data, error } = await supabaseAdmin
    .from('agent_sip_credentials')
    .select('telnyx_credential_id, sip_username, connection_id')
    .eq('clerk_id', clerkId)
    .maybeSingle()

  if (error) {
    if (error.code === PG_UNDEFINED_TABLE || /agent_sip_credentials.*does not exist/i.test(error.message || '')) {
      storageUnavailable = true
      console.error(
        '[agentSipCredentials] table agent_sip_credentials does not exist, apply ' +
        'db/migrations/2026-08-05-add-agent-sip-credentials.sql. Falling back to the shared ' +
        'SIP user for every agent until then.'
      )
      return null
    }
    // Any other read failure must not break dialing — the shared-username
    // fallback covers it — but don't latch the flag, since it may be
    // transient.
    console.error(`[agentSipCredentials] lookup failed for ${clerkId}:`, error)
    return null
  }
  if (!data) return null

  return {
    telnyxCredentialId: data.telnyx_credential_id,
    sipUsername: data.sip_username,
    connectionId: data.connection_id,
    isSharedFallback: false,
  }
}

/** Test/ops hook — clear the "migration missing" latch after applying it. */
export function resetStorageAvailability(): void {
  storageUnavailable = false
}

function sharedFallback(config: TelnyxConfig): AgentSipCredential | null {
  if (!config.sipUsername) return null
  return {
    telnyxCredentialId: '',
    sipUsername: config.sipUsername,
    isSharedFallback: true,
  }
}

async function deleteTelnyxCredential(credentialId: string, apiKey: string): Promise<void> {
  try {
    await telnyxRequest(`/telephony_credentials/${credentialId}`, apiKey, { method: 'DELETE' })
  } catch (err) {
    console.error(`[agentSipCredentials] failed to delete orphaned credential ${credentialId}:`, err)
  }
}

// =============================================================================
// DIAL TARGETS — read-only, used by the server when placing an agent leg
// =============================================================================

/**
 * The SIP URI that rings THIS agent's browser and no one else's.
 *
 * PROVISIONS ON MISS rather than just reading. An earlier version was
 * read-only, to keep a Telnyx round trip off the dial path — but that made
 * dialing depend on /api/calls/sip-credentials having already run and
 * succeeded for this user, and when it hadn't, the dial silently fell back to
 * the shared TELNYX_SIP_USERNAME. On an account where that env var doesn't
 * name a real SIP credential, that fallback isn't a graceful degradation, it
 * is a guaranteed failed call with a misleading error.
 *
 * The cost is one Telnyx round trip on an agent's very first dial and never
 * again (the row is then in the database). That is the right trade against a
 * class of failure that is invisible until someone tries to place a call.
 */
export async function agentSipUriForClerkId(
  clerkId: string,
  config: TelnyxConfig
): Promise<string> {
  const credential = await getOrCreateAgentCredential(clerkId)

  if (credential && !credential.isSharedFallback) {
    // Verify the connection will actually ACCEPT a SIP URI call before we
    // dial one at it.
    //
    // This has to happen here, not only in resolveCredentialConnectionId:
    // getOrCreateAgentCredential returns early the moment a stored credential
    // exists, so for every already-provisioned agent — i.e. everyone, after
    // their first session — the resolver is never reached and its checks
    // never run. That is exactly why the fix appeared to do nothing and
    // produced no logs at all.
    //
    // Cheap to call on every dial: ensureSipUriCallingEnabled memoizes per
    // connection for the life of the process, so this is a Map lookup after
    // the first call.
    if (credential.connectionId) {
      const bareId = String(credential.connectionId).replace(/^connection:/, '')
      const outcome = await ensureSipUriCallingEnabled(bareId, config.apiKey)
      if (outcome === 'enabled') {
        console.log(
          `[agentSipCredentials] connection ${bareId} had SIP URI calling DISABLED, that is why ` +
          `agent legs were being hung up by Telnyx (~100ms, 'user_busy') without ever reaching ` +
          `the browser. Set to "internal".`
        )
      } else if (outcome === 'failed') {
        console.error(
          `[agentSipCredentials] could NOT read/write SIP URI calling on connection ${bareId}. ` +
          `If agent legs keep ending in 'user_busy' with no INVITE at the browser, set ` +
          `"Receive SIP URI calls" to "Only from my Connections" on this connection in Telnyx ` +
          `Mission Control, the API could not do it.`
        )
      }
    }
    return `sip:${credential.sipUsername}@${config.sipDomain}`
  }

  console.warn(
    `[agentSipCredentials] dialing ${clerkId} via the SHARED SIP user, no per-agent credential ` +
    `could be provisioned. This rings every registered browser, and fails outright if ` +
    `TELNYX_SIP_USERNAME does not name a real credential on this Telnyx account.`
  )
  return `sip:${credential?.sipUsername || config.sipUsername}@${config.sipDomain}`
}

/**
 * Same, for the predictive/overflow paths, which hold agent_sessions.user_id
 * (a users.id uuid) rather than a Clerk id.
 */
export async function agentSipUriForUserId(
  userId: string,
  config: TelnyxConfig
): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('clerk_id')
    .eq('id', userId)
    .maybeSingle()

  if (error || !data?.clerk_id) {
    console.error(
      `[agentSipCredentials] could not resolve clerk_id for user ${userId}` +
      `${error ? `: ${error.message}` : ''}: using the shared SIP user, which will ring every ` +
      `registered agent rather than this one`
    )
    return config.agentSipUri
  }
  return agentSipUriForClerkId(data.clerk_id, config)
}

// =============================================================================
// REGISTRATION DETAILS — served to the agent's own browser
// =============================================================================

/**
 * Everything the browser softphone needs to register as this agent, with the
 * password fetched live from Telnyx (never stored here). Provisions the
 * credential if this is the agent's first time.
 */
export async function getAgentRegistration(
  clerkId: string
): Promise<{ registration: AgentSipRegistration | null; error?: string }> {
  const resolved = resolveTelnyxConfig()
  if (!resolved.ok) {
    return { registration: null, error: resolved.errors.join('; ') }
  }
  const config = resolved.config

  const credential = await getOrCreateAgentCredential(clerkId)
  if (!credential) {
    return { registration: null, error: 'No SIP credential could be resolved for this user' }
  }

  // The shared fallback's password still lives in an env var — there is no
  // Telnyx credential id to fetch it against.
  if (credential.isSharedFallback) {
    const sharedPassword = process.env.TELNYX_SIP_PASSWORD?.trim()
    if (!sharedPassword) {
      return { registration: null, error: 'TELNYX_SIP_PASSWORD is not set' }
    }
    return {
      registration: {
        ...credential,
        sipPassword: sharedPassword,
        sipDomain: config.sipDomain,
        sipWssUrl: config.sipWssUrl,
      },
    }
  }

  const { ok, status, env } = await telnyxRequest<TelnyxCredentialResource>(
    `/telephony_credentials/${credential.telnyxCredentialId}`,
    config.apiKey
  )

  const password = env?.data?.sip_password
  if (!ok || !password) {
    return {
      registration: null,
      error:
        `Telnyx did not return a password for credential ${credential.telnyxCredentialId} ` +
        `(${describeErrors(env, status)})`,
    }
  }

  if (env?.data?.expired) {
    return {
      registration: null,
      error: `Telnyx reports credential ${credential.telnyxCredentialId} as expired`,
    }
  }

  void supabaseAdmin
    .from('agent_sip_credentials')
    .update({ last_fetched_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('clerk_id', clerkId)
    .then(({ error }) => {
      if (error) console.error('[agentSipCredentials] last_fetched_at update failed:', error)
    })

  return {
    registration: {
      ...credential,
      sipPassword: password,
      sipDomain: config.sipDomain,
      sipWssUrl: config.sipWssUrl,
    },
  }
}
