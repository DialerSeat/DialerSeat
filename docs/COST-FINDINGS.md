# Cost Findings

Everything measured on 14–15 September 2026, from Telnyx's own `call.cost`
records rather than from our rate model. Ordered by what it is worth.

The one-line summary: **dialing is nearly free, answering is the charge, and
about 40% of what you pay for an answered call is a minimum you never used.**

---

## 0. The road to $3 a day

The target is **$3 per agent per day**. Here is the arithmetic, measured rather
than modelled, and it ends somewhere specific.

### Where it stands

The cleanest window we have — the hour after the teardown fix, two agents, both
at ~100% utilisation, which makes it a *worst* case for cost per hour:

| | |
|---|---|
| seat time | **1.96 agent-hours** (0.999 + 0.963) |
| dials | 148 (113 + 35) |
| answered | 109 |
| carrier spend | $1.8138 captured **+ $0.218 AMD** = **$2.03** |
| **cost per agent-hour** | **$1.04** |
| **projected 6-hour day** | **$6.22** |

Composition of that $2.03:

| | | share |
|---|---|---|
| lead legs (real PSTN) | $1.315 | **64.7%** |
| agent legs (both connections, §1g) | $0.447 | **22.0%** |
| AMD (invisible to the webhook, §1d) | $0.218 | **10.7%** |
| everything else | $0.052 | 2.6% |

### What closes the gap

Compounded in order, not summed — they overlap, and summing them is how you talk
yourself into a number you cannot hit:

| step | lever | day |
|---|---|---|
| — | today | **$6.22** |
| 1 | defer the agent leg (`dial_agent_on_answer`, **built, OFF**) | $5.54 |
| 2 | destination rate guard (**shipped**) | $5.37 |
| 3 | **60-second minimum reduced** — Telnyx Q1/Q2 | $3.15 |
| 4 | **agent legs rated on-net** — Telnyx Q3 | $2.81 |
| — | **+ DID rental** ($13/mo ÷ 2 agents, §4) | **$3.02** |

The last row is not a lever, it is a line that was missing from the model.
Number rental does not care how much you dial, so it survives every per-minute
saving above and then sits on top of the result.

### The honest conclusion

**$3.02. The target was $3.**

**Engineering alone gets to $5.37. The letter gets to $3.02.**

Steps 1 and 2 are ours and they are worth **$0.85** a day. Steps 3 and 4 are
Telnyx's to grant and they are worth **$2.56 — three times as much.** That is
the whole result of the night in one line: *the remaining money is not in the
code, it is in four questions.* Send `docs/telnyx-questions.md`.

That is a **55% reduction**, and the half of it that matters is not engineering.

And at $3.02, AMD is **24%** of what is left — the second-largest line, still
invisible to every webhook we capture. It is next, and it is not reachable until
Ledger → CAPTURE NOW has run (§1d). Note it is also the one line worth
*keeping*: $0.88 a week of AMD buys back **2.15 agent-hours** a week of not
listening to voicemail greetings. Costing it is not the same as cutting it.

> **$3.02 is the floor this architecture reaches** — $2.81 of dialing plus
> $0.21 of rent. Going under it means paying
> for fewer answered minutes, not cheaper ones — which is list quality, time of
> day (§4) and number burn (§1f), not carrier engineering. Those are also the
> only levers that make the day *more* valuable rather than just cheaper.

---

## 1. Ask Telnyx these four questions first

No engineering. Between them they are worth **more than twice** everything
shipped so far — see §0 for the arithmetic.

### 1a. The 60-second minimum — worth ~20% of the bill

**You are already on 6-second increments.** 1,033 of 1,490 billed records are
multiples of 6 and *not* 60 — observed values include 6, 12, 18, 24, 30, 36, 42,
48, 54, 66, 72, 90, 108. Their public documentation says the opposite: *"60/60
billing increments"* and *"we no longer offer 6 second billing increments."*

But the **answered lead leg carries a 60-second minimum** on top of that
increment.

> **These figures were revised upward on 15 Sept.** The earlier version measured
> `calls.duration`, which **includes the ring** — 10.5s of it on average.
> Billing starts at answer, so ring seconds were never billable and counting
> them inflated “actual duration” by about double. Everything below is
> post-answer only, over 30 days.

| who answered | legs | avg **post-answer** | 6s increment alone | with the 60s minimum | wasted |
|---|---|---|---|---|---|
| **machine** | 377 | **10.9s** | 13.1s | **60.0s** | **78.3%** |
| no verdict | 166 | 23.7s | 28.1s | 70.9s | 60.4% |
| human | 99 | 111.4s | 114.8s | 150.5s | 23.7% |
| not_sure | 6 | 12.8s | 16.0s | 60.0s | 73.3% |

**648 answered legs. 49,656 seconds billed against 21,048 that the 6-second
increment alone would produce. 476.8 minutes — 57.6% — is minimum, not
conversation.** The old figure was 39.4%; it was understated because the ring
was counted as talk.

