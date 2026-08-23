# Team code / campaign invite flow

Reference for how a join code travels from a link to a seat, where that journey
currently breaks, and what the intended destination is.

Traced 2026-08-20 against live code and the live database. Anything marked
CONFIRMED was read off the source or queried, not inferred.

---

## The short version

**The redeem logic is not the problem. The code never reaches it.**

`/api/teams/redeem` already implements owner-pays vs agent-pays, instant vs
approval, charge-on-join, and pending-vs-active access. The billing page already
knows how to tell a team code from a Stripe promo code, and already reads a code
out of `?promo=`. Those two halves are correct and were built to fit together.

What is missing is the wire between them: the code is discarded at sign-up, and
nothing downstream ever learns it existed.

---

## Current flow, step by step

### 1. `/join/[code]` — correct

`app/join/[code]/page.tsx` uppercases the code and, for a signed-out visitor,
redirects to `/sign-up?redirect_url=/join/CODE`. The intent is right: come back
here after sign-up and redeem.

### 2. Sign-up — THE CODE DIES HERE (CONFIRMED)

`app/sign-up/[[...sign-up]]/page.tsx:131`

    <SignUp forceRedirectUrl="/api/auth/post-signin" />

`forceRedirectUrl` is Clerk's *override* — it takes precedence over
`redirect_url` by design. The `/join/CODE` return trip is thrown away at the
moment the account is created. This is the root cause of every symptom below.

`fallbackRedirectUrl` is the prop that yields to `redirect_url`. It is not used.

### 3. `/api/auth/post-signin` — has no idea a code exists (CONFIRMED)

Routes on identity alone: admin to the desktop, `shouldSeeWelcome(userId)` to
`/welcome`, otherwise the tenant dashboard. It never reads `redirect_url`, has
no notion of a pending join, and could not recover the code anyway — step 2
already dropped it.

### 4. `/welcome` sends to `/billing?from=welcome`

No `promo` parameter, because there is nothing left to attach.

### 5. `/billing` — ready and waiting, handed nothing (CONFIRMED)

The page is already built for this and says so in its own comments:

- line 142 seeds the promo field from `searchParams.get('promo')` — *"the code
  that brought them is exactly what belongs in this box"*
- `handleApplyPromo` (line 308) classifies before charging: it calls
  `/api/teams/redeem/preview`; a hit means team code, a miss means hand it to
  Stripe as a price code
- team codes **stack** (an agent can be on several teams); price codes
  **replace** each other (only one can change what an order costs)

The box works. It is simply never pre-filled.

---

## Why pasting a team code says "not found or expired"

That exact string is **ours**, not Stripe's:

    app/api/stripe/create-subscription/route.ts:293
    Promo code "..." not found or expired.

It is only reachable on the **Stripe branch**. Seeing it for a team code means
`/api/teams/redeem/preview` returned a non-success, so `handleApplyPromo` fell
through and asked Stripe about a code Stripe has never heard of.

Ruled out by querying the live database:

- all five codes are stored uppercase, no whitespace, `is_active = true`
- none are use-exhausted (`max_uses` null, `use_count` 0)
- every referenced team **and** campaign still exists
- `team_members.user_id` holds Clerk ids, matching what preview compares
  against — no id-namespace mismatch

Preview returns `success: true` for both `isOwnTeam` and `alreadyMember`, and
billing prints distinct messages for those. So neither produces this message.

**Unresolved:** which non-success preview actually returned. The live candidates
are a `401` (no session on that request) or the pasted string not being one of
the five real codes. Watching the Network tab on `/api/teams/redeem/preview`
while pasting answers it immediately — the status code is the whole diagnosis.

**Design defect regardless:** the classifier treats *every* non-success as "not
one of ours". A team code that exists but is expired, exhausted, or attached to
a deleted team is indistinguishable from a Stripe promo, and the user is told
the wrong thing about the wrong system. A 404 should mean "not a team code"; a
410 or 401 should surface on its own terms.

---

## What the codes actually are right now

All five live codes have `join_mode = 'approval'`. **None are `instant`.**

Even with the plumbing fixed, every joiner would land pending and wait for the
owner to accept in Requests. Instant access needs codes created with
`join_mode = 'instant'` — the redeem route honours it, but nothing has set it.

