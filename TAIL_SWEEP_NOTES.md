# Batch: error-leak + factory tail sweep

## Converted this batch (all type-check clean)
- campaigns/* and scripts/* (script CRUD cluster) → apiError
- analytics/* (summary, campaigns, dispositions, timeseries) → apiError + factory
- recordings/* (list, delete, sync, play) → apiError + factory
- whitelabel/* (onboarding, custom-themes, check-subdomain, switch-view, upload-logo) → factory
- admin/* (analytics, tenants, notes, logs, impersonate, desktop-prefs) → factory
- manager/* (analytics, desktop-prefs, notes) → factory
- predictive/prefs, subscriptions/summary, users/create → factory/apiError
- cron/pool-reset, cron/pool-maintenance → factory + apiError
- leftover catch-block leaks in admin/pool/{buy,release,sync,import-existing} → apiError

## Final state
- error.message leaks: 74 → 6 remaining (all INTENTIONAL — see below)
- bare inline clients: 54 → 1 remaining (stripe/webhook, parked)

## Deliberately LEFT (not bugs)
- stripe/cancel, stripe/abandon-billing, stripe/create-subscription,
  teams/members/accept: surface err.message/err.code to the USER on purpose
  (Stripe payment errors like "card declined" must be shown so the user can fix
  it). Each has a user-facing fallback string. Genericizing would hurt UX.
- admin/pool/seed: the err.message there is stored in an internal results[]
  array (batch diagnostics), NOT returned as the route's error response.
- stripe/webhook: parked for its own careful pass (bare client + handling).

## Apply
Replace the listed route files. Primitives (lib/supabase.ts, lib/apiError.ts)
shipped in prior batches; idempotent if re-applied.
