# Cost Findings

Everything measured on 14–15 September 2026, from Telnyx's own `call.cost`
records rather than from our rate model. Ordered by what it is worth.

The one-line summary: **dialing is nearly free, answering is the charge, and
about 40% of what you pay for an answered call is a minimum you never used.**

---

## THE LIST

Everything found, ordered by what it is worth. Detail in the numbered sections.

### Do these — no engineering, and the top two are the biggest items in the file

| # | action | worth | where |
|---|---|---|---|
| 1 | **Switch Telnyx payment to ACH Direct Debit** | 3% of every dollar, forever — **~$199/mo at 100 agents** | §1q |
| 2 | **Turn on ACH auto-recharge, card as fallback only** | prevents *“negative balance 1 month → all numbers deleted”* | §1r |
| 3 | **Admin → Numbers → `$ AUDIT`** | settles **$0–$19.50/month** of E911 in one click | §1o, §1u |
| 4 | **Send `docs/telnyx-questions.md`** (5 questions) | **Q1 alone is 55.6% of answered-call billing** (§1a) — rewritten, the old version asked for 1.3% | §1a–c, §1g |
| 5 | **Ledger → CAPTURE NOW** | 1 of 19 record types has ever been captured | §1d |
| 6 | **Admin → Numbers → `⚠ SURCHARGE`** | both ratios month-to-date; portal pie chart still outranks it | §1i |
| 7 | **Admin → Numbers → `SET CNAM`** | free; landlines only, no answer-rate claim | §1t |
| 8 | Register the pool at `freecallerregistry.com` | free; First Orion + TNS + Hiya in one form | §1f |
| **10** | **Point Telnyx's inbound SMS webhook at `/api/webhooks/telnyx-sms`**, and hand-suppress the two people who already texted in | **somebody texted STOP and nothing heard it. $500–$1,500 per call, no safe harbour** | **§1ac** |
| **0** | **Upgrade Vercel to Pro ($20/mo)** | **two agents already use ~35–40% of Hobby's invocation cap; it PAUSES for 30 days, and Hobby forbids commercial use** | **§1x** |

### Last, once the rest is done

| # | action | why |
|---|---|---|
| 9 | ~~Full structural audit of everything shipped~~ | **DONE — §1v.** Found 3 defects: 2 created tonight, 1 worth 4.7× |

Nine changes landed on or beside the dial path in one night, several of them
interacting: a guard that can refuse, a guard that delays, a new failure branch,
a new webhook handler, and a changed cost constant. **The risk is no longer any
one of them — it is the combination.** Specifically worth proving:

- a dial cannot be delayed *and then* refused into something pathological;
- the backoff cannot serialise a predictive tick's parallel lines;
- the socket breaker's new per-dial query has not put latency on the happy path;
- the D17 regex cannot false-positive onto an unrelated Telnyx error;
- the CNAM write hits the endpoint and body shape Telnyx actually documents;
- the corrected agent-leg rate has not broken a figure elsewhere.

### Shipped tonight

| what | worth |
|---|---|
| Agent socket breaker | abandonment **33.8% → 15.4%**, under the surcharge line |
| `call.bridged` recorded from the carrier's event | proved predictive works; unblocked it |
| Agent-leg rate corrected $0.002 → $0.004 | reconciler was ~40% wrong on that half |
| Billing model validated against Telnyx | **184 of 192 legs predicted exactly** |
| **Number audit** (`$ AUDIT` / `SET CNAM`) | answers E911 and sets CNAM without Mission Control |
| **Real-time outage alert + D17 detection** | 11 Sept ran **ten hours** unseen; the cron is daily on Hobby |
| **Surcharge exposure screen** (`⚠ SURCHARGE`) | the $3.53 breach was invisible; also the gate on `dial_agent_on_answer` |
| **Platform-failure backoff** | ~7 attempts/min → under 1; delay-only, first success clears it |

### Built or designed, deliberately not on

| what | gate |
|---|---|
| `dial_agent_on_answer` (−$0.68/agent/day) | **abandonment must measure under 20% first** — §1i |
| Voicemail drop into the prepaid 49 seconds (§1j) | playback billing unverified **and** prerecorded-voice consent is counsel's call |

### Rejected — do not re-check

Branded Calling ($0.075/call, 6× a whole dial) · calling bundles (Operator
Connect/Zoom only, and Programmable Voice does not consume them) · channel
billing (inbound only, $144/mo against a $28 bill) · leaving Call Control (loses
AMD, which skips 54% of answers) · inbound `reject` (took the dialer down; inbound
costs **$0.90/month**) · changing the ring timeout (both directions lose) ·
lowering `voicemail_streak_limit` (curve is flat) · spam-label testing the two
numbers §1f originally named · inbound CNAM lookup · pre-answer AMD (not on this
stack) · call transfer anywhere ($0.10 per invocation).

### Found in the ledger capture (§1z)

| | |
|---|---|
| **PSTN bills 60/60, on-net bills 6/6** | overturned §1a's headline; the ask went from 1.3% to **55.6%** |
| the capture read **one page** | 50 records/type — seven minutes of sip-trunking. Fixed |
| AMD is its own record type | `rate_measured_in: invocations`, $0.002, `is_telnyx_billable: true` |
| `messaging` records exist | 3 of them, $0.00 — nothing sends SMS. Worth knowing the meter is there |

### Still unknown

1. Is **E911** enabled? — $0 or $19.50/month. **Invoice answers it.**
2. What **attestation level** are we getting? Free and automatic, level unnamed.
3. Which price-list line is the agent leg's **second $0.002/min**?
4. Does **`playback_start`** bill separately?
5. Does the **CPS surcharge** apply at all? (§1p says almost certainly not.)

### The corrections, kept visible on purpose

