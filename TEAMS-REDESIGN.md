# Teams — rebuild spec

Replacing `components/teams/TeamsManager.tsx` (1,452 lines) and
`components/teams/TeamOverview.tsx` (320). The 22 routes under
`app/api/teams/` stay; this is a front-end rebuild.

`components/admin-desktop/apps/Teams.tsx` is a **different surface** and out of
scope — it deliberately wears that desktop's OS chrome.

---

## The form follows the job

Stripe was the wrong reference and is deliberately abandoned here. Stripe is a
**billing** dashboard: centered, calm, max-width 1100, read once a week to
answer "how did we do". Teams answers a different question, continuously:
**who is on the floor right now and is it going well.**

That is a control room, not a report. Control rooms are full-bleed, dense,
and they move.

### Non-negotiables

1. **Edge to edge. No centered column, no max-width, no page card.** The
   content owns the full viewport width. A 27" monitor should show more
   agents, not more grey margin.
2. **Nothing is centered-and-constrained.** Vertical rhythm comes from a
   sticky header plus scrolling content, not from a stack of boxes down the
   middle.
3. **The floor is the page.** Not a widget on it.

---

## Layout

A three-region app shell using CSS grid, full height, no outer padding:

    ┌───────────────────────────────────────────────────────────┐
    │  BAR   team · plan · live pulse · invite            56px   │
    ├──────────────────────────────────┬────────────────────────┤
    │                                  │                        │
    │   FLOOR                          │   INSPECTOR            │
    │   agent grid, then roster table  │   slides in on select  │
    │   scrolls independently          │   420px, collapsible   │
    │                                  │                        │
    └──────────────────────────────────┴────────────────────────┘

`grid-template-columns: 1fr auto` — the inspector is a real grid column, so
opening it **reflows** the floor rather than covering it. No modal, no
accordion, nothing pushing rows apart.

### The bar

56px, sticky, full width. Team name, plan, and a **live pulse strip** — a
horizontal row of tiny bars, one per agent, coloured by state. At a glance,
across the whole width: how much of the floor is green. This is the ambient
signal; you should be able to read the room without focusing on anything.

Primary action (Invite) sits far right, and is the only filled control on the
screen.

### The floor — agent cards, not a table first

The top region is a **responsive auto-fill grid of agent cards**:

    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));

so the count per row is driven by viewport width, not a breakpoint list. Each
card carries:

- Name, and a **state dot that actually animates** — a CSS `@keyframes` ring
  pulse while on a call, static when ready, hollow when offline. Motion is
  reserved for live state and used nowhere else, so movement always means
  something.
- **A sparkline of their last 20 calls** — inline SVG, connect/no-connect as
  height. Shows shape, not numbers.
- Three figures in `tabular-nums`: calls, connect %, talk time.
- Current lead if on a call.

Cards are the *live* view. Below them, the same people as a **dense roster
table** for the administrative work — seat, who pays, pause, remove. Two
views of one dataset, each shaped for its job, both always visible. No tabs.

### The inspector

Selecting an agent slides in the right column. Their detail, their recent
calls, their seat controls. Uses `view-transition-name` on the selected card
so the card visually becomes the panel header where supported, and degrades
to a plain slide where not.

---

## Techniques to actually use

Not decoration — each earns its place:

- **CSS container queries** on the agent card, so a card in the narrow
  inspector renders compact and the same component in the wide floor renders
  full. One component, no prop-drilled `size`.
- **`grid-template-columns: subgrid`** on the roster rows so every row's
  internal columns align to the table grid even when cells wrap.
- **Inline SVG sparklines**, generated from the call array. No chart library —
  it is a polyline, and Recharts here would be 40kb for a squiggle.
- **`content-visibility: auto`** on off-screen roster rows. A 200-agent floor
  should not paint what nobody is looking at.
- **A single `@keyframes pulse`** bound to live state only.
- **`tabular-nums`** on every figure.
- **Colour carries state, never decoration.** Green on call, amber ready,
  grey offline, red failed. Everything else is ink and surface.

## What NOT to do

- No hard-coded palette. White-label tenants override `--brand-*`; the whole
  surface reads from tokens.
- No modal for the inspector. It is a column.
- No accordion anywhere.
- No card wrapping the entire page.
- No chart library for a sparkline.

