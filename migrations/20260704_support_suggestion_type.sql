-- Adds 'suggestion' as a valid support_submissions.type, for the new
-- Suggestions tab in the admin Support app (settings → Contact Support).
-- Run this against your Supabase database before using the Suggestion tab —
-- without it, the CHECK constraint rejects the insert with a 500.

ALTER TABLE public.support_submissions DROP CONSTRAINT IF EXISTS support_submissions_type_check;

ALTER TABLE public.support_submissions ADD CONSTRAINT support_submissions_type_check
  CHECK (type = ANY (ARRAY['support','bug','exit','suggestion']::text[]));