Five claims of mine did not survive checking: number burn (window artifact),
voicemail retirement (6× → 1.5×), predictive “never bridging” (telemetry gap), the
CPS surcharge (**priced off another product's tier table**), and the agent leg
being “double billed” (it is a published line). Four of the five came from reading
a column we populate as though it were the carrier's state — see §1m.

---

## 0. COST PER DIAL — the only unit that survives a change in volume

**This section used to project a day from an agent-hour measured on leaky
history. That was the wrong unit and it produced numbers that were wrong by
3–4×.** An agent-hour bundles pace, answer rate and a session's particular
mix; a *dial* does not. Build it from the published rates instead.

| component | rate | applies to |
|---|---|---|
| lead leg, PSTN carriage | $0.005/min | answered dials only — unanswered legs bill $0 |
| lead leg, platform | $0.002/min | answered dials only |
| **agent leg** | **$0.004/min** | **EVERY dial**, answered or not, billed on two connections (§1aa) |
| AMD | $0.002 | per answered leg |

At the measured 67.1% answer rate and 21s mean post-answer duration:

| | cost per dial | $3/day is |
|---|---|---|
| **today** — 60/60 billing, agent leg billed twice | **$0.0077** *(measured $0.0098)* | 389 dials |
| if the agent leg were not double-charged — **Telnyx Q3** | $0.0060 | 500 dials |
| if PSTN billed 6/6 — **Telnyx Q1** | $0.0049 | 612 dials |
| **both asks landed** | **$0.0032** | **931 dials** |

**$0.0032 is the number to hold them to.** Everything between today and it is the
two unsent questions — not engineering.

### What a day actually costs

| dials/agent/day | today | both asks landed |
|---|---|---|
| 200 | $1.54 | $0.64 |
| 300 | $2.31 | $0.97 |
| **500** | **$3.85** | **$1.61** |
| 800 | $6.16 | $2.58 |
| **1000** | $7.71 | **$3.22** |

**At the rates the account should be on, $3/day per agent is roughly 930 dials.
That is a very big day, not a normal one.**

### The one engineering lever left on this

`dial_agent_on_answer` (built, flag **OFF**) removes the agent leg from the
~33% of dials nobody answers, and removes the ring from the rest. That is the
$0.0077 → ~$0.0060 row **without needing Telnyx to agree to anything**. It is
gated on abandonment (§1i, §1y), not on doubt about the saving.

### How to tell a leak from a normal day

Judge **cost per dial**, not cost per hour or per day:

| | |
|---|---|
| **≤ $0.010/dial** | normal at today's rates |
| **> $0.020/dial** | something is wrong — that is predictive's rate (§1ab) |
| **> $0.050/dial** | a leak. The parked-leg bug ran here |

A day that costs little because nobody answered is not a good day — unanswered
legs are free, so **cheap days are empty days**. Cost per *conversation* is the
business metric; cost per *dial* is the leak detector.

---

## 0a. WHAT ENGINEERING ALONE GETS TO, and the alarm at $3

### The honest per-dial figure, from Telnyx's own billing

Not modelled. Every billing record attributed to the dial that caused it:

| | measured |
|---|---|
| an **unanswered** dial | **$0.00237** — entirely the agent leg ringing. The lead leg bills $0 |
| an **answered** dial | **$0.01345** — 60s minimum × two components, + AMD, + agent leg |

Cost per dial is therefore **a function of answer rate**, which is why a single
figure kept being wrong:

| answer rate | cost per dial today |
|---|---|
| 27.8% *(the real 7-day rate)* | **$0.0055** |
| 67.1% *(one good session)* | $0.0098 |

### Where engineering alone lands — no Telnyx agreement needed

The **whole** $0.00237 of an unanswered dial is the agent leg. It does not have
to exist: `dial_agent_on_answer` places it only once a lead answers.

| | cost per dial @ 27.8% |
|---|---|
| today | **$0.0055** |
| **+ `dial_agent_on_answer`** (built, flag OFF) | **~$0.0036** |
| + Telnyx Q1 (PSTN 6/6) and Q3 (agent leg) | **~$0.0015** |

**Engineering alone gets to about $0.0036 a dial.** That is a **35% cut** and it
is the last lever that does not require Telnyx to answer a letter. At that rate
**$3/day is ~830 dials per agent.**

### So the alarm is arithmetic, not caution

At ~$0.003 a dial, **$3 from one agent in one day is roughly a thousand calls.**
Nobody dials a thousand times in a day. Reaching it almost certainly means a
fault — and every fault here has looked exactly like that first:

| | |
|---|---|
| the parked agent leg | **$8.17 per agent-hour, for weeks** |
| the blocked-account loop | **4,341 dials in ten hours**, nothing said |
| the dead browser socket | **41 failed dials in one hour**, one agent |

**In every one of those the money was gone before a person read a number.**

### Shipped: `lib/dailySpendAlarm.ts`

- Checked in the `call.cost` webhook — **the moment the carrier's own figure
  lands.** No cron, no dashboard, no month-end invoice.
- `platform_config.daily_spend_alert_usd`, default **$3.00**. 0 disables.
- **Re-alerts at 2×, 4× and 8×.** One alert then silence is the wrong shape —
  the failure mode is that a runaway keeps running. $3 says look, $6 says it did
  not stop, $12 says nobody has intervened.
- Compares **lead-leg `telnyx_cost` only**; the agent leg and twin bill
  separately, so the alarm is **conservative** — real spend is always higher
  than the figure that tripped it.
- **It alerts and nothing else.** It cannot refuse, delay or alter a call. A
  spend guard that could halt dialing would be a more expensive failure than the
  one it guards against.

---

## 0b. The road to $3 a day

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
| — | + DID rental ($13/mo ÷ 2 agents, §4) | $3.02 |
| — | **× 1.03 if topping up by card** (§1q) | $3.11 |
| — | **+ E911 IF enabled** ($1.50 × 13 numbers, §1o) | **$3.55** |

The last three rows are not levers, they are lines that were missing from the
model. Number rental does not care how much you dial, so it survives every
per-minute saving above and then sits on the result. The card fee **multiplies**
everything — and switching to ACH removes it outright, which makes it the
cheapest row in this table to fix. E911 is unverified and may be $0; it is shown
because at $19.50/month it would be the second-largest line on the account and
nobody has looked.

> **The surcharges (§1i) are not in this table** because they are month-level
> ratios rather than per-dial costs. September carries $3.53 of them, and the
> socket breaker shipped tonight is what stops that recurring.

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

> **$3.02 is the dialing floor; $3.11 on a card; $3.55 if E911 is on.** Only
> the first of those is engineering. Going under it means paying
> for fewer answered minutes, not cheaper ones — which is list quality, time of
> day (§4) and number burn (§1f), not carrier engineering. Those are also the
> only levers that make the day *more* valuable rather than just cheaper.

---

## 1. Ask Telnyx these four questions first

No engineering. Between them they are worth **more than twice** everything
shipped so far — see §0 for the arithmetic.

### 1a. It is not a minimum — PSTN is billed 60/60, and that is worth 55.6%

**This section said the opposite for most of a night, and the detail records
settle it.**

The claim was: *“you are already on 6-second increments; the 60 is a minimum
sitting on top.”* It rested on 1,033 of 1,490 billed records being multiples of
6 and not 60. **Those 1,033 are the agent legs.** 344 + 344 + 345 = 1,033
exactly — the agent leg, its credential-connection twin, and their two cost
parts. Not one of them is a PSTN call.

Split by leg, across 1,103 `call.cost` records:

| leg | records | **6-second increment** | 60-second |
|---|---|---|---|
| agent leg (on-net SIP) | 361 | **344 — 97.2%** | 10 |
| agent twin (credential conn) | 382 | **345 — 94.5%** | 20 |
| **lead leg (PSTN)** | 360 | **0 — 0.0%** | **192, every billed one** |

Confirmed independently in the `/detail_records` capture, where `call_sec` and
`billed_sec` sit side by side on the same call session:

| leg | destination | `call_sec` | `billed_sec` | |
|---|---|---|---|---|
| agent | `sip:gencred1…@sip.telnyx.com` | 182 | **186** | 6-second |
| lead | `+16262007113` | 163 | **180** | 60-second |

163 seconds rounds to 168 on a 6-second increment. It billed **180** — the third
minute.

> **So Telnyx's documentation was right and I was wrong.** *“60/60 billing
> increments”* is exactly what PSTN gets. The 6-second billing is real but it
> lives on the **on-net** product, which is why it looked like an account-wide
> concession when the agent legs dominated the sample.

### There is no “minimum”. The floor and the increment are the same thing.

A 61-second conversation does not bill 61, or 66. **It bills 120.** That is worse
than a floor, because a floor only costs you once.

### What that does to the ask

648 answered lead legs, 30 days, seconds after answer:

| | seconds | minutes |
|---|---|---|
| actually used | 19,149 | 319 |
| **billed today (60/60)** | **44,820** | **747** |
| if the 60s floor were cut to a 6s increment — *the old ask* | 44,226 | 737 |
| **if PSTN moved to 6/6 — the real ask** | **19,902** | **332** |

| ask | worth |
|---|---|
| what the letter said (reduce the “minimum”) | **1.3%** |
| **what it should say (60/60 → 6/6 on PSTN)** | **55.6%** |

**The letter was asking for 1.3% while the prize was 55.6%**, and it was asking
for something that mostly does not exist.

### The version to actually send

Not *“please give me a better rate”* — that gets a no. It is:

> **My account already receives 6-second billing on its on-net legs** — 344 of
> 361 records are multiples of 6 and not 60. My PSTN legs are billed 60/60 —
> all 192 billed records are multiples of 60, and a 163-second call billed 180.
> **Can the 6-second increment my account already has be extended to PSTN
> outbound?**

That is an extension of an existing entitlement across product lines, evidenced
from their own records, rather than a discount request. **57.3% of what is
billed on answered calls is rounding, not conversation.**

### 1b. STIR/SHAKEN attestation level

> **§1s largely answers this.** Telnyx: *“Every outbound call with a valid U.S.
> Caller ID that originates on the Telnyx platform receives attestation at no
> additional charge.”* Our numbers qualify, and the trace below was an agent leg
> — a SIP URI with no caller ID — so it was never evidence of a problem. What
> remains is confirming the *level*.

A SIP trace from this account carried `verstat=No-TN-Validation`. That was an
agent leg so it does not prove the outbound attestation is missing, but it is
worth one question. Industry reporting puts A-level attestation at 60%+ connect
improvement, and without it calls are spam-flagged regardless of anything else.

This does not reduce cost per conversation — it raises conversations per dial,
which is worth more.

### 1c. Month-to-date CPS tier

> **§1p supersedes this.** Three sources scope the CPS surcharge to Elastic SIP
> Trunking, a product we do not use. The $60–120/month below is almost certainly
> not owed. Kept because the question is still worth asking in writing, and
> because the reasoning error is worth not repeating.

CPS is billed on the 95th percentile of hourly peaks and never appears in the
balance — assessed monthly, landing on the invoice. P95 measured 15 CPS before
predictive was withdrawn, against a free tier of 5. Priced off the published
tiers that would give **$60–120/month** — **on a tier table belonging to a
different product.**

The real, product-independent constraint is the **20 CPS ceiling per IP or SIP
username**, which rejects calls rather than billing for them. That is what
`lib/cpsGovernor.ts` actually protects.

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

### It is a published line, not a billing error — corrected

The second charge is almost certainly **“Browser/app calling — $0.002 per
minute”** on Telnyx's Voice API price list (or the identically-priced “SIP
interface” line). An earlier draft of this section, and of the letter, framed it
as double billing. **It is not.** Two published line items apply to one leg:
`call-control` at $0.002/min and browser calling at $0.002/min.

