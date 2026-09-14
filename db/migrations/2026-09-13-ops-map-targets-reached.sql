-- ---- ops_map_targets gains a `reached` column --------------------------
--
-- The map's target pings divide answered by calls, and `calls` includes the
-- dead-socket rows: a lead leg created, torn down before it rang, and recorded
-- NO_ANSWER against somebody who was never called. Platform-wide those are
-- 7,117 of 9,007 calls, which drags the reported answer rate from a real 41.7%
-- down to 8.8%.
--
-- It matters more on this surface than anywhere else, because this is the view
-- somebody uses to decide which area codes are worth buying numbers in.
-- Judging a state on a rate that is mostly our own bug is how you buy the
-- wrong numbers. Measured over thirty days, the ordering inverts:
--
--   786   8.7% shown -> 90.0% real
--   956   6.4% shown -> 70.0% real
--   323  10.3% shown -> 51.7% real
--   303  23.1% shown -> 23.4% real   (barely touched: it has few phantoms)
--
-- `calls` is deliberately unchanged. Those dials really were attempted and
-- really were billed, so the ping still sizes by them and the dial count still
-- reports them. `reached` is added alongside as the honest denominator.
--
-- The test matches lib/dialOutcome.ts, no answer and no duration, and the two
-- are kept in step by hand. Both carry this note so a change to either is a
-- visible reason to check the other.
--
-- Dropped and recreated rather than replaced: adding an OUT column changes the
-- function's row type, which CREATE OR REPLACE refuses. Both statements are in
-- one migration so there is no window where the function does not exist.

DROP FUNCTION IF EXISTS public.ops_map_targets(timestamp with time zone);

CREATE FUNCTION public.ops_map_targets(p_since timestamp with time zone)
 RETURNS TABLE(npa text, calls bigint, answered bigint, connected bigint, reached bigint)
 LANGUAGE sql
 STABLE
AS $function$
  with n as (
    select
      case
        when length(regexp_replace(k.phone_number, '\D', '', 'g')) = 11
             and left(regexp_replace(k.phone_number, '\D', '', 'g'), 1) = '1'
          then substr(regexp_replace(k.phone_number, '\D', '', 'g'), 2, 3)
        when length(regexp_replace(k.phone_number, '\D', '', 'g')) = 10
          then left(regexp_replace(k.phone_number, '\D', '', 'g'), 3)
        else null
      end as npa,
      k.answered_at,
      k.talk_seconds,
      k.duration
    from calls k
    where k.created_at >= p_since
  )
  select n.npa, count(*)::bigint,
         count(*) filter (where n.answered_at is not null)::bigint,
         count(*) filter (where coalesce(n.talk_seconds, 0) > 0)::bigint,
         count(*) filter (
           where not (n.answered_at is null and coalesce(n.duration, 0) = 0)
         )::bigint
  from n where n.npa is not null
  group by n.npa;
$function$;
