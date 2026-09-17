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

### Placing it at answer instead — `dial_agent_on_answer`

Even released promptly, the agent leg is live for the whole time the lead's
phone rings, on every dial including the ones nobody answers: 317 such legs,
176 billed minutes, **17% of a clean session's spend**, buying nothing.

With `platform_config.dial_agent_on_answer` on, the lead is dialled alone and
the agent's leg is placed the instant they pick up. The browser auto-answers in
~0.4s and `connecting_message` covers the gap. Worth −17% at a 66% answer rate
and nearer −23% at a normal one, because the win is legs on calls nobody
answered.

**It moves where failure lands, which is why it is a switch and why it ships
off.** Today a dead agent socket fails BEFORE the lead's phone rings and nobody
is disturbed. With this on, the lead answers first and the agent is discovered
unreachable afterwards — an abandoned call in the sense the FTC means it. Agent
leg failure ran 10–20% during the socket problems on 14 Sept, against an
abandoned rate of 2.9% and a 20% threshold. There is room; this is the change
that spends it.

So every failure path **ends the lead's call** rather than leaving somebody
listening to nothing — no env, no user, no SIP URI, a dial that errors, a dial
returning no id, a bridge that fails — plus a guard in `handleHangup` for the
case none of those cover: the agent leg that simply never answers inside its
12-second timeout. That guard is restricted to **unbridged** calls, so a normal
hangup after a real conversation still belongs to the machine-verdict and
compliance-hold paths.

`user_dial` only. Fan-out's agent-leg path is separately unverified (§2), and
wiring a second deferral through it would be changing two things at once on the
code that produced the silence.

---

## 6. What the carrier actually charges

Measured from 1,490 captured `call.cost` records, not from a rate card — and
the rate card is wrong about this account.

| event | billed |
|---|---|
| **unanswered lead leg** | **$0.00 — free** |
| answered lead leg | **60-second minimum**, then 6-second increments |
| agent leg | actual duration, 6-second increments, **no floor** |
| recording | **60-second minimum**, $0.002/minute |
| both halves of a bridged pair | billed separately |
| AMD | $0.002 per answered leg |
| DID | $1.00 once, $1.00/month (day-prorated in the first month) |

### The published increments are not the increments you get

Telnyx's billing documentation states **"60/60 billing increments"** and
explicitly *"we no longer offer 6 second billing increments."* This account
gets 6-second billing anyway: **1,033 of 1,490 billed records are multiples of
6 and not 60**, with observed values of 6, 12, 18, 24, 30, 36, 42, 48, 54, 66,
72, 90 and 108 seconds. The smallest billed duration on record is 6 seconds.

So the 60 is **a minimum on the answered lead leg**, not the increment — and it
sits on top of an increment that is already fine-grained. That distinction is
what turns it into an answerable question rather than a complaint:

> **`calls.duration` INCLUDES THE RING.** 10.5 seconds of it on average, 49.6%
> of the column on a machine-answered call. **Billing starts at answer**, so
> ring seconds are never billable and any “actual duration” taken from that
> column is roughly double the truth. An earlier version of this table made
> exactly that mistake. Post-answer seconds are
> `duration - (answered_at - created_at)`.

| who answered | legs | avg **post-answer** | 6s increment | with 60s floor | wasted |
|---|---|---|---|---|---|
| **machine** | 377 | **10.9s** | 13.1s | **60.0s** | **78.3%** |
| no verdict | 166 | 23.7s | 28.1s | 70.9s | 60.4% |
| human | 99 | 111.4s | 114.8s | 150.5s | 23.7% |
| not_sure | 6 | 12.8s | 16.0s | 60.0s | 73.3% |

**648 answered legs over 30 days. 49,656 seconds billed against 21,048 the
increment alone would produce. 476.8 minutes — 57.6% — is minimum rather than
conversation.** A voicemail holds the line for 10.9 seconds and bills 60.

