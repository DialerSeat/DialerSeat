-- billing_events: append-only audit trail for account/subscription lifecycle
-- events (account_created, initial_sub, resub, renewal, cancel).
--
-- Why this exists: the admin Logs page previously reconstructed history by
-- reading the live `users` and `subscriptions` tables. deleteAccount()
-- hard-deletes both of those rows when an account is deleted, which means
-- every event tied to that account — including ones that happened weeks
-- earlier and were already visible in Logs — disappeared the moment the
-- account was deleted. Same problem hit live push notifications: they look
-- up the user's name via `stripe_customer_id` on the `users` table, which
-- no longer exists for a deleted account, so the notification silently
-- never sends.
--
-- billing_events is written once, at the moment each event happens, with a
-- denormalized name/email snapshot baked in — no foreign key to `users`, so
-- deleting an account can never cascade into deleting its own history, and
-- reading it never depends on the user still existing.
CREATE TABLE IF NOT EXISTS public.billing_events (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_id         text NOT NULL,
  event_type       text NOT NULL CHECK (event_type IN (
                     'account_created', 'initial_sub', 'resub', 'renewal', 'cancel'
                   )),
  plan             text,                    -- 'pro' | 'wl' | null (account_created has no plan)
  amount_cents     integer NOT NULL DEFAULT 0,
  retention_weeks  integer,                  -- populated for 'cancel' events only
  stripe_subscription_id text,
  -- Denormalized snapshot of who this was, taken at write time. Deliberately
  -- NOT a foreign key / live join — this is what lets the row keep meaning
  -- after the account itself is deleted.
  user_name        text NOT NULL,
  user_email       text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_billing_events_created    ON public.billing_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_billing_events_clerk_id   ON public.billing_events (clerk_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_billing_events_type       ON public.billing_events (event_type, created_at DESC);

ALTER TABLE public.billing_events ENABLE ROW LEVEL SECURITY;

-- Append-only at the privilege level, same pattern as call_events: the
-- webhook (service_role) can insert and read, nothing can update/delete
-- through the API surface. Only a superuser/postgres maintenance task
-- should ever prune this table.
REVOKE UPDATE, DELETE, TRUNCATE ON public.billing_events FROM service_role;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.billing_events FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.billing_events FROM authenticated;
