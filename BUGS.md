# Open bugs

Running list. Newest reports at the top. Each entry says where the problem is
and, where it has been traced, what the fix actually is — so picking one up does
not mean re-deriving it.

Nothing here is fixed unless it says FIXED.

---

## 1. Seconds of dead air before audio. FIXED.

Confirmed fixed on a live call. Three separate causes stacked, which is why the
first two fixes each only moved part of it and it kept looking like AMD.

**It was never AMD, and never the bridge.** Once `bridged_at` started being
recorded, the server was connecting the legs **0.09s and 0.06s** after the
prospect answered. That measurement is what turned this from an argument into a
search.

**Cause 1 — the audio attach retry ladder.** `attachSIPAudio` retried at 500ms,
1500ms and 3000ms. `tryAttach` fails while the peer connection is still being
built, which right after `accept()` is most of the time, so audio commonly
attached on the 3000ms rung. It compounded: `pc.ontrack` is registered INSIDE
`tryAttach`, so until one attempt succeeded nothing was even listening for the
track. Now polls every 60ms.

**Cause 2 — sip.js waited for ICE gathering with no timeout at all.** This was
the big one. sip.js does not send its SDP answer until ICE gathering is
COMPLETE, and from the installed v0.21.2:

    waitForIceGatheringComplete(restart = false, timeout = 0)
    ...
    if (timeout > 0) { ...arm the timer... }

Its own type says *"If zero, no timeout"*, and zero is what an unset
`iceGatheringTimeout` resolves to. The default is not a five second cap — it is
an UNBOUNDED wait for every STUN server in the list. No answer means no media.
Now capped at 500ms; ICE keeps gathering afterwards and late candidates still
arrive by trickle.

**Cause 3 — a stale comment that sent the search the wrong way.** The events
route claimed the dial stops carrying `bridge_on_answer` once AMD is enabled.
That had been reversed long before, but the prose survived, and it is the first
thing anyone debugging this reads. It cost real time here.

**The lesson worth keeping:** the fix only arrived after something was measured
rather than reasoned about. `bridged_at` was null on every user_dial row because
nothing recorded it, so "audio started late" and "audio started on time" were
indistinguishable after the fact. Recording it ended the guessing in one call.

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

## 3. Campaign dropdown shows for campaigns the user does not own. FIXED.

**Reported:** a user should not see the dropdown on a campaign they do not own.
Confirmed to be the per-campaign dropdown in the teams sidebar
(`components/teams/TeamsSidebar.tsx`) — the caret on each campaign row that
expands to reveal the agent roster underneath.

`SidebarTeam` already carries `isOwner`, but it is only used to render an
"Owner" tag (line 588). Nothing gates the caret or the roster it reveals.

Resolved as: the roster is the owner's to see. Expanding a campaign lists every
agent on it by name, which is a management view — for somebody who merely dials
the campaign it is a list of colleagues and how the floor is staffed, which they
cannot act on and were never meant to have.

The caret is hidden rather than disabled, because a control that does nothing
reads as broken and invites the click that proves it. A spacer keeps campaign
names aligned so the tree does not change shape per viewer.

---

## 4. "One of two on this team" remark in team view. FIXED.

`components/teams/TeamDetail.tsx` rendered `One of ${team.memberCount} on this
team` under the agent's seat status. Removed — it told the agent nothing they
could act on, and framed their own seat as a headcount line. Falls back to
"Active", which is what the row is actually reporting.

---

## 5. A member opening a campaign page just gets told off. FIXED.

**Reported:** the campaign page for a campaign the user does not own currently
renders red text saying they do not own it, and nothing else. Needs a real
member-facing campaign view built.

This is the same underlying gap as #3, seen from the other side: ownership is
being used only to REFUSE, never to decide what a non-owner should legitimately
see. A member on a campaign has a genuine reason to open it — their own numbers
on it, the script, which dispositions they have been recording, how much of the
list is left.

Answered as: ownership decides what somebody may CHANGE, not whether they may
see the work they are doing.

`/api/teams/campaigns/detail` now has a member branch returning a deliberately
narrow payload — the campaign's name and state, how much list is left, and the
viewer's OWN figures. `CampaignDetail` renders that as a personal scorecard with
a Dial button.

Absent by design, and worth stating because the temptation is to widen it: no
other agent's name or figures, no lead data, no settings, no codes, no drip
token, nothing that spends money. Widening it would turn a personal scorecard
into a leaderboard nobody asked to be on.

Access is checked properly rather than assumed: active membership on a team the
campaign is attached to, AND either a live grant on that campaign or the
campaign being open to the whole team. Anyone else still gets the 403.

**Caught while building it:** the stored dispositions are `NOT INTERESTED` and
`DO NOT CALL` — with spaces. Matching on `NOT_INTERESTED` and `DNC`, which is
what a reader would assume and what a comment elsewhere still claims, returns
zero forever with no error. Both spellings are now accepted. A stat that silently
reads zero is worse than one that is missing, because it looks like an answer.

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
