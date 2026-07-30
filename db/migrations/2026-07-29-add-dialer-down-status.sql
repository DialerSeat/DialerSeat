-- ---- Dialer Down emergency banner --------------------------------------
-- Single-row singleton table (id is always 1), same pattern as
-- admin_notification_prefs. Holds the sitewide "Dialer Down" technical
-- difficulty banner that admins can publish from Settings > Notifications.
--
-- password_hash / password_salt store a scrypt hash of the publish/remove
-- password — never the plaintext. Verification happens server-side in
-- /api/admin/dialer-down against these two columns (see lib/dialerDown.ts).
--
-- This table is read by two different code paths:
--   1. /api/admin/dialer-down (admin, requireAdmin-gated) — full read/write,
--      used by the Settings app to publish, edit, and remove the banner.
--   2. /api/dashboard/dialer-down (signed-in Pro/Manager+ users only) — a
--      narrow read-only endpoint that returns only { enabled, message }
--      when enabled is true, and never exposes the password hash/salt.
--      Landing pages and anonymous visitors never call this endpoint at
--      all, so they can never see the banner regardless of its state.
CREATE TABLE IF NOT EXISTS public.dialer_down_status (
  id            integer PRIMARY KEY DEFAULT 1,
  enabled       boolean NOT NULL DEFAULT false,
  message       text NOT NULL DEFAULT ''::text,
  password_hash text,
  password_salt text,
  updated_at    timestamptz NOT NULL DEFAULT now(),
  updated_by    text,
  CONSTRAINT dialer_down_status_singleton CHECK (id = 1)
);

INSERT INTO public.dialer_down_status (id, enabled, message)
VALUES (1, false, '')
ON CONFLICT (id) DO NOTHING;
