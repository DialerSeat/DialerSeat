-- ─────────────────────────────────────────────────────────────────────────
-- A PAUSED PLAN KEEPS THE DAYS IT PAID FOR, AND NOTHING MORE
--
-- Pausing is Stripe's pause_collection. The subscription stays 'active' and
-- its billing period keeps rolling forward every week, each new invoice
-- voided. So current_period_end on a paused plan is always a week ahead and
-- never stops: proxy.ts read it as "access runs to period end" and the
-- dialer's own gate (lib/subscription.ts) never looked at the pause at all.
--
-- 8 Oct: Karol Amado paid for 28 Sept to 5 Oct, paused on 1 Oct, and dialed
-- 491 calls between 5 and 8 Oct on a plan nobody had paid for since.
--
-- paused_access_until is written when the pause is made, from Stripe: the end
-- of the current period if that period's invoice was paid, otherwise the
-- moment of the pause. It does not move when Stripe rolls the period. Null on
-- a paused row means no paid days remain.
-- ─────────────────────────────────────────────────────────────────────────

alter table public.subscriptions
  add column if not exists paused_access_until timestamptz;

comment on column public.subscriptions.paused_access_until is
  'While paused_at is set: access runs to this moment and no later. The end of the last paid period at the time of the pause. Cleared on resume.';

-- The plans already paused on 8 Oct, from the billing ledger (the last paid
-- initial_sub/resub/renewal on each, and the period it opened).
update public.subscriptions set paused_access_until = '2026-10-07 21:17:05+00'
  where stripe_subscription_id = 'sub_1UGQCTLUtyFm1UFgOw1xiOa8' and paused_at is not null; -- Hussein, renewal paid 30 Sept
update public.subscriptions set paused_access_until = '2026-10-05 17:07:35+00'
  where stripe_subscription_id = 'sub_1UKi1bLUtyFm1UFgnQDJdgKK' and paused_at is not null; -- Karol, paid 28 Sept
update public.subscriptions set paused_access_until = '2026-10-02 18:40:07+00'
  where stripe_subscription_id = 'sub_1UJe2VLUtyFm1UFg3TLmHVyx' and paused_at is not null; -- Madison, paid 25 Sept
update public.subscriptions set paused_access_until = '2026-10-09 14:09:08+00'
  where stripe_subscription_id = 'sub_1UEV8bLUtyFm1UFgB0dll4dR' and paused_at is not null; -- Esteban, renewal paid 2 Oct
