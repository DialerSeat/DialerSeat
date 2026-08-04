-- ---- campaigns.dial_repeat_count -------------------------------------------
-- How many times a lead should be dialed in a row before being set aside
-- (1x/2x/3x, hard-capped at 3 in application code regardless of what's
-- written here). Power/Progressive/Preview enforce this entirely
-- client-side (the browser controls the redial loop directly), but
-- Predictive resolves calls server-side via the Telnyx webhook handler
-- (app/api/calls/events/route.ts -> bumpLeadAttemptAndRelease), which has
-- no access to any client-side React state at all — this column is the
-- only way that handler can know the selected repeat count for a given
-- campaign.
ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS dial_repeat_count smallint NOT NULL DEFAULT 1;

ALTER TABLE public.campaigns
  DROP CONSTRAINT IF EXISTS campaigns_dial_repeat_count_check;

ALTER TABLE public.campaigns
  ADD CONSTRAINT campaigns_dial_repeat_count_check
  CHECK (dial_repeat_count >= 1 AND dial_repeat_count <= 3);
