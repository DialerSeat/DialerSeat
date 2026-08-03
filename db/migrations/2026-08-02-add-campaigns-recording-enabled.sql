-- ---- campaigns.recording_enabled -----------------------------------------
-- Fixes a real production error: campaign creation was throwing
--   "Could not find the 'recording_enabled' column of 'campaigns' in the
--   schema cache"
-- because app/api/campaigns/create/route.ts (and the campaign edit route)
-- write to this column, but it was never actually added to the database —
-- confirmed absent from both the live schema (per the error) and this
-- repo's db/schema.sql. This is not a toggle that regressed; it appears the
-- column was never migrated in when the "Call Recording" setting was built.
--
-- Defaults to true to match the code's own fallback behavior
-- (recordingEnabled = typeof recording_enabled === 'boolean' ? recording_enabled : true)
-- and to preserve existing behavior for any campaign row that predates this
-- column — recording was always effectively "on" before this toggle
-- existed, so existing rows should read as on, not off, once this column
-- starts being read.
ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS recording_enabled boolean NOT NULL DEFAULT true;
