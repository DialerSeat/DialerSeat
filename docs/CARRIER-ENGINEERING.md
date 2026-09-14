# Carrier Engineering

How DialerSeat actually talks to a carrier, and why each piece is shaped the
way it is. None of this is plug-and-play. A dialer that simply calls
`POST /calls` and waits works for one agent making one call, and falls apart at
the point where it has to place calls nobody is waiting on, decide in under
three seconds whether a machine picked up, connect a person to a stranger
mid-ring, and account for every fraction of a cent afterwards.

Everything below is measured against production unless it says otherwise.
Figures dated 14 Sept 2026 come from the first full day of real dialing.

---

## 1. The two-leg model

Every dial is **two calls at the carrier**, not one.

| leg | who is on it | our record |
|---|---|---|
| **lead leg** | the person being called | a row in `calls`, keyed by `call_control_id` |
| **agent leg** | the agent's browser, over SIP | `calls.agent_call_control_id` — no row of its own |

This is the single most expensive fact about the architecture, and the one most
often forgotten when reading cost figures. **A "dial" is billed twice**, and
the carrier bills *both halves of a bridged connection* on top of that — so a
connected call can produce four billable records.

Our `calls` table holds one row per lead leg. Agent legs appear only as a
foreign key. Any query that counts rows in `calls` and calls the result "calls"
is undercounting what the carrier saw by roughly **2.7×** (measured 14 Sept:
215 rows against 574 distinct legs).

**Agent legs are 1:1 with calls.** Verified across 1,905 legs: every one belongs
to exactly one call, never shared. That property is what makes it safe to
release an agent leg when its call ends.

---

## 2. Bridging, and why it happens at pickup

An agent-attended dial carries **`bridge_on_answer`**, so the carrier connects
the two legs itself at the instant the lead picks up. We do not wait for a
webhook and then issue a bridge command.

This was chosen on measurement, not preference. Bridging after the AMD verdict
tracked the verdict to within ten milliseconds — because it *was* the verdict —
and bought detection accuracy at the price of one to six seconds of silence on
both ends of every answered call. Nobody wants a product where every real
conversation opens with the prospect saying "hello?" twice.

**Fan-out is the genuine exception.** A predictive line is placed with no agent
attached — there is nobody to hear silence — so routing really does have to wait
for a verdict, and the bridge is issued from the AMD handler.

> **Historical failure worth keeping.** That fan-out bridge lived inside
> `if (!callRow.dial_group_id)`, and a fan-out call is *defined* by having a
> `dial_group_id`. The one path that needed the bridge was the one path excluded
> from it. Result on 14 Sept: 138 fan-out calls, 35 answered, 7 of them human,
> **zero bridged**, against 80 of 80 for agent-attended. Seven people answered
> their phone and heard nineteen seconds of nothing. It was invisible because
> every *other* mode bridged correctly and the block was headed "ALREADY
> CONNECTED AT PICKUP".

---

## 3. Answering machine detection

Standard `detect` runs on the dial. Premium exists and is not used — it costs
3.25× more and its extra vocabulary (`human_residence`, `human_business`,
`silence`) collapses to "a person" for our purposes anyway.

- **Cost:** $0.002 per *answered* leg. Unanswered dials are not charged.
- **Verdict latency:** 3.31s median across 128 production detections.
- **What counts as a robot:** exactly `machine` and `fax_detected`. Held in one
  module-scope set because two handlers need the answer — the one that ends the
  call and the one that decides whether to keep the recording — and a second
  copy is how they drift apart.

AMD is on for progressive. It is what makes it possible to skip 54% of
everything that answers without an agent hearing a word of it.

---

## 4. Recording is deferred until a human is confirmed

The dial deliberately does **not** carry `record` when AMD is enabled. The
recording is started from the human branch of the AMD handler, never at the
bridge.

The bridge happens at pickup, *seconds before any verdict exists*. Starting a
recording there records every voicemail greeting on the platform and then throws
them away — paying $0.002/minute for audio nobody will ever play, and filling
the recordings list with dead air an owner has to click through.

Statuses `pending_amd` and `pending_amd_advisory` both mean "a recording is owed
once a human is confirmed". They differ only in what a *machine* verdict does.

---

## 5. Agent leg lifecycle

An agent leg is opened per dial and must be released when that dial ends.

**The teardown is not optional and it is not automatic.** Until 14 Sept the only
release sat in the machine-verdict path behind a flag defined as
`dial_source === 'user_dial'`, which a fan-out call can never satisfy. Every
fan-out agent leg therefore stayed open for as long as the agent stayed online.

What that cost, from the carrier's own cost records on 14 Sept:

| | legs | avg billed | longest | cost |
|---|---|---|---|---|
| fan-out agent legs | 115 | 314s | **1,338s (22 min)** | $1.20 |
| user_dial agent legs | 12 | 126s | 1,302s | $0.05 |

