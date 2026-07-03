# DialerSeat security fixes — full status

## Applied and verified (tsc clean)

**#1 — deleted `app/api/users/create/`.** Dead, unauthenticated route. Zero
callers confirmed. Just delete it in your repo (nothing to add — it's gone).

**#2 — `lib/verifyWebhook.ts`: `FAIL_OPEN_WHEN_UNSET` → `false`.** You
confirmed `SIGNALWIRE_WEBHOOK_SECRET` is set in Vercel prod.

**#3 — TwiML hardening.**
- New `lib/xml.ts` (`escapeXml`).
- `twiml`, `twiml-agent` route.ts: added `verifyWebhook()` gate, escape `room`.
- `twiml-abandon`: escape `room` (bonus consistency fix).
- `lib/placeOutboundCall.ts`: wrapped 4 SignalWire callback URLs
  (`twiml`, `status`, `twiml-agent`, `amd-result`) with `webhookUrl()` — this
  was a real pre-existing bug (those URLs never carried the `whk` param even
  though `status`/`amd-result` already enforced it), independent of anything
  the original audit flagged.

## Staged, needs `npm install` + build + click-through on your machine

**#4 — dependency bumps, `package.json` (included).** Nothing below takes
effect until you run `npm install`.
- `next`: `16.2.4` → `16.2.10` (latest 16.2.x LTS, includes the May 2026
  security release patching middleware/proxy authorization-bypass CVEs
  (CVE-2026-44574, CVE-2026-44575) that specifically target apps like this
  one — App Router + `proxy.ts`/Clerk middleware gating pages, admin routes,
  and subscription tier). Verified `16.2.10` is within `@clerk/nextjs@7.2.9`'s
  declared peer range for `next` (checked the literal peerDependencies field
  and tested with the real `semver` library — no conflict).
- `eslint-config-next`: bumped to match (`16.2.10`).
- Added `overrides`: `ws: ^8.20.1` (fixes uninitialized-memory disclosure,
  pulled in by `@signalwire/realtime-api` and `@supabase/realtime-js`, both
  satisfied by this version) and `js-cookie: ^3.0.7` (fixes prototype-hijack
  cookie-attribute injection, pulled in by `@clerk/shared`; your own code
  never calls js-cookie directly — confirmed — so this is hardening Clerk's
  internal usage, not something your code path triggers today).

Couldn't run `npm install`/`next build` in this sandbox — no network access.
`tsc --noEmit` stayed clean throughout, but that's not a build guarantee for
a framework bump; needs your real toolchain.

## Not changed — deliberate, your call

**#5 — RLS-enabled-no-policy on 40 tables.** Audit's own conclusion: fine as
designed given your service-role-client + Clerk-authed-route architecture.

**#6 — fail-open error handling in `proxy.ts getAccessState`.** Genuine
security-vs-availability tradeoff (flip it and a transient Supabase error
locks out every paying customer instantly). Left alone — say the word if you
want it changed.

## Morning bug fix — mic-permission block (unrelated to any of the above)

`next.config.ts` had a site-wide `Permissions-Policy` header with
`microphone=()` — an empty allowlist, blocking mic access for every origin
including the app's own. Since this is a browser-based SIP dialer, that
silently killed `getUserMedia()` before the browser could even show a
permission prompt: `NotAllowedError`, no visible feedback, "SET AVAILABLE TO
DIAL" appeared to do nothing.

This line was untouched by anything from last night — pre-existing, unrelated
to the audit. Fixed by changing it to `microphone=(self)` (camera and
geolocation left blocked at `()` — confirmed nothing in the app uses either).

This one's a plain header change with no dependency/lockfile involved — you
can ship this independently of the `next`/`ws`/`js-cookie` bump if you want
the dialer working again before touching anything else.

## Verification
`tsc --noEmit` clean (0 errors) after every change above, matching the
original baseline before any edits.

## How to apply
Folder mirrors your repo's structure. Delete `app/api/users/create/`, copy
the rest of these files in, `npm install`, `npm run build`, test, deploy.
