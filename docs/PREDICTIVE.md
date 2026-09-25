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

A second line also needs the campaign's seller name and callback number,
because without the message the safe harbor is gone entirely.

The cap is min(5, `platform_config.predictive_line_ceiling`, the campaign's
max, the agent's LINES setting).

## When a lead answers

1. The dialing agent's seat is free and live → join it. Detection runs exactly
   as in progressive (same detector, same tuning, from `platform_config`).
   Machine → leave, agent back on the queue, lead held to the 9-second rule,
   hung up.
2. Seat busy → wait up to 1.8 s for the verdict, then look once more for the
   seat. Machine → hold and hang up, silently. Otherwise → the abandon message:

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

## Not built yet, on purpose

- **Handing a surplus answer to a free teammate.** It would cut abandonment on
  team floors, but the teammate could not hang that call up, poll it or
  disposition it: `/api/calls/hangup`, `/api/calls/check` and
  `/api/leads/dispose` all require the caller to own the call or lead. The line
  count assumes one agent, so compliance does not depend on it.
- **State calling rules** (Florida's 8 p.m. end and three calls in 24 hours,
  Fla. Stat. 501.616(6)). The calling window is shared by every mode and is a
  uniform 9 a.m. to 9 p.m.; changing it is a decision for all modes at once.
