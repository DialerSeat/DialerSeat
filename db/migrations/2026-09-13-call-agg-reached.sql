-- ---- call_agg_by_day_campaign gains a `reached` column ------------------
--
-- Two team-owner surfaces divide by this function's `calls`: the tiles on the
-- teams page, and the contact and conversion rates on an agent's card. Both
-- denominators included the dead-socket rows — a lead leg created, torn down
-- before it rang, recorded NO_ANSWER against somebody never called — which are
-- 7,117 of the 9,007 calls on file.
--
-- Those rows can never reach the numerator, because their disposition is
-- NO_ANSWER and neither the contact nor the conversion set contains it. All
-- they ever did was inflate the bottom of the fraction, so every rate an owner
-- read about an agent was understated, by different amounts per agent
-- depending on how much of their history predates the fix.
--
-- `calls` is deliberately unchanged: those dials were really attempted and
-- really billed, so dial counts and cost keep them. `reached` is added
-- alongside as the honest denominator.
--
-- The test matches lib/dialOutcome.ts, no answer and no duration. The two are
-- kept in step by hand, since one is Postgres and one is TypeScript.
--
-- Dropped and recreated rather than replaced: adding an OUT column changes the
-- row type, which CREATE OR REPLACE refuses. Both statements are in one
-- migration, so there is no window where the function is missing.

DROP FUNCTION IF EXISTS public.call_agg_by_day_campaign(uuid[], timestamp with time zone, timestamp with time zone, text);

CREATE FUNCTION public.call_agg_by_day_campaign(
  p_campaign_ids uuid[],
  p_since timestamp with time zone,
  p_until timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_agent text DEFAULT NULL::text
)
 RETURNS TABLE(day date, hour_of_day integer, campaign_id uuid, disposition text,
               calls bigint, talk_seconds bigint, reached bigint)
 LANGUAGE sql
 STABLE
AS $function$
  select
    (c.created_at at time zone 'UTC')::date as day,
    extract(hour from c.created_at at time zone 'UTC')::int as hour_of_day,
    c.campaign_id,
    coalesce(c.disposition, '') as disposition,
    count(*)::bigint as calls,
    coalesce(sum(greatest(c.talk_seconds, 0)), 0)::bigint as talk_seconds,
    count(*) filter (
      where not (c.answered_at is null and coalesce(c.duration, 0) = 0)
    )::bigint as reached
  from calls c
  where c.campaign_id = any(p_campaign_ids)
    and c.created_at >= p_since
    and (p_until is null or c.created_at <= p_until)
    and (p_agent is null or c.user_id = p_agent)
  group by 1, 2, 3, 4;
$function$;
