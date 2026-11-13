-- =============================================================================
-- Thirteen tables get a retention decision
-- =============================================================================
-- /api/cron/data-retention reports every table with no row in retention_policy
-- ("N table(s) have no retention policy and are being kept by default"), every
-- day, until somebody decides. These are the thirteen it was reporting on
-- 12 Nov 2026. The owner was shown each one with its size and what it is for,
-- and approved the list below on 13 Nov: twelve kept, one pruned.
--
-- Unclassified already meant kept, so the twelve change nothing about what is
-- stored. They record that the keeping is on purpose.
--
-- THE ONE THAT IS PRUNED. live_leg_sightings is the leg watchdog's log of call
-- legs it has seen at the carrier, about 270 rows a day. The watchdog uses a
-- row only while the leg is alive, and no leg lives thirty days, so a row last
-- seen more than thirty days ago is history. Pruned on last_seen_at, not
-- first_seen_at: the question is when a leg was last alive, not when it was
-- first noticed (see 2026-11-12-retention-agent-sessions-kept.sql for what
-- pruning on the wrong column did).
--
-- NONE IS MARKED PROTECTED. Protection cannot be lifted by an update, only by a
-- migration, and the owner was asked about keep or prune, not about that.
--
-- THE TWO UNDO LISTS (leads_maxed_release_20260913,
-- calls_disposition_backfill_20261001) are the only way to reverse two one-off
-- fixes. Kept, so the prune never touches them; the owner can drop them by
-- hand once he is sure those fixes stay.
-- =============================================================================

insert into public.retention_policy (table_name, retention_class, keep_days, timestamp_column, notes)
values
  ('telnyx_ledger_records', 'evidence', null, 'captured_at',
   'What Telnyx charged, captured from the carrier. The record behind every cost figure and any billing dispute. The one table here that grows with volume.'),
  ('telnyx_balance_snapshots', 'evidence', null, 'at',
   'Account balance history. Read by the reconcile screens and the low-balance alert.'),
  ('telnyx_monthly_bills', 'evidence', null, 'recorded_at',
   'Monthly invoice totals. Money.'),
  ('dial_performance_daily', 'evidence', null, 'computed_at',
   'The daily summary itself, rebuilt by refresh_dial_performance. This is the compressed form; there is nothing smaller to keep instead.'),
  ('destination_rates', 'evidence', null, 'last_seen',
   'Per-destination carrier rates the dialer reads before placing a call. State, not a log: one row per NPA-NXX.'),
  ('cps_governor', 'evidence', null, 'window_start',
   'Live call-pacing state. One row.'),
  ('predictive_batch', 'evidence', null, 'updated_at',
   'Leads a predictive session has in play. The app removes a row when the lead is done; rows also go with their agent_sessions row or their lead by cascade.'),
  ('agent_spend_alerts', 'evidence', null, 'alerted_at',
   'One row per agent per day an alert fired. Doubles as the once-a-day lock.'),
  ('platform_config_backups', 'evidence', null, 'created_at',
   'Snapshots of dialer and AMD settings taken before a change. The way back.'),
  ('suggestions', 'evidence', null, 'created_at',
   'Feedback people sent through the site. Same shape as support_submissions.'),
  ('leads_maxed_release_20260913', 'evidence', null, 'released_at',
   'Undo list for the one-time lead release of 13 Sept 2026. Drop by hand once that release is certain to stay.'),
  ('calls_disposition_backfill_20261001', 'evidence', null, 'backfilled_at',
   'Undo list for the one-time disposition backfill of 1 Oct 2026. Drop by hand once that backfill is certain to stay.'),
  ('live_leg_sightings', 'ephemeral', 30, 'last_seen_at',
   'Leg watchdog log of call legs seen at the carrier. Only meaningful while the leg is alive; no leg lives thirty days.')
on conflict (table_name) do nothing;