**A voicemail occupies the line for 10.9 seconds and bills 60.**

### The model reproduces their billing exactly, which is what makes it an ask

Post-answer duration → 6-second increments → 60-second floor, run against
Telnyx's own `billed_duration_secs` on every leg where both exist:

| | |
|---|---|
| legs matched | 192 |
| **exact matches** | **184 (95.8%)** |
| average absolute error | **1.8 seconds** |
| total predicted vs billed | 14,766s vs 14,940s — **98.8%** |

There is no dispute available about what the rule is. The only question is
whether the floor can come down to meet the increment.

The ask: *the 6-second increment already applies; can the minimum on answered
outbound be reduced to match it?* Two facts they hold, no accusation.

> **Second-order effect if they say yes:** the 9-second compliance hold stops
> being free. It costs nothing today because a voicemail bills 60 seconds
> regardless. At a 6-second minimum it becomes real money — still worth paying
> for surcharge protection, but it wants re-tuning.

### 1b. STIR/SHAKEN attestation level

A SIP trace from this account carried `verstat=No-TN-Validation`. That was an
agent leg so it does not prove the outbound attestation is missing, but it is
worth one question. Industry reporting puts A-level attestation at 60%+ connect
improvement, and without it calls are spam-flagged regardless of anything else.

This does not reduce cost per conversation — it raises conversations per dial,
which is worth more.

### 1c. Month-to-date CPS tier

CPS is billed on the 95th percentile of hourly peaks and **never appears in the
balance** — it is assessed monthly and lands on the invoice. P95 measured 15 CPS
before predictive was withdrawn, against a free tier of 5: **$60–120/month**,
against a month-to-date usage bill of $28.29.

Ask before month end. The percentile is computed across the whole month, so
flattening peaks now still pulls the final figure down.

---

## 1d. AMD is billed and INVISIBLE to the webhook — every figure here is ~13% low

`call.cost` reports exactly three components: `sip-trunking`, `call-control`
and `call-recording`. **AMD is not one of them.** The evening session carried
149 AMD verdicts — $0.298 at $0.002 each — none of which appear in any captured
record.

So the measured $2.32 was really about **$2.62**. Per dial $0.0121 not $0.0108;
per conversation **$0.125 not $0.111**.

**We have captured exactly ONE record type.** `/api/admin/telnyx-charges`
queries nineteen. AMD is provably billed and provably absent from the webhook,
which means anything else billed outside `call.cost` is equally absent.

> **Ledger → CAPTURE NOW is the highest-value click available.** It reads
> `GET /v2/detail_records` across all nineteen types and stores them
> append-only. It is admin-authed, so it needs a human. Until it is run, the
> honest statement is not "we know what we are charged" — it is "we know what
> one webhook reports."

---

## 1e. Options checked and rejected, so nobody re-checks them

**Channel billing — inbound only.** A flat MRC per concurrent channel with calls
at $0: US pricing is $12/channel (0–10), $11 (10–50), $9 (50–250), $8 (250+).
It applies *only to inbound*. Peak concurrency here is 12 with an average of 1.4
when active, so twelve channels would be $144/month against a $28 usage bill —
worse, and it would not touch outbound anyway.

**Pre-answer voicemail detection — not on this stack.** Screening automated
announcements during *early media*, before a call is billable, is a real
technique. But at SIP signalling level a human answer and a voicemail answer are
structurally identical (`INVITE → 100 → 183 → 200 OK`); the difference exists
only in the media. Telnyx Call Control does not expose pre-answer media without
paid media streaming. Worth remembering only if a different stack is ever
evaluated.