**The model is exact.** Post-answer → 6s increment → 60s floor, checked against
Telnyx's own `billed_duration_secs`: **184 of 192 legs predicted exactly**,
average absolute error 1.8 seconds, 98.8% of total billed seconds. `lib/
telephonyCosts.ts` implements it; `tests/unit/telephonyCosts.test.ts` pins it.
See `docs/telnyx-questions.md` for the exact wording of the ask.

> If the minimum is ever reduced, **the 9-second compliance hold stops being
> free** (§9). It costs nothing today because a voicemail bills 60 seconds
> whatever happens; at a 6-second minimum it becomes real money and wants
> re-tuning.

> **The hold is working precisely, and this is the proof.** On the old floor of
> 9, machine legs ran 10.9 seconds after answer: ~2s for AMD to report and hang
> up, plus `amd_hold_seconds_after_machine`. The 10–45s spread in raw
> `duration` is ring time, not drift. Nothing to tune.
>
> **Floor lowered to 8 on 17 Sept** (spread 2.5, so 8/9/10 and never 11). Free
> in both directions under 60/60 — it buys back line occupancy, not money.

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

### The agent leg is billed on two connections

The agent leg never touches the PSTN — it is a SIP URI dialled from our Call
Control application to the credential connection the agent's browser registered
against (§5, `lib/agentSipCredentials.ts`). Telnyx confirms there is no carrier
involved by rating its `sip-trunking` part at **$0**.

It is billed twice anyway, once per connection traversed. One call session:

| connection | `call_leg_id` | billed | cost | cost parts |
|---|---|---|---|---|
| credential (`…31936933233`) | `80101afa` | 2058s | $0.0686 | `sip-trunking @ 0.00200` |
| Call Control (`…04966737730`) | `7fe7e45e` | 2058s | $0.0686 | `call-control @ 0.00200`, `sip-trunking @ 0` |
| Call Control | `801a750e` | 2040s | $0.2380 | `call-control @ 0.00200`, `sip-trunking @ 0.005` |

The first two are one agent leg. Same seconds, same charge, different leg ids.

**Effective agent-leg rate: $0.004/min, all of it connection fee.** A real PSTN
call averages $0.0052/min. **Ringing a browser costs 77% of ringing a phone.**

Three things follow, and they matter more than the rate:

1. **The second record is invisible to every join we have.** It carries its own
   `call_leg_id` and a `call_control_id` we never issued, so it matches neither
   `calls.call_control_id` nor `calls.agent_call_control_id`. It is reachable
   only by `call_session_id`, or by its connection id. Anything that costs
   agent legs by joining on `agent_call_control_id` alone is **half the real
   figure** — check `app/api/admin/balance-reconcile` before trusting it.
2. **Agent legs still carry more billed time than lead legs.** Post-teardown:
   223 billed minutes on legs that never leave Telnyx, against 163 that reach a
   phone. The agent leg is up for the ring *and* the conversation; the lead leg
   only for the conversation. That gap is precisely what
   `dial_agent_on_answer` closes (§5).
3. **It is worth asking about rather than engineering around.** Their own record
   writes `$0` in the rate field for the carriage. `docs/telnyx-questions.md`
   question 3.

> **How much the teardown fix was really worth.** Splitting the ledger at it,
> counting both records: agent legs were **79.2% of the entire bill** before
> (427 legs, 1,333 billed minutes, averaging 187s each) and **24.6% after**
> (296 legs, 223 minutes, 45s each). Lead legs went from a fifth of spend to
> nearly three quarters — not because they got dearer, but because the bill
> stopped being mostly agents' browsers listening to ringing.

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

## 8. Inbound is answered — and the attempt to stop that took the floor down

Every owned number is reachable, so something must happen when a lead calls
back. We **answer** and read a short text-to-speech apology.

Answering is the exact moment a call becomes billable, so that courtesy costs
the 60-second minimum plus TTS by the character — roughly $10/month at ~68
inbound callbacks a day — to say "this number does not accept incoming calls".

### The rejection that was shipped and reverted the same day

