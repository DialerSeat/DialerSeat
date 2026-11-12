-- The leg watchdog now links legs through their Telnyx call session, so the
-- agent's browser-side leg of a progressive or manual call is no longer ended
-- as "untracked" two minutes in. Recording the session on each sighting makes
-- that link auditable after the fact.
alter table public.live_leg_sightings add column if not exists call_session_id text;
