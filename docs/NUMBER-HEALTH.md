# Number health

Why outbound numbers get flagged, what we can see about it today, what we
cannot, and what buying Telnyx Number Reputation would change.

Written 17 Sept 2026. Every figure here is measured, and the date is on it
because the numbers move.

---

## 1. The problem, in this platform's own data

Pool usage is not even, and answer rate tracks it almost perfectly inversely:

| number | state | dials (month) | share | **answer rate** | convos/100 dials |
|---|---|---|---|---|---|
| 415-862-7515 | CA | 645 | 20.3% | **33.6%** | 3.1 |
| 830-283-2151 | TX | 439 | 13.8% | **29.4%** | 2.3 |
| 409-345-0167 | TX | 433 | 13.7% | **31.6%** | 1.8 |
| … | | | | | |
| 925-232-9093 | CA | 104 | 3.3% | **76.0%** | 6.7 |
| 210-742-5406 | TX | 98 | 3.1% | **75.5%** | 5.1 |
| 361-217-1881 | TX | 94 | 3.0% | **67.0%** | 3.2 |

Three numbers carry 48% of traffic and answer at 29–34%. The lightest answer
at 67–76% and produce roughly **twice the conversations per dial**.

### The reading we cannot yet settle

Two explanations fit that table exactly, and they have opposite remedies:

- **Burn.** Work a number hard enough and carriers' analytics engines start
  labelling it, so fewer people pick up. Remedy: rotate harder.
- **Geography.** `claim_pool_number` ranks locality above everything but the
  soft cap, so the 415 number takes every California lead — and California is
  a fifth of the list. Heavy use and low answer rate would then both be
  downstream of *which states the leads are in*, and nothing is wrong with the
  numbers at all. Remedy: rotating harder **costs** answer rate.

Comparing across days cannot separate them, because the list and the hour move
too. That is what `lib/poolStrategy.ts` exists for: both arms run against the
same traffic at the same time, and `calls.pool_strategy` records which arm
chose each caller ID. It ships at `pool_experiment_pct = 0`.

### A third factor that is definitely real

`is_registered` is a tie-break in `claim_pool_number` that sits **above**
usage. Registered numbers therefore absorb nearly all volume. On 17 Sept the
nine registered numbers held 449–779 lifetime calls while six unregistered
ones sat at 0–212 — and the three best answer rates in the pool belonged to
unregistered numbers the selector was actively holding back.

---

## 2. How a number actually gets flagged

Three private analytics engines score every outbound call in the US and decide
what the carrier displays. A number with many short calls and a low answer rate
looks like a robocaller, because that is what a robocaller looks like.

This is why the compliance work and the number work are the same work. The
[short-duration surcharge](./CARRIER-ENGINEERING.md) was a Telnyx billing
event, but the underlying signal — a pile of sub-6-second connected calls — is
also scored by at least one of these engines. Same behaviour, two bills.

Researched 17 Sept 2026. **No vendor publishes numeric thresholds** — all
three treat their algorithms as proprietary — so everything below is a
weighting, not a number. Anyone quoting you "keep calls above X seconds" is
inferring, and this file will not.

### Who feeds which carrier

| engine | carriers |
|---|---|
| **Hiya** | AT&T, Cricket, and Samsung's native Android dialer |
| **TNS Call Guardian** | Verizon, US Cellular |
| **First Orion** | T-Mobile, Metro, Boost |

That mapping matters operationally: a number labelled on Verizon and clean on
AT&T is a **TNS** problem, and remediating with Hiya will not touch it.

### What each one weights

- **Hiya** — consumer feedback loops, call-pattern anomalies (burst dialing,
  24/7 activity), CNAM consistency, caller enrollment status.
- **TNS** — origination-network reputation, completion rates,
  **short-duration-hangup ratios**, STIR/SHAKEN attestation, and **number
  age**.
- **First Orion** — direct complaint volume, call-behaviour fingerprints with
  **heavy weighting on hangup-before-ring patterns**, number-neighbourhood
  reputation, branded-calling enrollment.

### Three of those land directly on things we already measure