Doubled by the billed twin of each, that was **88% of the entire bill**. Total
billed that day: **1,307 minutes against 30.7 minutes of actual conversation.**

The release now happens in `handleHangup` for **any** call, not just fan-out —
`user_dial` leaked too. It is safe to do unconditionally because agent legs are
1:1 with calls (§1), and the hangup helper treats 404 and 422 as success, so a
duplicate webhook or an already-dead leg is a no-op.

It is **awaited, not fired and forgotten**. A dangling promise on this runtime is
frozen when the response returns, which is exactly how a teardown silently never
happens.

---

## 6. What the carrier actually charges

Measured from captured `call.cost` webhooks, not from a rate card.

| event | billed |
|---|---|
| **unanswered lead leg** | **$0.00 — free** |
| answered lead leg | **60-second minimum**, then 6-second increments |
| agent leg | actual duration, 6-second increments, no visible floor |
| both halves of a bridged pair | billed separately |
| AMD | $0.002 per answered leg |
| recording | $0.002/minute |
| DID | $1.00 once, $1.00/month (day-prorated in the first month) |

Two consequences that drive everything else:

1. **Dialing is nearly free. Answering is what costs.** 94 unanswered lead legs
   billed zero seconds. Cost scales with *pickups*, not dial volume — which
   inverts the obvious intuition about where to optimise.
2. **The 60-second floor means a 5-second call costs the same as a 60-second
   one.** There is no cost argument for rushing a conversation, and none for
   hanging up on a voicemail quickly. Hang up fast for the agent's time, not for
   the bill.

### Where the remaining money goes

Of everything that answers, month to date:

| verdict | share | avg duration |
|---|---|---|
| **machine** | **54.2%** | 19.1s |
| human | 12.9% | 138.1s |
| no verdict recorded | 31.5% | 28.5s |

**Over half of all answered-call spend buys voicemail greetings**, each at the
full 60-second minimum plus AMD. That cost is not reachable by engineering — it
is list quality and time-of-day. The lever is dialing fewer numbers that are
always going to be a machine, not handling machines more cheaply.

> **The "no verdict" row is not a bug and not a cost.** AMD is enabled and runs
> on all of them — 375 answered calls, every one on a campaign with
> `amd_enabled: true`. The verdict simply is not what ended the call. 87 were
> SKIPPED by an agent who was already talking (`bridge_on_answer` connects at
> pickup, so the agent is on the line from second one while detection runs in
> parallel), 32 of those ending inside AMD's own 3.31s median verdict time. A
> further 7 are real dispositioned conversations averaging 167 seconds. The
> consequence is that AMD metrics undercount, not that money is wasted — the
> whole row is worth about $0.23 a month.

---

## 7. Cost telemetry

Three independent records, deliberately, because each can be wrong on its own.

1. **`call.cost` webhooks** → `calls.telnyx_cost` and `telnyx_ledger_records`.
   The carrier pushes what each leg cost. 90% arrive within 60 seconds of the
   call (492 of 545 measured); a tail runs to two hours. These were being
   discarded for months — the default switch branch stored `payload.result`, and
   a cost event has no `result` field, so every one logged as "unhandled" with a
   null detail.
2. **Balance snapshots**, sampled on hangup (throttled to once per 45s) and
   whenever an operator has the ops map open. This is the only contemporaneous
   record of movement, because the portal hides transaction detail until the
   following month.
3. **Our own model** in `lib/telephonyCosts.ts` — rates fitted against a real
   invoice, not list pricing.

**Never trust one alone.** A model is only as good as the components it counts;
ours omitted parked agent-leg time entirely and therefore "proved" an 87%
unexplained gap that turned out to be our own leak. The ledger is append-only so
that a restated figure can be *detected* rather than silently absorbed.

> **Settlement is batched.** Debits land in lumps minutes after the calls they
> cover, so a balance drop in a window with no dialing is normal and is not
> evidence of anything. Webhook latency and settlement latency are different
> systems; do not use one to reason about the other.

---

## 8. Inbound is rejected, never answered

Every owned number is reachable, so something must happen when a lead calls
back. We used to **answer** and read a text-to-speech apology.

Answering is the exact moment a call becomes billable. That courtesy cost the
60-second minimum plus TTS by the character, per caller, to say "this number
does not accept incoming calls".

Now rejected at `call.initiated`, before answer, with **`CALL_REJECTED`**
(Q.850 cause 21) rather than `USER_BUSY` (cause 17) — busy invites the caller's
carrier to retry, and a retry is another call to refuse. An unconnected call has
no minutes to round up and no TTS to bill.

The trade is real and was made deliberately: a lead who rings back gets an
intercept tone instead of an explanation. Every alternative that says anything
at all has to answer first.

---

## 9. Pacing, abandonment and the surcharge thresholds

The carrier publishes two penalties that apply **account-wide once tripped**,
which is what makes them worth engineering against rather than absorbing:

