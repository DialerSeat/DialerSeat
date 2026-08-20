# Vercel Pro — the upgrade play

**Status: NOT YET APPLIED.** Everything here is blocked on the Vercel account
being on Pro. Applying any of it while still on Hobby breaks the deployment —
see the warning below.

**To run this:** tell Claude *"Vercel is on Pro — run vercel-upgrade.md"*.

---

## Why none of this is applied yet

Vercel Hobby caps cron jobs at **once per day**, with **±59 minutes** of
scheduling slop. Pro allows **once per minute** with per-minute precision.

The critical part: a sub-daily cron expression does not degrade on Hobby, it
**fails the deployment**, with `Hobby accounts are limited to daily cron jobs.`
So these edits cannot be staged ahead of time — they must land after the plan
changes, or the next deploy breaks.

Verified against Vercel's docs on 2026-08-20 (`/docs/cron-jobs/usage-and-pricing`,
`/docs/functions/limitations`, `/docs/limits/fair-use-guidelines`). Re-check
before running; these limits move.

---

## Change 1 — cron frequency (`vercel.json`)

Two jobs are badly served by a once-a-day cap. The rest are daily *by design* —
their grace periods are measured in days — and must be left alone.

### `stale-call-reaper`: `0 4 * * *` → `*/10 * * * *`

This reaps wedged calls and sessions. At daily plus slop, a wedged session can
sit for up to **~25 hours** — an agent stuck mid-call, or a lead claimed by a
session that died. `app/api/cron/stale-call-reaper/route.ts` already carries the
comment *"Do not reintroduce `*/10` here while on Hobby"*, which is exactly this.

Its `BATCH_LIMIT = 500` is safe to leave: reaping un-wedges a session, so the
selection set drains, and at ten-minute intervals the batch will never be near
full. (See the draining rule in `BREAKDOWN.md`.)

### `ops-health`: `0 12 * * *` → `0 * * * *`

This carries the webhook-silence detector — the check that catches *"calls
connect but every metric reads zero"*, meaning Telnyx delivery or signature
verification has broken. Daily means finding that out up to a day late, during
which every call is unrecorded.

It also now carries `checkSecurityInvariants` and `checkDatabaseCapacity`. All
three are cheap reads. `COOLDOWN_MINUTES = 60` in that file already prevents an
hourly cadence from becoming hourly noise — an ongoing condition still alerts
once per hour, not once per run. **If you go below hourly, raise the cooldown**,
or a single ongoing problem will buzz every fifteen minutes.

### Leave these exactly as they are

`recording-retention`, `pool-reset`, `pool-maintenance`, `number-health`,
`data-retention`, `seat-billing-enforcement`, `billing-retry`. Each is daily
because the thing it manages moves in days. Making them frequent adds load and
changes nothing.

---

## Change 2 — `maxDuration` 300 → 800

Pro raises the ceiling from 300s to 800s. **Only worth doing if the evidence says
so**, and the evidence already exists: check recent runs of

- `/api/cron/seat-billing-enforcement` for `completed: false` or
  `pendingAfterRun > 0`
- `/api/cron/billing-retry` for a non-empty `notReached`

If both are clean, the jobs are finishing inside 300s and raising the limit
changes nothing. If either is non-zero, raise `maxDuration` to `800` **and**
`TIME_BUDGET_MS` from `240_000` to roughly `700_000` in the same file — the
budget must stay below the hard limit, or the function is killed mid-pass and
loses the record of where it stopped, which is the failure the budget exists to
prevent.

Files: `app/api/cron/seat-billing-enforcement/route.ts`,
`app/api/cron/billing-retry/route.ts`.

The two export routes (`app/api/leads/export`, `app/api/admin/user-data/leads/export`)
stream and page, so they only need more than 300s for a genuinely enormous
export. Leave them at 300 unless someone reports a truncated download.

---

## Change 3 — nothing, for invocations

The 1M/month guideline stops applying; it becomes usage-based billing. **No code
change.** At $0.60 per million, a full-time predictive agent is about
$0.70/month in invocations. Fifty predictive agents dialing all day is roughly
$40/month against about $7,500/month of seat revenue.

Do **not** slow the heartbeat to save money. It is presence and, in predictive,
the engine — `PREDICTIVE_HEARTBEAT_INTERVAL_MS = 1_500` is tuned, and the
predictive path is fragile by standing instruction.

---

## Already done, not part of this play

`"regions": ["cle1"]` is set in `vercel.json`. Cleveland is us-east-2, matching
the Supabase project, removing a 10–15ms cross-region round trip from every
query. Single-region selection is a Hobby feature so it needed no upgrade. If
the database region ever changes, change this with it.

---

## After applying

1. Deploy, and confirm the build does not fail on cron expressions.
2. Vercel dashboard → the project → Cron Jobs — confirm both changed jobs show
   their new schedule and a next-run time.
3. Within ~15 minutes, confirm `stale-call-reaper` has executed at least once.
4. Confirm `ops-health` runs and returns `checks` with `db_capacity` reporting a
   percentage — that proves the capacity alarm is live rather than merely
   deployed.

---

## What Pro does NOT fix

Vercel Pro removes the *hosting* ceiling. The next wall is the database, and it
arrives quickly:

- **Supabase is still on the free plan**, which switches to **read-only** at
  500 MB — no uploads, no call rows, no dispositions, no heartbeats. At 50 seats
  dialing 1,000 leads a day that is **under a week** of runway. `ops-health`
  warns at 70% and 85%.
- **Concurrency** on the free Micro instance (60 connections, 224 MB
  shared_buffers) lands around **300–500 progressive** agents or **40–70
  predictive at 5 lines**, on arithmetic from the real heartbeat intervals — not
  a load test.
- **Presence is the architectural wall.** Every agent writes to Postgres every
  5 seconds, or every 1.5 seconds on predictive. That is load proportional to
  seats and independent of call volume: 2,900 seats is ~580 requests/second
  before anybody dials. Past a few hundred agents, presence has to move off
  Postgres — Redis or Supabase Realtime — and no plan upgrade substitutes for
  that.

Vercel Pro is the right next step because it is the cheapest, and because Hobby
is non-commercial-only and DialerSeat takes payment. It is not the last one.
