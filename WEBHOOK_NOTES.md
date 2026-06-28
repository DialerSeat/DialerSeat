# stripe/webhook hardening — minimal, behavior-preserving

The webhook was already mature (signature verification, idempotency layer,
correct retry semantics, documented bugfix history). This was NOT a rewrite —
just two surgical changes, plus a careful review confirming the rest is sound.

## Changed
1. Bare inline createClient(SERVICE_ROLE) → getServiceClient('stripe/webhook').
   This was the LAST bare client in the codebase — bare-client count is now 0.
2. Handler-failure 500 return → apiError(err, { route, context:{event_id,event_type} }).
   apiError defaults to status 500, so Stripe STILL RETRIES failed events, and
   it adds Sentry capture. markStripeEventFailed() is kept (idempotency-table log).

## Deliberately LEFT unchanged (verified correct)
- The two signature-failure returns stay 400 (Stripe must NOT retry a malformed/
  unsigned request). The "Webhook Error: <msg>" text is Stripe-facing webhook
  diagnostic (no user PII) — useful for debugging webhook config, so left verbose.
- Success/skip paths still return 200 { received: true } (tells Stripe to stop).
- Handlers are intentionally idempotent (upserts onConflict, status-set updates)
  rather than transactional — the correct webhook design: idempotent handler +
  Stripe retry. A previously_failed event re-processes cleanly via claimStripeEvent.

## Retry contract (verified end-to-end)
handler throws → markStripeEventFailed → apiError returns 500 → Stripe retries →
claimStripeEvent sees 'failed' → shouldProcess:true → clean reprocess.
already_processed events return shouldProcess:false (no double-processing).

## Result: firmness sweep complete
- bare inline service-role clients: 0 remaining (was 54)
- client error.message leaks: only the 5 INTENTIONAL ones remain (4 Stripe/teams
  user-facing payment errors with fallback strings; 1 internal results array).
