# Message to Telnyx support

Five questions, all answerable from records they already hold. No accusation —
every figure below came from their own `call.cost` webhooks. Between them they
are worth more than every engineering change made this week.

Send as one ticket. Paste the block below.

---

Hi — five billing questions about my account, all with figures from your own
`call.cost` webhooks so they should be quick to check.

**1. Extending the 6-second increment I already have to PSTN.** My account
receives two different billing increments depending on the leg, and I can show
both from your own records.

On-net legs (SIP URI to my credential connection) bill on a **6-second**
increment — 344 of 361 `call.cost` records are multiples of 6 and not 60, and a
`/detail_records` row shows `call_sec` 182 billing `billed_sec` **186**.

PSTN legs bill **60/60** — every one of my 192 billed lead-leg records is a
multiple of 60, none is a multiple of 6, and a `call_sec` of **163** billed
**180**.

Across 648 answered PSTN legs in 30 days I used 19,149 seconds and was billed
44,820 — **57.3% of billed time is rounding rather than conversation.** On a
6-second increment the same traffic is 19,902 seconds.

**Can the 6-second increment my account already receives on-net be extended to
PSTN outbound?** I am not asking for a rate change — the per-minute rate can
stay exactly as it is.

**2. Confirming there is no separate minimum.** Related, so I model it
correctly: on PSTN I see no floor distinct from the increment — a 61-second call
appears to bill 120, not 61 or 66. Is that right, or is there a minimum as well
as the 60-second increment?

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

**4. Attestation and CPS.** Two quick ones:

- What STIR/SHAKEN attestation level are my outbound calls receiving? A SIP
  trace on my account showed `verstat=No-TN-Validation`.
- Please confirm in writing that the CPS surcharge does **not** apply to my
  account. My reading is that it is scoped to Elastic SIP Trunking and that I am
  on Programmable Voice — my `call.cost` records carry a `call-control`
  component — but I would rather have it confirmed than assumed. If it does
  apply, what is my month-to-date 95th-percentile CPS and tier?

Thanks.

**5. Does audio playback bill separately?** If I use the Call Control
`playback_start` endpoint to play an audio URL on a leg that is already
connected and already being billed, is there any charge beyond the
`call-control` and `sip-trunking` minutes I am already paying for that leg? I
cannot find playback in the published pricing breakdown and I would rather ask
than assume.

---

## Why each one is worth asking

**The increment question is now the whole letter.** An earlier draft had this
backwards — it claimed the account was already on 6-second billing everywhere
and asked only for the “minimum” to come down. That was worth **1.3%**, and it
rested on a sample that turned out to be entirely agent legs. Split by leg, ZERO
of 360 PSTN records use a 6-second increment.

The corrected ask is worth **55.6%** of what is billed on answered calls, and it
is stronger in kind as well as size: it asks them to extend a granularity the
account **already has** on one product line to another, evidenced from their own
detail records. It is not a discount request and should not be framed as one.

> **Do not send any draft claiming “you are already on 6-second increments.”**
> For PSTN that is false, their public documentation saying 60/60 is correct,
> and leading with a provably wrong premise loses the question that matters.

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