| surcharge | threshold | rate |
|---|---|---|
| short-duration calls | >15% of *connected* calls ≤6s | per call |
| abandoned calls | >20% of outbound | $0.005/call |

Measured the way a billing system would — on **connected** calls, not counting
ring time — we run at **17.0% SDC** and **2.9% abandoned**. Marginally over on
one, comfortably clear on the other.

The naive measurement counts ring time and reports 91% SDC. It is wrong and it
will cause somebody to panic. Measure on answered calls.

### The short-call hold, and why it is randomised

When **we** are the ones hanging up — a machine verdict, an agent skipping — the
line is held past the six-second threshold rather than dropped at two seconds.
`lib/complianceHold.ts`.

**The hold is free.** An answered outbound leg bills a 60-second minimum either
way (§6), so a call dropped at 2s and a call held to 11s cost exactly the same.
It buys surcharge headroom for nothing, which is why the floor is generous.

**The randomisation is the clever part, and it is not decoration.** A fixed hold
produces calls that end at 9.0s every time, forever. That is a signature — a
carrier looking at a duration distribution sees a spike on one value that no
human conversation would ever produce, sitting three seconds above their own
short-call threshold. The entire point of the hold is to stop being flagged, and
a mechanical tell is its own kind of flag.

So each hold picks a fresh target uniformly between the floor and **3.5 seconds**
above it, at sub-second resolution. Durations land across 9, 10, 11 and 12 with
no mode — an ordinary spread of short calls. The spread is 3.5 rather than 3
because a uniform 3 over a floor of 9 yields [9, 12), which truncates to only
9, 10 or 11: "sometimes twelve" would have quietly meant never.

**Measured from ANSWER, not from dial.** Ring time is neither billed nor counted
toward the short-call ratio, so holding from dial would both overshoot and vary
with how long the phone rang.

The floor itself is configuration, not a constant —
`platform_config.amd_hold_seconds_after_machine` — so it can be raised if a
carrier ever moves its threshold. Randomness only ever *adds* to it; nothing in
the module can return less than the configured minimum.

Separately, the predictive controller enforces the **FTC 3% abandon ceiling per
campaign** over a rolling 30 days. It is per campaign because the rule is per
campaign: one unhealthy list must not throttle a healthy one, and a healthy one
must not launder an unhealthy one. When every involved campaign is degraded the
tick drops to a single line — progressive parity, which cannot abandon anyone.

---

## 10. Failure modes the carrier will not tell you about

**Agent leg refused.** The dial returns 200 with a `call_control_id`, nothing
upstream sees a failure, the browser never receives an INVITE, and the only
symptom is a connected call with no audio. The tell is an agent leg hanging up
with `user_busy` (SIP 486) and no `calls` row. Cause is almost always
`sip_uri_calling_preference` disabled on the credential connection.

**Dead SIP registration.** The browser's registration lapses while the page
still looks fine. Every dial then fails at ~1.1 seconds. Observed 14 Sept: 86
calls in 8 minutes, 40 of them at ~1.1s, recovering on its own after ~3 minutes.
A circuit breaker now pauses dialing after two consecutive missed INVITEs and
forces re-registration.

> That 1.1-second signature matters beyond the breaker. An earlier attempt to
> detect plumbing failures tested `duration === 0` and missed every one of them,
> wrongly charging 39 leads against their attempt budget.

**Webhook race.** One underlying fault can be dispositioned `AGENT_LEG_FAILED`
or `NO_ANSWER` depending on which webhook lands first. Known, unfixed; it
distorts disposition counts, not billing.

---

## 11. Numbers

Numbers are a pool, not a property of a campaign. Rotation, daily caps and
resting are enforced in `claim_pool_number`.

One negative result worth preserving: **routing by `health_answer_rate` was
built and reverted.** It counts answers *including machines*, so it is
anti-correlated with the human rate you actually want — and human pickup is a
property of the *list*, not of the number dialing it. Shipping it made things
worse in a way that looked like an improvement on the dashboard.

Reputation is protected mainly by not generating dead-air calls (§2) and by the
attempt budget: **6 attempts per number per 30 days**, with plumbing failures
not counted against the budget.

---

## 12. Rules of thumb

- **A dial is two legs; a connected call is four billed records.** Double any
  per-call figure before believing it.
- **Unanswered dials are free.** Optimise pickups, not dial count.
- **Answering is the charge.** Anything that answers a call — inbound courtesy
  messages, voicemail greetings, detection — is where the money is.
- **Every leg opened must have an owner responsible for closing it**, and that
  owner must not be conditional on something that only happens sometimes.
- **Measure against production, never reason from the rate card.** Every figure
  in this document that turned out to be wrong was wrong because it was derived
  rather than observed.
- **Two independent measurements or none.** A model that disagrees with the
  carrier is a hypothesis, not a finding.