What remains true and worth asking is narrower: the leg never touches a carrier,
Telnyx confirms that by rating its `sip-trunking` part at **$0**, and it still
costs **77% of what reaching a real phone costs**. So the question is *“which
line is this, and is an on-net leg between two connections on one account rated
differently?”* — not *“why am I charged twice.”* Asking the second version
invites a one-line answer quoting the price list, and ends the conversation.

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

## 1i. BOTH SURCHARGES ARE BREACHED — $3.53 in September, 12.5% of the bill

**The definitions, verbatim from Telnyx, because this section changed twice
before they were read properly.**

> **Short duration:** *“Short Duration Calls (SDCs) are outbound calls that are
> 6 seconds or less in duration.”* Ratio is *“Count of short duration calls
> connected / Total count of connected calls.”* Limit 15%. *“The penalty will be
> applied to ALL Short Duration calls made that month and not only those above
> the 15% mark”* — $0.01 each. Domestic **and** international; international
> was added 1 January 2024.

> **Abandoned:** *“the originating user initiates the call disconnection during
> the ringing/call set-up process”*, **including calls to disconnected
> numbers**. Ratio is abandoned outbound / **total outbound**. Limit 20%,
> $0.005 each, *“applied to all the abandoned calls and not just those that
> exceeded the threshold.”* Live since 1 November 2025.

**The two ratios have different denominators.** Short duration is over
*connected* calls; abandonment is over *total outbound*. An earlier draft
“corrected” short duration onto total outbound and reported a comfortable 5.7%.
That was wrong — the original figure was right.

### Where September actually stands

| | measured | limit | exposure |
|---|---|---|---|
| short duration (122 of 586 connected) | **20.8%** | 15% | 122 × $0.01 = **$1.22** |
| abandoned (462 of 2,139 outbound) | **21.6%** | 20% | 462 × $0.005 = **$2.31** |
| | | | **$3.53 — 12.5% of the $28.29 usage bill** |

**Verify this rather than trust it.** The Telnyx portal shows the abandoned rate
as a pie chart on the dashboard, and the advanced usage reports carry both.
That is the carrier's own count and it outranks this table (§1m).

### Dilution works for one of them and not the other

Both are month-long ratios, so clean volume pulls them down — **but only if the
clean rate is under the limit.** It is not:

| 14 September | abandoned |
|---|---|
| as it ran | **33.8%** |
| with the socket breaker (§1i below) | **15.4%** |

**Dialing more at the 14th's actual rate makes abandonment worse, not better.**
An earlier draft said two normal days would clear it; that used
“answered-but-unbridged”, which is not what abandoned means.

**The socket breaker is what makes dilution possible at all.** With it on:

| to clear September | needs |
|---|---|
| short duration | 421 more connected calls ≈ **816 dials** |
| abandoned | **741 more dials** |
| **binding** | **816 dials — about 1.5 days at the 14th's pace** |

### What the abandonment is made of, on the clean day (533 dials)

| | legs | avg life | share |
|---|---|---|---|
| **`AGENT_LEG_FAILED`** | **98** | **2–4s** | **18.4%** |
| fan-out cancellations | 78 | 17.0s | 14.6% |
| other | 4 | 3.0s | 0.8% |

**Our own bug is the larger half**, and it is the half that is now fixed.
`lib/agentSocketBreaker.ts` stops an agent after 5 consecutive agent-leg
failures instead of letting a dead browser socket ring leads at 41 an hour. Run
lengths over 30 days were 1, 2, 3, 4 — then 12 and 28, nothing between — so 5
sits in an empty gap.

