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

Three analytics engines decide what US carriers display:

| engine | primary carrier |
|---|---|
| **Hiya** | AT&T (powers ActiveArmor) |
| **First Orion** | T-Mobile |
| **TNS** | Verizon |

They score on call patterns — volume, call duration distribution, answer rate,
complaint rate, how many distinct numbers you dial, whether people call back.
A number with many short calls and a low answer rate looks like a robocaller,
because that is what a robocaller looks like.

This is why the compliance work and the number work are the same work. Our
[short-duration surcharge incident](./CARRIER-ENGINEERING.md) was Telnyx
billing, but the underlying signal — a pile of sub-6-second connected calls —
is also exactly what an analytics engine scores against.

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
   and the pool is not a scaling constraint.

---

## 7. Open questions

- **Burn or geography?** Unresolved. The experiment settles it; see §1.
- **Does the short-duration fix lift answer rate?** It should reduce a signal
  the engines score on. No causal evidence yet.
- **Is the registration tie-break correct?** It concentrates volume on
  registered numbers, and the best answer rates belonged to unregistered ones.
  It may be optimising the wrong thing.
