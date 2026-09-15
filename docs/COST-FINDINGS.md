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
| 1 | defer the agent leg (`dial_agent_on_answer`, **built, OFF**) | $5.53 |
| 2 | destination rate guard (**shipped**) | $5.37 |
| 3 | **60-second minimum reduced** — Telnyx Q1/Q2 | $3.86 |
| 4 | **agent legs rated on-net** — Telnyx Q3 | **$3.51** |
| — | **+ DID rental** ($13/mo ÷ 2 agents, §4) | **$3.73** |

The last row is not a lever, it is a line that was missing from the model.
Number rental does not care how much you dial, so it survives every per-minute
saving above and then sits on top of the result.

### The honest conclusion

**Engineering alone gets to $5.37. The letter gets to $3.51.**

Steps 1 and 2 are ours and they are worth $0.85 a day. Steps 3 and 4 are
Telnyx's to grant and they are worth $1.86 — **more than twice as much.** That
is the whole result of the night in one line: *the remaining money is not in the
code, it is in four questions.* Send `docs/telnyx-questions.md`.

And at $3.51, AMD is suddenly **19%** of what is left — the third-largest line,
still invisible to every webhook we capture. It is next, and it is not reachable
until Ledger → CAPTURE NOW has run (§1d).

> **$3.73 is the floor this architecture reaches** — $3.51 of dialing plus
> $0.22 of rent. Going under it means paying
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
increment:

| who answered | records | avg actual | avg billed | wasted on the minimum |
|---|---|---|---|---|
| **machine** | 290 | **26.2s** | **60.0s** | **51.6%** |
| human | 87 | 110.7s | 145.5s | 22.2% |
| no verdict | 30 | 37.1s | 68.0s | 42.4% |

**32,100 seconds billed against 19,446 that 6-second increments alone would
produce. 211 minutes — 39.4% — is minimum, not conversation.**

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
| Deferred agent leg | −17% to −23% | **built, flag OFF** |

### The flags

```sql
-- the deferred agent leg. Watch abandoned calls when you turn it on.
update platform_config set dial_agent_on_answer = true;

-- everything tunable without a deploy
select dial_agent_on_answer, connecting_message,
       max_destination_rate, max_rate_min_samples,
       voicemail_streak_limit, amd_hold_seconds_after_machine
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
