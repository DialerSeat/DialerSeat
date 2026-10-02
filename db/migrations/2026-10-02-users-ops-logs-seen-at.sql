-- The Ops Map's "new logs" badge was measured against a timestamp kept in
-- each browser's localStorage, so reading the panel on a phone left the badge
-- up on the desktop. The watermark now lives on the admin's account.
alter table public.users add column if not exists ops_logs_seen_at timestamptz;
comment on column public.users.ops_logs_seen_at is
  'When this admin last had the Ops Map notifications panel open. Drives the unread badge on every device, so reading on one clears it on all.';
