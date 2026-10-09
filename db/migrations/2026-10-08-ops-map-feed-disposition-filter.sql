-- The Map's live calls gained a CLOSED tab. Closed calls are rare (9 ever by
-- 8 Oct 2026), so filtering only the latest N loaded calls would nearly always
-- show an empty table. The feed now takes an optional disposition and returns
-- the latest calls WITH that disposition, however far back they are.
--
-- Same columns, same order, same grants as before. Dropped and recreated
-- rather than overloaded: two versions would make a call with only p_limit
-- ambiguous to PostgREST.

drop function if exists public.ops_map_feed(integer);

create function public.ops_map_feed(p_limit integer default 60, p_disposition text default null)
 returns table(call_id uuid, at timestamp with time zone, agent text, agent_country text, agent_region text, pool_number text, phone text, duration integer, talk_seconds integer, answered boolean, disposition text, amd_result text, amd_requested boolean, dial_source text, dialer_mode text, campaign text, recording_status text)
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
    k.dialer_mode,
    c.name,
    k.recording_status
  from calls k
  left join users u on u.clerk_id = k.user_id
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
  where p_disposition is null or k.disposition = p_disposition
  order by k.created_at desc
  limit p_limit;
$function$;

grant execute on function public.ops_map_feed(integer, text) to public, anon, authenticated, service_role;
