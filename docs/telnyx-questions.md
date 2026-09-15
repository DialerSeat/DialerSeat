# Message to Telnyx support

Four questions, all answerable from records they already hold. No accusation —
every figure below came from their own `call.cost` webhooks. Between them they
are worth more than every engineering change made this week.

Send as one ticket. Paste the block below.

---

Hi — four billing questions about my account, all with figures from your own
`call.cost` webhooks so they should be quick to check.

**1. Billing increments.** Your documentation states 60/60 increments and says
6-second billing is no longer offered. My records show otherwise: of 1,490
billed durations, 1,033 are multiples of 6 and not 60 — including values of 6,
12, 18, 24, 30, 36, 42, 48 and 54 seconds. The smallest billed duration on
record is 6 seconds. Can you confirm which increment applies to my account, so I
can model costs accurately?

**2. The minimum on answered outbound.** Separately from the increment, answered
outbound legs appear to carry a 60-second minimum. Across 290 machine-answered
calls averaging 26.2 seconds of actual duration, every one billed 60 seconds.
Across all answered calls I show 32,100 billed seconds against 19,446 that the
6-second increment alone would produce — 39.4% of billed time. Given that the
6-second increment already applies, can the minimum on answered outbound be
reduced to match it?

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

Identical duration, identical charge, one agent leg. Can on-net legs between two
connections on the same account be zero-rated, or billed once rather than on
both connections? This is roughly a quarter of my bill.

**4. Attestation and CPS.** Two quick ones:

- What STIR/SHAKEN attestation level are my outbound calls receiving? A SIP
  trace on my account showed `verstat=No-TN-Validation`.
- What is my month-to-date 95th-percentile CPS and which surcharge tier does it
  fall in? I'd like to know before month end rather than on the invoice, since
  the percentile is computed across the whole month and I can still act on it.

Thanks.

---

## Why each one is worth asking

**The increment question is the lever.** It is framed as "confirm which applies"
rather than "you are wrong" because the discrepancy favours *us* — the account
gets better terms than the documentation promises. Asking it first establishes
that the numbers are real before the second question arrives.

**The minimum is ~20% of the bill.** 211 minutes of the 535 billed on answered
calls is minimum rather than conversation, and 51.6% of machine-answered billed
seconds buy nothing. It is a reasonable ask precisely because the fine-grained
increment already exists on the account.

**The on-net question is the one they have already conceded.** Every other
question asks them to change a rate. This one only asks why a leg they
themselves rated at $0 is charged twice at $0.002/min. It is worth ~25% of
the bill and it is the strongest of the four.

**Attestation changes conversations per dial**, not cents per call — which is
worth more. Industry reporting puts A-level attestation at 60%+ connect
improvement, and without it calls are spam-flagged regardless of anything else.

**CPS never appears in the balance.** It is assessed monthly and lands on the
invoice. P95 measured 15 CPS against a free tier of 5 before predictive was
withdrawn — $60–120/month against a $28.29 usage bill.

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
the formal route and it exists. It should not be needed for any of the four
questions above, which are requests for information rather than disputes.
