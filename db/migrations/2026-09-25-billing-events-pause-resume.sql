-- =============================================================================
-- PAUSES REACH THE BILLING LOG AS THEMSELVES
-- =============================================================================
-- A pause only ever sent a push. The Logs app reads billing_events, so a
-- customer who paused and later cancelled appeared there as a cancel with
-- nothing before it, and a pause on its own did not appear at all. Joshua,
-- 25 Sept 2026: "differentiate in logs between sub cancel and sub pause".
--
--   pause   written by /api/stripe/pause when the customer pauses, and by the
--           Stripe webhook when Stripe itself puts a plan in status 'paused'
--           (a trial that ended without a card).
--   resume  written by /api/stripe/pause when billing restarts.
-- =============================================================================

alter table public.billing_events
  drop constraint if exists billing_events_event_type_check;

alter table public.billing_events
  add constraint billing_events_event_type_check check (event_type = any (array[
    'account_created', 'initial_sub', 'resub', 'renewal', 'cancel',
    'account_deleted', 'cancel_scheduled', 'payment_failed',
    'checkout_started', 'checkout_failed', 'checkout_stalled',
    'pause', 'resume'
  ]));
