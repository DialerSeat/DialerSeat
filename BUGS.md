# Open bugs

Running list. Newest reports at the top. Each entry says where the problem is
and, where it has been traced, what the fix actually is — so picking one up does
not mean re-deriving it.

Nothing here is fixed unless it says FIXED.

---

## 1. Dead air until AMD says human — CAUSE NOT FOUND IN CODE

**Reported:** zero audio until the call is verified human. Wanted: audio the
instant the line connects, even if that means a sliver of voicemail. AMD's
behaviour must not change.

**The first diagnosis in this file was wrong and has been replaced.** It said
fan-out waits for the verdict before bridging. That was true once; it is not now,
and worse, a stale comment in the code still said so, which is what the diagnosis
was built on.

**What the code actually does today:**

- `lib/placeOutboundCall.ts` sets `bridge_on_answer` **unconditionally** whenever
  there is an agent leg — see its ALWAYS BRIDGE ON ANSWER block, which reversed
  the bridge-after-detection arrangement on measured grounds: the bridge tracked
  the verdict to within ten milliseconds, because it WAS the verdict.
- `app/api/calls/events/route.ts` explicitly does **not** re-bridge `user_dial`
  on a verdict; its guard excludes it, precisely because re-bridging a live call
  can drop the audio the agent is using.
- Fan-out gained a pickup bridge too (`c8995257`, `f8769239`).

**What the live data says:**

- Every call since 18 Aug is `user_dial`, not predictive — so this is the
  agent-attended path, and fan-out is not involved at all.
- All three calls today had an agent leg, meaning `bridge_on_answer` was set.
- The last `fanout_placement_failed` event is 15 Aug.

So the code already does the thing being asked for, and there is no evidence in
the database of the bridge being withheld. Telnyx's own docs do not say that
`answering_machine_detection` delays `bridge_on_answer`, so that cannot be
asserted either.

**Fixed here:** the stale comment, which was a live hazard rather than untidiness
— anyone debugging this reads it, believes the bridge is gated on AMD, and goes
to work on a mechanism that was removed.

**To settle it needs one live call watched in real time**, since neither the code
nor the stored rows can distinguish "audio started late" from "audio started on
time". Worth capturing when it happens: the exact call, whether the agent leg was
up before the lead answered, and how long after `answered_at` the audio arrived.

One thing worth ruling out first: AMD is on for every recent call, and a
`machine` verdict releases the agent within a few seconds. Two of today's three
calls came back `human` and one `machine` — if what is being heard is the machine
path releasing the agent, that is AMD working as designed rather than an audio
bug, and it would feel identical from the agent's chair.

---

## 2. A seat can go active before the money does

**Reported:** John Doe invited Test 2 with an owner-pays code. Test 2 became
active without the seat charge succeeding. Two separate faults.

**2a — the owner's own comp travels to the seats. FIXED (detection only).**
Seat subscriptions are created on the OWNER'S Stripe customer, and Stripe
applies a customer-level discount to any subscription that has no discount of
its own. An owner holding a 100%-off comp therefore gets every seat free, with
no error anywhere, because a $0 invoice settles happily. It only bites below the
first volume tier, since a subscription carrying the volume coupon does not
inherit the customer's.

`lib/teamBilling.ts` now detects this and raises an admin alert. It cannot
*prevent* it: blocking inheritance needs a subscription-level discount, and
Stripe requires `percent_off` greater than zero, so there is no no-op coupon to
apply. **The comp has to be moved off the customer and onto the owner's personal
subscription in Stripe** — that part is a data fix, not a code one. The app's own
checkout already applies coupons at subscription level; the bad shape comes from
applying one to a customer by hand in the dashboard.

**2b — a failed charge still approves the member. FIXED.**
`app/api/teams/members/accept/route.ts` catches a seat billing failure, marks the
charge `failed`, and approves anyway. That is deliberate and commented:

> "A BILLING PROBLEM IS NOT A REASON TO REFUSE SOMEBODY ... an owner without a
> card on file could not accept anyone at all."