It was replaced with `reject` at `call.initiated`, before answer, using
`CALL_REJECTED` (Q.850 cause 21). Within hours dialing collapsed: 16 dials, 10
`AGENT_LEG_FAILED`, 1 bridged. The browser console named it exactly:

```
CANCEL sip:...  Reason: Q.850;cause=21;text="CALL_REJECTED"
```

cancelling an **agent leg** the browser had already accepted. That cause string
appears nowhere else in the codebase.

**Why the reasoning failed, because the reasoning is the part worth keeping.**
It was argued that an agent leg cannot carry `direction: 'incoming'`, since
otherwise agents would have been hearing the inbound apology for years and
nobody had reported it. That does not follow. The old branch issued `answer`,
which is **inert** on a leg the browser is already answering — so a
misclassified agent leg passed through it invisibly for as long as the code had
existed. `reject` is not inert. The same misclassification that cost nothing
became fatal the moment the action changed.

> **The general form: an inference from the ABSENCE of a symptom is only as
> strong as the old code's ability to produce one.** That path was silent, so it
> proved nothing, and silence was read as evidence.

### What it would take to do it safely

Not `direction`. Gate on a **positive identification of our own legs**:
`parseClientState` returns null for anything we did not place, and every
agent-attended leg carries one. The deferred agent leg is now stamped for this
reason as well as for the kill switch.

**The prerequisite is that fan-out legs get stamped too.** They currently carry
no `client_state` — their own comment says so — so under a client_state gate
they would read as strangers and be rejected: the same outage by a different
route. Roughly $10/month is not worth that until fan-out is fixed.

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
because a uniform 2 over a floor of 8 yields [8, 10), which truncates to only
8 or 9: "sometimes ten" would have quietly meant never.

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

### Local presence is a preference, not an override

`claim_pool_number` ranked the match tier FIRST and used `daily_call_count` only
to break ties inside it. So when a campaign dials mostly one area code, the
single number matching it absorbed everything until it hit `daily_cap` (200)
while the rest of the pool sat idle: **15 Sept, 234 dials across 11 available
numbers, 176 of them on ONE number.** 12 Sept, 201 of 859.

That is a deliverability problem before it is a fairness one. This platform's
own traffic says so:

| dials/day on one number | answer rate |
|---|---|
| under 40 | **38.8%** |
| 41–70 | 20.1% |
| 71–120 | 26.0% |
| over 120 | 21.6% |

Industry guidance is ~70 dials per number per day. A `p_soft_cap` (default 60)
now **demotes** a number past it behind every number that is not, however local
it is; local presence still wins while a number has room, because local numbers
answer 3–4× better and that is the point of the pool. It degrades safely: if
every number is past the cap they all score equal, the term cancels, and
selection falls through to the previous behaviour. `daily_cap` remains the hard
stop.

> **Adding the parameter created an OVERLOAD rather than replacing the
> function**, and every caller passes three named arguments, which matched both.
> Postgres resolves that as "function is not unique" and every dial fails. The
> old signature had to be dropped explicitly. This codebase has been bitten by
> the same thing before — see the `team_code_use_count` ambiguity fix.

---

## 11b. Calls per second, and the meter nobody sees

CPS is billed on the **95th percentile of hourly peaks**: first 5 free, then
$12/CPS to 25, $16 to 200, $24 to 250, $30 beyond. Their own worked example is a
peak of 163 CPS costing $2,448/month.

**It never touches the balance.** It is assessed monthly and lands on the
invoice, which is why it went unnoticed through a whole day of watching
per-minute usage reconcile. Measured here: P95 of **15 CPS** before predictive
was withdrawn, against a free tier of 5 — $60–120/month, against a usage bill of
$28.29. Withdrawing predictive alone took P95 to 7.3.

**Two meters, and only one is per credential.** The real-time 20 CPS limit that
*rejects* calls is per source IP or SIP username, so individual credentials
genuinely protect each agent — 100 agents at 100 dials/hour is 0.06 CPS each and
no credential comes close. The **surcharge is account-level**, explicitly *"not
by IP address or SIP username"*. A hundred agents each placing one call in the
same second is 100 CPS on the meter and 1 CPS per credential. Every credential
looks innocent; the account looks like a burst.

