-- =============================================================================
-- TEST ACCOUNTS RUN THE PREDICTIVE LINES THEY PICK
-- =============================================================================
-- The legal line count holds every campaign with a thin 30-day record to one
-- line (lib/predictive/pacing): at a ~12% human rate a second line abandons ~6%
-- of the people who answer, and the record has to absorb that under 2% first.
-- On a test campaign dialling the owner's own phones that makes the multi-line
-- paths untestable: the surplus answer, the recorded message with the business
-- name and number, the teammate hand-off.
--
-- A flag an admin sets in SQL, never the app. On a flagged account the
-- controller runs the LINES chosen (2 or 3) and skips the 30-day abandon check.
-- The seller-details gate still applies: the message must exist. Set 25 Sept
-- 2026 on the two internal accounts (both exclude_from_analytics), for
-- Joshua's multi-line test. ONLY for dialling your own numbers: on real leads
-- it abandons real people with no legal cover.
-- =============================================================================

alter table public.users
  add column if not exists predictive_test_lines boolean not null default false;

comment on column public.users.predictive_test_lines is
  'TEST ONLY. Predictive runs the chosen LINES and skips the 30-day abandon check. Admin-set in SQL, for dialing your own numbers.';

update public.users set predictive_test_lines = true
where clerk_id in ('user_3DJJGeuXcG0KuKWBMX8KuR85X4M', 'user_3DEdnNyr7JTifmlBlkJZvr17vE8')
  and exclude_from_analytics = true;