1. **TNS weights short-duration-hangup ratios.** That is the same signal
   Telnyx surcharged us for on 16 Sept. The billing problem and the Verizon
   spam-label problem are **one problem**, and fixing the agent leg addressed
   both. Industry commentary also cites average call duration under 30 seconds
   as a blocking trigger; treat that figure as indicative, not published.

2. **First Orion heavily weights hangup-before-ring.** Our `AGENT_LEG_FAILED`
   path tears the lead leg down at roughly 1.2 seconds, which is exactly that
   shape. It ran at 16.4% of dials on 14 Sept and 5.4% on 17 Sept. This is a
   T-Mobile reputation risk, not only an agent-experience bug.

3. **TNS weights number age.** Consistent with what we measured on 15 Sept:
   brand-new numbers answered at **20.5%** while numbers rested 8+ days came
   back at **16.4%**. Resting does not restore age or history.

### Attestation is not our problem, and would not fix it anyway

Telnyx confirms that **customers who buy numbers from Telnyx should expect A
attestation**, applied automatically, with no action required and no
notification. Every number in our pool is Telnyx-purchased, so we are already
at the strongest signal available.

More importantly, **attestation and spam labelling are separate systems**.
Bandwidth puts it plainly: *"Attestation is not the same as call blocking or
spam identification. Those are features within the terminating service
provider's network."* A call signed A can still be labelled, because the
analytics engine scores behaviour, not authentication. Anyone selling
STIR/SHAKEN as a cure for "Spam Likely" is selling the wrong thing.

Telnyx does expose attestation in Call Detail Records. We do not currently
capture it — `call.cost` payloads carry no attestation field — so confirming
our real-world attestation would mean pulling CDRs. Worth doing once, to close
the question with evidence rather than a vendor statement.

### How long a flagged number takes to heal

**There is no "all carriers" answer.** Three databases, three processes,
three clocks. A number cleared on AT&T can still be labelled on Verizon a
fortnight later, and clearing one does nothing for the others.

**Active remediation — you submit it:**

| Engine | Carrier | Reported turnaround |
|---|---|---|
| Hiya | AT&T | **1–2 weeks** |
| First Orion | T-Mobile | **1–2 weeks** |
| TNS | Verizon | **2–4 weeks** |

No expediting exists once submitted. Telnyx additionally rate-limits its own
remediation product to **one submission per number per 14 days**, so a failed
attempt costs a fortnight before the next.

**Passive healing — you just stop calling:**

No vendor publishes a decay window, and the consistent industry position is
that scores do not recover on their own. Hiya's Maturity grade explains the
mechanism: a number is mature because it is *seen calling*, so silence is the
absence of the input, not a cure.

Our own evidence, such as it is, agrees and is recorded honestly:

- §6: numbers rested 8+ days returned at **16.4%**, worse than brand-new
  numbers at 20.5%.
- A direct before/after on rest episodes attempted 18 Sept found only **three**
  episodes with 20+ dials on both sides of the gap. Two improved, one did not;
  pooled, 55.8% before against 45.0% after. **That is far too small to
  conclude anything from** and is listed so nobody later mistakes it for
  evidence.

A 30–60 day rolling window appears in practitioner writing and in no vendor
documentation. If it is real it means bad history ages out over one to two
months **while the number keeps calling well** — which is the opposite of
resting it.

**So the operating rule stands: replacing beats healing.** A replacement is
~$1/month and live in minutes; healing is one to four weeks of degraded answer
rate per engine, with no guarantee, and the label returns if the behaviour
that caused it has not changed.

### Registration is separately slow

Registration and remediation run **2–6 weeks per vendor** from clean
submission to active status, and each vendor requires separate business
verification through its own portal: **Hiya Connect** (fastest), **First
Orion INFORM**, **TNS Enterprise Branded Calling** (slowest).

Two consequences worth planning around:

- **Remediation is not a same-week fix.** A number flagged today is not
  recovered this month. Buying a replacement number is faster than rescuing a
  burned one — and at ~$1/month, usually cheaper than the lost connects.
- **Register before you need it.** Enrollment is itself a positive signal for
  Hiya and First Orion, so registering a clean number is worth more than
  registering a flagged one.

---

## 3. What we can see today, and what we cannot

### Can see

