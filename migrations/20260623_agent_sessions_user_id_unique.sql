-- =============================================================================
-- MIGRATION: agent_sessions unique(user_id) — fixes heartbeat 500
-- Applied to project ajknvwdojwrtxzrikpak (DialerSeat) on 2026-06-23.
-- Already live; this file is a version-control record.
-- =============================================================================
-- The heartbeat route upserts agent_sessions with onConflict: 'user_id'.
-- Postgres requires a unique/exclusion constraint matching the conflict target.
-- It was missing, so EVERY heartbeat threw and returned 500 (the error you saw
-- spamming the console every ~5s). This adds the constraint.

ALTER TABLE public.agent_sessions
  ADD CONSTRAINT agent_sessions_user_id_key UNIQUE (user_id);
