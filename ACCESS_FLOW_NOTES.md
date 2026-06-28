# Access flow: no trials, locked unless paying, read-only with data, /welcome without

## The rule (as implemented)
- Two paid products only: $35 team seat, $75 manager+. ONLY a genuinely 'active'
  (paid) sub grants full access.
- NO TRIALS. 'trialing' removed from every access gate.
- past_due (failed payment) = LOCKED (not active).
- Not paying + HAS DATA  → READ-ONLY dashboard (view + export own data; resub
  buttons shown everywhere). Cannot mutate.
- Not paying + NO DATA   → redirected to /welcome every time (never to /billing).

## Where it's enforced (centralized — no per-page rewrite)
proxy.ts (middleware, runs on all routes incl. /api/*):
  - ACTIVE_STATUSES = ['active'] (was ['trialing','active','past_due']).
  - tier 'active'            → full access.
  - not active + isPreserved → READ-ONLY: GET/reads pass; data-export + stripe +
    auth allowlisted; ALL other mutating API methods (POST/PUT/PATCH/DELETE) get
    403 "Read-only mode". Sets x-read-only header. ONE enforcement point.
  - not active + no data     → redirect to /welcome.

## Trials stripped from access gates
proxy.ts, lib/subscription.ts, lib/tenant.ts, stripe/status, subscriptions/summary,
whitelabel/switch-view, admin/analytics. Webhook: seat-charge no longer marks
'trialing' as paid; WL onboarding only triggers on 'active'.
(Admin DASHBOARD display logic in admin/users + admin/billing intentionally still
shows past_due/trialing as distinct states — those are visibility, not gates.)

## Resub CTA (the "buttons all over")
components/ResubBanner.tsx — mounted once in app/dashboard/layout.tsx, so it shows
on every dashboard page when /api/stripe/status reports isActive:false. Brand-themed.

## No duplicate sub / no double charge (verified)
- create-subscription already BLOCKS a new sub when one is active/past_due
  (BLOCKING_STATUSES) and cleans up 'incomplete' subs — no second sub, no double
  charge. Recovery for past_due is via the dashboard resub flow (not a new sub).
- Live DB verified: 0 users with multiple live subs; no past_due; 2 active
  unaffected. The strict change locks out nobody currently.

## NOTE / follow-up
- Read-only is enforced at the API layer (the real guard). Per-page button-hiding
  is cosmetic on top of that — the ResubBanner + 403s already make it correct and
  safe; individual pages can hide disabled buttons incrementally if desired.
- isActiveOnlyRoute matcher in proxy.ts is now unused (left inert; harmless).
