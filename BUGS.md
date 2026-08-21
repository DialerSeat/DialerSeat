# Open bugs

Running list. Newest reports at the top. Each entry says where the problem is
and, where it has been traced, what the fix actually is — so picking one up does
not mean re-deriving it.

Nothing here is fixed unless it says FIXED.

---

## 1. Predictive gives dead air until AMD says human

**Reported:** the call puts out zero audio until it is verified human. Wanted:
audio the instant the line connects, even if that means hearing a sliver of
voicemail. **AMD's behaviour must not change** — only when audio starts.

**Traced.** `app/api/calls/events/route.ts`, the `call.answered` branch. Its own
header comment states the current rule:

> "controller_fanout calls: ... We don't yet know if it's a human or a machine —
> AMD is still running. So we do NOT bridge yet here. ... Audio isn't bridged to
> anyone during that window for fanout calls."

So the dead air is deliberate, and it is **predictive only**: agent-attended
(`user_dial`) calls are bridged by Telnyx itself via `bridge_on_answer` at
pickup, which is why every other mode already feels instant.

It is not the lead-info-reveal change. The dialer already switches at pickup —
`app/dashboard/dialer/page.tsx` says so directly: *"Deliberately switches at
PICKUP, before any AMD verdict — a voicemail opens the profile exactly like a
human does."* The UI was never the thing holding the audio.

**Fix:** call `bridgeAgentOntoLead` in the `call.answered` branch for
`controller_fanout`, instead of waiting for `call.machine.detection.ended`.
Leave the machine branch exactly as it is — it already drops the agent's leg the
moment AMD says machine, and the client already tears down its own SIP session
in response.

Low risk because `bridgeAgentOntoLead` is already idempotent: the conditional
`.is('bridged_at', null)` update means only the first caller issues a bridge, so
the existing human-verdict call becomes a harmless no-op rather than a second
bridge.

**Consequence to accept deliberately:** the agent hears the first moment of a
voicemail greeting before AMD cuts it. That is the trade being asked for.

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

**2b — a failed charge still approves the member. NOT FIXED.**
`app/api/teams/members/accept/route.ts` catches a seat billing failure, marks the
charge `failed`, and approves anyway. That is deliberate and commented:

> "A BILLING PROBLEM IS NOT A REASON TO REFUSE SOMEBODY ... an owner without a
> card on file could not accept anyone at all."

The instruction is now the opposite: no activation until billing goes through.
Worth deciding explicitly, because the old comment is describing a real cost —
an owner whose card fails can accept nobody, and the agent waits on someone who
cannot unblock them. A middle option: keep them pending, tell the OWNER plainly
that the card failed, and let the daily retry activate them when it settles.

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
