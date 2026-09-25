# Predictive — how it works (v2, 24 Sept 2026)

Predictive is rebuilt around four decisions. Each one is here because the
previous design broke on exactly that point.

## 1. One agent line per session: the seat

The old engine dialed the agent's browser again for **every line**: three lines
meant three agent legs ringing one browser, each billed for the whole ring.
That was 82% of predictive's carrier spend (COST-FINDINGS §1ag).

Now, when the agent presses START, the server dials the agent's browser
**once**. The browser answers, and the server puts that leg in a Telnyx
conference of its own: the seat. Every answered lead is **joined** into that
conference and **leaves** it when it's done. The seat stays up the whole
session.

- Connecting is a join onto a line that's already open, so a person who says
  hello hears the agent at once. That is the 2-second rule, met by
  construction rather than by racing a dial.
- Telnyx: *"Removes a call leg from a conference and moves it back to parked
  state."* A voicemail can leave the agent instantly while its own leg stays
  up for the 9-second rule, with nobody hearing it.
- Cost: agent leg $0.004/min plus conference $0.002/min, about $0.36 an hour
  while armed. The per-line legs it replaces cost about $0.0013 per line, so
  the seat is cheaper from roughly 280 lines an hour upward, and it removes the
  failure mode of a browser juggling several invites at once.
- Conferences expire after 4 hours (Telnyx). The heartbeat re-places the seat
  if it is ever gone while the engine is armed.

## 2. Rounds, with 1x/2x/3x per lead

A round is up to L lines dialed together. The next round starts only when
every line of the current one has ended and the agent is back on the queue.

A round is filled with leads **still owed a repeat** first (the campaign's
1x/2x/3x, `backToBackAttempts`), then fresh leads from the top of the queue.
The redial rule is progressive's own (`lib/redialDecision`): only no-answer and
voicemail earn a redial; a person picking up ends the sequence. Lifetime
attempts (nine) still apply through the same `bumpLeadAttemptAndRelease`.

State lives in `predictive_batch` (one row per lead in play for a session).

## 3. No leg is ever cut short

- **Ringing legs ring out.** Nothing cancels a ringing line: not a pickup on
  another line, not STOP. A leg that rings out ends with Telnyx `timeout`,
  which Telnyx does not count as abandoned (COST-FINDINGS §1ad). The ring window
  is 20 s, above the TSR's 15-second floor.
- **Answered legs we end are held to the 9-second rule**: 8 s + U[0, 2.5) s
  from answer (`lib/complianceHold`), in the background, after the agent has
  already been freed. Voicemails, agent skips, and a seat that drops mid-call
  all go through the same hold.
- **The abandon message is never cut off.** It plays as a gather and the leg
  hangs up only when Telnyx reports it finished (~14 s). It used to be spoken
  and hung up in the same breath.

## 4. As many lines as the law allows, from the campaign's own record

The abandonment rule is per campaign over 30 days: abandoned ÷ answered by a
person ≤ 3% (16 CFR 310.4(b)(4)(i), 47 CFR 64.1200(a)(7)). Lines are chosen so
the projected rate stays at or under 2%:

- expected abandoned per human answered at L lines, for one agent with ring-out:
  `(L·h − (1 − (1 − h)^L)) / (L·h)`, where h is the campaign's human-answer
  rate per dial (14 days, prior of 12% weighted as 50 dials);
- projected = (abandoned₃₀ + that × 50) ÷ (answered₃₀ + 50);
- take the largest L ≤ the cap with projected ≤ 2%. One line is always allowed:
  it cannot abandon anyone;
- measured 30-day rate ≥ 2.5% forces one line, whatever the projection says.

The 30-day numbers come from the `calls` table (`was_abandoned`, answered
non-machine calls). The old guard read `pacing_metrics`, which no code has ever
written: it held zero rows, so the advertised auto-degrade could never fire.

The same `predictive_campaign_stats` count is what the agent sees: the
terminal's 30D ABANDON (`/api/dialer/active-agents`) and the Compliance tab
(`computeAbandonRate30d`) both read it, and show a dash, not 0.00%, before a
campaign has anyone answered in 30 days. The heartbeat's legacy
`should_yield` still reads `campaign_abandon_rate_30d`, a view over the empty
`pacing_metrics`, so it never fires; the line count above is the only rule.

A second line also needs the campaign's seller name and callback number,
because without the message the safe harbor is gone entirely.

The cap is min(5, `platform_config.predictive_line_ceiling`, the campaign's
max, the agent's LINES setting).

## When a lead answers

1. The dialing agent's seat is free and live → join it. Detection runs exactly
   as in progressive (same detector, same tuning, from `platform_config`).
   Machine → leave, agent back on the queue, lead held to the 9-second rule,
   hung up.
2. Seat busy → a teammate takes it, when all of these hold: the campaign is a
   team campaign, and the teammate is on that team and that campaign, running
   predictive themselves (armed, seat live), free (no call, on the queue
   panel) and heartbeating. Whoever has waited longest goes first. The call is
   stamped `calls.handled_by` with the teammate's id, which is what lets them
   poll, hang up and disposition a call dialed on someone else's session.
3. Nobody free → wait up to 1.8 s for the verdict, then look once more for
   either seat. Machine → hold and hang up, silently. Otherwise → the abandon
   message:

   > This is a telemarketing call from *Seller*. To be added to our
   > do-not-call list, press 9 now. To reach us, call *number*.

   Press 9 → the number goes on the do-not-call list and the call ends at
   once (FCC 64.1200(a)(7)(i)(B)). Recorded as `was_abandoned`.

## Controls

- **STOP** stops placing lines. Lines in flight ring out; a person who answers
  still reaches the agent while the seat is up. The seat is released when the
  last line ends.
- **Runaway breaker**: more than 6 dials per allowed line in a minute pauses
  the engine for 30 s and logs `predictive_breaker`.
- Every idle tick records why (`fanout_idle`), as before.

## State rules

- **Florida** (Fla. Stat. 501.616(6)): the window ends at 8 p.m. lead-local
  (`STATE_RULES.FL` in lib/timezones.ts; the uniform 9 a.m. start already sits
  inside Florida's 8 a.m.), and no more than three calls to the same number in
  24 hours, counted across the account and the campaign
  (lib/placeOutboundCall.ts). Both apply in every mode.
- A refusal is a 451 with `retryAfter`. Predictive holds the lead's claim until
  then rather than releasing it to be claimed and refused again every round
  (`N held until callable` in the controller's reason). The client modes
  dispose it `TCPA_BLOCKED`, which keeps the lead's status, spends no attempt
  and leaves its disposition and note alone.
- Alabama and Mississippi (8 p.m.) and Louisiana (no Sundays) are not added
  until each is checked against its statute the way Florida was.

## Not built yet

- **Holding a skipped ringing call to 15 seconds in the client modes.** 47 CFR
  64.1200(a)(6) forbids disconnecting an unanswered call before 15 seconds or
  four rings. Predictive never cuts a ringing line, but in preview, power and
  progressive a skip while the lead is ringing hangs it up at once. Holding it
  would make a late pickup an abandoned call with nobody on it, so it needs
  the abandon message there too: a decision, not a patch.
