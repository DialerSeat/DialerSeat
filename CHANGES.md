# DialerSeat security fixes — full status

## Applied and verified (tsc clean)

**#1 — deleted `app/api/users/create/`.** Dead, unauthenticated route. Zero
callers confirmed. Just delete it in your repo.

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

## Staged tonight, needs `npm install` + build + click-through tomorrow

**#4 — dependency bumps, `package.json` only (included in this zip).**
Nothing below takes effect until you run `npm install` — these are just
version-string edits, so there's nothing to break tonight.

- `next`: `16.2.4` → `16.2.10` (latest 16.2.x LTS as of July 1, 2026). This
  is the one that actually matters: 16.2.4 predates Next's May 7, 2026
  security release, which patched several **middleware/proxy
  authorization-bypass** CVEs (CVE-2026-44574 dynamic-route-param injection,
  CVE-2026-44575 segment-prefetch bypass) — your `proxy.ts` is exactly the
  pattern these target (App Router + Clerk middleware gating pages, admin
  routes, and subscription tier). Good news from checking your code: 83/139
  API routes call Clerk's `auth()` directly, so a middleware skip alone
  wouldn't let a fully anonymous request through your API — but pages/routes
  that rely *only* on `proxy.ts` for tier/admin gating (not re-checked
  downstream) are the real exposure. 16.2.10 stays in the same minor line as
  16.2.4, so no breaking API changes expected — it's patch releases only.
- `eslint-config-next`: bumped to match (`16.2.10`), standard practice to
  keep in lockstep with `next`.
- Added an `overrides` block:
  - `ws: ^8.20.1` — fixes CVE-2026-45736 (uninitialized memory disclosure in
    `websocket.close()`). Pulled in transitively by `@signalwire/realtime-api`
    (`^8.17.1`) and `@supabase/realtime-js` (`^8.18.2`) — 8.20.1 satisfies
    both ranges, so this isn't fighting either package's own requirements.
  - `js-cookie: ^3.0.7` — fixes CVE-2026-46625 (prototype-hijack enabling
    cookie-attribute injection). Pulled in by `@clerk/shared`, which pins it
    exactly at `3.0.5`; the override forces the patched version anyway. Your
    own app code never calls `js-cookie` directly (checked — zero references
    outside `node_modules`), so this is purely hardening Clerk's internal
    usage, not something your code path triggers today.

### Why these are staged, not applied live
None of this can be verified from this sandbox — no network access to
actually pull the new packages, resolve the lockfile, or run a real
`next build`. `tsc --noEmit` (which doesn't touch installed package versions)
stayed clean through all the other changes, but that's not a build guarantee
for a framework version bump. This one needs your real toolchain.

## Not changed — deliberate, needs your call, not mine

**#5 — RLS-enabled-no-policy on 40 tables.** Audit's own conclusion: "fine as
designed" given your service-role-client + Clerk-authed-route architecture.
No code change proposed.

**#6 — fail-open error handling in `proxy.ts getAccessState`.** On a
transient Supabase error it currently grants `tier: 'active'` rather than
denying. This is a genuine security-vs-availability tradeoff (flip it and a
DB blip locks out every paying customer instantly), not a bug with one
correct answer — I didn't touch it. Say the word if you want it flipped to
fail-closed, or want something in between (e.g. fail open only for a short
grace window, alert on it, etc.).

## Tomorrow's plan
1. `npm install` (pulls next 16.2.10, ws 8.20.1, js-cookie 3.0.7).
2. `npm run build` — confirm clean build.
3. `npm run lint` (or your CI's tsc) — confirm clean.
4. Deploy to a preview environment first if you have one, not straight to
   prod.
5. Click-through checklist (see chat) focused on the `proxy.ts` middleware
   changes, since that's the one with real behavioral risk.
6. Place one real test call once you're back at your desk, to confirm the
   webhook/`whk` changes from tonight didn't regress status/AMD/recording
   callbacks.
