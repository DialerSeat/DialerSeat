-- =============================================================================
-- BACKUP OF THE WORKING AMD SETUP, BEFORE ANY TUNING
-- =============================================================================
-- Joshua, 25 Sept 2026: "create a backup ... tune amd after". This is the
-- detector configuration that ran the real dialing days (unchanged since
-- 18 Sept 21:45 UTC), kept three ways so tuning can always be undone:
--
--   1. platform_config_backups: the WHOLE platform_config row as jsonb, so a
--      restore also catches anything tuning touches beyond the AMD columns.
--   2. The exact AMD values below, with the UPDATE that puts them back.
--   3. git tag amd-baseline-2026-09-25 on the code that reads them
--      (lib/placeOutboundCall.ts, app/api/calls/events/route.ts).
--
-- Baseline, as read before this ran:
--   amd_detector                   detect   (the only standard-rate detector)
--   amd_tuning_enabled             true
--   amd_total_analysis_ms          6000
--   amd_after_greeting_silence_ms  800
--   amd_greeting_duration_ms       2200
--   amd_max_words                  5
--   amd_initial_silence_ms         2500
--   amd_max_seconds_after_answer   10
--   amd_hold_seconds_after_machine 8
--   amd_hangup_when_bridged        true
--   amd_in_preview                 false
--   amd_enabled_global             true
--   recording_enabled_global       true
--
-- TO RESTORE the AMD settings exactly:
--
--   update public.platform_config set
--     amd_detector = 'detect',
--     amd_tuning_enabled = true,
--     amd_total_analysis_ms = 6000,
--     amd_after_greeting_silence_ms = 800,
--     amd_greeting_duration_ms = 2200,
--     amd_max_words = 5,
--     amd_initial_silence_ms = 2500,
--     amd_max_seconds_after_answer = 10,
--     amd_hold_seconds_after_machine = 8,
--     amd_hangup_when_bridged = true,
--     amd_in_preview = false,
--     amd_enabled_global = true,
--     recording_enabled_global = true;
--
-- and for the code: git checkout amd-baseline-2026-09-25 -- lib/placeOutboundCall.ts app/api/calls/events/route.ts
-- =============================================================================

create table if not exists public.platform_config_backups (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  reason text,
  snapshot jsonb not null,
  created_at timestamptz not null default now()
);

comment on table public.platform_config_backups is
  'Whole-row snapshots of platform_config taken before a deliberate change, so it can be put back. Restore with jsonb_populate_record.';

alter table public.platform_config_backups enable row level security;

insert into public.platform_config_backups (label, reason, snapshot)
select 'amd-baseline-2026-09-25',
       'Working AMD setup of the real dialing days, before AMD tuning and the recording-start change.',
       to_jsonb(pc)
from public.platform_config pc;
