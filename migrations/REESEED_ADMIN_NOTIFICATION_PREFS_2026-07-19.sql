-- Re-seeds admin_notification_prefs if it's missing its one row.
--
-- This directly addresses two confirmed bugs traced to the exact same
-- root cause — the seed insert from migrations/PUSH_NOTIFICATIONS_
-- 2026-07-17.sql never actually running against this database:
--
--   1. Every toggle in Settings > Notifications appeared to save (200 OK)
--      but silently reverted on next load — the POST route was using
--      UPDATE, which matches zero rows (not an error) when the row
--      doesn't exist, so nothing was ever actually persisted.
--   2. Every push notification was being silently discarded before it
--      even checked which devices were subscribed — lib/pushNotify.ts's
--      getPrefs() returned null for a missing row, and sendAdminPush()
--      treated that identically to "notifications explicitly disabled."
--
-- Both of those are now fixed at the code level to be self-healing (see
-- app/api/admin/push/prefs/route.ts and lib/pushNotify.ts), but this
-- migration closes the actual gap directly rather than relying solely on
-- the fallback behavior. Safe to run any number of times.
INSERT INTO public.admin_notification_prefs (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;
