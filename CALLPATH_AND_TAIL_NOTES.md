# Batch: call-path primitives + administrative tail

## Call-path (done carefully, in isolation — logic UNTOUCHED)
Only error-response and client-construction lines changed; no telephony logic,
no SignalWire fetch, no AMD/predictive logic touched. Each read in full first,
type-checked after.
  - calls/check, calls/hangup, calls/incoming-route → factory client
  - dialer/heartbeat, dialer/active-agents          → factory client
  - calls/outbound, calls/status, calls/recording-status, calls/token,
    dialer/abort, dialer/session                    → apiError
  WEBHOOKS (calls/status, calls/recording-status): apiError defaults to 500, so
  SignalWire still gets the retry signal. Verified.

## Administrative tail (28 files)
Bulk-converted error.message leaks to apiError, with per-file variable detection
(handled error/err/ownErr/delErr correctly). ALL were status-500 server errors —
no user-facing 4xx validation messages were genericized (verified). stripe/webhook
deliberately EXCLUDED (manual webhook verification).

## Progress
- error.message leaks: 74 → 41   (41 routes on apiError)
- bare inline clients: 54 → 28   (26 routes on getServiceClient)

## Remaining (next incremental passes)
- 41 leaks + 28 bare clients across lower-traffic routes (gmail, onboarding,
  whitelabel detail, analytics, misc). Same two primitives; no blockers.
- stripe/webhook error handling (wants its own careful look).

## Apply
Replace lib/supabase.ts, add lib/apiError.ts, replace the listed route files.
Primitives are idempotent with any prior batch.