### The governor is a leaky bucket, and the first version was not

The first design returned a call's position within the current second and
derived a delay proportional to how far over target it was. That approximates a
rate and cannot guarantee one — and clipping the delay broke it outright: in a
second carrying eight legs the eighth needs a full second of delay, against an
agent cap of 200ms. A 200ms shift only crosses a second boundary if the call was
already within 200ms of one. It smoothed the shoulders of a burst and left the
burst.

A leaky bucket hands every origination the next free slot at fixed spacing.
Verified: a burst of eight returns **0, 247, 496, 746, 996, 1246, 1496,
1746ms** — exact 250ms spacing, draining at precisely 4/second. `next_slot_at`
is monotonic and pulled forward when idle, so quiet time banks no credit that
releases later as a burst.

Verified against every second on record: after predictive was withdrawn, **zero
of 404 seconds exceed either cap**, so every burst the platform now produces is
absorbed completely.

Caps are generous on purpose (2s agent, 5s fan-out). A cap below the spacing the
bucket needs does not pace more gently — it disables pacing silently at the exact
moment a burst is happening. Beyond the cap the call goes and the peak is
accepted: an unbounded queue in front of a phone call is worse than a billing
tier.

---

## 11c. Not every destination costs the same

From the carrier's own records: **71.5% of spend at the $0.002 base rate, 23.7%
at $0.005, and 4.1% at $0.07** — thirty-five times base, from two exchanges
across five calls. One voicemail to a 209 number cost **fourteen cents**.

That is rural high-cost termination: certain rural LECs levy inflated access
fees and the carrier passes them through legitimately. Rate decks are built per
NPA-NXX and OCN precisely because of it, which is why `destination_rates` keys
on the six-digit exchange rather than the area code — an area code spans dozens
of carriers and averaging across them buries exactly the expensive ones.

**Learned, not configured.** Every `call.cost` webhook carries the rate its
seconds billed at, so the table builds itself from traffic that already
happened. The honest limit: it can never protect the FIRST call to an exchange,
only the second. A guess that refuses a dial is worse than a fact that arrives
one call late.

Worst rate ever seen is kept rather than a mean — an exchange that charged $0.07
once will do it again, and an average against a cheap majority would bury it.
Blast radius measured before shipping: **4 of 16,204 uncalled leads, 0.025%.**

---

## 11d. The lead row is not the source of truth, and that cost 18 calls

`claim_next_leads_for_campaign` selected on `status IN ('uncalled','no_answer')`
with a 30-second claim expiry and **never capped on `dial_attempts`** — it only
*ordered* by it, `ASC NULLS FIRST`.

So a lead whose call ended without a disposition stayed claimable forever **and
was promoted to the front of the queue**, because a counter nobody increments
sorts first. Not merely uncapped: prioritised.

On 12 Sept one lead was dialled **18 times in 28 minutes**, every 62 seconds,
every call `user_busy` at ~5 seconds, every one undispositioned. Its row read
`dial_attempts: 0, status: uncalled, last_called_at: null`. Eighteen calls, and
the record said it had never been touched. Two others took 15 and 8 in the same
window.

That is a compliance exposure before it is a cost one.

**Two thirds of calls never write back to their lead**, and 88% carry no
`dial_source` at all — which is why the gap stayed invisible. 206 leads were
undercounted by 481 attempts before a backfill from the calls table.

The breaker now sits at **25 attempts, and it is a runaway breaker, not policy**:
`DIAL_PASSES = 0` means lifetime attempts are deliberately uncapped, and the
real enforcement is six per NUMBER per 30 DAYS against the calls table. A cap of
6 on the lead row would be a different policy wearing the same number — and it
would not have caught this bug anyway, since the counter stayed at zero
throughout. **The real fix is on the write path and is still open.**

