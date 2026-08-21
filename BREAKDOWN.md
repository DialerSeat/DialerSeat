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

**No cap on campaign size.** A campaign holds as many leads as somebody wants to
put in it. There was a 10,000 ceiling, and it existed because the duplicate
check read every phone in the campaign into memory on each upload — the dedupe,
not the dialer, was the thing that could not scale. It now asks which of the
UPLOADED numbers already exist, so the cost follows the upload and is
independent of what the campaign already holds. Exports stream and page for the
same reason.

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

**Compression is the default; keeping is declared.** Every table classifies
itself in the `retention_policy` table as either **evidence** (kept, because
somebody could need to answer a question from a row — money, the customer'''s
data, compliance records, work product) or **ephemeral** (compressed, then
pruned, because its only contribution was a number on a chart). A daily job
reads that policy rather than a list in code.

Two properties make it safe. The rollup runs first and the prune is **gated on
it succeeding**, so nothing is deleted before its numbers exist elsewhere. And
an unclassified table is **kept and reported**, never auto-pruned — defaulting
an unknown table to deletion would mean the next one somebody adds starts
destroying itself on day one. The daily report is what stops anything
accumulating unnoticed.

**Sensitive tables cannot be armed for deletion at all.** People, teams,
campaigns, money and credentials are marked `protected` — 34 tables. A protected
table cannot be made ephemeral, cannot be given a retention window, cannot have
its policy row deleted, and its protection cannot be turned off by an update. A
database trigger rejects all four, so there is no sequence of updates that
points the retention job at customer data. Lifting protection requires a
migration written by a person who has thought about it, which is the bar it
should meet. The executor independently skips anything protected, so two things
would have to fail together.

Add a table, add a policy row. `select * from unclassified_tables()` should
always return nothing.

**A SECURITY DEFINER function is a hole unless its EXECUTE is revoked.** These
bypass RLS by design, and the API route in front of them is what does the
authorising — so if PostgREST can reach one directly at `/rest/v1/rpc/<name>`,
that authorisation is simply skipped, along with lead masking and team
membership. Postgres grants EXECUTE to PUBLIC by default, and Supabase adds anon
and authenticated on top. Every such function must end up with
`postgres | service_role` and nothing else. `select proname, proacl from pg_proc
where prosecdef` is the check.

**A batch limit is safe only if processing drains the selection set.** This is
the difference between a job that is merely slow and one with a permanent blind
spot, and the number itself tells you nothing about which you have. If a run
removes what it touched from the filter, `LIMIT 500` is pagination across time —
3,000 items take six days. If it does not, the same rows return forever and
everything past the limit is never seen. The stale-call reaper and the seat
enforcement job had the identical `LIMIT 500`; reaping un-wedges a session, so
one was fine, while suspending a member never changed the charge's status, so
the other was a wall. When a pass cannot drain naturally, give it a marker
column — `team_seat_charges.enforced_at` is the worked example.

Two rules follow. **Order the selection**, always, so a backlog too large for one
run is worked in a defined sequence instead of whatever the planner returns —
unordered truncation silently starves the oldest rows, which are usually the
ones that matter most. And **budget against time, not row count**, wherever a
row costs an external round trip: a fixed batch of 500 Stripe calls cannot
finish in a serverless invocation, so the limit that actually binds is the
timeout, and a job killed mid-pass loses the record of where it stopped.

**A bound that binds silently is indistinguishable from a bug.** Where a limit
genuinely must exist, it has to say so when it is reached — `truncated: true`,
`pendingAfterRun`, `notReached`, an alert. That is what turns it from a wrong
answer nobody questions into a known limitation somebody can act on. The same
reasoning is why the retention job reports unclassified tables instead of
quietly keeping them.

**Never fabricate a number.** A dash means no data. A plausible invented figure
is worse than an obvious gap: the gap gets fixed, the invention gets trusted.
This applies hardest to billing statements and analytics.

**Two user identifiers exist.** `users.clerk_id` (text, from Clerk) and
`users.id` (uuid). `agent_sessions.user_id` is the uuid; almost everything else
is the clerk id. Joining on the wrong one returns an empty result rather than an
error.

**Serverless discards dangling promises.** `void somePromise()` before a
response returns will not complete — Vercel may freeze the instance the moment
the response is flushed. This is not theoretical: it was silently dropping call
events and leaking lead claims under load, in both cases producing exactly the
failure the surrounding comment claimed to prevent, and only when busy.

Await anything that matters. When the work must not block the response — logging,
telemetry, a cache write — use `after()` from `next/server`, which defers it
until after the response is sent and still guarantees it runs. `after()` throws
outside a request scope, so a background tick needs a plain `await` fallback.

**Preview, power and progressive are tuned and fragile.** Predictive work must
be additive and must not touch the shared claim path.

**Telnyx webhooks are signature-verified, and production fails closed.**
`TELNYX_PUBLIC_KEY` is set in Vercel and Ed25519 verification is enforced, with
a five-minute replay window. A missing key in production is a 503, not a
pass-through — the fail-open path survives only outside production so the
handler can be exercised locally. Do not reintroduce a key-presence check as the
enforcement condition; it removes the protection in precisely the case it exists
for.

**Compliance is not optional.** Calling windows, the abandonment hold, consent
records and recording rules are product requirements, not nice-to-haves. When in
doubt, the stricter behaviour is the correct one.

---

## Hosting capacity, and where it stops

Deliberately on free tiers. At the current size that is the right call and not a
gap — the numbers below exist so the ceiling arrives as a decision rather than an
outage.

**Measured, not estimated:** a lead costs about **1,436 bytes** including
indexes. The database was 42 MB when this was written, roughly 8.5% of the free
limit, leaving about **334,000 leads** of headroom.

**Supabase Free enters READ-ONLY at 500 MB of database size.** Read-only is not
slow, it is stopped: no lead uploads, no call rows, no dispositions, no
heartbeats, every write failing invisibly from inside the app. The daily
`ops-health` cron now warns at 70% and 85% so this cannot arrive unannounced.
The trigger to upgrade is a seat count, not a date — at 50 seats dialing 1,000
leads a day the database grows about **69 MB/day**, which is under a week of
runway.

**Vercel Hobby is non-commercial only.** Their fair-use policy defines commercial
as including "any method of requesting or processing payment from visitors of the
site", which is what Stripe checkout is. This one has no usage gauge because it
is a policy matter, and enforcement is pausing the deployment — so it must be
handled before real payment volume rather than when some number goes red. Usage
points the same way: about **6.3M function invocations a month at 50 seats**
against Hobby's 1M guideline, tripled again under predictive's 1.5s heartbeat.

**Vercel function limits worth knowing:** request bodies are capped at **4.5 MB**
(a 413 raised before the handler runs — this is why large lead uploads are
chunked client-side), and `maxDuration` defaults to 300s with fluid compute, which
is also the Hobby maximum. Pro allows 800s. Do not set a lower `maxDuration`
believing the default is small; it is not.

**Fluid compute must be explicitly on for this project.** It defaults to enabled
only for projects created after 2025-04-23 — this one predates that, so it was
running classic execution, where Hobby's real ceiling is 60s, not 300s. A
`maxDuration = 300` route (the two lead exports, the two 300s crons) then fails
the *build*, not just the runtime: `Builder returned invalid maxDuration value...
must have a maxDuration between 1 and 60 for plan hobby.` Fixed 2026-08-20 by
adding `"fluid": true` to `vercel.json`. If a future project reset or a fresh
`vercel.json` ever drops that key, this exact build failure comes back.

**Functions run in `cle1` (Cleveland), not the `iad1` default,** because Supabase
is in us-east-2 and `cle1` is us-east-2. Every query otherwise paid a
cross-region round trip of roughly 10-15ms, and a predictive tick makes about
fifteen of them — 150-225ms of pure network latency inside a 1.5s budget, spent
holding a database connection. Single-region selection is a Hobby feature; this
did not need Pro. If the database ever moves, move this with it.

**What changes when Vercel goes Pro.** Hobby caps cron jobs at once per day with
±59 minutes of scheduling slop; Pro allows once per minute. Two jobs are badly
served by daily and should be changed at that point, and NOT before — a
sub-daily cron expression fails the *deployment* on Hobby:

- `stale-call-reaper` is `0 4 * * *`, so a wedged call or session can sit for up
  to ~25 hours. It wants `*/10 * * * *`.
- `ops-health` is `0 12 * * *`. It carries the webhook-silence detector, the
  thing that catches "calls connect but every metric reads zero", so a daily
  cadence means learning about it a day late. It wants hourly or `*/15`.

The rest are daily by design — grace periods measured in days — and stay.
`maxDuration` can go to 800s on Pro, with the cron `TIME_BUDGET_MS` raised to
match, but only bother if `pendingAfterRun` or `notReached` ever report non-zero.
The invocation guideline simply becomes a bill: at $0.60 per million, a
full-time predictive agent is about $0.70/month.

**Sentry, GitHub and Cloudflare are not near anything.** Exceeding Sentry's free
quota drops events, costing visibility rather than uptime.

**The heartbeat is what will actually bind first at scale.** Every agent posts
every 5 seconds, or every 1.5 seconds on predictive. That is presence traffic
proportional to seats and independent of call volume: 2,900 seats is ~580
requests/second before anybody dials. The compute upgrade buys room, but the
architectural answer is that presence should not be a database write per agent
per five seconds.

## Known gaps

- No seat charge has completed end to end. Everything in billing is reasoned,
  not observed.
- Lead drip has never received a real vendor payload.
- Lead masking has never been tested with a real second account.
- Predictive AMD catch rate on bridged fan-out calls is unverified.
- The campaign view cannot yet upload or replace leads in place.
- Statement lines are reconciled against Stripe only for the first 250 invoices
  in a period; beyond that they are marked unverified rather than silently
  trusted, but a large annual statement is mostly unverified.
- Neither export has been run against a campaign large enough to need paging.
- AMD is editable from two screens and can drift between them.
- Everything is US-only (see Globalization above).
- Lead ingest has no rate limit. The token is 192-bit and owner-gated, so this
  is a flooding concern rather than a disclosure one.
