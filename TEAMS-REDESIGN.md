# Teams — rebuild spec

Replacing `components/teams/TeamsManager.tsx` (1,452 lines) and
`components/teams/TeamOverview.tsx` (320) with a Stripe-dashboard-shaped
surface. The 22 routes under `app/api/teams/` stay; this is a front-end
rebuild, not a data-model one.

The admin desktop's own `apps/Teams.tsx` is a **different surface** and is out
of scope — it deliberately wears the OS-chrome look of that desktop.

---

## What makes Stripe feel like Stripe

Not the blue. Copying the colour without the structure is how dashboards end
up looking like a Stripe tribute act. The things actually doing the work:

1. **One number, enormous, top left.** Stripe opens on gross volume — the
   number you came for — at 32–40px, with a small muted delta beneath it. Not
   a grid of six equally-weighted tiles. Ours is **active agents right now**.
2. **Everything else is secondary and admits it.** 11–13px labels in muted
   grey, uppercase only for column heads, generous line-height. The hierarchy
   does the explaining, not borders.
3. **Whitespace instead of boxes.** Stripe separates with space and one hairline
   rule. Our current Teams page separates with cards inside cards.
4. **Tables are the primary object, not a footnote.** Dense rows, 40–44px,
   hairline dividers, no zebra striping, no card wrapper. The row is clickable
   and the whole row highlights on hover.
5. **Status is a quiet pill, never a colour-filled row.** Small caps, 10–11px,
   tinted background at ~8% opacity, coloured text. Green = active, grey =
   pending/paused, red = failed only.
6. **Numbers are tabular.** `font-variant-numeric: tabular-nums` so columns of
   figures line up. Stripe does this everywhere; it is most of why their
   tables look engineered rather than typed.
7. **Actions are text buttons, not filled blocks.** Filled is reserved for the
   single primary action on a screen.

## What we are NOT copying

- Their exact palette. DialerSeat has `--brand-*` tokens and white-label
  tenants override them; hard-coding Stripe indigo breaks every tenant.
- Their nav. We already have a sidebar.

---

## Information architecture

The current page tries to be a manager and an overview at once. Split it:

**Header** — team name, plan, and one primary action (Invite). Nothing else.

**The number** — `AGENTS ONLINE` as the hero, with `dialing / on call / ready`
as a muted breakdown beneath it. This is the question a floor manager actually
opens the page to answer, and `teams/[id]/overview` already returns all four
under `live`.

**A four-stat strip** — connect rate, calls, talk time, weekly spend. 11px
muted labels, 20px tabular values. Secondary by construction.

**ACTIVE USERS — the centrepiece.** One row per member, always visible, no
accordion:

| Column | Source |
|---|---|
| Name + email | `team_members` joined to `users` |
| Status pill | active / pending / paused |
| Live state | ready / on call / dialing / offline, from `agent_sessions` |
| Calls today | `calls` scoped to team + member |
| Connect rate | answered / placed |
| Talk time | **`talk_seconds`**, not `duration` — see below |
| Seat | who pays, and the pause/cancel control |

Row click opens a detail panel. Live state gets a small dot, coloured, so the
floor reads at a glance.

**Below the fold** — join codes, attached campaigns, billing history. Present,
not competing.

---

## Two data corrections to make while rebuilding

1. **`teams/[id]/overview` computes `talkMinutes` from `duration`.** That is
   dial→hangup wall clock and includes ring time, which averages ~10s on our
   traffic. It overstates talk time by roughly 2x. Use `talk_seconds`, which
   now exists on `calls` and is the real answer→hangup figure.
2. **Any per-member call count must exclude disposition rows.** 1,462 rows in
   `calls` have no `call_control_id` — they are dispositions written into the
   calls table, not calls. They inflate every denominator; filter
   `call_control_id IS NOT NULL`.

---

## Build order

1. Design primitives — `Stat`, `StatStrip`, `DataTable`, `StatusPill`,
   `LiveDot`. Built against `--brand-*` tokens so white-label still works.
2. The shell: header, hero number, stat strip.
3. ACTIVE USERS table, wired to a new `teams/[id]/members` endpoint returning
   the per-member row in one query rather than N.
4. Row detail panel.
5. Move join codes / campaigns / billing under the fold.
6. Delete `TeamsManager.tsx` and `TeamOverview.tsx` only once every capability
   they hold has a home. List them out first — that file has 1,452 lines and
   some of it is load-bearing.

Mobile is not a port. The table becomes stacked cards; the hero number and
live states stay.
