# AMD — Answering Machine Detection

How voicemail skipping works in DialerSeat, what it costs, and the rules that
must not be broken. Every number in this document is measured from production
traffic, not estimated.

---

## What it does

The lead answers. Telnyx listens to the first few seconds and reports back
`human`, `machine`, or `not_sure`. On `machine` we hang up and move the agent
to the next lead. On anything else the call stays up.

The verdict does **not** decide whether to connect the call. The call is
already connected, bridged at the instant of pickup, which is what makes audio
instant. The verdict decides only whether to *end* one.

---

## The latency budget

Measured across 128 production machine detections since 2026-08-05:

| Stage | Time |
|---|---|
| Telnyx detection (answer → verdict) | **3.31s** — fastest 1.11s, slowest 5.99s |
| Our handler (verdict → hangup) | **1.71s** → reduced, see below |
| Remainder (command → line actually drops) | ~0.7s |
| **Total heard by the agent** | **5.74s** |

A third of that was ours, not the carrier's. The handler was doing four serial
round trips before the hangup — the verdict write, a `calls` read, a config
read, and (briefly) a `record_stop`. None of them are things the hangup
decision needs finished first. They now run concurrently with, or after, the
hangup.

**Rule: nothing may be added above the hangup in `handleAmdResult`.** Every
`await` before it is another fraction of a voicemail greeting playing to an
agent who has already been told to move on. If new work is needed there, run
it inside the existing `Promise.all` or after the line drops.

---

## Current configuration

Live values in `platform_config`:

| Setting | Value | What it does |
|---|---|---|
| `amd_detector` | `detect` | Standard detection. Returns human/machine/not_sure. |
| `amd_total_analysis_ms` | 6000 | Hard ceiling on analysis. |
| `amd_greeting_duration_ms` | 3000 | Speech longer than this ⇒ machine. **Dominant term in the 3.31s.** |
| `amd_initial_silence_ms` | 3000 | Silence this long before speech ⇒ machine. |
| `amd_after_greeting_silence_ms` | 800 | Silence after a greeting ends. |
| `amd_max_words` | 8 | More words than this ⇒ machine. |
| `amd_max_seconds_after_answer` | 10 | Verdicts older than this are ignored. |
| `amd_hangup_when_bridged` | true | Honour a machine verdict even with an agent bridged in. |
| `amd_in_preview` | false | Preview mode runs no AMD at all. |

### Where the 3.31s comes from

`amd_greeting_duration_ms: 3000` is the main cost. A machine is declared once
its greeting has run past three seconds. Lowering it is the single most
effective way to speed up detection.

**The tradeoff is real and it is not symmetric.** A human saying "Hello?"
finishes in half a second, but a human saying "Hello, this is Dave speaking,
how can I help you?" runs past two seconds and is nine words — already past
`amd_max_words: 8`. Tightening these hangs up on real people. Skipping a
voicemail slightly late costs a few seconds. Hanging up on a prospect who
answered costs the deal.

**Rule: never tune the detector without measuring the human/machine split
before and after.** The ratio of `human` to `machine` verdicts is the alarm.
If `machine` climbs while dial volume is flat, the detector is eating people.

---

## The conflict nobody expects

Making AMD faster makes the Telnyx short-duration problem **worse**.

Telnyx surcharges calls with 6 seconds or less of billed talk time when they
exceed 15% of connected calls. Our machine detections average 5.74s and 82% of
them are already under that line. A sharper AMD that skips at 3s does not move
those calls out of the bucket — it drives them further in.

So the two goals pull opposite ways:

- **A sharp product** wants the agent off a voicemail as fast as possible.
- **The carrier** wants calls that are not trivially short.

Voicemail drop would satisfy both — detect fast, release the agent, and let
the lead leg stay up delivering a message, so the call that created the
short-duration risk becomes a 25-second delivery instead.

**DECIDED 2026-08-13: BUILT, opt-in per campaign.**

An earlier decision the same day was "no recorded messages", and it was
reversed once the economics were measured properly: the surcharge is
~$0.00165 per dial, which is over half a $0.003 target cost per dial. That is
not a rounding error, it is the unit economics.

How it is built, and why each part:

- **The message is the USER'S**, recorded or uploaded by them, never generated
  by us. FCC rules require a prerecorded telemarketing message to identify the
  business and give a callback number — so a generic "someone tried to call
  you" clip carries MORE exposure than a real one, not less.
