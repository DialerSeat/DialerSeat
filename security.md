# DialerSeat Security Model

This document is the authoritative statement of how authorization works in this
codebase. Read it before adding any API route.

## The core rule (Option B: app-layer auth is the ONLY boundary)

We use the Supabase **service-role key** for all server-side data access
(`supabaseAdmin`). The service-role key **bypasses Row-Level Security entirely.**

Therefore:

> **Every API route handler MUST establish identity and authorize the caller
> in application code, before any data access. RLS is NOT a backstop. There is
> no second layer.**

RLS policies exist in the database but are currently **inert** — they key off a
`current_setting('app.clerk_id')` session variable that the app never sets, and
the service-role key bypasses them regardless. Do not rely on them. Do not write
a route that uses the anon client expecting RLS to protect it, unless you have
explicitly wired `app.clerk_id` per request (we have not).

## How to gate a route — pick the right helper

| Situation | Use | Returns |
|---|---|---|
| User-scoped data (their leads, calls, campaigns, analytics) | `requireUser()` from `@/lib/requireUser` | `{ ok, userId, response }` |
| Route accepts a `user_id` param for back-compat | `requireUserMatching(param)` | 403s on mismatch |
| User-scoped + must have active subscription | `requireActive()` / `requireSelfSub()` from `@/lib/subscription` | NextResponse or null |
| Admin-only | `requireAdmin()` from `@/lib/requireAdmin` | `{ ok, clerkId }` |
| Manager+ tenant-owner data | `requireTenantOwner()` / `requireTenantScope()` from `@/lib/tenant-scope` | tenant or throws |
| Gmail routes | `requireAuth()` from `@/lib/gmail` | clerkId or throws |
| Vercel cron jobs | `Bearer ${CRON_SECRET}` header check | — |
| Stripe webhooks | `stripe.webhooks.constructEvent` (signature) | — |
| SignalWire/telephony webhooks | `verifyWebhook(req)` shared-secret check from `@/lib/verifyWebhook` | NextResponse or null |

## The two non-negotiable patterns

**1. Identity comes from the session, never from the request.**

```ts
// CORRECT
const gate = await requireUser()
if (!gate.ok) return gate.response
const userId = gate.userId
// ...query.eq('user_id', userId)

// WRONG — this is the IDOR class of bug
const userId = searchParams.get('user_id')   // attacker controls this
```

A `user_id` (or `id`) in the query string or body is an *input*, not an
identity. If you must read one, treat it as a claim to be verified against the
authenticated user — never as truth.

**2. Verify ownership BEFORE any write.**

For any update/delete keyed by a record `id` the client supplies, look the
record up, confirm `record.user_id === authenticatedUserId` (or the appropriate
ownership relation), and only then write. Also scope the write itself
(`.eq('user_id', userId)`) as belt-and-suspenders.

```ts
const { data: existing } = await supabaseAdmin
  .from('campaigns').select('id, user_id').eq('id', id).maybeSingle()
if (!existing) return notFound()
if (existing.user_id !== userId) return forbidden()
await supabaseAdmin.from('campaigns').update({...}).eq('id', id).eq('user_id', userId)
```

## Things that are legitimately public (no user gate)

These do not get a user gate, by design — but each has its OWN authenticity
mechanism that must stay in place:

- `calls/twiml`, `calls/twiml-agent`, `calls/twiml-abandon` — TwiML documents
  fetched by SignalWire. Protected by the `verifyWebhook` shared secret (the
  registered URL carries `?whk=<secret>`).
- `calls/status`, `calls/amd-result`, `calls/inbound`, `calls/recording-status`
  — SignalWire webhooks. Protected by the `verifyWebhook` shared secret. NOTE:
  the check is fail-open until `SIGNALWIRE_WEBHOOK_SECRET` is set; once set it
  enforces. Existing pool numbers must be re-provisioned after setting the
  secret so their registered callback URLs carry it.
- `calls/token` — mints a short-lived SignalWire JWT. Must remain behind the
  middleware session gate; never expose long-lived credentials here.
- `gmail/auth`, `gmail/callback` — OAuth handshake (state-protected).
- `stripe/webhook` — verified by Stripe signature.
- `cron/*` — verified by CRON_SECRET bearer token.
- `users/create` — called once at signup to mirror the Clerk user into
  `public.users`. Takes `clerk_id` from the body. LOW risk (worst case: someone
  upserts display fields for a clerk_id), but ideally should also verify the
  body's clerk_id matches `auth()` once the Clerk session exists at call time.

## The middleware is necessary but NOT sufficient

`proxy.ts` (Next.js 16 middleware) enforces that a *valid session exists* for
non-public routes via `auth.protect()`. That stops anonymous access. It does
**not** know which user owns which record — so it cannot stop user A from
requesting user B's data. Per-route ownership checks are mandatory on top of it.

## When you add a new route, ask:

1. Does it touch user data? → `requireUser()` (or the right helper above).
2. Does it write by a client-supplied id? → verify ownership first.
3. Is it intentionally public? → it needs its own authenticity check
   (signature / shared secret / OAuth state). Add it to the list above.
4. Never trust `user_id`, `id`, `team_id`, `clerk_id`, etc. from query/body as
   identity.

## Data at rest

Most columns are stored plaintext and protected only by access control to the
database (the service-role key). Two columns are an exception because they are
live credentials to a third-party account:

- **`gmail_oauth_tokens.access_token` and `.refresh_token`** are encrypted with
  AES-256-GCM (`lib/tokenCrypto.ts`). They are encrypted on write and decrypted
  on read inside `lib/gmail.ts`, so callers never handle ciphertext directly.
  The key is `GMAIL_TOKEN_ENCRYPTION_KEY` (server-side env, 32 bytes). Stored
  form is `enc:v1:<iv>:<authTag>:<ciphertext>`; legacy plaintext is passed
  through on read so the system tolerates a mix during migration.

  Operational notes:
  - Guard `GMAIL_TOKEN_ENCRYPTION_KEY` like the service-role key. Losing it makes
    every token undecryptable (users must reconnect Gmail); leaking it defeats
    the encryption.
  - To encrypt pre-existing rows or after key rotation, run
    `scripts/encrypt-gmail-tokens.ts` (idempotent — skips already-encrypted rows).

If you add another column that stores a third-party credential, secret, or
token, encrypt it the same way rather than storing it plaintext.

## Remediation status (baseline)

The following hardening was completed against the original audit. This section
is a record of the secured state, not a substitute for the rules above — new
code must still follow every pattern in this document.

- Leaked credentials in committed `.env*` files were rotated (Supabase
  service-role, Stripe secret + webhook, SignalWire token, Clerk secret).
- SIP credentials removed from the public client bundle; served from an
  authenticated endpoint (`calls/sip-credentials`) instead of `NEXT_PUBLIC_*`.
- The read-side IDOR class (routes trusting `?user_id`) was closed via
  `requireUser()`; a write-side IDOR on the orphaned `campaigns/script` route
  was removed.
- The two conflicting `requireAdmin` implementations were consolidated into one
  non-throwing source of truth (`lib/requireAdmin.ts`), eliminating a fail-open
  ambiguity.
- Telephony webhooks gained shared-secret authentication (`verifyWebhook`).
- Pacing/compliance constants were centralized (`lib/dialerConstants.ts`) so the
  predictive controller and pacing module cannot disagree on the FTC
  abandon-rate inputs.
- Gmail OAuth tokens are encrypted at rest (see "Data at rest" above).
- The database schema was captured into version control (`db/schema.sql`); the
  inert-RLS posture is documented there as well.