Decided the other way, and both paths now enforce it. Manual approval returns
402 and leaves the member pending. Instant approval demotes them back to pending
if the card fails after they were let in — "instant" sets them active before the
card is tried, which the failure makes premature.

Nobody is rejected, only held: the owner fixes the card and accepts from
Requests, and the awaiting-approval banner tells the agent where things stand
meanwhile.

**Also fixed: the seat now verifies what it actually billed.** Rather than
trusting that no stray discount reached it, `createSeatSubscription` reads the
invoice Stripe produced and compares it against itself — if we applied no
coupon, total must equal subtotal. Anything less means a discount we did not
choose, the mispriced subscription is cancelled, and the seat is refused as a
billing failure. A seat billed at zero is a billing failure, not a free seat.
This catches the inherited comp without depending on any undocumented Stripe
behaviour, and catches any future cause too.

---

## 3. Campaign dropdown shows for campaigns the user does not own

**Reported:** a user should not see the dropdown on a campaign they do not own.
Confirmed to be the per-campaign dropdown in the teams sidebar
(`components/teams/TeamsSidebar.tsx`) — the caret on each campaign row that
expands to reveal the agent roster underneath.

`SidebarTeam` already carries `isOwner`, but it is only used to render an
"Owner" tag (line 588). Nothing gates the caret or the roster it reveals.

To build out rather than just hide: decide what a non-owner should see under a
campaign — nothing at all, only themselves, or the roster minus other agents'
names.

---

## 4. "One of two on this team" remark in team view. FIXED.

`components/teams/TeamDetail.tsx` rendered `One of ${team.memberCount} on this
team` under the agent's seat status. Removed — it told the agent nothing they
could act on, and framed their own seat as a headcount line. Falls back to
"Active", which is what the row is actually reporting.

---

## 5. A member opening a campaign page just gets told off

**Reported:** the campaign page for a campaign the user does not own currently
renders red text saying they do not own it, and nothing else. Needs a real
member-facing campaign view built.

This is the same underlying gap as #3, seen from the other side: ownership is
being used only to REFUSE, never to decide what a non-owner should legitimately
see. A member on a campaign has a genuine reason to open it — their own numbers
on it, the script, which dispositions they have been recording, how much of the
list is left.

Worth designing once and applying to both surfaces: what does a campaign look
like to somebody who dials it but does not run it? Owner-only, at minimum, are
the lead file, the team assignment, the dialer mode, AMD and recording settings,
and anything that spends money.

---

## 6. Untested: the join link paired with a fresh signup

**Not a bug — the verification that is still owed.** Several fixes tonight all
land on one path, and none of them has been watched end to end by a real person
creating a real account:

- `/join` made public in `proxy.ts`, so the page runs at all
- `fallbackRedirectUrl` on sign-up and sign-in, so Clerk stops overriding
- the `ds_join_code` cookie, scoped to the root domain to survive a whitelabel
  subdomain
- `/welcome` carrying the code to `/billing?promo=CODE`
- billing applying it on arrival instead of only pre-filling the box
- the redeem endpoints allowed through for a user with no subscription
- pending owner-funded seats getting read-only access instead of a redirect loop

Every one of those was verified as far as it could be without an account. The
uncovered leg is the same in all of them: **what happens immediately after
someone signs up.** That cannot be tested from here — creating accounts is off
limits — so it needs a real run.

Worth doing in one sitting, in this order, since each step gates the next:

1. Open a join link signed out, in a clean browser profile.
2. Sign up. Confirm you come back to `/join/CODE` and not to `/welcome` empty
   handed.
3. Owner-pays: confirm no redirect loop, and that the amber awaiting-approval
   banner names the team.
4. Agent-pays: confirm billing opens with the code already applied, not merely
   typed into the box.
5. Accept in Requests, and confirm the seat charge lands `paid` with a non-null
   `stripe_subscription_item_id`.

Also still unverified: the `DeadInvite` page body (this machine has no Supabase
env, so it 500s locally — route resolution was confirmed, the render was not),
and the whitelabel subdomain redirect after joining (no tenant to test against).