- **Opt-in per campaign, off by default.** Selecting a message IS the toggle;
  there is no separate flag that could disagree with it.
- **Once per lead**, enforced by `leads.voicemail_dropped_at`. Three dials must
  not leave three identical voicemails — useless to the lead, and exactly the
  behaviour that gets a number reported, which would undo the point.
- **Capped at 20 saved messages per user**, enforced before upload so a
  rejection cannot orphan a file in storage.
- **`detect_beep` for these campaigns only.** Plain `detect` never reports when
  the greeting ended, so a message played on the verdict would record over the
  outgoing greeting. Campaigns that did not opt in keep the configured
  detector and are unaffected.

What is still worth doing, and is not about the ratio:

- **Do not redial numbers that always reach voicemail.** Fewer wasted dials,
  better answer rate, less spam signal. Real value regardless of the
  threshold.
- **Answer rate** is what Telnyx actually asked for, and it is a list-quality
  and caller-ID-health problem, not an AMD one.
- **Never pad call duration to clear the threshold.** A duration histogram
  that cliffs just past 6 seconds is the most visible thing there is to a
  carrier analytics team, and it reads as deliberate evasion. Voicemail drop
  is not padding: the call is longer because something is genuinely being
  delivered, and the lead can act on it.
- **Negotiate the rate card.** An AMD dialer is inherently short-call heavy;
  that is a traffic type, not abuse. With a 25% answer rate and a measured
  profile, asking Telnyx to price the traffic type is a normal conversation.

---

## Rules

1. **Nothing may be added above the hangup** in `handleAmdResult`. See the
   latency budget.
2. **`ROBOT_RESULTS` lives at module scope and has exactly one definition.**
   Two handlers depend on it — the one that ends the call and the one that
   discards its recording. A second copy is how they drift apart.
3. **Never tune the detector without measuring the human/machine split.** A
   rising `machine` share on flat volume means it is hanging up on people.
4. **The verdict window can never be shorter than the analysis it judges.**
   `amd_max_seconds_after_answer` is derived as
   `max(configured, total_analysis_ms/1000 + 3)` for this reason. A 6s window
   against a 6000ms analysis cap once suppressed *every* voicemail skip in
   production — 13 real machine verdicts, all silently discarded.
5. **Preview runs no AMD, by design.** A wrong verdict hurts most where the
   agent chose the lead deliberately. This means `amd_result IS NULL` is
   expected there and is not evidence of a fault — check `amd_requested`.
6. **Machine calls are never recorded.** Recording starts at answer, ~5.7s
   before the verdict, so a voicemail greeting is always captured. It is
   discarded and deleted from Telnyx on the verdict. The manual-record
   exception wins: an agent who deliberately hit record keeps their audio.
7. **AMD is billed per requesting leg.** `calls.amd_requested` records whether
   this call asked for it, so cost is counted rather than inferred.
8. **Do not switch to premium detection without an explicit decision.** It
   costs more per leg and the standard detector is not the bottleneck — our
   own handler latency and `greeting_duration_millis` are.

---

## What "no verdict" means

34% of answered calls carry no `amd_result`. That is **not** automatically a
fault. It covers three different things, which were indistinguishable until
`amd_requested` was added:

- AMD was never requested — preview mode, or AMD off globally or per campaign.
- AMD was requested and Telnyx never returned a verdict.
- The call predates `amd_requested` entirely (NULL).

Only the second is a defect. Check `amd_requested` before investigating.

---

## History — things that have already broken here

- **A minimum-age floor suppressed every skip.** Verdicts had to be at least 6s
  old to be trusted, while analysis was capped at 6000ms, so essentially every
  verdict arrived under the floor and was discarded. Real machine verdicts, in
  seconds after answer: 1.76, 2.01, 2.06, 2.07, 2.22, 2.36, 2.47, 2.52, 2.62,
  2.70, 3.03, 3.07, 3.95. Thirteen voicemails, every one ignored.
- **AMD ran in front of the bridge and returned nonsense.** A detector asked to
  classify an already-joined call returned `machine` for 12 of 12 humans.
- **`duration` was mistaken for talk time.** It is `created_at → hangup` and
  includes ~10s of ring, which hid a 66% short-call rate behind a
  healthy-looking 18.5s average. `talk_seconds` is the real number.
- **SignalWire-era verdicts still exist in the data** — `machine_start`,
  `machine_end_beep`, `unknown`, all stopped 2026-07-03. They are not handled
  by `ROBOT_RESULTS` and should not be: that detector is gone.