- **Answer rate per number, per month** — `/api/admin/pool/usage`, surfaced in
  the Numbers app's USAGE tab, ranked most- to least-used
- **Rolling health** — `phone_numbers.health_answer_rate`, written by
  `cron/number-health` over a 3-day window
- **Registration state** — `phone_numbers.is_registered`, plus per-engine rows
  in `number_registrations`
- **Short-call ratio** — carrier-sourced from `telnyx_ledger_records`

### Cannot see

- **The actual spam label.** Nothing tells us that AT&T shows "Spam Likely" on
  415-862-7515. We infer it from answer rate, which conflates label, list
  quality, time of day and geography.
- **Which engine flagged it**, so we cannot tell a Verizon problem from an
  AT&T one.
- **Whether remediation worked**, except by waiting and watching answer rate.

Everything in the "cannot" column is the case for buying instrumentation.

---

## 4. Free Caller Registry vs Telnyx Number Reputation

### Free Caller Registry — freecallerregistry.com

Free. Submits a number once to Hiya, First Orion and TNS. Fire-and-forget:
no score comes back and there is no API. This is what
`phone_numbers.is_registered` tracks today, and **all pool numbers were
registered as of 17 Sept**.

Do this for every new number. It costs nothing and it is the baseline.

### Telnyx Number Reputation — the paid option

| | cost |
|---|---|
| Enterprise registration | **Free** |
| Reputation monitoring | **$100/month per enterprise** |
| Reputation check | **$0.10 per query** (cached reads free; fresh queries and auto-refreshes billed) |
| Remediation | **$1.00 per number** submitted for re-evaluation |

**No per-call fee.** It does not change how calls are placed. Registering
through Telnyx pushes to all three engines, and reputation data is powered by
Hiya.

**US only. Canadian numbers are not accepted.** There is no international
equivalent, because the engines it queries only cover US numbers.

At 15 numbers: **$100/month** flat, plus about **$6/month** to check all of
them weekly. Roughly doubles the Telnyx bill against a ~$130/month spend.

#### Not to be confused with Branded Calling

Separate product — `$50` one-time, `$50`/month, and **`$0.075` per call**. At
674 dials/day that is **$50.55/day against a $4.77/day carrier bill**. It is
priced for businesses whose individual call is worth dollars. It is not for us
at this scale, and the two are separable: *"an enterprise can register for
Number Reputation, Branded Calling, or both."*

---

## 5. If we implement Number Reputation

The value is **instrumentation, not remediation**: it replaces inference with
a score, and answers the burn-vs-geography question directly.

### What to build

1. **`number_reputation_snapshots`** — one row per number per check:
   `number_id`, `checked_at`, `spam_risk` (level), `score`, `category_label`,
   `raw` (jsonb). Keep history; a single reading says nothing, the **trend**
   is the signal.

2. **`cron/number-reputation`** — weekly, not daily. Fresh queries are billed
   at $0.10 and scores do not move hour to hour. Batch up to 100 numbers per
   request. Weekly on 15 numbers is ~$6/month.

3. **Surface it in the Numbers app USAGE tab** beside answer rate. The two
   columns are only useful together: a low answer rate *with* a clean score is
   a list problem; a low answer rate *with* a flagged score is a number
   problem. That distinction is the whole purchase.

4. **Remediation behind a button, never automatic.** $1.00 per submission and
   engines rate-limit re-evaluation. An operator decides.

5. **Feed it into `claim_pool_number`.** Once a real score exists it belongs in
   the ORDER BY — a flagged number should sort behind a clean one, the way
   `is_registered` does now. **Do not do this until the score has been
   observed for a few weeks**; wiring an unvalidated signal into the dial path
   is how the current locality-vs-burn confusion got built in the first place.

### Do this first, because it is free

Run the **pool selection experiment** (`pool_experiment_pct = 20`,
arm `rotate`). It answers the same question with a week of waiting instead of
$100/month. If rotation lifts the heavy numbers' answer rate, it was burn. If
each number holds its own rate regardless, it was the lists — and a reputation
score would have told you the same thing for money.

---

## 6. Practices that keep numbers healthy

### What Hiya actually scores, 18 September 2026

