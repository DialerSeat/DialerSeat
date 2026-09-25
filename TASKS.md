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

## 1. Dialer and call logs. DONE 25 Sept 2026.

All four shipped together. Nothing here is verified on a live floor yet.

1. **Daily metrics: swap the two times.** DONE. TIME CONNECTED on the left,
   TIME DIALED on the right.
2. **Live calls full screen should not take the page with it.** DONE. Opening
   live calls asked the browser for real fullscreen on the way in, so one
   button did two things. It now only swaps what the app shows; the button
   beside it still takes the screen.
3. **Call logs: show the pool number a lead was dialed from.** DONE. A POOL
   column left of FROM, from `calls.pool_number_id`. A dash on the ~5% of
   calls placed through the env-fallback caller ID, which is not recorded.
4. **Compliance percentage on the live calls full screen.** DONE. Left of the
   Telnyx balance and sized with it. The CARRIER's short-call ratio, the same
   figure and fallback as the map's compliance box.

## 1b. The agent's browser missing its calls. IN PROGRESS.

The label said 4-7% of dials. Sorted by what actually happened on the real
dialing days (15-18 Sept, 2,063 dials, 85 filed as AGENT_LEG_FAILED):

- **48 were the agent skipping, stopping or aborting while the lead rang.**
  DONE 25 Sept (f7af6024): `calls.ended_by_agent_at` is stamped before the
  hangup is sent, and those calls are no longer filed as failures. They had
  been recorded as never rung, so the attempt went uncounted, the pool number's
  usage was refunded and Florida's three-a-day count missed them.
- **17 (0.8%): the browser dropped a leg it had answered**, with no hangup
  request. Our own code. The server's events cannot show which path did it:
  timestamps drift, and the decision happened in the browser. NEXT, this
  evening (dialer change): record every agent-leg teardown with the code path
  that did it, then fix it on that evidence.
- **20 (1.0%): the browser never answered** — a dead connection. After the
  above.

The real rate is 1.8%. That also changes the cost switch
(`dial_agent_on_answer`, section 3): its blocker was this failure rate.

## 2. Idea, not scheduled

- **A console log app.** Somewhere to read the console errors a user is
  actually getting, either streamed or pulled from their current session on
  request. Raised 25 Sept 2026 as an idea only — do not build it without
  asking.

## 3. After 1b: AMD and recording cost tuning

Both change the call path, so both ship outside the dialing day, and **a backup
of the working AMD configuration is taken before either starts** (the detector
settings in platform_config, in a migration that can be replayed, plus a git
tag on the code).

0. **Backup.** DONE 25 Sept: `platform_config_backups` row, the restore
   UPDATE in db/migrations/2026-09-25-amd-baseline-backup.sql, and git tag
   `amd-baseline-2026-09-25`.
1. **AMD accuracy tuning.** MEASURED, NOT CHANGED, 25 Sept (see AMD.md tuning
   log). 67% of human verdicts were skipped by agents, which looks like
   voicemail passed as people, but the data has no ground truth, and the
   obvious setting (longer confirm-a-human silence) is recorded as having hung
   up on real people before. Waiting on a listen to ~15 of the 103 recorded
   skipped-human calls; then one step, measured.
2. **Recordings start 10 seconds after a person picks up.** DONE 25 Sept
   (3180f4b6). Only if the call is still up and the agent has not skipped it.
   Telnyx bills each recording a 60-second minimum, so this removes the
   recordings of calls over in seconds.

## Cost per dial: where it stands

Measured from Telnyx's own call.cost records, 15-24 Sept: **$0.0093 a dial**
(2,518 dials, $23.54). Voicemail billed a full 60 seconds is $0.0041 of it:
machines are 76% of answers, average 11.6 s, and are billed a minute each.
Telnyx no longer offers 6-second billing (Joshua, 25 Sept), so that part stays.
The levers left are ours: the agent leg only on answer (after 1b), fewer wrong
AMD verdicts, and recordings that start later.

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