Both shapes exist and both must work:

- **team-wide** — `campaign_id` null, grants every campaign on the team
- **campaign-tied** — `campaign_id` set, grants exactly that campaign
  (`WUCRV62W` is one, and its campaign exists)

---

## What `/api/teams/redeem` already does (CONFIRMED)

    joinMode = code.join_mode === 'approval' ? 'approval' : 'instant'

    payer 'agent'  -> member status 'pending' always
                      (they must complete their own checkout first)
    payer 'owner'  -> 'active' if instant, 'pending' if approval

    chargeNow = single-use partner seat OR joinMode === 'instant'
      -> owner billed at the moment of joining
      -> charge row moves pending -> paid, or -> failed

    returns action:
      'redirect_to_billing'  agent-pays, needs their own checkout
      'redirect_to_dialer'   already active

This matches the intended behaviour almost exactly. Today it is reached only by
pasting a code into billing by hand.

---

## Intended flow

1. `/join/CODE` signed out, then sign-up **carrying the code**.
2. After sign-up, return to `/join/CODE` and redeem automatically.
3. Redeem decides:
   - **owner-pays + instant** — owner charged now, member active, straight into
     the dialer with the granted team/campaign.
   - **owner-pays + approval** — member pending. Full DialerSeat access, but that
     team's campaigns stay shut and a site-wide read-only "awaiting approval"
     header explains it.
   - **agent-pays** — `/billing?promo=CODE`, pre-filled and already recognised as
     a team code. Seat opens when their checkout succeeds. They may add a
     *separate* Stripe discount code alongside it, or just pay.
4. **Owner billing fails** — same read-only awaiting-approval state, not silent
   exclusion.

---

## The fix, in order

1. **Stop discarding the code at sign-up.** Either swap `forceRedirectUrl` for
   `fallbackRedirectUrl`, or keep routing through `post-signin` and pass the
   destination along. Routing through `post-signin` is preferable — it does real
   provisioning work — so it should accept and honour a return path.
2. **Teach `post-signin` about a pending join**, so a brand-new account holding a
   code lands on `/join/CODE` instead of `/welcome`.
3. **Pass the code to billing** as `?promo=CODE` on the agent-pays branch. The
   page already reads it.
4. **Split the classifier's failure modes** so an expired or exhausted team code
   says so, instead of being misreported as an invalid Stripe promo.
5. **Create codes with `join_mode = 'instant'`** where instant access is wanted.
   No code change; redeem already honours it.

Steps 1 to 3 make the flow work at all. Step 4 is what stops the next person
losing an evening to a misleading error message.

---

## The Clerk config this flow depends on

Two environment variables, and the flow silently breaks if either is wrong:

```
NEXT_PUBLIC_CLERK_SIGN_UP_FORCE_REDIRECT_URL = /api/auth/post-signin
NEXT_PUBLIC_CLERK_SIGN_IN_FORCE_REDIRECT_URL = /api/auth/post-signin
```

**FORCE, not FALLBACK.** Clerk's precedence is force > `?redirect_url` >
fallback, so only a force value guarantees that `/api/auth/post-signin` runs.
That endpoint is the router: it reads the join cookie, handles admin, the
welcome gate and tenant subdomains. Nothing else does.

The usual reason to prefer fallback is preserving deep links through
`?redirect_url`. Nothing here uses them — `proxy.ts` sends unauthenticated
users to a bare `/sign-in`, and post-signin ignores the parameter. The
`?redirect_url=/join/CODE` set by `/api/join/start` is a spare, not the
mechanism; the cookie is the mechanism.

**Pointed anywhere else** — `/dashboard`, `/welcome`, `/billing` — and every
invited signup skips the router. No membership is created, and the person
lands on a page with no sign an invite existed. This is not hypothetical: a
signup on 23 Aug 2026 did exactly that, and the code was live the whole time.

The three destinations that hold the code (`/welcome`, its continue button,
and `/billing`) now all forward to `/join/CODE` rather than to billing, so the
symptom is contained even when this config is wrong. The config is still the
thing to get right — containment is not correctness.
