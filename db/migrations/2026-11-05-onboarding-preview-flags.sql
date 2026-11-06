-- One set of onboarding flags per account: the welcome popup, the demo tour, and
-- the one-time tutorial after paying for Pro. See app/api/onboarding/route.ts.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS onboard_popup_done boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS onboard_tour_on boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS onboard_tour_done boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS onboard_tut_done boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS onboard_gd_min boolean NOT NULL DEFAULT false;