The fan-out remainder is inherent to multi-line dialing and is within limits on
its own.

> **`dial_agent_on_answer` stays OFF until this is measured under 20%.**
> Deferring the agent leg means the lead is **already answered** when the agent
> leg is placed, so every agent-leg failure becomes a hangup on a live connected
> call — a short-duration call *and* an abandoned one, on a base already over
> both lines. The saving is $0.68/agent/day; the surcharge is retroactive across
> the month.

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

## 1q. A 3% FEE ON EVERY DOLLAR THAT ENTERS THE ACCOUNT

> *“Credit Card and PayPal payments will incur an additional 3% transaction fee.”*
> *“Making payments through ACH Direct Debit incurs no fee to our customers.”*

**This is not a per-call optimisation. It is 3% off the top of everything ever
spent with Telnyx, forever, and it is fixed by changing a payment method.**

Measured from the balance snapshots (two days, all we hold): six top-ups,
**$23.86**, of which **$0.72** was fee if paid by card.

It scales exactly linearly, which is what makes it worth more than anything else
in this document at the scale being planned for:

| | monthly spend | 3% card fee |
|---|---|---|
| today | ~$50 | ~$1.50 |
| 10 agents at the §0 floor | ~$664 | **~$20** |
| **100 agents at the §0 floor** | **~$6,644** | **~$199/month** |

**Action: switch the Telnyx payment method to ACH Direct Debit.** Keep a card on
file as emergency backup — auto-recharge on a card still carries the 3%, so the
card should be the fallback, not the default. Auto-recharge is capped at **10
times per 24 hours** and that cap cannot be lifted; minimum payment is **$10**.

---

## 1r. THE ACCOUNT DELETION RULE, AND WHY IT IS NOT THEORETICAL

> **“Negative balance for 1 month” → account abolished → “all numbers are deleted
> from the account.”**

On **11 September** Telnyx returned *“Account is disabled D17. The Account used to
place the termination call is blocked”* 227 times. The account has already been
in the state this rule starts from.

**Losing the numbers is not losing $13 of rental.** It is losing every number's
accumulated answer history and local presence, and §1f says the pool is a
consumable whose value is its history. A month of inattention on a negative
balance deletes the asset, and the dialer's response to that state is to retry
4,341 times over ten hours (§1n) rather than to say anything.

**Action:** ACH auto-recharge with a card as fallback covers this and the 3% in
one change.

### While here — the balance mystery has a mundane answer

> *“Taxes are calculated and applied **daily**, deducted from the balance on the
> following calendar day.”*

Balance moves that never matched call costs were partly this: tax is a separate
daily debit, landing a day late, unrelated to any individual call. Worth knowing
before reading another balance drop as an overcharge.

### Two more, recorded so nobody re-derives them

- **International spend limit $700/day**, resetting 00:00 UTC, error *“403
  International daily spent limit reached D39”*. Not near it; it exists.
- **No refunds** on consumed pay-as-you-go services, or on any payment 180+ days
  old. Money in the account is spent money.

---

## 1t. OUTBOUND CNAM IS FREE, AND NOBODY HAS SET IT

> *“Outbound caller ID name listing is free.”* Up to **15 characters**, pushed to
> the US industry databases, live in **12–72 hours**.

Thirteen numbers currently display as a bare number. A registered CNAM shows a
business name instead — **for nothing**, set once per number in Mission Control
→ Numbers → number settings → CNAM listing.

### The honest caveat, which is most of the value gone

> *“It's up to the receiving carrier of your outbound calls to display CNAM…
> wireless carriers generally don't use CNAM services.”*

**Mobile phones will not show it.** For a dialer working consumer lists that is
the majority of the list. What it buys is the landline share, plus a legitimacy
signal in the databases the analytics engines read — plausible, not proven.

**Still worth doing, because it is free and takes minutes.** Just do not expect
it to move the answer rate, and do not confuse it with Branded Calling, which
*does* reach mobile and costs **$0.075 per call** — 6× the entire cost of a dial,
and arithmetically impossible here (§1e).

Related, and not worth buying: **inbound CNAM lookup is $0.40/month per number**
— that resolves a *caller's* name on calls coming in. Thirteen numbers would be
$5.20/month to label inbound callers we already know from the lead record.

---

## 1u. BUNDLES DO NOT APPLY, AND THE INVOICE DECODER

**Calling bundles are not available to us.** *“Bundle offers are currently limited
to Operator Connect and Zoom Phone users”*, and decisively: *“programmed voice
calls are charged separately and do not affect the bundle's minutes.”* Every call
this platform places is Programmable Voice. **Rejected — do not re-check.**

### What can appear on the invoice

Useful for reading the next bill, since only usage has ever been looked at:

| category | what lands there |
|---|---|
| **MRC** | number rental, and *“recurring fees for enabled features like inbound channels, CNAM, **emergency services**”* |
| **One-time** | number purchase, feature activation fees |
| **Usage** | voice traffic by quantity, average cost, total |
| **Fees** | port-in and port-out fees, **“3% charge for using credit card or paypal”** |
| **Adjustments** | top-ups, credits, ledger |

Two things fall out of that table:

1. **The 3% card fee is a named invoice line** — independent confirmation of
   §1q. It will be visible on the last invoice.
2. **E911 appears under MRC as “emergency services”** — which is exactly where to
   look to settle the $0–$19.50 question in §1o. One glance at the previous
   month's invoice answers it.

**Port-out fees exist.** Worth knowing before any carrier switch: leaving is not
free, and the numbers carry the answer history that §1f says is the real asset.

Invoices for the previous month appear *“during the first few days of the new
month”*.

---

## 1s. CHECKED AND CLEAR — four things that are not leaks

Recorded so nobody spends a second night on them.

### Inbound costs about three cents a day

Inbound still answers, speaks and hangs up — the `reject` attempt that would have
stopped it took the whole dialer down (§8 carrier doc) and was reverted. Measured
over the two days of ledger we hold: **20 legs, 11 billed minutes, $0.0572.**

**About $0.03/day, call it $0.90 a month.** The instruction *“I don't want inbound
callbacks active or chargable”* was right in principle, and the charge is real —
but it is a rounding error against a $46–$66 monthly bill, and the attempt to
remove it cost a dialing day. **Leave it.**

### STIR/SHAKEN attestation is free and automatic

> *“Every outbound call with a valid U.S. Caller ID that originates on the Telnyx
> platform receives attestation at no additional charge.”*

Our numbers are Telnyx numbers, so they qualify. **And the
`verstat=No-TN-Validation` that raised this was on an agent leg** — a SIP URI to
a browser, which has no US caller ID and is not a PSTN origination. Expected, not
a fault. §1b overstated it.

Worth still asking which *level* (A, B or C) is being applied, since the article
says “attestation” without naming a level and A-level is what drives connect
rates. But there is no missing purchase here and nothing to buy.

### Caribbean and territory numbers are already blocked

**173 leads** sit in NPAs that look domestic — all `+1` — but are international
destinations at international rates: 787, 784, 868, 268, 264, 473, 869, 242, 809,
284 and others. Telnyx rejected 172 Guam (`671`) attempts in September as
*“country not whitelisted”*.

