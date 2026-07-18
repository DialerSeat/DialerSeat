-- Extends billing_events.event_type to allow 'account_deleted'.
--
-- Without this, INSERT ... event_type = 'account_deleted' violates the
-- original CHECK constraint from BILLING_EVENTS_AUDIT_LOG_2026-07-18.sql
-- and the insert fails (swallowed by lib/billingEvents.ts's never-throw
-- design, so it fails silently rather than breaking account deletion —
-- but the event never gets recorded either way without this migration).
--
-- Run this before deploying the updated lib/deleteAccount.ts /
-- app/api/webhooks/clerk/route.ts that write 'account_deleted' rows.

ALTER TABLE public.billing_events DROP CONSTRAINT IF EXISTS billing_events_event_type_check;

ALTER TABLE public.billing_events ADD CONSTRAINT billing_events_event_type_check
  CHECK (event_type = ANY (ARRAY['account_created','initial_sub','resub','renewal','cancel','account_deleted']::text[]));
