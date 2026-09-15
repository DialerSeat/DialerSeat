# Message to Telnyx support

Send as one ticket. Paste the block between the rules.

Everything in it comes from Telnyx's own `call.cost` webhooks on this account —
no third-party measurement, nothing they have to take on trust. The letter asks
questions; it does not make accusations. See "Why each one is worth asking"
below for what each is worth and what not to say.

**The first question is the letter.** It is worth 57.5% of PSTN spend and it is
not a discount request — it asks them to extend a billing granularity the
account **already receives**, on the **same product line**, to another leg type.
Everything after it is smaller.

---

Hi — a few billing questions about my account. Every figure below is from your
own `call.cost` webhooks, so they should be quick to verify.

## 1. Extending the 6-second increment my account already has to PSTN legs

Two `call.cost` events from my account, **the same minute of the same day** (15
September, 13:09 UTC), on the **same connection** (`3010874004966737730`):

**PSTN leg to a prospect** — actual conversation 13 seconds:

```
cost_parts:
  sip-trunking    rate 0.005     billed_duration_secs  60    $0.0050
  call-control    rate 0.00200   billed_duration_secs  60    $0.0020
total_cost $0.0070      billed_duration_secs 60
```

**On-net leg to my own credential connection** — 12 seconds:

```
cost_parts:
  sip-trunking    rate 0         billed_duration_secs  12    $0
  call-control    rate 0.00200   billed_duration_secs  12    $0.0004
total_cost $0.0004      billed_duration_secs 12
```

Same account, same connection, same `call-control` product at the same
`0.00200` rate — **one billed in 60-second increments, the other in 6-second
increments.** 12 is a multiple of 6 and not of 60.

Across 30 days the split is absolute:

| leg type | records | multiple of 60 | multiple of 6 but not 60 |
|---|---|---|---|
| PSTN | 375 | **375 (100%)** | 0 |
| on-net | 775 | 64 | **711** |

What that rounding costs on answered PSTN calls over those 30 days:

| | |
|---|---|
| answered PSTN legs | 197 |
| billed | **254.0 minutes** |
| actually used | **101.6 minutes** |
| rounding | **60.0% of what I pay** |
| the same traffic at a 6-second increment | **107.9 minutes** |

**Can the 6-second increment my account already receives be extended to PSTN
outbound?** I am not asking for a rate change — the per-minute rates can stay
exactly as they are. My traffic is short-duration by nature, so the increment
matters far more to me than the rate.

## 2. Is there a separate minimum as well as the increment?

So I model this correctly: on PSTN I see no floor distinct from the increment —
a 61-second call appears to bill 120, not 61 or 66. Is that right, or is there a
minimum in addition to the 60-second increment?

## 3. The `call-control` component, charged per leg

On a connected call I am charged `call-control` at $0.002/min three times: once
on the PSTN leg, once on the agent's on-net leg, and once more on a second
record for that same on-net leg on my credential connection. Against
`sip-trunking` at $0.005/min charged once, that is **$0.006 of call-control
against $0.005 of trunking on a single connected call.**

Two questions:

1. The second on-net record — I assume it is the published "Browser/app
   calling" or "SIP interface" line (both $0.002/min on your Voice API price
   list). **Please confirm which**, so I can model it correctly.
2. Your SIP URI Calling article says the $0.002/min *"is charged to the owner of
   the connection that receives the call"* and applies to calls **from sources
   Telnyx cannot identify**, and that *"if the source matches a Telnyx SIP
   Connection, the call is treated as an On-Net call and billed according to
   your Telnyx rate deck."* My source is my own Call Control application on this
   same account. **Is an on-net leg between two connections on one account rated
   differently?**

## 4. What tier am I on, and what moves it?

My `sip-trunking` rate is $0.005/min and `call-control` is $0.002/min. What tier
is that, what are the next tiers, and what monthly volume or commitment reaches
them?

## 5. Attestation

What STIR/SHAKEN attestation level are my outbound calls receiving? A SIP trace
on my account showed `verstat=No-TN-Validation`. If I am not receiving A-level
attestation, what is required to get there?

