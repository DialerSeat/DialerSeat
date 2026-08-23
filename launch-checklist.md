# Launch checklist — everything between here and marketing

**Written 2026-08-23.** Ordered. Each step says who does it and what I do.

The rule throughout: nothing here is polish. Every item is either a thing that
breaks in front of a paying customer, or a thing that has never once been
proven to work with real money.

---

## 1. Upgrade Vercel to Pro — **you**

Hobby's terms are non-commercial. Marketing is the definition of commercial
use, and the risk is not throttling — it is the deployment being pulled while
your first paying customers are on it.

Verified today: `vercel.json` has every cron at daily and `vercel-upgrade.md`
still reads NOT YET APPLIED, so this has not happened yet.

**I cannot do this** — it is a payment on your account.

---

## 2. Run the upgrade play — **me**

Say *"Vercel is on Pro — run vercel-upgrade.md"* and I apply it.

It cannot be staged ahead of time: a sub-daily cron expression does not degrade
on Hobby, it **fails the deploy** with `Hobby accounts are limited to daily
cron jobs`. So this lands after the plan changes, never before.

What it changes: cron frequency (seat enforcement and billing retry currently
run once a day, which means a failed card is chased once every 24 hours),
function duration ceilings, and the capacity notes.

---

## 2b. Upgrade Supabase off the free plan — **you**

Added after the fact, and it is arguably more urgent than Vercel rather than
less. The earlier version of this list left it out, which was a real omission.

Two ceilings arrive almost immediately once a genuine floor dials:

- **500 MB, then the database goes READ-ONLY.** No call rows, no dispositions,
  no heartbeats, no uploads. At 50 seats dialing 1,000 leads a day that is
  **under a week** of runway. `ops-health` warns at 70% and 85%, which is
  warning, not headroom.
- **The free Micro instance** (60 connections) lands around 300–500 progressive
  agents or **40–70 predictive at 5 lines**, on arithmetic rather than a load
  test. JG's 35 on predictive sits at the top of that range.

So the sequence before that floor runs is Supabase Pro **and** Vercel Pro. One
without the other still stops.

**I cannot do this** — payment on your account.

---

## 3. Stripe Customer Portal — **DONE**

Active by default on the account. Verified in code that nothing else blocks it:
the only guard in `/api/stripe/portal` is on `stripe_customer_id` being null —
somebody who has never paid at all — and it says so plainly rather than
erroring. The "no configuration" case is caught and named explicitly if it ever
does fire.

## 4. Clerk `user.updated` — **DONE**

Subscribed on the endpoint. Verified the handler acts on it rather than
acknowledging and discarding, which is what an earlier version did and what
caused the name-sync hunt:

```ts
if (evt.type !== 'user.created' && evt.type !== 'user.updated') return
```

Worth one live check during the sweep: change a name in Clerk, confirm it
reaches the `users` table without a sign-in.

---

## 5. Turn off the seat billing exemption before testing money — **me**

`pro@dialerseat.com` currently carries `users.seat_billing_exempt = true`. While
that is set, every seat it opens invoices **$0.00** — which is exactly why the
9 "paid" seats in the database prove nothing about billing.

Two options and I need you to pick:

- **Clear the flag on pro@** for the test, then set it back afterwards.
- **Use a second owner account** with a real card and leave pro@ exempt.

I'd take the second: it leaves your working test account alone, and it exercises
the path a genuine new owner takes, which is the one that matters.

Say the word and I flip it either way.

---

## 6. One real seat charge, end to end — **DONE, 23 Aug 2026**

Proven. `pmnt@dialerseat.com` joined Making Progress on an instant owner-pays
code, the seat charge settled, and the card statement reads **$15.00** against
`sub_1U7ft3LUtyFm1UFge9qHLdBk` — $35.00 list, less a 57.14% agreed rate, to the
cent. Weekly period, Aug 23 to Aug 30.

That is the first time money has moved through the seat path. Eleven billing
bugs had been found by reading before this; none of them had ever been
disproven by a transaction.

The original text follows, since the same steps re-verify it after any change
to the discount rules.

### Original

## 6. One real seat charge, end to end — **you and me**

The thing that has never happened. Nine paid seats, every one settled at $0
through the exemption or voided as self-funded. Your personal plan works; the
**seat** path is different code with a different Stripe shape and has never
moved a cent.

**You:** put a real card on the owner account and approve one agent.

**I cannot enter card details** — that is yours to type, always.

**Me, immediately after:** verify against both sides —
- `team_seat_charges` row reaches `paid` with a real `sub_...` id
- the Stripe invoice is **$35.00**, not $0
- the subscription renews weekly, on the right price
- `/api/admin/billing-check` agrees with the database

Then **you** refund it in the Stripe dashboard. I will not move money.

---

