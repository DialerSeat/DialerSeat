# Cost Findings

Everything measured on 14–15 September 2026, from Telnyx's own `call.cost`
records rather than from our rate model. Ordered by what it is worth.

The one-line summary: **dialing is nearly free, answering is the charge, and
about 40% of what you pay for an answered call is a minimum you never used.**

---

## 1. Ask Telnyx these three questions first

No engineering. Between them they are worth more than everything shipped so far.

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

**10 numbers marked `released` on 29 Aug still carry Telnyx ids.** Run
`/api/admin/pool/sync`. Retires them → already gone. **Reactivates them → Telnyx
has been billing $1/month each since August**, and you gain the headroom to drop
`daily_cap` from 200 toward the industry guidance of 70.

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