---

## Data corrections to make during the rebuild

1. **`teams/[id]/overview` computes `talkMinutes` from `duration`** — wall
   clock including ~10s average ring, overstating talk time by roughly 2x.
   Use `talk_seconds`.
2. **Per-member call counts must filter `call_control_id IS NOT NULL`.** 1,462
   rows in `calls` are disposition rows, not calls, and inflate every
   denominator.
3. One new endpoint: `teams/[id]/members` returning the full per-member row —
   identity, live state, today's calls, connect rate, talk time, seat — in one
   query. The current page would need N+1.

## Build order

1. `teams/[id]/members` endpoint.
2. Shell: grid regions, sticky bar, live pulse strip.
3. `AgentCard` with container queries, state dot, sparkline.
4. The floor grid.
5. Roster table with subgrid.
6. Inspector column and view transitions.
7. Only then delete the old files — enumerate every capability in
   `TeamsManager.tsx` first and confirm each has a home. 1,452 lines hide
   things.

Mobile: the inspector becomes a bottom sheet, the floor grid goes single
column, the roster table becomes the card list. The bar and pulse strip stay.

---

## Backlog

### Hide lead numbers until a human answers

A campaign setting, available in New Campaign and editable later from the team
view, applying to **all four dialer modes**.

While it is on, the queue panel does not show a lead's phone number. The number
appears only once AMD has confirmed a human pickup on that specific lead —
everything before that (upcoming rows, ringing, machine verdicts, no-answers)
stays masked.

**Why it matters commercially.** A lead vendor selling seats on their own list
is currently handing every agent a readable copy of the whole stash. One export,
one screenshot of a scrolled panel, and the asset they sell is gone. Masking
until connection means an agent can work the list without ever being able to
take it — they get the conversations, not the inventory.

Implementation notes for whoever picks this up:
- The panel already knows which lead is live (`activeDialingLeadIds`) and the
  verdict already lands in `calls.amd_result`, so the reveal condition is
  `amd_result = 'human'` on the current call for that lead id. No new detection
  work.
- Mask in the API response, not just the UI. A number that reaches the browser
  and is merely hidden by CSS is not protected — it is one devtools panel away.
  `/api/leads/list` and the queue fetch have to omit it.
- Search must keep working on the masked list, which means matching
  server-side rather than filtering a client array of numbers.
- The dial path itself is unaffected: `placeOutboundCall` reads the lead from
  the database, so the browser never needs the number to make the call.
- Exports are the biggest hole and must be closed in the same change. CSV
  download hands over the entire list in one click — masking the panel while
  leaving /api/leads/export open protects nothing. On a masked campaign, an
  agent's export must omit the phone column outright; the owner's own export
  keeps it, since it is their list.
- Same for the leads page and any bulk view an agent can reach.


### A member's team view is not the owner's

Clicking a team shows the same panel to everyone right now: stats, campaigns,
members, join codes. That is the owner's view and only the owner's.

A member opening their own team should see **what they can work** — the
campaigns available to them, and how to get into one — not aggregate
performance for a team they do not run. Total leads and dialed counts across
everyone else's work is somebody else's business, and codes and the roster are
administration they have no part in.

So: same route, two panels. Owner keeps stats + campaigns + members + codes.
Member gets available campaigns, each with a way to start dialing it, and
nothing else.


### A campaign view page

Clicking a campaign should open it the way clicking a team opens a team, rather
than only scoping the overview. What belongs there:

- **Its numbers** — leads, dialed, contact and conversion rate, for this
  campaign alone.
- **Who works it** — the agents with access, and a way to add or remove one
  without going through the team roster.
- **Its settings, editable in place** — dialer mode, AMD, recording, access
  mode, repeat count. These are set once at creation today and cannot be
  changed afterwards from anywhere in Teams.
- **Leads** — upload more, or replace the list entirely. Replacing is the
  common one for a vendor rotating a stale file, and it is currently a trip to
  the Leads page with no campaign context.
- **Pause / activate**, the same toggle now on the team view.

The pieces mostly exist: /api/campaigns/update takes every setting,
/api/teams/access/{grant,revoke} moves agents on and off, and lead upload is on
the Leads page. This is assembly plus one view, not new capability — the value
is that an owner stops having to know which of four pages holds the control
they want.