## 7. Prove the deactivate/activate switch on that same seat — **me watching**

New yesterday and it touches a live subscription. Deactivate it, confirm Stripe
shows `pause_collection`, activate it, confirm billing resumes. Then cancel one
and activate again — that path re-issues a brand new subscription rather than
un-pausing, and it is the newest code in the billing surface.

I verify the data; you press the buttons.

---

## 8. A real dialing day at volume — **you**, then me

3,243 calls all-time but **21 in the last 7 days**. The recent work has all been
teams and billing, while the call path changed underneath it: bridging, AMD
writing VOICEMAIL, the manual record toggle, the disposition relabelling.

Dial a real list for a real session. I read the logs, the `calls` rows and the
recordings afterwards and fix what it surfaces.

This is the step I would least want to skip. Everything else on this list is
provable at a desk; this one is not.

---

## 9. Decide the existing duplicate seats — **you**

Six duplicate subscriptions are live from before the one-seat-per-person rule.
You said leave them, which is fine and they are frozen — nothing sweeps
retroactively and no new one can be created.

If you ever want them collapsed:

```bash
curl -s -X POST "https://dialerseat.com/api/admin/consolidate-seats"
```

Dry run. Reports what it would cancel and changes nothing. Add `?apply=1` when
the plan looks right. I will not run this myself — it cancels live subscriptions.

---

## 10. Close out BUGS.md — **me**

Item 6 (join link paired with a fresh signup) is the only one not marked FIXED,
and it was exercised end to end this week: a fresh signup redeemed a link, the
membership was created pending, approval settled the seat. I can mark it and
write up what was actually proven.

---

## Then, and only then: marketing

### 11. Land JG's floor — **you**

35 agents is ~$1,225/week from one conversation, and it is the only load test
that means anything: real agents, real lists, all day. It also produces the one
asset this category respects — a named floor running seats in production.

Run it for two weeks before spending a pound on traffic.

**Me:** on call for whatever it surfaces, and I can build whatever reporting
you want to hand them.

### 12. Whitelabel as the channel — **you**, me on the build

The differentiated feature and the reason to talk to agency owners rather than
individual reps. A tenant reselling under their own brand markets you to their
own downline. Nobody else at $35/week hands them that.

**Me:** I can draft the outreach copy, the pricing page for tenants, comparison
pages, and anything the tenant onboarding needs. **You** send it — I do not
send messages or publish outward-facing content on your behalf.

### 13. Video advertising — **you film, me on everything around it**

You want real edited video, not generated filler. That is the right call for
this category and it changes what I should be building.

**The ad is the latency.** The one thing DialerSeat does that a viewer can
feel in three seconds is connect a call before they expect it. We measured
bridging at 0.09s. A split-screen of the click and the "hello" is a better
advertisement than any list of features, and it is unfakeable — which is
exactly why it lands.

Runners-up, in order of how well they film: the queue rotating with dispositions
landing on rows, five lines in flight on predictive, and a lead answering while
the agent's script is already on screen.

**A caution worth taking seriously.** Do not publish audio of a real prospect.
Two-party consent states make that a legal problem and it is a trust problem
everywhere else — an outbound dialer showing off a stranger's voice tells every
prospective customer exactly what will happen to their leads. Every call in
front of a camera should be to somebody who agreed to be filmed.

**What I can build so the product films well:**

- A demo campaign of obviously fictional leads pointed at numbers you control,
  so you can record a genuine dialing session without a single real customer
  record on screen. This is the one I would do first — it is the difference
  between filming freely and editing around your own data.
- Number masking is already there (`mask_lead_numbers`) if you would rather
  film against a real campaign with the numbers hidden.
- Whatever the shot needs: a cleaner idle state, a bigger call timer, a view
  that crops to vertical without the sidebar eating half the frame.

**What I can write:** scripts and shot lists for 30–60 second spots, the copy
that goes over them, and the landing page each one points at.

**What I cannot do:** film, edit, voice, or post any of it. And I will not
publish anything outward-facing on your behalf — you send it.

### 14. SEO, which is already half built — **me**

`lib/canonicalFacts.ts`, `lib/schema.ts`, the FAQ pages and the comparison
pages already exist and are structured for it. That is a surface to grow into,
not to build. I can extend it whenever you want.

---

## What I can do without you, any time

- Run the Vercel play the moment Pro is live
- Flip the exemption flag either way
- Verify every billing claim against the database and the Stripe mirror
- Fix whatever the dialing day surfaces
- Draft copy, pages, docs, reporting
- Build any diagnostic that would answer a question faster than guessing

## What only you can do

- Pay for Vercel Pro
- Save the Stripe portal config
- Tick `user.updated` in Clerk
- Enter a card, anywhere, ever
- Refund or move money
- Talk to JG, and send anything outward-facing
