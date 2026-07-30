-- ---- Promo / announcement banner -----------------------------------------
-- Single-row singleton table (id is always 1), same pattern as
-- dialer_down_status. Unlike Dialer Down, this banner has no password
-- gate — it's for non-emergency announcements (promos, holiday codes,
-- etc.) that admins should be able to publish and edit freely from
-- Settings > Notifications.
--
-- Same audience rule as Dialer Down: only signed-in Pro/Manager+ users,
-- only inside dashboard apps, never the landing page, never signed-out
-- visitors. See /api/dashboard/promo-banner for the enforcement point.
CREATE TABLE IF NOT EXISTS public.promo_banner_status (
  id         integer PRIMARY KEY DEFAULT 1,
  enabled    boolean NOT NULL DEFAULT false,
  message    text NOT NULL DEFAULT ''::text,
  text_color text NOT NULL DEFAULT '#FFFFFF',
  bg_color   text NOT NULL DEFAULT '#0A84FF',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text,
  CONSTRAINT promo_banner_status_singleton CHECK (id = 1)
);

INSERT INTO public.promo_banner_status (id, enabled, message, text_color, bg_color)
VALUES (1, false, '', '#FFFFFF', '#0A84FF')
ON CONFLICT (id) DO NOTHING;