Hiya publishes its methodology, which makes it the most authoritative source
in this document. It matters twice over: Hiya feeds AT&T, Cricket and Samsung,
**and Telnyx's Number Reputation product is powered by Hiya** -- so these four
grades are exactly what the $100/month would show us.

Four factors, graded A to D:

| Grade | Hiya's own wording | What it is |
|---|---|---|
| **Maturity** | "Do you use established numbers, without rotating?" | Mature if the number creates higher volume **OR** is seen calling over multiple days/weeks *"even at very low volumes"* |
| **Connection** | "Do recipients choose to answer your calls?" | Answer rate |
| **Engagement** | "Are recipients staying on the line after answering?" | Talk time |
| **Sentiment** | "Do recipients rarely complain about or block your calls?" | Complaints and blocks |

**CALL VELOCITY IS NOT ONE OF THEM.** Not calls per hour, not burst rate, not
calls per minute. The practitioner advice that circulates -- ">50 calls/hour
trips carrier algorithms" -- appears in no vendor documentation we can find,
including Hiya's own.

Three things follow, and they are the most useful conclusions in this file:

1. **Pacing is not a scored variable, so pacing controls are not a lever.**
   Burst rate can only hurt through its effect on Connection and Engagement.
   If sixty calls in half an hour do not lower answer rate or talk time, the
   scoring does not see them. Our own data agrees: holding volume constant,
   velocity would not separate from volume across 21 days, because there is
   no independent effect to find.

2. **Two of the four are things we already measure for free.** Connection is
   answer rate and Engagement is talk time, and `cron/number-health` computes
   answer rate per number against the pool median on every dial. The free
   signal maps directly onto half the paid product.

3. **Sentiment is the genuine blind spot.** Complaints and blocks are
   invisible to us and cannot be inferred. That, not pacing, is what money
   would buy.

#### And it explains the resting result

§6 records that numbers rested 8+ days came back at a **16.4%** answer rate,
worse than brand-new numbers at 20.5%, with no explanation for why rest failed
to heal anything. Maturity is the explanation: a number is mature when it is
*seen*, and rest is the absence of being seen. Resting does not heal a number,
it de-matures it.

The soft cap in `claim_pool_number` already does the useful half of resting --
it demotes a hot number to the back of the queue while leaving it present and
calling. That keeps Maturity intact in a way that resting cannot.

---

### What TNS told us directly, 18 September 2026

Their registration confirmation email carries the only unprompted guidance any
of the three engines has given this account. Quoted rather than paraphrased,
because it is primary source and it contradicts three things this platform
does:

> "we recommend that you follow best practices for call origination, including
> not rotating numbers, using a number for a single purpose when possible, and
> leaving voicemail messages on the line, in order to minimize any negative
> labeling"

They also say plainly what registration is and is not:

> "registration does not guarantee positive treatment. If at any time there is
> substantial negative information about the number ... it is possible they
> could still be labeled"

**Where we conflict, and how much it matters:**

| Their advice | What we do | Assessment |
|---|---|---|
| Don't rotate numbers | A rotating pool, by design | Partly a false conflict. Rotation across a STABLE REGISTERED SET is not what they mean -- burner churn is. What genuinely matches the bad pattern is buying and releasing, which this account did do: 10 SignalWire numbers were retired and deleted on 18 Sept. Going forward the 15 are stable and additive. |
| One purpose per number | **Every number carries 4-8 different accounts** (measured 18 Sept, 14-day window) | The real conflict, and structural. `claim_pool_number` has no tenant filter, so an insurance agency and a roofer share a caller ID. That is an incoherent calling pattern to a model that scores patterns. |
| Leave voicemail messages | AMD detects a machine and hangs up; voicemail drop is OFF | Conflicts, and staying that way. Drop was attempted twice and failed both times -- see AMD.md. Leaving messages would also multiply cost per dial by keeping every machine leg alive. |

**None of this is measured against answer rate.** It is one vendor's stated
preference, covering Verizon and US Cellular only, and it is what they would
tell any caller. It is recorded because it is the closest thing to a published
threshold any engine has offered, not because it has been shown to move a
number here.

