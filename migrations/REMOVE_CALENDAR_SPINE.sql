-- ============================================================================
-- OPTIONAL: remove the dormant calendar/scheduling DB objects
-- Run this ONLY if you want the database fully clean of the calendar work.
-- All three are currently EMPTY and unreferenced (verified: 0 rows, the claim
-- RPC never used them), so dropping them is safe and changes no app behavior.
-- This is irreversible — that's why it's yours to run, not done automatically.
-- ============================================================================

DROP TABLE IF EXISTS public.calendar_events;
DROP TABLE IF EXISTS public.dial_attempts;

-- The dormant scheduling column + its partial index on leads:
DROP INDEX IF EXISTS public.idx_leads_next_eligible;
ALTER TABLE public.leads DROP COLUMN IF EXISTS next_eligible_at;
