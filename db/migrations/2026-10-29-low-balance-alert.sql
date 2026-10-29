-- Push Joshua when the Telnyx balance drops below a threshold ($5 to start).
-- Asked for 29 Oct 2026. The check runs from /api/cron/low-balance every five
-- minutes and reads the balance from Telnyx itself, so it fires whether or not
-- anybody is dialing or has an admin screen open.
--
-- Once per drop: low_balance_alerted_at is set when the alert goes out and
-- cleared once the balance is back above the threshold plus $1, so a top-up
-- re-arms it and a balance hovering around $5 does not alert every few minutes.

alter table public.platform_config
  add column if not exists low_balance_alert_usd numeric not null default 5,
  add column if not exists low_balance_alerted_at timestamptz;

alter table public.admin_notification_prefs
  add column if not exists low_balance boolean not null default true;