**`lib/areaCode.ts` already classifies them** (`OTHER_NANP`) and
`lib/callingWindow.ts` returns `allowed: false, code: 'international'`. **Zero
calls to any of these NPAs in 90 days.** The leak is sealed; the 173 leads simply
sit unreachable, which is correct.

### The 412 held calls are the compliance hold

`call.hold` fired 412 times in eight days, averaging 8.4 seconds. **276 of them
are on `machine` verdicts** — that is `park_after_unbridge: 'self'` parking the
lead leg for the 9-second AMD hold after the agent is released. Working as
designed, and free inside the 60-second minimum. The 36 on human verdicts are
agents using hold normally.

---

## 1o. THE PUBLISHED FEE LIST, CHECKED LINE BY LINE

From `telnyx.com/pricing/voice-api` and `/pricing/elastic-sip`. Every line, and
whether this platform touches it.

| line | price | us |
|---|---|---|
| Voice API (call control) | $0.002/min | **yes** — both legs |
| SIP trunking outbound | $0.005/min | **yes** — lead leg carriage |
| SIP trunking inbound | $0.0032/min | yes — inbound callbacks |
| **Browser/app calling** | **$0.002/min** | **yes — this is the agent leg's second charge** |
| SIP interface | $0.002/min | same rate, same leg — one of these two |
| Standard AMD | $0.002/call | **yes** |
| Premium AMD | $0.0065/call | no — deliberately (§6 carrier doc) |
| Call recording | $0.002/min | yes, human-confirmed only |
| **Recording storage** | **free** | — confirms no storage cost |
| **Call transfer** | **$0.10 per invocation** | **no** — nothing in the codebase calls it |
| Noise suppression | $0.002/leg/min | **no** — not enabled |
| Media streaming (WebSockets) | $0.0035/min | no |
| Conference | $0.002/participant/min | no — we bridge, not conference |
| Deepfake detection | $0.01 per invocation | no |
| Conversation Relay | $0.05/min | no |
| Speech-to-text | $0.0015–$0.027/min | no |
| Text-to-speech | per character | inbound `speak` only |
| **Emergency calling (E911)** | **$1.50/month/number** | **UNKNOWN — see below** |

**Call transfer at $0.10 an invocation is the one to never reach for casually.**
It is 8× the cost of an entire dial. Nothing uses it today; anything that adds
warm transfer should price it first.

### E911 is the largest unchecked line on the account

**$1.50 per month per number.** Thirteen numbers is **$19.50/month** — more than
the $13 DID rental and half the entire $28.29 usage bill.

Nothing in this codebase enables it; it is set per number on Telnyx's side,
often at provisioning. We cannot see it from here. **Check Mission Control →
Numbers → each number → Emergency settings, or look for an E911 line on the last
invoice.**

> **The monthly bill is probably not $28.29.** Usage $28.29 + DID rental $13 +
> surcharges $3.53 (§1i) + E911 $0–$19.50 + tax. That is **$46 to $66**, and
> only the first number has ever been looked at. This is the arithmetic behind
> the original instinct that the bill was bigger than the dialing.

---

## 1p. THE CPS SURCHARGE PROBABLY DOES NOT APPLY TO US

**Correction.** §1c estimated **$60–120/month** of CPS surcharge and it drove a
night of work on `lib/cpsGovernor.ts`. Three independent sources say the
surcharge is scoped to a product we do not use:

- Their knowledge base: *“CPS surcharges apply only to SIP trunking traffic (not
  programmable voice).”*
- `/pricing/elastic-sip`: the surcharge is named there, applying to **outbound
  SIP trunking** calls.
- `/pricing/voice-api`: **no mention of a CPS surcharge at all.**

We are on Programmable Voice — the `call-control` cost part exists only on that
product. The `sip-trunking` component inside our bill is not the Elastic SIP
Trunking *product*; the Voice API pricing page lists *“SIP Trunking (outbound):
$0.005/min”* as one of its own line items.

### What this changes, and what it does not

**Changes:** the $60–120/month is almost certainly not owed, and the CPS
question in the letter drops from “urgent before month end” to “confirm in
writing.”

**Does not change:** the **20 CPS real-time limit per IP or SIP username** is
real and product-independent — exceed it and calls are rejected outright, which
is an outage rather than a bill. `lib/cpsGovernor.ts` still earns its place
protecting that, and it only ever delays. Nothing to remove.

> Worth stating plainly: a night of engineering was justified on a surcharge
> that probably never applied. The governor is still correct and still useful,
> but the *reason* given for it was wrong, and the number quoted was invented
> from a tier table for someone else's product.

---

## 1v. THE AUDIT — what nine interacting changes did to each other

Item 9 on the list. **It found three real defects, two of them created the same
night while closing older ones.** That is the argument for doing it at all.

### Created tonight, and fixed

**1. The number audit read the wrong endpoint and would have answered the E911
question confidently wrong.** It took `emergency_enabled` and
`cnam_listing_enabled` as flat fields off `GET /phone_numbers`. **Neither exists
there.** Verified against Telnyx's reference: both are **nested**, under
`emergency` and `cnam_listing`, on `GET /phone_numbers/voice` — a different
resource, which in turn does not carry the phone number.

Every flag came back `undefined`, so every number read E911 **OFF**, and the
tool built to settle *“is this $0 or $19.50 a month”* would have said **$0
without ever looking.** Now fetches both lists and joins on `id`; rows carry
`settings_unknown` so a failed lookup can never read as “off”; and the bulk CNAM
write skips those numbers rather than overwrite a listing nobody saw.

**2. The D17 matcher would have widened per-lead failures into account
outages.** The first draft used `/account.*blocked/i` and `includes('D17')`.
The first also matches *“the destination account has blocked calls from this
number”* — one callee refusing us. The second matches `D17` appearing by chance
inside a `call_control_id` like `v3:QimHtanc0pXZ…`.

Either would classify a **per-lead** failure as `capacity`, which stops a whole
predictive tick **and** starts the outage backoff shipped hours earlier — a
dialer slowed down over one unreachable prospect. Now a pure matcher in
`lib/telnyxErrors.ts` anchored on Telnyx's observed wording, with 8 tests
covering the real 11 September string and every near-miss.

### Not created tonight, and much worse

**3. Unit economics was reporting a fifth of real cost, so margin was fiction.**

`billableSeconds` — the model that reproduces Telnyx's own
`billed_duration_secs` on **184 of 192 legs** — was used in exactly **one**
place. Every other cost figure went through `computeCost`, which counted the
lead leg only and was fed **raw talk seconds**.

| over 30 days, 2,261 calls | |
|---|---|
| unit economics said | **$1.79** |
| the validated model says | **$7.15** + $1.30 AMD |

**4.7× understated.** Both causes were already written down elsewhere in this
document and neither had been applied here: the 60-second floor (a voicemail
talks 11 seconds and bills 60) and the agent leg (billed on two connections,
carrying *more* billed time than the lead leg). An earlier fix on that page had
corrected ring time *out* of the minutes and stopped — which is why it looked
deliberate and was easy to walk past.

