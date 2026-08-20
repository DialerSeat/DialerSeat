# DialerSeat — what it is, what it does, where it is going

**Keep this current.** It is the first thing a person or a model should read
before touching this codebase, and it is only worth reading if it is true. Update
it when the product changes direction, when a number below stops being accurate,
or when something here turns out to be wrong. Do not let it drift into a
changelog — it describes the shape of the thing, not its history.

---

## What DialerSeat is

A multi-tenant outbound calling platform. Agents log in, get handed leads, and
dial them. Owners buy seats for agents and hand them lists to work.

Built on **Telnyx** for telephony, **Supabase/Postgres** for data, **Clerk** for
identity, **Stripe** for money, **Next.js** on **Vercel** for everything else.

The customer is not a call centre buying enterprise software. It is a lead
vendor, an insurance agency, or a floor manager who needs fifteen people dialing
by Monday and does not want a contract, an onboarding call, or a per-minute
invoice they cannot predict.

---

## What it does today

**Four dialing modes.** Preview (see the lead, choose to dial), power (one at a
time, automatic), progressive (dials while you wrap), predictive (multiple lines
per agent, server-driven). Preview, power and progressive are considered stable
and are treated as fragile — changes there are additive and contained.

**Answering-machine detection** with a compliance hold. When a machine is
detected the agent is returned to the queue immediately while the line is held
the full window in the background, so the abandonment rules are honoured without
an agent watching a timer.

**Teams.** An owner creates teams, attaches campaigns, and hands out join codes.
A code says who pays (owner or agent) and whether joining is instant or needs
approval. Seats are the billable unit — once somebody holds one, adding them to
more campaigns costs nothing.

**Lead drip.** One webhook URL per campaign accepts JSON from any CRM, sheet or
automation tool, and leads land in a running queue without agents restarting.

**Lead masking.** A campaign can hide phone numbers from agents until the lead
picks up. The number never leaves the server.

**Reporting.** Per-campaign and per-agent analytics, a live floor view, seat
usage, weekly/quarterly/annual billing statements, and site traffic analytics.

**White label.** An owner's own brand, colours and subdomain.

**Fully mobile.** Everything an agent or owner touches works on a phone —
dialing, the queue, lead profiles and dispositions, teams, campaigns,
recordings, analytics and billing statements. This is a first-class path, not a
shrunken desktop: the dialer and the Teams sidebar use the same drawer pattern
and the same edge tab, layouts respect device safe areas, and wide tables scroll
inside themselves so the page never pans sideways. An agent can work a full
shift from a phone anywhere, provided they are calling US leads.

The one exception is deliberate: the **admin desktop** is a windowed desktop
metaphor built for operating the platform, not for using it. It is an internal
tool and is not expected to work on a phone.

---

## The payment model, and why it is shaped this way

| | Price | Notes |
|---|---|---|
| Pro seat | **$35 / week** | Cancel any single seat, any time |
| Manager+ (white label) | **$75 / week** | On top of seats |
| Volume | 5% at 10 owner-paid seats, 10% at 25 | Applies to every seat, not just those past the threshold |
| Above 50 seats | Negotiated | sales@dialerseat.com |

**Always quote weekly. Never monthly.** This is deliberate and it is not
cosmetic. Weekly billing with per-seat cancellation is the entire competitive
argument: a floor manager can add five people on Sunday and drop three on Friday
without a conversation. Monthly framing invites comparison against annual
contracts, which is the ground competitors have already won.

**The seat is the billable unit.** Not the campaign, not the call, not the
minute. Every billing decision follows from this — extra campaigns are free,
one person is one seat however many lists they work, and there is no metered
surprise on an invoice.

**A payment problem never ejects a working agent.** A declined card is chased
daily, and only after a grace period does the seat suspend. The owner holds the
lever; the agent keeps working while it is sorted out.

---

## Goals

**Near term — make the money path real.** As of this writing no seat charge has
ever completed end to end. Eleven billing bugs have been found and fixed by
reading, none proven by a live transaction. The next milestone is one seat
charged, one discount applied, one week renewed.

**$100,000+ weeks.** At $35 a seat that is roughly 2,900 concurrent seats. Not
one customer — dozens of vendors and agencies running 15 to 200 each. The
architecture question that follows is not "can we bill it" but "does a floor of
200 dial without stepping on itself", which is why lead claiming is atomic and
why every aggregate is computed in Postgres rather than in a serverless
function.

**Globalization.** Today the platform is US-only: numbers are US, the calling
window logic is US state law, phone normalisation assumes ten digits, and the
tax statements reference the IRS. Expanding means per-country number pools,
per-jurisdiction calling windows and consent rules, non-US number formats, and
statements that do not assume one revenue authority. None of that is built.
When it is designed, it should be designed as *regions* rather than as
exceptions bolted onto the US path — the US is a region, not the default.

**A household name in the space.** The ambition is not to be a cheaper option
that people use quietly — it is for DialerSeat to be the dialer people in this
industry name first, and respect. That is earned in a specific way and not
another: by the invoice being right, by the numbers on screen being true, by a
declined card never cutting somebody off mid-shift, and by a vendor's lead list
never leaking to a closer they do not employ. Reputation in a market this small
travels by word of mouth between operators who all know each other, which means
one wrong statement or one leaked list costs more than any feature gains. Build
accordingly.

**Partnerships over self-serve.** A lead vendor bringing fifteen closers is
worth more than fifteen individual signups and costs less to acquire. This is
why code redemptions notify separately from signups, and why the volume tiers
exist at all.

---

## Things a model working here needs to know

**Verify vendor behaviour against vendor docs.** Do not infer how Telnyx or
Stripe behave from comments in this repo. Several long bugs came from
assumptions about AMD detectors and Stripe payment-method resolution that the
documentation contradicts.

**PostgREST fails silently on an unknown column.** It rejects the whole select
and Supabase surfaces `data: null` with an error most call sites never read — so
the query does not crash, it returns nothing. Eleven bugs came from exactly
this, every one invisible on the happy path. `scripts/schema-audit.py` sweeps
for it; run it after any migration.

**Supabase caps an unbounded select at 1,000 rows and truncates without
erroring.** Never aggregate by pulling rows into JavaScript. Group in Postgres,
or paginate and print the true total beside the page.

**Never fabricate a number.** A dash means no data. A plausible invented figure
is worse than an obvious gap: the gap gets fixed, the invention gets trusted.
This applies hardest to billing statements and analytics.

**Two user identifiers exist.** `users.clerk_id` (text, from Clerk) and
`users.id` (uuid). `agent_sessions.user_id` is the uuid; almost everything else
is the clerk id. Joining on the wrong one returns an empty result rather than an
error.

**Serverless discards dangling promises.** `void somePromise()` before a
response returns will not complete. Await anything that matters.

**Preview, power and progressive are tuned and fragile.** Predictive work must
be additive and must not touch the shared claim path.

**Compliance is not optional.** Calling windows, the abandonment hold, consent
records and recording rules are product requirements, not nice-to-haves. When in
doubt, the stricter behaviour is the correct one.

---

## Known gaps

- No seat charge has completed end to end. Everything in billing is reasoned,
  not observed.
- Lead drip has never received a real vendor payload.
- Lead masking has never been tested with a real second account.
- Predictive AMD catch rate on bridged fan-out calls is unverified.
- The campaign view cannot yet upload or replace leads in place.
- AMD is editable from two screens and can drift between them.
- Everything is US-only (see Globalization above).
