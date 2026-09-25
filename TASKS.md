# Open tasks

What Joshua has asked for and what has not been built yet. Newest list at the
top of its section. An item is done when it says DONE and names the commit.

Order matters here: the AMD and recording work at the bottom waits until
predictive is known to work on a real dialing day.

---

## 0. First: is predictive actually working?

Nothing below the UI section starts until predictive has run a live day and the
answer is yes. Asked 25 Sept 2026.

What to read when it runs (docs/PREDICTIVE.md has the full spec):

- did a round place 2 or 3 lines, and did the lines ring out rather than being
  cut;
- did a surplus answer reach a teammate, or hear the recorded message;
- `predictive_campaign_stats` for the campaign: answered vs abandoned over 30
  days, and whether the engine held itself under 2%;
- `call_events`: `predictive_route`, `predictive_seat`, `tsr_abandon_message`,
  `fanout_idle` reasons;
- cost per dial against the $0.0032 target.

---

## 1. Dialer and call logs (next)

1. **Daily metrics: swap the two times.** TIME CONNECTED on the left, TIME
   DIALED on the right.
2. **Live calls full screen should not take the page with it.** Clicking full
   screen on live calls currently puts the whole page into real full screen.
   It should expand the call logs panel only, and leave the browser alone.
3. **Call logs: show the pool number a lead was dialed from**, immediately left
   of the state it was dialed from.
4. **Compliance percentage on the live calls full screen**, to the left of the
   Telnyx balance.

## 2. Idea, not scheduled

- **A console log app.** Somewhere to read the console errors a user is
  actually getting, either streamed or pulled from their current session on
  request. Raised 25 Sept 2026 as an idea only — do not build it without
  asking.

## 3. Last: AMD and recording cost tuning

Both of these change the call path, so they come after predictive is proven,
and **a backup of the working AMD configuration is taken before either starts**
(platform_config's detector settings, in a migration that can be replayed).

1. **Recording start tuning.** Stop paying to record what turns out not to be a
   conversation: a recording that begins on a false flag is billed per minute
   and stored. See docs/COST-FINDINGS.md for the per-minute rates and
   app/api/calls/events (recording.saved) for where a machine's greeting is
   already discarded.
2. **AMD accuracy tuning.** Fewer wrong verdicts is what makes the recording
   rule above safe: every machine called a human is a recording paid for, and
   every human called a machine is a lead hung up on. Same detector settings
   for progressive and predictive (docs/AMD.md).

---

## Decisions waiting on Joshua

- **Recordings say they are deleted after 30 days and they are not.** Nothing
  on the live path sets `recording_expires_at`, so the retention cron deletes
  nothing: 271 recordings back to 22 June have no expiry, and Telnyx keeps
  them a year. Either the deletion becomes real (irreversible for the existing
  audio, so it needs a yes) or the compliance page and privacy policy change.
- **Skipping a call that is still ringing hangs it up at once** in preview,
  power and progressive. 47 CFR 64.1200(a)(6) wants 15 seconds or four rings.
  Holding it means a late pickup becomes an abandoned call, so it needs the
  recorded message there too.
