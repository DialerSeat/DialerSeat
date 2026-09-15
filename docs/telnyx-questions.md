# Message to Telnyx support

Five questions, all answerable from records they already hold. No accusation —
every figure below came from their own `call.cost` webhooks. Between them they
are worth more than every engineering change made this week.

Send as one ticket. Paste the block below.

---

Hi — five billing questions about my account, all with figures from your own
`call.cost` webhooks so they should be quick to check.

**1. Billing increments.** Your documentation states 60/60 increments and says
6-second billing is no longer offered. My records show otherwise: of 1,490
billed durations, 1,033 are multiples of 6 and not 60 — including values of 6,
12, 18, 24, 30, 36, 42, 48 and 54 seconds. The smallest billed duration on
record is 6 seconds. Can you confirm which increment applies to my account, so I
can model costs accurately?

**2. The minimum on answered outbound.** Separately from the increment, answered
outbound legs carry a 60-second minimum. Over the last 30 days, across 648
answered legs:

| answered by | legs | avg seconds **after answer** | your billed seconds |
|---|---|---|---|
| answering machine | 377 | **10.9** | **60.0** |
| a person | 99 | 111.4 | 150.5 |

**49,656 seconds billed against 21,048 that the 6-second increment alone would
produce — 57.6% of billed time.**

So I can be precise about the rule rather than guessing at it: modelling
post-answer duration, rounded up to 6 seconds, floored at 60, reproduces your
own `billed_duration_secs` **exactly on 184 of the 192 legs** where I hold both,
with an average error of 1.8 seconds and 98.8% of total billed time.

Given the 6-second increment already applies on this account, can the minimum on
answered outbound be reduced to match it?

**3. On-net legs billed on both connections.** My agent-side legs are SIP URI
calls from my own Call Control application to my own credential connection —
they never touch the PSTN, and your own `call.cost` records confirm that by
rating `sip-trunking` at **$0** on them. But each one produces two billing
records, one per connection, each at $0.002/min. Example from a single
`call_session_id`:

| connection | call_leg_id | billed | cost | cost parts |
|---|---|---|---|---|
| credential connection | `80101afa-…` | 2058s | $0.0686 | `sip-trunking @ 0.00200` |
| Call Control application | `7fe7e45e-…` | 2058s | $0.0686 | `call-control @ 0.00200`, `sip-trunking @ 0` |

Identical duration, identical charge, one agent leg. I assume the second record
is the published “Browser/app calling” line (or “SIP interface” — both $0.002/min
on your Voice API price list); **please confirm which**, so I can model it.

Two questions on it:

1. Your SIP URI Calling article says this $0.002/min *“is charged to the owner
   of the connection that receives the call”* and applies to calls **from sources
   Telnyx cannot identify**, and that *“if the source matches a Telnyx SIP
   Connection, the call is treated as an On-Net call and billed according to your
   Telnyx rate deck.”* My source is my own Call Control application on this same
   account. Is an on-net leg between two connections on one account rated
   differently?
2. The leg never touches the PSTN — your own `call.cost` rates its
   `sip-trunking` part at **$0** — yet at $0.004/min combined it costs 77% of
   what it costs me to ring a real phone. Is that the intended relationship?

This is roughly a quarter of my bill.

**4. Does audio playback bill separately?** If I use the Call Control
`playback_start` endpoint to play an audio URL on a leg that is already
connected and already being billed, is there any charge beyond the
`call-control` and `sip-trunking` minutes I am already paying for that leg? I
cannot find playback in the published pricing breakdown and I would rather ask
than assume.

**5. Attestation and CPS.** Two quick ones:

- What STIR/SHAKEN attestation level are my outbound calls receiving? A SIP
  trace on my account showed `verstat=No-TN-Validation`.
- Please confirm in writing that the CPS surcharge does **not** apply to my
  account. My reading is that it is scoped to Elastic SIP Trunking and that I am
  on Programmable Voice — my `call.cost` records carry a `call-control`
  component — but I would rather have it confirmed than assumed. If it does
  apply, what is my month-to-date 95th-percentile CPS and tier?

Thanks.

---

## Why each one is worth asking

**The increment question is the lever.** It is framed as "confirm which applies"
rather than "you are wrong" because the discrepancy favours *us* — the account
gets better terms than the documentation promises. Asking it first establishes
that the numbers are real before the second question arrives.

**The minimum is the single biggest line in the bill.** 476.8 minutes of the 827
billed on answered calls is minimum rather than conversation — **57.6%**. A
voicemail holds the line for 10.9 seconds and bills 60, so **78.3% of
machine-answered billed seconds buy nothing.** It is a reasonable ask precisely
because the fine-grained increment already exists on the account.

**Lead with the model validation.** 184 of 192 legs predicted exactly is the
sentence that makes this a reconciliation rather than a complaint — it says
“I know what your rule is, I am asking you to change it” instead of “I think
you are overcharging me.”

> **An earlier draft of this letter said 26.2 seconds and 39.4%.** Those came
> from a duration column that includes the ring, and billing starts at answer.
> Do not send any version carrying those numbers: they are wrong, they
> understate the case, and a figure they can disprove costs more than it buys.

**The agent-leg question was rewritten and is weaker than it first looked.** An
earlier draft called it double billing. It is not: “Browser/app calling” is a
published $0.002/min line, so two published charges legitimately apply to one
leg. Asking “why am I charged twice” invites a one-line reply quoting the price
list and ends the conversation. Asking *which* line it is, and whether on-net is
rated differently, keeps it open. Still ~25% of the bill.

**Attestation changes conversations per dial**, not cents per call — which is
worth more. Industry reporting puts A-level attestation at 60%+ connect
improvement, and without it calls are spam-flagged regardless of anything else.

**The playback question unlocks 8.4 hours a month of line we already bought.**
Every answered call bills a 60-second minimum; a voicemail uses 10.8 seconds of
it. Whether the other 49 can carry audio at no extra charge decides whether
that is dead cost or usable inventory. Asking is free; assuming is how
`detect_beep` killed AMD twice.

**The CPS question changed from urgent to housekeeping.** Three sources scope
that surcharge to Elastic SIP Trunking — their knowledge base says it outright,
and the Voice API price page never mentions it. We are on Programmable Voice, so
the $60–120/month an earlier draft warned about is almost certainly not owed. It
is still worth one line in writing, because the whole point of this letter is to
stop guessing.

## What not to send

No accusation, no "scam", no mention of the balance discrepancies chased on 14
September. Those turned out to be **our** parked agent legs — 1,307 billed
minutes against 30.7 minutes of conversation — and the per-minute charges
reconciled every time they were checked: $2.03 of balance against $2.29 on their
ledger for 142 connected calls. A letter that leads with theft gives them
something to deny; one that leads with arithmetic gives them something to
reconcile.

## If they push back

Their own terms carry a dispute clause: *"The Parties shall negotiate in good
faith to resolve any billing dispute for a period of thirty (30) days."* That is
the formal route and it exists. It should not be needed for any of the five
questions above, which are requests for information rather than disputes.
