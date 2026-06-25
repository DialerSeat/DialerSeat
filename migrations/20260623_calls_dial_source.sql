-- =============================================================================
-- MIGRATION: calls.dial_source marker
-- Applied to project ajknvwdojwrtxzrikpak (DialerSeat) on 2026-06-23.
-- Already live; this file is a version-control record.
-- =============================================================================
-- Records how each call was originated so we can distinguish them in analytics
-- and debugging:
--   'user_dial'         — agent pressed dial / manual keypad
--   'controller_fanout' — predictive controller fanout
-- Nullable text, default null, so existing rows stay valid.

ALTER TABLE public.calls
  ADD COLUMN IF NOT EXISTS dial_source text;
