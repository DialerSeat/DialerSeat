-- ---- Recording on, for every campaign -------------------------------------
--
-- Recording was opt-in per campaign and in practice that meant off. 17 of the
-- 21 campaigns on the platform had never turned it on, so a team owner who
-- wanted to hear how an agent sounded had nothing to listen to. A recording
-- that was not made cannot be made afterwards, which is what makes "off" the
-- wrong thing to leave to a checkbox nobody finds.
--
-- TWO THINGS WERE KEEPING IT OFF.
--
-- The column default. 2026-08-02-add-campaigns-recording-enabled.sql created
-- this column with DEFAULT true, but the live column read DEFAULT false: the
-- schema had drifted from the migration that defined it.
--
-- The API route. app/api/campaigns/create/route.ts substituted false whenever
-- the caller omitted the field, which is the path almost every campaign is
-- created through, so the column default rarely got a say. That route now
-- substitutes true and carries the reasoning.
--
-- WHAT THIS COSTS. Not only the recording line. AMD is what decides whether to
-- record, so enabling recording on a campaign also runs detection on every
-- dial from it (see amdOnDial in lib/placeOutboundCall.ts). Detection is
-- billed per leg whether or not anyone answers, and it is the cost that scales
-- with dialing rather than with talk time.
--
-- WHAT STILL TURNS IT OFF. An explicit false on a campaign. And
-- platform_config.recording_enabled_global, which remains the platform-wide
-- kill switch: resolveWithGlobal only ever turns things OFF, so that flag can
-- stop recording everywhere in seconds without touching a campaign row.
--
-- Two-party consent is a real exposure and is not addressed by this file. It
-- now rests on the disclosure the agent gives and on the compliance surface,
-- rather than on most campaigns happening to be off by accident.

ALTER TABLE campaigns
  ALTER COLUMN recording_enabled SET DEFAULT true;

-- Existing campaigns, which the default above cannot reach.
UPDATE campaigns
   SET recording_enabled = true
 WHERE recording_enabled IS DISTINCT FROM true;
