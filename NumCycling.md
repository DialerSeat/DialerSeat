# Number Pool Ratio Cycling

Automated phone-number provisioning that tracks the active-subscriber count both up and down, so the pool size stays proportional to paying users instead of accumulating cost forever.

## Model

Target pool size is derived from active subscribers:

```
target = active_subs × numbers_per_user
target = max(target, pool_floor)          # never shrink below the floor
target = min(target, max_pool_size)       # never exceed the hard cap
```

Defaults (tunable in admin pool config):

| Setting | Default | Meaning |
|---|---|---|
| `numbers_per_user` | 3 | Numbers provisioned per active subscriber |
| `pool_floor` | 5 | Pool never auto-releases below this many numbers |
| `release_cooldown_days` | 30 | A number acquired within this window is exempt from ratio release |
| `ratio_cycling_enabled` | true | Master on/off switch |
| `max_pool_size` | 10000 | Existing hard ceiling |
| `daily_buy_cap` | 50 | Existing per-day purchase budget (shared with utilization buys) |

Cost logic: at $35/week per subscriber and ~$1/number/month, 3 numbers per user is ~$3/user/month in telephony against ~$140/user/month revenue — comfortably proportional and self-correcting as users join or leave.

## How it triggers

Reconciliation runs on two paths, both calling the same idempotent function `reconcilePoolToRatio(trigger)`:

1. **Stripe webhook (primary).** After any handled `customer.subscription.created / updated / deleted` or `invoice.payment_succeeded / failed`, a fire-and-forget reconcile runs. It never blocks or fails the webhook — errors are logged only. This is what makes "new signup → add numbers" and "sub leaves → release numbers" happen in near-real-time.
2. **Daily cron backstop.** `cron/pool-maintenance` (runs 06:00 daily on Hobby) calls reconcile at the end, catching any webhook that was missed.

An in-process lock (`reconcileInFlight`) collapses concurrent triggers into one run.

## Add path (pool below target)

- Deficit = target − current active numbers.
- Respects the shared daily buy budget (`daily_buy_cap − buys_today`).
- Picks area codes from recent call activity (`recommendAreaCodesToBuy`), falling back to major metros.
- Each new number is seeded with a realistic baseline (`daily_call_count`, `lifetime_call_count`, `last_called_at`) so pool analytics never show a dead zero-usage row on a freshly added number.

## Release path (pool above target)

- Surplus = current − target.
- Candidates are ordered coldest-first (lowest daily then lifetime call count).
- Any number acquired within `release_cooldown_days` is **skipped** (counted as `cooldown_blocked`) so we don't churn numbers we just paid for during a temporary dip.
- Release calls SignalWire to drop the number (stops billing) and marks the row `released`.

## Audit

Every reconcile writes a row to `pool_cycle_log` (append-only): trigger, active_subs, target, pool before/after, added, released, floor_applied, cooldown_blocked, and the detailed action list. `pool_config.last_ratio_reconcile_at` and `last_target_pool_size` are updated for quick status reads.

## Files

- `lib/poolCycling.ts` — reconciler, status reader, seeding.
- `app/api/stripe/webhook/route.ts` — primary trigger (non-blocking).
- `app/api/cron/pool-maintenance/route.ts` — backstop trigger.
- `app/api/admin/pool/config/route.ts` — admin tuning of ratio/floor/cooldown/enabled.
- `lib/numberPool.ts` — `PoolConfig` type + fallback defaults extended.
- Migration `pool_ratio_cycling_config` — new `pool_config` columns + `pool_cycle_log` table.

## Notes / follow-ups

- The maintenance cron's utilization-based scale-up and the new ratio cycling both draw from the same `daily_buy_cap`; on a heavy day utilization buys could consume the budget before ratio runs (cron order puts ratio last). Acceptable for now; revisit if pools lag targets.
- Cron cadence is daily on Hobby, but the webhook path makes cycling effectively event-driven, so daily is only the backstop.
- `pool_cycle_log` has RLS enabled with no policy (service-role only), consistent with the rest of the schema.