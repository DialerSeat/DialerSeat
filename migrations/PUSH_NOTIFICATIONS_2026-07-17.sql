-- Adds Web Push support for the admin Settings > Notifications screen.
-- Two tables:
--   push_subscriptions        one row per subscribed device (a phone can
--                             re-subscribe after reinstall, so this is a
--                             real table, not a singleton).
--   admin_notification_prefs  singleton row (same pattern as pool_config)
--                             holding one boolean per Logs event type —
--                             single-admin setup for now, per product
--                             decision; add a clerk_id column later if
--                             per-admin prefs are ever needed.
-- Run this against your Supabase database before using push notifications —
-- without it, /api/admin/push/subscribe and /api/admin/push/prefs will 500.

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id             uuid NOT NULL DEFAULT gen_random_uuid(),
  clerk_id       text NOT NULL,                 -- FK -> users(clerk_id), who owns this device
  endpoint       text NOT NULL,
  p256dh         text NOT NULL,                 -- subscription encryption key
  auth           text NOT NULL,                 -- subscription auth secret
  user_agent     text,                          -- best-effort device label, e.g. "iPhone — Safari"
  created_at     timestamptz NOT NULL DEFAULT now(),
  last_used_at   timestamptz,
  PRIMARY KEY (id),
  UNIQUE (endpoint)
);

CREATE TABLE IF NOT EXISTS public.admin_notification_prefs (
  id             integer NOT NULL DEFAULT 1,    -- CHECK (id = 1) singleton, same pattern as pool_config
  master_enabled boolean NOT NULL DEFAULT true,
  signup         boolean NOT NULL DEFAULT true,
  new_sub        boolean NOT NULL DEFAULT true,
  resub          boolean NOT NULL DEFAULT true,
  renewal        boolean NOT NULL DEFAULT true,
  cancel         boolean NOT NULL DEFAULT true,
  updated_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id),
  CONSTRAINT admin_notification_prefs_singleton CHECK (id = 1)
);

-- Seed the singleton row so the app can always assume it exists.
INSERT INTO public.admin_notification_prefs (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;