Separately: the attempt budget was counted against *the campaigns being dialled*
rather than the team's, so a number in two lists got a fresh six attempts in
each. 4,974 numbers sit in more than one campaign — 81.8% of lead rows — so the
cap held only while somebody happened to be dialing every list at once.

---

## 11e. The agent's socket dies, and the dialer keeps going

The agent leg is a SIP URI to the browser's registration (§5). When that socket
dies, Telnyx **accepts** the dial — 200 OK, `call_control_id` returned — and
only gives up ~1.2s later when the browser never answers. The lead's leg dies
~0.4s after that, having rung for about a second.

`app/api/calls/events` already handles the aftermath correctly: it writes
`AGENT_LEG_FAILED` and releases the lead **without spending a dial attempt**,
because the lead was never really called. That is not the problem.

**The problem is that nothing stopped the next dial.** 14 September, share of
each agent's dials ending `AGENT_LEG_FAILED`, by hour:

| hour | agent | dials | failed | |
|---|---|---|---|---|
| 22:00 | A | 112 | 3 | **2.7%** — healthy |
| 17:00 | C | 120 | 25 | 20.8% |
| 12:00 | B | 58 | 41 | **70.7%** — dead socket |
| 20:00 | D | 13 | 10 | **76.9%** — dead socket |

Bimodal. A session is healthy at ~3% or broken at 70%+, and a broken one stays
broken until the agent reloads. Agent B rang 41 leads while believing they were
working.

### Why it is worth blocking rather than logging

Telnyx surcharges accounts where **more than 20% of outbound calls are dropped
by the originating side before being answered** — $0.005 on *every* abandoned
call once over, not just the excess. `AGENT_LEG_FAILED` alone was **18.4% of all
dials** on the 14th; removing it takes that day's abandonment from 33.8% to
15.4%, under the line. See `docs/COST-FINDINGS.md` §1i.

### The default is argued from the distribution, not from a probability

`lib/agentSocketBreaker.ts` stops an agent after N consecutive failures and
tells them to reload. Every run of consecutive `AGENT_LEG_FAILED` over 30 days:

| run length | 1 | 2 | 3 | 4 | 5–11 | 12 | 28 |
|---|---|---|---|---|---|---|---|
| times seen | 15 | 3 | 3 | 1 | **0** | 1 | 1 |

**Runs are either ≤4 or ≥12. Never between.** A limit of 5 sits in an empty
gap — it would have fired twice in a month, both correctly, never on noise.
The per-dial arithmetic (2.7% ⇒ 1 in 700 million) was never the argument, since
failures cluster; the gap is.

> **This is the only guard on the dial path that refuses.** §10 says such a
> guard is one bad measurement from an outage, so: it refuses only dials that
> cannot succeed; one good dial clears it; the window is ten minutes; a NULL
> disposition ends the run because in-flight means the socket is alive; every
> failure path — no config, no rows, a query error, a thrown exception —
> permits the dial; and `agent_leg_failure_limit = 0` disables it without a
> deploy. Pure logic lives in `lib/agentSocketHealth.ts` under 14 tests.

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
- **Measure per leg, never per aggregate.** The 30-second minimum this document
  used to assert was fitted against one invoice line and landed within 9%
  because it over-counted agent legs, which have no floor, and under-counted the
  lead minimum, which is twice what it assumed. The errors cancelled. No
  aggregate could have exposed that; per-leg records did immediately.
- **An inference from the ABSENCE of a symptom is only as strong as the old
  code's ability to produce one** (§8). Silence is not evidence.
- **A guard that can refuse is one bad measurement from an outage.** Every cost
  control here delays or demotes; none can say no. `lib/concurrency.ts` is the
  cautionary tale and is worth reading before adding another.
- **Thin data argues against hardcoding a threshold, not against building the
  mechanism.** Voicemail-streak retirement was nearly dropped on 54 samples; it
  shipped with the threshold in config instead.
- **Adding a parameter to an RPC creates an overload, not a replacement.** Every
  caller passing named arguments then matches both, and Postgres refuses the
  call as ambiguous. Drop the old signature in the same migration.