## 6. Please confirm the CPS surcharge does not apply

My reading is that it is scoped to Elastic SIP Trunking and that I am on
Programmable Voice — my `call.cost` records carry a `call-control` component —
but I would rather have it confirmed than assume. If it does apply, what is my
month-to-date 95th-percentile CPS and tier?

## 7. Does audio playback bill separately?

If I use the Call Control `playback_start` endpoint to play an audio URL on a
leg that is already connected and already being billed, is there any charge
beyond the `call-control` and `sip-trunking` minutes I already pay for that leg?
I cannot find playback in the published pricing breakdown.

Thanks.

---

## Why each one is worth asking

**Q1 is the letter.** 60.0% of what is billed on answered PSTN legs is rounding
rather than conversation — 254.0 minutes billed against 101.6 used. At a
6-second increment the same traffic is 107.9 minutes, a **57.5% reduction on the
line that is 84% of a day's spend.**

Its strength is that it is not a discount request. It asks them to extend a
granularity the account **already has**, and the proof is two of their own
receipts from the same minute, same connection, same product, same rate, billed
at different increments. That forecloses the easy answer — "our platform bills
PSTN in 60-second increments" — because their own system billed `call-control`
at 12 seconds on one leg and 60 on another, simultaneously. The only variable is
PSTN vs on-net.

> **Do not send any draft claiming "you are already on 6-second increments."**
> For PSTN that is false — 375 of 375 records are multiples of 60 — their public
> documentation saying 60/60 is correct, and leading with a provably wrong
> premise loses the question that matters. An earlier draft did exactly this,
> valued the ask at 1.3%, and rested on a sample that turned out to be entirely
> agent legs.

**Q3 was rewritten and is weaker than it first looked.** An earlier draft called
it double billing. It is not: "Browser/app calling" is a published $0.002/min
line, so two published charges legitimately apply to one leg. Asking "why am I
charged twice" invites a one-line reply quoting the price list and ends the
conversation. Asking *which* line it is, and whether on-net between two
connections on one account is rated differently, keeps it open.

Worth noting what is NOT their problem: three call-control charges per connected
call is partly our architecture. We place a fresh agent leg for every dial
instead of holding one open per session. Fixing that on our side removes two of
the three without Telnyx agreeing to anything.

**Q4 is new and may be the second-biggest.** $0.005/min trunking is not a bad
rate but it is not a good one either, and nothing in this account's history
shows anyone ever asked what tier it is on. The worst case is being told it is
the standard rate, which costs nothing to hear.

**Q5, attestation, changes conversations per dial** rather than cents per call —
which is worth more. Without A-level attestation calls are spam-flagged
regardless of anything else, and answer rate is the lever every cost figure
here ultimately divides by.

**Q7 unlocks line already paid for.** Every answered call bills a 60-second
minimum and a voicemail uses about 13 seconds of it. Whether the other 47 can
carry audio at no extra charge decides whether that is dead cost or usable
inventory. Note this question becomes far less interesting if Q1 succeeds —
there is no spare minute to fill once billing is by the 6 seconds. Ask both; act
on Q1 first.

**Q6 is housekeeping.** Three sources scope the CPS surcharge to Elastic SIP
Trunking, and we are on Programmable Voice, so the $60–120/month an earlier
draft warned about is almost certainly not owed. One line in writing, because
the point of this letter is to stop guessing.

## What not to send

No accusation, no "scam", no mention of the balance discrepancies chased on 14
September. Those turned out to be **our** parked agent legs — 1,307 billed
minutes against 30.7 minutes of conversation — and the per-minute charges
reconciled every time they were checked. A letter that leads with theft gives
them something to deny; one that leads with arithmetic gives them something to
reconcile.

Do not send lead phone numbers. Connection ids, call control ids and call
session ids are our own identifiers and are what let them find the records.

## If they push back

Their own terms carry a dispute clause: *"The Parties shall negotiate in good
faith to resolve any billing dispute for a period of thirty (30) days."* That is
the formal route and it exists. It should not be needed for any question above,
which are requests for information rather than disputes.