**Leaving Call Control for plain SIP trunking — loses AMD.** The platform fee is
**39.7% of the entire bill** ($2.06 across 1,028 billed minutes, on essentially
the same seconds as sip-trunking's 1,048) and is documented as *"$0.002/minute
plus the SIP Trunking fee"*. But AMD is a Programmable Voice feature and is not
offered on standalone Elastic SIP Trunking, and AMD is what skips 54% of
everything that answers. The 40% is the price of the platform, and the place to
attack it is the Committed tier's *"discounted rates across everything you
use"*, not an architecture change.

**Their contract has a dispute clause.** *"The Parties shall negotiate in good
faith to resolve any billing dispute for a period of thirty (30) days."* Should
not be needed for requests for information, but it exists.

---

## 1g. THE AGENT LEG IS BILLED TWICE, AND IT NEVER TOUCHES A PHONE NETWORK

The agent's leg is not a phone call. It is a SIP URI dialled from our Call
Control application to the credential connection the agent's browser registers
against — entirely inside Telnyx, no carrier, no PSTN. It produces **two
separate billing records.**

One call session, every record it generated:

| connection | leg id | billed | cost | cost parts | what |
|---|---|---|---|---|---|
| `…31936933233` — **credential** | `80101afa` | 2058s | **$0.0686** | `sip-trunking @ $0.00200` | *not linked to any call* |
| `…04966737730` — **call control** | `7fe7e45e` | 2058s | **$0.0686** | `call-control @ $0.00200`, `sip-trunking @ $0` | **agent leg** |
| `…04966737730` — call control | `801a750e` | 2040s | $0.2380 | `call-control @ $0.00200`, `sip-trunking @ $0.005` | lead leg |

Identical seconds, identical amounts, different leg ids, different connections.
Not a duplicate record — a second leg. A call from a Call Control application to
a SIP URI on your own credential connection traverses two connections, and
Telnyx meters each traversal.

### What this means

- **The carriage genuinely is free.** `sip-trunking @ $0` on the agent leg is
  Telnyx confirming there is no carrier involved. **Every cent paid on an agent
  leg is connection fee**, charged twice at $0.002/min.
- **Effective agent-leg rate is $0.004/min.** A real PSTN call averages
  $0.0052/min ($0.00321 termination + $0.002 platform). **An internal
  browser leg costs 77% of what it costs to ring an actual phone.**
- This is also why the credential-connection records never matched a call row
  and read as orphans: they carry their own `call_leg_id` and a
  `call_control_id` we never issued. They are only identifiable by
  `call_session_id`, or by their connection.

### It confirms the teardown fix was the biggest thing done all week

Splitting the whole ledger at the fix:

| | legs | billed min | cost | share | avg leg |
|---|---|---|---|---|---|
| **before** — agent legs (both records) | 427 | **1,333** | **$2.667** | **79.2%** | 187s |
| before — lead legs | 212 | 86 | $0.697 | 20.7% | 24s |
| **after** — agent legs (both records) | 296 | 223 | $0.447 | **24.6%** | 45s |
| after — lead legs | 148 | 163 | $1.315 | 72.5% | 66s |

Before the fix, **79% of the entire bill was agents' browsers listening to
ringing.** Lead legs — the actual product — were a fifth of spend.

### Still true after the fix

223 billed minutes on legs that never leave Telnyx, against 163 minutes that
reach a real phone. **The agent leg still carries more billed time than the
lead leg**, because it is up for the ring and the conversation while the lead
leg is only up for the conversation.

That is exactly what `dial_agent_on_answer` removes, and it is the strongest
argument yet for turning it on (§3).

### The fourth question for Telnyx

> An on-net leg from my own Call Control application to my own credential
> connection, with `sip-trunking` explicitly rated at $0, is billed $0.002/min
> on each connection. Can on-net legs between two connections on the same
> account be zero-rated, or billed once?

Worth ~25% of the remaining bill, and it is the only question of the four where
their own record already concedes the premise: they wrote `$0` in the rate
field themselves.

---

## 1h. USF is real, it is rising fast, and at scale it stops being a cost question

**Checked because `TAX_RATE = 0.058` looked like an assumption. It is not** — it
was measured from a real August invoice: three codes (`TAX-CHARGES`,
`TAX-CHARGES-USF`, `TAX-CHARGES-TRS`) totalling $1.27 against $21.90 of charges.
Nothing hidden. But two things follow that are not in any forecast.

### The contribution factor is climbing steeply

The FCC sets it quarterly, as a percentage of interstate end-user revenue:

| quarter 2026 | factor |
|---|---|
| Q1 | 37.6% |
| Q2 | 37.0% |
| Q3 | 38.8% |
| **Q4** | **42.0%** — a record |

Telnyx passes it through: *“USF will be applied to telecom and/or VoIP
consumption and Programmable Voice (US Outbound & Inbound) services. Only the
Interconnected VoIP portion of these products will be subject to USF.”*

That 5.8% blended rate was struck when the factor was ~38%. At 42% the same
assessable base gives roughly **6.3%**. Small in absolute terms — about $0.02 a
day per agent at the §0 floor — but it is a line that rises on its own, and it
is the only one here that does.

### The exemption exists and is probably the wrong door

Telnyx: companies that *“file the FCC Form 499-A and make USF contributions
directly as a provider of telecommunications”* may apply for exemption via
`tax@telnyx.com`, renewed annually.

**Do not chase this as a saving.** Claiming it means becoming a direct
contributor, which means owing USF on **your own** end-user revenue — the seat
subscriptions — at that same 42% against whatever share is deemed
telecommunications. That trade is only favourable if almost all revenue is
classed as software, and that classification is not ours to assert.

### The part that actually matters

> **At 100 subscribers, reselling voice, a Form 499-A obligation may exist
> whether or not anyone claims an exemption.** That is a compliance question,
> not a cost question, and it arrives at exactly the scale being planned for —
> not at today's two agents.
>
> **Get a telecom regulatory advisor before the subscriber count grows, not
> after.** This is well outside what can be settled from invoices and help
> articles, and it is the one item in this document that is worth paying a
> professional to answer.

### While here: the ledger has still only ever captured one record type

`telnyx_ledger_records` holds **1,103 rows, all `call.cost`**, spanning 14–15
September. No tax records, no DID records, no AMD records — `call.cost` does not
carry any of them. `/api/admin/telnyx-charges` queries nineteen types.
**Ledger → CAPTURE NOW remains the highest-value click available** (§1d), and it
is the only way any of the above gets measured rather than inferred.

---

## 1i. ABANDONED CALLS — over the threshold, and the cause is our own bug

**Both figures in the first version of this section were wrong**, because both
denominators were. Telnyx's actual definitions, from their own pages:

- **Short duration**: a call of **6 seconds or less**. Surcharge $0.01/call once
  short calls are **15% or more of OUTBOUND TRAFFIC** — not of connected calls.
- **Abandoned**: *“dropped by the originating side before being answered”*,
  during ringing or setup. Surcharge $0.005 once **more than 20% of outbound
  calls**, and *“the surcharge will apply to all the abandoned calls and not
  just those that exceeded the threshold.”* Live since 1 Nov 2025.

The earlier version measured short calls against *connected* calls, and used
“answered but never bridged” for abandonment — which is a different thing
entirely from a call dropped before answer.

### Where we actually are

Counting only calls Telnyx saw (`call_control_id` present), September:

| | measured | limit | |
|---|---|---|---|
| short duration (≤6s) | **5.7%** | 15% | ✓ comfortable |
| **abandoned** | **21.6%** | 20% | **✗ over** |

Short duration was never a problem. Abandonment is, and on the *clean* day —
14 September — it was **33.8%**, worse than the month.

### What it is made of, on the clean day (533 dials)

| | legs | avg life | share of dials |
|---|---|---|---|
| **`AGENT_LEG_FAILED`** | **98** | **2–4s** | **18.4%** |
| fan-out cancellations | 78 | 17.0s | 14.6% |

**Our own bug is the larger half.** When an agent's browser SIP socket dies,
Telnyx accepts the agent-leg dial and gives up ~1.2s later; the lead's leg dies
with it. The lead gets a second of ringing. And nothing stopped the next dial —
one agent made 41 such dials in an hour.

**Removing `AGENT_LEG_FAILED` takes the clean day from 33.8% to 15.4%, under the
threshold.** That is the whole fix; the fan-out remainder is within limits.

### Shipped tonight

`lib/agentSocketBreaker.ts` — after N consecutive agent-leg failures the agent
is told to reload instead of dialing more leads. The default of 5 is argued
from the real distribution rather than a probability:

| run length | 1 | 2 | 3 | 4 | 5–11 | 12 | 28 |
|---|---|---|---|---|---|---|---|
| times seen in 30 days | 15 | 3 | 3 | 1 | **0** | 1 | 1 |

**Runs are either ≤4 or ≥12, never between.** A limit of 5 sits in an empty gap:
it would have fired twice in a month, both times on a genuinely dead socket, and
never on noise. `agent_leg_failure_limit = 0` turns it off with no deploy.

### This is also the go/no-go gate for `dial_agent_on_answer`

Deferring the agent leg means the lead is **already answered** when the agent's
leg is placed, so every agent-leg failure becomes a hangup on a live connected
call — a short-duration call *and* an abandoned one, on a base that is already
over the line.

> **Do not enable `dial_agent_on_answer` until a session runs with the breaker
> on and abandonment measured under 20%.** The saving is $0.68/agent/day. The
> surcharge is $0.005 on *every* abandoned call, retroactive across the month.

---

## 1j. THE 60-SECOND FLOOR IS PREPAID INVENTORY, AND WE THROW IT AWAY

The floor fires at answer and nothing afterwards reduces it. That is usually
stated as a reason not to rush a call. Turned around, it says something else:

**Every answered call buys 60 seconds of line. A voicemail uses 10.8.**

| verdict | legs | seconds used | prepaid seconds discarded |
|---|---|---|---|
| machine | 376 | 10.8 | **308.6 min** |
| no verdict | 147 | 7.0 | 129.7 min |
| human (under 60s) | 79 | 11.7 | 63.6 min |
| not_sure | 6 | 12.8 | 4.7 min |

**8.44 hours of line time paid for and discarded in 30 days.** It is already
bought. Playing audio into it is the obvious use, and **`voicemail_drop_url` is
null on all 21 campaigns** — the column exists and nothing uses it.

### Two gates, and neither is engineering

1. **Does `playback_start` bill separately?** Not established. Call Control is
   $0.002/min and we are already inside a minute we paid for, but Telnyx prices
   features individually and this one is not in the published breakdown.
   **Added to `docs/telnyx-questions.md`.** Do not build against an assumption
   here — `detect_beep` was assumed harmless twice and killed AMD both times.
2. **A prerecorded voice message is regulated on its content, not its
   delivery.** This is *not* ringless voicemail — the phone rang, a machine
   answered, we are already connected — so the FCC's 2022 RVM ruling is not the
   question. The question is prior express written consent for an artificial or
   prerecorded voice, which is a matter for counsel and for what the lists
   actually carry. TCPA exposure is $500–$1,500 per call and class actions rose
   112% year on year. **Not a decision engineering should make quietly.**

---

## 1k. RING LENGTH IS ALREADY RIGHT, AND BOTH INTUITIONS ABOUT IT ARE WRONG

**“Unanswered legs are free, so ring longer.”** Wrong. Late answers are not
people:

| ring | answers | human | machine | % human | real conversations |
|---|---|---|---|---|---|
| under 10s | 384 | 56 | 224 | 14.6% | 10 |
| **10–20s** | 142 | 35 | 76 | **24.6%** | 7 |
| 20–30s | 69 | 6 | 43 | 8.7% | 2 |
| **30s+** | 53 | **2** | 34 | **3.8%** | **1** |

Ringing past 30 seconds buys 34 voicemails at a 60-second floor each to find
one conversation.

**“So ring shorter.”** Also wrong. Cutting at 25s saves those 53 answers —
about **$0.42 a month** — and costs the conversation. A conversation is worth
more than forty cents. **Leave `ringTimeoutSecs` alone.** The peak human band is
10–20s and the current window already spans it.

> The lesson is the shape of the answer, not the answer: a lever that is free on
> one side of the ledger is rarely free on the other. Ring time costs nothing at
> the carrier and costs conversations at the margin.

---

## 1l. RETIRING DEAD NUMBERS — real, but worth a third of what it first looked

Everything else in this document shaves the cost of an answered call. Only one
thing avoids the answer: not dialing numbers that are never a person.

**The first version of this section said 93.8%, recommended dropping
`voicemail_streak_limit` from 4 to 2, and was wrong.** That figure came from 16
observations keyed on `lead_id`. The production code keys on **`phone_number`**
(`voicemailStreakKeys`, `lib/recentDialSuppression.ts`), and on that key with
seven times the data the answer is different.

### The real curve

Answered dials only, keyed by phone number, 90 days — exactly what the code sees:

| consecutive voicemails | n | machine again | **still reaches a person** |
|---|---|---|---|
| 1 | 82 | 61.0% | **39.0%** |
| 2 | 28 | 71.4% | 28.6% |
| 3 | 16 | 68.8% | 31.3% |
| 4 | 11 | 72.7% | **27.3%** |
| 5 | 8 | 75.0% | 25.0% |
| 6 | 6 | 66.7% | 33.3% |
| 7 | 4 | 50.0% | 50.0% |

**It plateaus at ~70% and never climbs.** A number with four voicemails on
record still reaches a person more than a quarter of the time — and one number
answered as a human on the sixteenth attempt.

> **The existing config comment was right.** It reads: *“the early sample
> (205/82/54 observations) puts the chance of another machine at 66%, 71%, 70%
> — it plateaus, and a band that wide cannot fix a threshold.”* This
> independent 90-day pass gets 61%, 71%, 69%. **Leave `voicemail_streak_limit`
> at 4.**

### What is still true

Leads are not the scarce resource — 17,142 of them against ~2,139 dials a month.
Dial slots are. So retirement never forfeits a conversation; it spends the same
dial on a different number:

| dial a… | chance of reaching a person |
|---|---|
| number with 4 voicemails on record | 27.3% |
| fresh number | **41.8%** |

**1.5×, not the 6× the bad sample implied.** Still worth having, still the only
mechanism that avoids the 60-second floor rather than shaving it — but it is a
modest edge, not the lever that changes the economics.

### Why the curve is flat, and what that means for tuning

If the chance of another machine is ~70% at depth 1 and ~70% at depth 5, then
**waiting buys no information.** The threshold is therefore not a statistical
question at all — the data cannot pick it, because every depth says the same
thing. It is a business preference: how many voicemails to leave before giving
up on a number, knowing each next one is about 70% likely to be another.

Four is a reasonable answer to that question. So is two. The data does not
prefer either, and any claim that it does is reading noise.

### The rule this earns

> **Key the analysis the way the code keys the decision.** The same question
> asked on `lead_id` gave 93.8% and on `phone_number` gave 61% — and only one of
> those is the key the retirement actually groups by. Before acting on a
> conditional rate, check that its grouping matches the grouping in the code
> path it is meant to change. See also §1f, where the window was wrong in the
> same way the key is wrong here.

---

## 1m. PREDICTIVE IS NOT BROKEN — and the measurement that said it was

**A `calls`-table reading said fan-out answers prospects into silence. It was
wrong, and it was one step from a recommendation to disable predictive before a
dialing day.**

What the table said, eight days:

| dial_source | legs | answered | `bridged_at` set |
|---|---|---|---|
| user_dial | 1,614 | 449 | 425 |
| **controller_fanout** | 525 | **137** | **0** |

Zero, across three separate days of use. Every fan-out leg has an agent leg
(525 of 525), so the obvious reading was that 137 people picked up and got
nothing — matching a known earlier incident where exactly that happened.

### What Telnyx actually sent

| event, from the carrier | total | on fan-out |
|---|---|---|
| **`call.bridged`** | **3,189** | **136** |

**136 of the 137 bridged.** The lead leg carries `link_to` and
`bridge_on_answer` whenever an agent leg exists, and fan-out places one per
line, so Telnyx bridges without being asked.

`bridged_at` was never a record of the carrier's state. It was a record of *our
own bridge command*, written in the `user_dial` branch of `handleCallAnswered`.
Fan-out never runs that branch, so its bridges were invisible — while 3,189
`call.bridged` webhooks sat in the `unhandled` bucket saying so.

**Fixed:** `call.bridged` is now handled and stamps `bridged_at` when it is
missing, for any source. Additive only — it issues no commands.

### The open item this closes

> *“Predictive bridge fix is shipped but UNVERIFIED — must not re-enable until a
> fan-out call is seen reaching `call.bridged`.”*

**136 have.** The condition is met, from the carrier's own events.

### The rule, and it is the third time tonight

> **Check the carrier's record before concluding anything about the carrier.**
> `bridged_at` measured our command; `calls.duration` included the ring (§1a);
> the agent-leg cost was half its real value because the second record carried
> a `call_control_id` we never issued (§1g). Each time, a derived column was
> read as though it were the carrier's state. **Every conclusion about what
> Telnyx did belongs against `call_events` or `telnyx_ledger_records`, not
> against a column we populate.**

---

## 1n. THE DIALER RETRIES A BLOCKED ACCOUNT IN A HOT LOOP

On 11 September the Telnyx account was **blocked** and the number pool was
**empty**. Both conditions fail every dial for every agent. The dialer did not
notice:

| hour ET | rows written | actually placed | distinct leads | **attempts per lead** |
|---|---|---|---|---|
| 11:00 | 542 | 0 | — | — |
| 12:00 | 1,776 | **0** | 210 | 8.5 |
| **16:00** | **1,827** | **0** | **44** | **41.5** |
| 17:00 | 64 | 0 | 21 | 3.0 |

**4,341 attempts over ten hours. Not one reached Telnyx.** One lead was
attempted 41 times in a single hour. Agents sat at their desks the whole time.

The carrier's own diagnostics recorded exactly why, 555 times:

- `"No phone numbers available in pool. Contact admin."` — 328
- `"Account is disabled D17. The Account used to place the termination call is
  blocked."` — 227

Both are **platform-level**: they cannot be fixed by trying a different lead,
which is precisely what the dialer did, 4,341 times.

### The phantom rows this creates — and the correction to an earlier claim

Each failed attempt is auto-dispositioned, and `/api/leads/dispose` has a
fallback that inserts a `calls` row when no call row exists. So every failure
writes a row with no `call_control_id`, no pool number, no cost.

**An earlier note in this document implied ~66% of the calls table is phantom.
That was one day dominating a month.** Day by day:

| day | rows | real calls | **% phantom** |
|---|---|---|---|
| 09-08 | 279 | 271 | 2.9% |
| 09-10 | 212 | 209 | 1.4% |
| **09-11** | **4,368** | **27** | **99.4%** |
| 09-12 | 870 | 857 | 1.5% |
| 09-14 | 596 | 533 | 10.6% |

Normally 1–3%. **Reporting is fine except on exactly the days you most need to
understand.** Anything counting calls should filter `call_control_id is not
null`; every figure in this document already does.

### The fix, and why it is not shipped tonight

There is no automatic breaker. `dialer_down_status` is a **manual maintenance
banner**, admin-set, unrelated.

The right shape is the one `lib/cpsGovernor.ts` already uses and
`docs/CARRIER-ENGINEERING.md` §10 insists on: **delay, never refuse.** After N
consecutive *platform-class* failures — 503 no-numbers, Telnyx account blocked —
each subsequent attempt waits, growing to a ceiling, and the first success
clears it. That turns 4,341 attempts into a slow poll without ever preventing a
dial that could have worked, so it cannot cause an outage even if its detection
is wrong.

Per-lead refusals (calling window, destination rate, suppression) must **not**
count toward it. They are correct outcomes for that lead and will not repeat on
the next one.

> **Not shipped tonight, deliberately.** This would be the third call-path
> change in one session, its triggering condition (an unfunded account) is
> resolved, and the standing instruction for tonight was *“don't break any
> audio.”* The design above is complete and the failure signatures are known;
> it wants a session where it is the only thing moving.

---

## 1f. NUMBER BURN — CHECKED AND NOT SUPPORTED

**This section previously claimed the opposite. It was wrong and it is worth
keeping the wrong version visible, because the error is a trap anyone would
fall into again.**

### What it said

Answer rate over 30 days tracked lifetime usage almost perfectly: the two most
used numbers (~640 lifetime calls) answered at 18.4% and 20.6%, the two newest
(13 calls) at 53.8% and 61.5%. Roughly 3×. It read as textbook number burn and
it was written up as the largest effect measured.

### Why it was wrong

**The window was the variable, not the number.** A number's lifetime count is
mostly a record of *when* it was in service. The heavily-used numbers
accumulated their volume in early September; the new ones only ever dialled on
the 14th. Comparing them compares two periods, not two numbers.

Re-run over one window, where the period cannot confound it:

| lifetime calls | dials in window | answer % |
|---|---|---|
| 594 | 13 | 61.5% |
| **545** | **200** | **64.5%** |
| 501 | 100 | 24.0% |
| 420 | 13 | 69.2% |
| 388 | 12 | 33.3% |
| 388 | 12 | 58.3% |
| **140** | 36 | **19.4%** |

**The correlation is gone.** The number with 545 lifetime calls took 200 dials
and answered at 64.5%; the one with 140 answered at 19.4%. If anything it now
runs the wrong way.

Also: the two numbers held up as proof answered 13 calls each. **A conclusion
built on a sample of 13.**

### What is actually there

Pool-wide, by day:

| day | numbers | dials | pool answer % | worst → best number |
|---|---|---|---|---|
| 09-08 | 3 | 250 | 17.2% | 14.4 → 21.1 |
| 09-09 | 3 | 218 | 13.3% | 5.7 → 27.7 |
| 09-10 | 8 | 209 | 28.7% | 19.6 → 47.4 |
| 09-12 | 11 | 857 | **16.2%** | 4.5 → 42.4 |
| 09-14 | 13 | 533 | **51.6%** | 24.0 → 69.2 |

**Between-day variance dwarfs between-number variance.** The pool swings
16.2% → 51.6% across two days while the spread between numbers on any given day
is narrower. The same number answered 4.5% on the 12th and **64.5%** on the
14th. It was not rehabilitated in between — the day changed.

One relationship does survive, and it is about *daily intensity*, not lifetime:

| dials per number that day | pool answer % |
|---|---|
| 21 | 90.5% |
| 26 | 28.7% |
| **41** | **51.6%** |
| 73 | 13.3% |
| 78 | 16.2% |
| 83 | 17.2% |

Monotone apart from one day, and it points at the **soft cap already shipped**
(§11 of CARRIER-ENGINEERING), which demotes a number past 60 dials/day. Six
days, heavily confounded with list and hour — a direction, not a result.

### The number-health cron is sound, and was worth checking

It rests numbers on a rolling 3-day window against the **pool median**, not a
fixed threshold. That is exactly the right comparison given the above: it
controls for the day by construction. `+14158627515` was rested for 4.5% on a
day the pool median was ~16% — a correct relative judgement, and one that
simply did not predict the 14th. Nothing to fix.

### What NOT to do

**Do not pay for spam-label testing on `+18302832151` or `+14093450167`.** The
previous version of this section named them, and they are ordinary.

Registering the pool at `freecallerregistry.com` is still worth doing — it is
free, it is one form covering First Orion, TNS and Hiya, and A-attestation is
a separate question (§1b). Just not on the evidence that was in this section.

### The rule this earns

> **A per-entity rate computed over a window the entities did not share is a
> statement about the window.** Before believing any ranking of numbers,
> agents, lists or campaigns, re-run it inside one window all of them were
> present for. If the ranking does not survive that, it was never about them.

---

## 2. Where the money actually goes

Clean session, after the agent-leg teardown fix:

| | share of spend |
|---|---|
| **Voicemail termination** | **~41%** |
| Human conversations | 26% |
| Agent-side legs | 26.6% |
| Recording | 2.5% |

**58% of lead-leg spend is answerphones** — 246 billed minutes of greeting
against 191 minutes of actual conversation. You pay more to reach machines than
people, by a factor of 1.6.

Unit economics on that session: 216 dials, 142 answered, **21 conversations**,
$2.32.

| | measured | **with AMD (§1d)** |
|---|---|---|
| per dial | $0.0108 | **$0.0121** |
| per answered call | $0.0164 | $0.0184 |
| **per conversation** | $0.111 | **$0.125** |
| projected 6-hour day | $9.94 | **$11.21** |

The right-hand column is the honest one. Everything measured from `call.cost`
alone understates by roughly 13%, and possibly more — see §1d.

**Judge the platform on cost per conversation, not cost per day.** A cheap day
is a day nobody picked up: that session ran at a 65.7% answer rate, which is
exceptional and is *why* it cost what it did.

---

## 3. Shipped

| fix | worth | evidence |
|---|---|---|
| **Agent-leg teardown** | **$8.17 → $1.34/agent-hour** | longest billed leg 2,058s vs call 2,055s |
| Destination rate guard | 4.1% | 2 exchanges billing $0.07/min, 35× base |
| CPS leaky bucket | $60–120/mo | burst of 8 → 0/247/496…1746ms, exact 250ms spacing |
| Billing model corrected | — | 60s floor, lead-leg only; 23 tests |
| Voicemail-streak retirement | scales with volume | tunable, `voicemail_streak_limit` |
| Team-wide attempt budget | latent | was per-list; 81.8% of leads are cross-list duplicates |
| Pool rotation soft cap | deliverability | one number took 176 of 234 dials |
| Deferred agent leg | −17% to −23% | **built, flag OFF — gated on §1i** |
| **Agent socket breaker** | **abandonment 33.8% → 15.4%** | run lengths never fall between 4 and 12 |

### The flags

```sql
-- the deferred agent leg. DO NOT turn this on until abandonment is under
-- 20% with the socket breaker running -- see 1i. It is currently 21.6%.
update platform_config set dial_agent_on_answer = true;

-- the socket breaker's kill switch, if it ever stops a working agent.
update platform_config set agent_leg_failure_limit = 0;

-- everything tunable without a deploy
select dial_agent_on_answer, connecting_message,
       max_destination_rate, max_rate_min_samples,
       voicemail_streak_limit, amd_hold_seconds_after_machine,
       agent_leg_failure_limit
from platform_config;
```

---

## 4. Open

**DID rental is ~31% of the Telnyx bill, and it is the one line that does not
care how much you dial.** 13 numbers owned (12 active, 1 resting) at $1/month =
**$13/month** against $28.29 month-to-date usage. Every per-minute saving in
this document is fighting for a share of the other 69%.

At two agents that is **$0.22 per agent per day** — 6% of the $3.51 floor in
§0, sitting there whether anyone dials or not. It is also the cheapest thing
here to *increase* deliberately: §1f says daily intensity per number is the one
thing that still correlates with answer rate, and more numbers is how you lower
it. **This is a line to spend on, not to cut** — it just needs to be in the
model, and it was not.

> **The 10 `released` numbers are NOT being billed — an earlier version of this
> section said they were.** They carry a `provider_number_id`, which is what
> that claim rested on, but their `flag_reason` reads *“Not owned on Telnyx —
> retired automatically by number pool sync.”* The sync already ran, already
> found Telnyx does not own them, and retired them; it just never cleared the
> stale local id. There is no $10/month to recover and no reason to run
> `/api/admin/pool/sync` for it. **A local id is not proof of a remote
> resource.**

**Two thirds of calls never write back to their lead.** 206 leads were
undercounted by 481 attempts before the backfill; one was dialed 18 times in 28
minutes while its row read `dial_attempts: 0`. A runaway breaker at 25 is in
place, but it is a backstop — the real fix is on the write path.

**~~Predictive bridge unverified~~ — CLOSED (§1m).** Telnyx sent `call.bridged`
for 136 of 137 answered fan-out legs. The path works; only its telemetry was
missing, and that is now stamped from the carrier's event.

**88% of calls carry no `dial_source`.** Most call history cannot be attributed
to a lead, campaign or mode, which is why the write-back gap stayed invisible.

**321 calls outside 8am–9pm ET** in 30 days. Some legitimate across time zones,
some possibly not.

**Time of day is the largest untested lever.** Of calls that answer, the share
that are human: 1pm **27.5%**, 5pm 23.6%, 10am **10.7%** (196 dials, the biggest
sample and the worst hour). Same money, 2.6× the conversations. Samples are
small and confounded by which lists ran when — but it costs nothing to test, and
a week of weight shifted toward 1pm–6pm would confirm or kill it.

---

## 5. Rules that came out of this

- **Measure per leg, never per aggregate.** The 30-second minimum in the old
  cost model was fitted against one invoice line and landed within 9% because it
  over-counted agent legs and under-counted the lead floor. The errors cancelled.
  No aggregate could have exposed it; per-leg records did immediately.
- **An inference from the absence of a symptom is only as strong as the old
  code's ability to produce one.** Inbound rejection was shipped on the argument
  that agent legs cannot be `direction: incoming`, because otherwise agents would
  have heard the apology message. The old branch called `answer`, which is inert
  on a leg already being answered — so it proved nothing, and `reject` took the
  floor down.
- **A guard that can refuse is one bad measurement from an outage.** Every cost
  control here delays or downgrades; none can say no. See `lib/concurrency.ts`.
- **Thin data is a reason not to hardcode a threshold, not a reason to withhold
  the mechanism.** Voicemail-streak retirement was nearly dropped on 54 samples.
  It shipped with the threshold in config instead.