`computeCost` now takes `agentLegSeconds` and returns `agentUsd`.
`balance-ledger`, `telnyx-bill` and `telnyx-reconcile` deliberately still pass
raw seconds: they compare our model against what Telnyx actually charged, so
changing the model changes what *“unexplained”* means on those screens. That
wants its own pass.

### Checked and clean

| what could have gone wrong | result |
|---|---|
| backoff serialising a predictive tick | **no** — fan-out uses `Promise.allSettled`, one wait not three |
| socket breaker firing on a blocked account, telling agents to reload | **no** — zero `AGENT_LEG_FAILED` rows on 09-10/11/12 |
| the breaker's new per-dial query adding latency | **no** — index scan, **0.117ms** |
| the CNAM write hitting the wrong shape | **correct** — `PATCH /phone_numbers/{id}/voice`, verified |
| the corrected agent-leg rate breaking a figure | only `balance-reconcile` consumes it |

**Typecheck clean across the project. 220 of 221 tests pass** — the one failure
is `siteIndexing.test.ts`, another agent's marketing work, untouched by any of
this. `next build` cannot complete in this environment at all (no
`SUPABASE_URL`, so `/api/admin/billing` fails to collect page data regardless);
its TypeScript phase does pass.

### Noted, not fixed

**Two duplicate index pairs on `calls`**, the hottest table:
`calls_user_created_idx` and `idx_calls_user_id_created_at` are both
`(user_id, created_at DESC)`; `calls_campaign_created_idx` and
`idx_calls_campaign_id_created_at` are both `(campaign_id, created_at DESC)`.
Every insert maintains both halves of each pair. Pre-existing, small, and not
worth dropping an index on a live dialer at the end of a long night.

---

## 1ac. SOMEBODY TEXTED STOP AND NOTHING WAS LISTENING

**The most serious finding in this document, and it is not about money.**

It was hiding in the `messaging` record type — three rows at $0.00, which is
exactly why nobody had opened it.

| | |
|---|---|
| **02:36:24** | we called **+1 650 290 0972** |
| **02:37:26** | they texted **STOP** to the number that had just called them |

**Sixty-two seconds.** Telnyx received it and auto-responded
(`"autoresponse_type": "STOP"`). DialerSeat never saw it — **the only webhook
route in the entire application was `webhooks/clerk`.**

At the moment of the finding:

| | |
|---|---|
| that person, suppressed? | **no** |
| still in the lead list | **3 times** |
| **total rows in `suppression_list`** | **0. It has never held a single entry.** |

### The enforcement was always fine. Nothing ever wrote the opt-out down.

`checkSuppression` runs on every dial and would have refused. `lib/suppression.ts`
is well built. The gap was purely ingestion — `suppression_list` is written only
by a manual admin action, and no inbound message ever reached it.

### Why this outranks everything else here

Every other finding in this document is measured in cents per agent-day.
**Calling somebody who has revoked consent is $500–$1,500 per call**, and unlike
the FTC abandonment rules (§1y) there is **no safe harbour** for not having
built the listener.

### Shipped

