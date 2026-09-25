-- =============================================================================
-- CALL LOGS SAY WHICH POOL NUMBER RANG
-- =============================================================================
-- The feed showed where the agent was and where the lead was, but not the
-- number the lead actually saw. That is the one identifier a "why is this
-- number being flagged" question starts from, and it was the only part of the
-- call not on screen (Joshua, 25 Sept 2026).
--
-- calls.pool_number_id -> phone_numbers.phone_number. Null on the ~5% of calls
-- placed before a pool existed or through the TELNYX_PHONE_NUMBER fallback;
-- those print a dash rather than a guess.
--
-- DROP first: CREATE OR REPLACE cannot add a column to a RETURNS TABLE.
-- =============================================================================

drop function if exists public.ops_map_feed(integer);

create function public.ops_map_feed(p_limit integer default 60)
returns table(
  call_id uuid, at timestamp with time zone, agent text,
  agent_country text, agent_region text,
  pool_number text,
  phone text, duration integer, talk_seconds integer, answered boolean,
  disposition text, amd_result text, amd_requested boolean,
  dial_source text, campaign text, recording_status text
)
language sql
stable
set search_path to 'public', 'pg_temp'
as $function$
  select
    k.id,
    k.created_at,
    coalesce(
      nullif(trim(concat_ws(' ', u.first_name, u.last_name)), ''),
      u.username, u.email, 'unknown'
    ),
    pv.country,
    pv.region,
    pn.phone_number,
    k.phone_number,
    k.duration,
    k.talk_seconds,
    (k.answered_at is not null),
    k.disposition,
    k.amd_result,
    k.amd_requested,
    k.dial_source,
    c.name,
    k.recording_status
  from calls k
  left join users u on u.clerk_id = k.user_id
  -- Where they were when this call was placed, not where they are now.
  left join lateral (
    select p.country, p.region
    from page_views p
    where p.clerk_id = k.user_id
      and p.created_at <= k.created_at
    order by p.created_at desc
    limit 1
  ) pv on true
  left join phone_numbers pn on pn.id = k.pool_number_id
  left join campaigns c on c.id = k.campaign_id
  order by k.created_at desc
  limit p_limit;
$function$;

-- Dropping a function drops its grants with it. These are the two the old one
-- carried; the route calls it as service_role.
grant execute on function public.ops_map_feed(integer) to service_role;
grant execute on function public.ops_map_feed(integer) to authenticated;
