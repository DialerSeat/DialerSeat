-- Guards against out-of-order Stripe webhook delivery. Stripe does not
-- guarantee events arrive in the order they occurred — a
-- customer.subscription.updated (status: active, fired the moment payment
-- succeeds) can be delivered to our webhook endpoint before the earlier
-- customer.subscription.created (status: incomplete, fired the instant the
-- billing page creates the placeholder subscription) finishes retrying or
-- lands. Every subscription write in app/api/stripe/webhook/route.ts
-- previously overwrote the row unconditionally, so whichever event happened
-- to arrive LAST won — including overwriting a real 'active' status back
-- down to 'incomplete' if the created event arrived after the updated
-- event. That corrupted state is what caused a real, human subscribe to be
-- misreported as "just subscribed" happening at account-creation time and
-- "resubscribed" at the moment they actually paid: the notification logic
-- reads the same (corrupted) stored status to decide what happened.
--
-- last_event_at stores the Stripe event's own `created` timestamp (when
-- Stripe originated the event, not when we received it) for whichever
-- event most recently wrote this row. Every future write compares its own
-- event timestamp against this before touching the row.
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS last_event_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_subscriptions_last_event_at
  ON public.subscriptions (last_event_at);