- `app/api/webhooks/telnyx-sms` — the inbound route that did not exist
- `lib/smsOptOut.ts` — matches the six carrier keywords **and** the phrases
  people actually type (*“stop calling me”*, *“take me off”*, *“don't call”*),
  which carriers do **not** honour. Deliberately generous: a false positive
  costs one lead, a false negative costs a claim. 9 tests.
- Suppression is written at **platform** scope, not user scope — several agents
  share the pool and the person is asking the business to stop, not one seat.
- Every inbound message is recorded as a `sms_inbound` event, opt-out or not.
  The platform previously had no trace that inbound SMS existed at all.

> **IT RECEIVES NOTHING UNTIL TELNYX IS POINTED AT IT.**
> Mission Control → Messaging → your messaging profile → Inbound Settings →
> Webhook URL: `https://<your-domain>/api/webhooks/telnyx-sms`
>
> Deploying the route changes nothing on its own. **This is now item 10 on the
> list, and it is above every cost item.**

### And the two people who already texted in

`+1 650 290 0972` (texted STOP) and `+1 323 603 7154` are each in the lead list
**three times** and were never suppressed. The webhook only catches what arrives
from now on — **those two should be added by hand**, and it is worth asking
Telnyx for any earlier inbound messages the platform never saw.

---

## 1aa. HOW MANY TIMES IS ONE CALL CHARGED? Three records, and two are the same leg

The direct question, answered from 364 call sessions.

### Telnyx is NOT triple-charging, and the detail records are not extra money

`call.cost` is an **aggregate** — its `cost_parts` already contain the
call-control, sip-trunking and call-recording components. `/detail_records` then
reports those same components as their own rows. Matched on leg id:

| | detail records | webhook, same legs |
|---|---|---|
| `call-control` | **$0.0234** | **$0.0234** |
| `billed_sec` identical | **24 of 24** | |

**Same charge, itemised and aggregated.** Summing both double-counts — which is
exactly the “charged three times” picture that is *not* happening. The ledger
screen did that and has been fixed: the total is now `call.cost` plus only the
types it does not already contain, and every component row is flagged
`countedInTotal: false`.

### What one call actually produces

**2.95 billing records per call session.** A worked example:

| record | cost parts | $ |
|---|---|---|
| **LEAD leg** (PSTN) | `call-control@0.002` + `sip-trunking@0.005` | **0.2380** |
| **AGENT leg** (call-control conn) | `call-control@0.002` + `sip-trunking@`**`0`** | **0.0686** |
| **AGENT twin** (credential conn) | `sip-trunking@0.002` | **0.0686** |
| | | **0.3752** |

**The lead is charged once. That is correct.** PSTN carriage plus the platform
fee — both legitimate.

**The agent's own leg is charged twice, identically.** Same duration, same
amount, two connections. And Telnyx writes `sip-trunking@0` on the first one,
confirming no carrier is involved in either.

### The drain, sized

| across 364 call sessions | |
|---|---|
| total billed | **$5.1828** |
| **the agent leg** | **$3.1136 — 60.1%** |
| the lead leg — the actual product | $2.0120 — 38.8% |
| mean share per individual call | **54.4%** |

> **That window spans the parked-leg leak.** Post-teardown the agent leg is
> **24.6%** of spend (§1g). Both figures are real; 24.6% is the one that
> describes today. What does **not** change with the fix is the *doubling* —
> that is structural, and it is what §1g question 3 asks about.

### So, precisely

- **Not triple-charged.** Three records, and the third is the second leg's twin.
- **The lead leg is billed once and correctly.**
- **The agent leg is billed twice** — `call-control` on one connection,
  `browser/app calling` (§1o) on the other. Both published; neither touches a
  carrier.
- **Halving that is a quarter of today's bill**, and it is the one item where
  Telnyx's own record concedes the premise by writing `$0` in a rate field.

---

## 1z. WHAT THE LEDGER CAPTURE ACTUALLY CONTAINED

The capture returned exactly 50 records of every type — Telnyx's page cap, since
fixed (§1w). But those 50 were enough to overturn the biggest claim in this
document, because `/detail_records` carries a field the `call.cost` webhook does
not: **`call_sec` alongside `billed_sec`.**

The webhook tells you what you were charged for. The detail record tells you
what you used **and** what you were charged for, on the same row. That single
pairing is what made the increment visible — see §1a.

### The other fields worth knowing exist

| field | why it matters |
|---|---|
| `call_sec` / `billed_sec` | the increment, side by side. Nothing else exposes it |
| `is_telnyx_billable` | an explicit flag — a record can carry a cost and not be charged |
| `rate_measured_in` | `"invocations"` on AMD, `"minutes"` on carriage. Says what you are buying |
| `telnyx_session_id` | joins both legs of a call across record types |
| `cld` / `dest_number` | `sip:` prefix distinguishes an on-net leg from PSTN — which is the whole §1a finding |
| `attempted` / `completed` / `connected` | Telnyx's own connect accounting, independent of ours |
| `caller_name` | empty on every record — consistent with no CNAM set (§1t) |

### AMD, confirmed from the source

```
"record_type": "amd", "feature": "STANDARD",
"rate": "0.002", "rate_measured_in": "invocations", "invocations": 1,
"is_telnyx_billable": true
```

**Billed per invocation, not per answered call**, on its own record type, absent
from `call.cost` entirely. §1d inferred this from a gap of exactly the right
size; this is the receipt. It also means a call where AMD is invoked twice is
charged twice — worth remembering if detection is ever retried.

### A meter nobody is watching

**`messaging` returned 3 records at $0.00.** Nothing in this platform sends SMS.
Three zero-cost rows are harmless, but the meter exists and is being written to,
and an unexpected charge is by definition in a category nobody is watching. Now
in the capture set.

### What to do with the fixed capture

Re-run **Ledger → CAPTURE NOW**. It now pages to the end of the window and
returns `complete: true` or names every type it cut short. The previous run's
totals for `sip-trunking`, `call-control` and `amd` are **partial** and should
not be compared against anything.

---

## 1ab. PREDICTIVE, COSTED FROM THE LEDGER — 51% more per dial, for nothing

§1y is the legal case. This is the money, from the same ledger window, same
pool, same days.

| | dials | answered | human | **conversations** | billed | **cost/dial** |
|---|---|---|---|---|---|---|
| `user_dial` | 246 | 165 — **67%** | 27 | **7** | $2.079 | **$0.00845** |
| `controller_fanout` | 115 | 27 — **23%** | 6 | **0** | $1.470 | **$0.01278** |

**Predictive costs 51% more per dial, answers at a third of the rate, and
produced zero conversations for $1.47 in this window.**

Across its whole history it is 596 legs → **3 conversations**. Progressive does
better than that in a single day.

### Why the per-dial cost is higher — it is the agent side

| source | share of spend that is the AGENT side |
|---|---|
| `user_dial` | **16.0%** |
| `controller_fanout` | **81.9%** |

**Five times.** Fan-out places one agent leg **per line**, and each of those legs
runs for the whole ring of every line — then gets billed twice (§1aa). A 3-line
burst is 3 lead legs + 3 agent legs + 3 twins = **nine billing records to have
one conversation.**

And the 23% answer rate is not bad luck: it is the design. Surplus lines are
cancelled before they can answer, which is the same mechanism that violates the
TSR 15-second floor (§1y).

### The conclusion

Predictive as built:

- costs **51% more per dial**
- puts **82% of spend** on legs that never touch a carrier
- has produced **3 conversations in 596 legs**
- **cannot legally exceed one line** without a TSR-compliant no-agent message
  that does not exist

**At a ceiling of 1 it is progressive with extra steps** — which is exactly where
it is set, and the honest description of it.

> It is not broken and the audio is genuinely fine (136/137 bridged, 0.19s dead
> air, 100% agent-answered). It is simply **not earning its complexity**, and
> the thing that would make it earn it — lines above 1 — is the thing that is
> unlawful without the recorded message. Build that message first, or leave this
> at 1 and spend the effort on answer rate instead (§1f, §4).

---

## 1y. PREDICTIVE: WHY IT IS CAPPED AT ONE LINE, AND WHAT THE REGULATION ACTUALLY SAYS

**The binding constraint on predictive is not the carrier bill. It is 16 CFR
310.4(b)(4), and it is $500–$1,500 per violating call.**

### The safe harbor is four conditions, and you need all four

> **(i)** abandonment ≤ **3%** of calls answered by a person, per campaign, per
> rolling 30 days
> **(ii)** ring **at least 15 seconds or 4 rings** before disconnecting an
> **unanswered** call
> **(iii)** when no representative is available within **2 seconds** of the
> person's completed greeting, **promptly play a recorded message stating the
> name and telephone number of the seller**

Break one and the whole safe harbor is forfeit — including the 3% protection.

### Measured against the four days predictive has ever run

| condition | result |
|---|---|
| **(i)** ≤ 3% abandoned | **PASSES** — 136 of 137 answered legs bridged, ~0.7% |
| **(ii)** ring ≥ 15s before dropping | **FAILED** — **160 legs** rang and were cancelled **under 15s**, averaging **4.7s**, cause `normal_clearing` — us |
| **(iii)** no-agent recorded message | **DOES NOT EXIST** |

`abortSiblingFanoutLines` hung up every still-ringing sibling the instant
another line was picked up, with no floor at all. **Fixed** — a leg that has not
yet rung 15 seconds is now left to ring out.

`connecting_message` is *“One moment, connecting you now.”* — no seller name, no
phone number, and it plays on the deferred-agent path where an agent **is**
coming. It is not condition (iii) and cannot be made into it by editing the
string.

### The part nobody tells you: (i) and (ii) fight each other

**Cancelling surplus lines early is what kept abandonment at 0.7% — and early
cancellation is exactly what violates (ii).**

Let them ring the lawful 15 seconds instead and roughly a quarter answer with no
agent behind them. At 2 lines that is **~50% abandonment against a 3% ceiling**.

| lines | (ii) satisfied? | resulting abandonment | (i) satisfied? |
|---|---|---|---|
| 1 | trivially — no surplus | ~0% | yes |
| 2, cancelling early | **no** | 0.7% | yes, but harbor already forfeit |
| 2, ringing 15s | yes | **~50%** | **no** |

**There is no line count above 1 that satisfies both — which is precisely why
condition (iii) exists in the regulation.** The recorded message is the only
thing that resolves the tension: it converts a surplus answer from an abandoned
call into a compliant one. That is how every lawful predictive dialer works, and
it is the piece this platform does not have.

### So: `predictive_line_ceiling = 1`

At one line there is no surplus, so neither condition is stressed. Predictive
degrades to progressive pacing with better lead claiming — a real but modest
product, and a lawful one.

> **Raise it only after** a TSR-compliant no-agent message exists (seller name +
> telephone number, played within 2 seconds of the greeting), **and** Admin →
> Numbers → `⚠ SURCHARGE` shows headroom on the separate Telnyx 20% line.

### Two definitions of “abandoned”, and they are not the same

This caused real confusion and is worth pinning:

| | FTC TSR | Telnyx surcharge |
|---|---|---|
| **what counts** | person **answers**, no agent within 2s | originator drops **before answer** |
| **denominator** | calls answered by a person | total outbound |
| **limit** | **3%** | 20% |
| **penalty** | $500–$1,500 per call | $0.005 per call |

§1i is entirely about the second one. This section is about the first. **A
change that improves one can worsen the other**, which is exactly what the
15-second fix does.

### And the industry number nobody publishes

Enterprise predictive dialers pace at **1.2–1.5 calls per available agent**, not
3 and not 5. `campaigns.predictive_lines_per_agent` defaults to **1.5** — which
was right — but `lib/predictiveController.ts` does `Math.round()` on it per
agent and falls back to **3** when unset.

That is the wrong shape: **the ratio is a pool-level quantity.** Four agents at
1.5 means dial six lines, not “each agent gets 2”. Rounding per agent throws the
fraction away and always rounds *up*. Worth fixing when predictive goes above
one line — not before, because at a ceiling of 1 it cannot bite.

---

## 1x. THE HARD CEILING IS VERCEL, NOT TELNYX — and it pauses rather than bills

**The one finding in this document that is not about money.** It is about the
dialer stopping.

Vercel **Hobby is 1,000,000 function invocations a month**, and the enforcement
is not an invoice: *“exceeding a Hobby limit doesn't trigger a bill; it pauses
that feature for roughly 30 days.”*

### The dialer polls, and polling is invocations

| poll | interval | per agent / month |
|---|---|---|
| session heartbeat | 5s (**1.5s in predictive**) | 95,040 |
| pacing | 10s | 47,520 |
| incoming route (**predictive only**) | 2s | 237,600 |

Six hours a day, 22 days:

| mode | per agent / month | **agents to saturate Hobby** |
|---|---|---|
| **progressive** (all 26 campaigns) | 142,560 | **7.0** |
| **predictive** | 601,920 | **1.7** |

**Today, two agents on progressive burn 285,120 — 29% of the entire Hobby
allowance — before a single dial, webhook or page load.** Telnyx webhooks alone
added ~2,500 a day last week, another ~7.5%. Call it **35–40% used, on two
agents.**

And on 11 September the dialer made **4,341 dial attempts in ten hours** against
a blocked account (§1n). Every one an invocation.

### There is a second, separate problem with being on Hobby

> Hobby is **non-commercial use only**, and the enforcement is **account
> suspension**. DialerSeat takes payment. That is a violation the day
> monetisation is switched on, independent of any limit.

### Do NOT engineer around this

The heartbeat is 67% of the progressive budget and could go from 5s to 10s —
`STALE_HEARTBEAT_MS` is 15s, so two beats still land inside the stale window,
and it would double the ceiling to 14 agents.

**That is the wrong trade and it should not be made.** It is a liveness-critical
change to the dial path, to avoid a **$20/month** bill, while planning for 100
agents. Vercel **Pro is $20/month**, removes the ToS exposure, and removes a
ceiling that is otherwise five agents away.

> **This is the cheapest item in the entire document and the only one whose
> failure mode is “the product stops for thirty days.”** Every per-minute saving
> in §0 is measured in cents per agent-day. This is $20 a month to remove a
> cliff at seven agents and a suspension risk that already applies.

Once on Pro, the polling profile stops being a ceiling and becomes a line item:
at 100 agents progressive that is ~14.2M invocations a month, which is an
overage worth pricing but not one that stops anything.

---

## 1w. THE OTHER VENDORS — Stripe and the database

A night on Telnyx, and the bill has other names on it.

### Weekly seat billing costs $1,200/year at 100 seats, in fixed fees alone

Stripe is **2.9% + $0.30** per charge, plus **0.7%** for the Billing layer on
subscriptions. The percentages do not care how often you bill. **The 30¢ does.**

| per seat, per year, on $35/week | |
|---|---|
| billed **weekly** (52 charges) | **$81.12** — 4.46% of revenue |
| billed **monthly** (12 charges) | **$69.12** — 3.80% of revenue |
| **difference** | **$12.00/seat/year**, all of it the fixed 30¢ |

| seats | extra per year |
|---|---|
| 10 | $120 |
| 50 | $600 |
| **100** | **$1,200** |

**Weekly billing is a product decision, not a bug** — lower barrier, faster cash,
easier to cancel — so this is a price tag, not a recommendation. But it had no
price tag before. If a monthly option is ever offered, it is **0.66 points of
revenue cheaper to serve** and could carry a discount and still win.

Also worth knowing it exists: the **0.7% Stripe Billing layer** is $12.74 per
seat per year and is easy to not realise you are paying.

### `call_events` is 44% of the database, and 6.1 MB of it was a fossil — FIXED

`sync_call_control_id`, a trigger on `calls` and on **every** `call_events`
partition, mirrors `call_control_id` into `signalwire_call_id` on insert and
update. It was the compatibility shim for the SignalWire → Telnyx move.

So every event row stores the same 54-byte Telnyx id **twice**
(`v3:fROSyDPZWURY5x-z3ifEcI5Y8rox…` in both columns), and `idx_call_events_sid`
indexed the duplicate across 14 partitions.

| | |
|---|---|
| cost | **6.1 MB of index**, maintained on ~2,500 inserts a day |
| benefit | **3 index scans. Ever.** |
| readers in the codebase | **none** — repo-wide grep over `.ts`/`.tsx` is empty |

**Dropped.** `call_events` went **38 MB → 33 MB**.

> The equivalent indexes on `calls` were **deliberately left**: they show 12,241
> scans, because `idx_calls_answered_at` is a *partial* index
> (`WHERE answered_at IS NOT NULL`) the planner uses to find answered calls
> regardless of which column it is on. Dropping those would be a real
> regression. The trigger and the column itself are defensible follow-ups — one
> writes NULLs, the other rewrites a 38 MB table — and neither is something to
> do to a live dialer at the end of a long night.

### 465 rows a day of our own compliance hold — FIXED

`call.hold` and `call.unhold` were landing in the `unhandled` bucket. They are
**our own 9-second AMD hold echoed back**: when AMD says `machine`, the agent's
leg is released and `park_after_unbridge: 'self'` parks the lead leg. 412 hold
periods in eight days, averaging 8.4 seconds, 276 on machine verdicts (§1s).

Now handled and not stored. **Silencing a known event is not the blindness that
made `detect_beep` undiagnosable** — that was *unknown* events vanishing, and
anything still unrecognised lands in `unhandled` exactly as before.

With `call.bridged` also now handled (§1m), `unhandled` drops from **20.5% of
the table** by roughly three quarters.

### While in there: `call.cost` used to be unhandled too

7,061 rows of it, **stopping 14 September** — the day it got a handler. That is
why `telnyx_ledger_records` only holds two days of cost data, and it is a second
reason Ledger → CAPTURE NOW matters (§1d).

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
