-- The map's ACTIVE filter treated any answered call older than 10 minutes as
-- over, so a long conversation (51 minutes on 13 Nov 2026) dropped off ACTIVE
-- at minute 10. It now reads the carrier's hang-up cause instead: a call is
-- over once a hangup is recorded (including the watchdog's
-- orphaned_no_hangup_event), not after an arbitrary age. Adding a column to
-- RETURNS TABLE needs a drop and recreate; execute stays granted to everyone,
-- as before.
drop function if exists public.ops_map_feed(integer, text);

create function public.ops_map_feed(p_limit integer default 60, p_disposition text default null::text)
 returns table(call_id uuid, at timestamp with time zone, agent text, agent_country text, agent_region text, pool_number text, phone text, duration integer, talk_seconds integer, answered boolean, disposition text, amd_result text, amd_requested boolean, dial_source text, dialer_mode text, campaign text, recording_status text, hangup_cause text)
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
    k.recording_status,
    k.hangup_cause
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

-- Applied as a second step the same day: p_open_only returns every answered
-- call with no hangup, duration or disposition yet (inside Telnyx's four-hour
-- leg maximum), so the map can show a long conversation that has fallen out
-- of the newest-N feed. The two-argument version is replaced; callers using
-- named arguments are unaffected.
drop function if exists public.ops_map_feed(integer, text);
-- (see the applied migration ops_map_feed_open_calls for the full body: it is
-- the function above with p_open_only boolean default false added and
--   and (not p_open_only or (k.answered_at is not null and k.hangup_cause is null
--        and coalesce(k.duration, 0) = 0 and k.disposition is null
--        and k.created_at > now() - interval '4 hours 10 minutes'))
-- appended to the where clause.)
