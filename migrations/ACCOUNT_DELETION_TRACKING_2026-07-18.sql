-- Adds account-deletion tracking, for the new "Account Deletions" row in
-- both the admin Logs app and Settings > Notifications.
--
-- IMPORTANT: this does NOT delete rows from `users`. It adds a `deleted_at`
-- marker instead — a real delete would risk orphaning/cascading everything
-- that references users(clerk_id) (calls, campaigns, leads, teams, etc.).
-- The webhook that fires this (app/api/webhooks/clerk/route.ts, on Clerk's
-- `user.deleted` event) only sets this timestamp; nothing else changes.
--
-- Run this against your Supabase database before using the account
-- deletion notification — without it, the webhook's UPDATE will fail
-- silently against a column that doesn't exist, and Logs won't have
-- anything to query for this event type.

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

ALTER TABLE public.admin_notification_prefs ADD COLUMN IF NOT EXISTS account_deleted boolean NOT NULL DEFAULT true;