The single-purpose one is the only conflict with a plausible remedy: per-tenant
number pools. At 8 active accounts and 3-5 numbers each that is 24-40 numbers
against today's 15, or roughly $25-40/month. Worth pricing against retention if
labelling ever becomes attributable to a specific account's traffic.

---

Ordered by evidence behind them here.

1. **Register every number.** Free, and the selector already prefers
   registered numbers.
2. **Keep the short-call ratio down.** Under 15% of connected calls at ≤6s —
   the same signal analytics engines score on. See `lib/complianceHold.ts`.
3. **Respect the soft cap.** `claim_pool_number` pushes any number past 60
   dials/day to the back of the queue. The 100 `daily_cap` almost never binds
   because of it.
4. **Redial from the same number.** Apple's Focus/Do Not Disturb lets through
   a second call **from the same number** within three minutes. Before 17 Sept
   our rotation used a different number on 56% of back-to-back redials,
   defeating it; `claim_specific_pool_number` now pins the redial.
5. **Do not rest a number expecting it to heal.** Measured 15 Sept: numbers
   rested 8+ days came back at a **16.4%** answer rate — the worst band —
   while brand-new numbers answered at 20.5%. Resting is a load-shedding tool,
   not a cure.
6. **Buy numbers rather than working a small pool harder.** Numbers are ~$1/mo
   and the pool is not a scaling constraint. This is also the faster remedy
   for a flagged number: remediation runs 2-6 weeks per vendor, a replacement
   runs minutes.
7. **Keep `AGENT_LEG_FAILED` near zero.** It tears the lead leg down at about
   1.2 seconds, which is the hangup-before-ring fingerprint First Orion weights
   most heavily. It was 16.4% of dials on 14 Sept. Treat it as a T-Mobile
   reputation risk, not only an agent-experience bug.
8. **Do not buy STIR/SHAKEN as a fix.** Telnyx-purchased numbers already get A
   attestation automatically, and attestation does not stop spam labelling --
   the two are separate systems. See section 2.

---

## 7. Open questions

- **Burn or geography?** Unresolved. The experiment settles it; see §1.
- **Does the short-duration fix lift answer rate?** It should reduce a signal
  the engines score on. No causal evidence yet.
- **Is the registration tie-break correct?** It concentrates volume on
  registered numbers, and the best answer rates belonged to unregistered ones.
  It may be optimising the wrong thing.
- **What attestation do our calls actually carry?** Telnyx says A for numbers
  bought from them, and every pool number qualifies -- but that is a vendor
  statement, not a measurement. Attestation appears in Telnyx CDRs and not in
  the `call.cost` payloads we capture, so confirming it means pulling CDRs
  once.
- **Which engine is labelling us, if any?** Answer rate cannot tell an AT&T
  problem from a Verizon one, and they remediate through different portals on
  different timelines. This is the single question a reputation product answers
  that nothing free does.

---

## Sources

Vendor documentation, which is authoritative:

- [Telnyx — Number Reputation pricing](https://developers.telnyx.com/docs/number-reputation/pricing)
- [Telnyx — Number Reputation overview](https://developers.telnyx.com/docs/number-reputation/overview)
- [Telnyx — Branded Calling pricing](https://telnyx.com/pricing/branded-calling)
- [Telnyx — Branded Calling display requirements](https://support.telnyx.com/en/articles/16296358-branded-calling-display-requirements)
- [Telnyx — STIR/SHAKEN with Telnyx](https://support.telnyx.com/en/articles/5402969-stir-shaken-with-telnyx)
- [Telnyx — Short duration calls](https://support.telnyx.com/en/articles/1130707-what-are-short-duration-calls)
- [Bandwidth — The ABCs of attestation and analytics](https://www.bandwidth.com/blog/abcs-of-attestation-and-analytics/)
- [Apple — Allow or silence notifications for a Focus](https://support.apple.com/guide/iphone/allow-or-silence-notifications-for-a-focus-iph21d43af5b/ios)

Industry commentary, used for the engine weightings because the vendors
publish none themselves. Directionally useful, not authoritative -- nothing
here should be treated as a threshold:

- [Hiya, TNS, First Orion: who flags your calls](https://lineshield.theidudes.com/blog/hiya-tns-firstorion-spam-labels)
