-- ─────────────────────────────────────────────────────────────────────────
-- LIKELY REAL VISITORS
--
-- The pageview endpoint only drops bots that name themselves. A crawler running
-- a normal browser is counted as a person and lights up the admin map: on
-- 6 Nov 2026 thirty "visitors" arrived in one minute, each on one page for
-- about 0.2 seconds.
--
-- This changes no data. The rule is a view over what is already stored, and
-- every function takes p_likely_real, defaulting to false, so anything that
-- does not ask gets exactly what it got before.
--
-- Within the period being looked at, a visitor counts if any of these is true:
--   - they have an account or were signed in
--   - they saw 2 or more different pages
--   - they spent 5 seconds or more in total
--   - they arrived from somewhere (a referrer or a utm tag)
-- What is left out is a direct visit to one page, under 5 seconds or with no
-- time recorded. Some real people bounce that way; this is "likely", not proof.
-- ─────────────────────────────────────────────────────────────────────────

create or replace function public.page_view_likely_real(p_since timestamptz)
returns setof text
language sql
stable
set search_path to 'public', 'pg_temp'
as $function$
  select coalesce(pv.visitor_id, pv.visitor_hash)
  from page_views pv
  where pv.created_at >= p_since
    and pv.is_admin = false
    and coalesce(pv.visitor_id, pv.visitor_hash) is not null
  group by 1
  having bool_or(pv.clerk_id is not null or coalesce(pv.is_authed, false))
      or count(distinct pv.path) >= 2
      or sum(coalesce(pv.dwell_ms, 0)) >= 5000
      or bool_or(pv.referrer_host is not null or pv.utm_source is not null);
$function$;

-- Dropped rather than replaced: adding a defaulted argument with CREATE OR
-- REPLACE would leave two overloads, and a call naming only the old arguments
-- would then be ambiguous.
drop function if exists public.ops_map_visitors(timestamptz);
drop function if exists public.ops_map_visitor_pulse(timestamptz, integer);
drop function if exists public.pv_individuals(timestamptz, timestamptz, integer);
drop function if exists public.ops_map_place(text, text, timestamptz, integer);

create function public.ops_map_visitors(p_since timestamptz, p_likely_real boolean default false)
returns table(country text, region text, visitors bigint, views bigint)
language sql
stable
set search_path to 'public', 'pg_temp'
as $function$
  select pv.country, pv.region,
         count(distinct coalesce(pv.visitor_id, pv.visitor_hash))::bigint,
         count(*)::bigint
  from page_views pv
  where pv.created_at >= p_since
    and pv.is_admin = false
    and (not p_likely_real
         or coalesce(pv.visitor_id, pv.visitor_hash) in (select public.page_view_likely_real(p_since)))
  group by pv.country, pv.region;
$function$;

create function public.ops_map_visitor_pulse(p_since timestamptz, p_buckets integer default 24, p_likely_real boolean default false)
returns table(bucket timestamptz, new_visitors bigint, returning_visitors bigint, views bigint)
language sql
stable
set search_path to 'public', 'pg_temp'
as $function$
  with span as (
    select p_since as t0, now() as t1,
           greatest(1, extract(epoch from (now() - p_since)) / greatest(p_buckets, 1)) as secs
  ),
  ident as (
    select coalesce(pv.visitor_id, pv.visitor_hash) as vid,
           min(pv.created_at) as first_ever
    from page_views pv
    where pv.is_admin = false
      and coalesce(pv.visitor_id, pv.visitor_hash) is not null
    group by 1
  ),
  hits as (
    select coalesce(pv.visitor_id, pv.visitor_hash) as vid,
           pv.created_at,
           to_timestamp(
             floor(extract(epoch from pv.created_at) / (select secs from span))
             * (select secs from span)
           ) as bucket
    from page_views pv
    where pv.is_admin = false
      and pv.created_at >= p_since
      and coalesce(pv.visitor_id, pv.visitor_hash) is not null
      and (not p_likely_real
           or coalesce(pv.visitor_id, pv.visitor_hash) in (select public.page_view_likely_real(p_since)))
  )
  select h.bucket,
         count(distinct h.vid) filter (
           where i.first_ever >= (select t0 from span)
             and i.first_ever < h.bucket + make_interval(secs => (select secs from span))
             and i.first_ever >= h.bucket
         )::bigint,
         count(distinct h.vid) filter (where i.first_ever < (select t0 from span))::bigint,
         count(*)::bigint
  from hits h
  join ident i on i.vid = h.vid
  group by h.bucket
  order by h.bucket;
$function$;

create function public.pv_individuals(p_since timestamptz, p_until timestamptz default null, p_limit integer default 100, p_likely_real boolean default false)
returns table(visitor_id text, clerk_id text, email text, views bigint, active_days bigint, first_seen timestamptz, last_seen timestamptz, first_source text, first_path text, signed_up boolean)
language sql
stable
set search_path to 'public', 'pg_temp'
as $function$
  with base as (
    select * from page_views
    where created_at >= p_since
      and (p_until is null or created_at <= p_until)
      and is_admin = false
      and visitor_id is not null
      and (not p_likely_real or visitor_id in (select public.page_view_likely_real(p_since)))
  ),
  identity as (
    -- Any session in which this browser was signed in names the browser.
    select b.visitor_id, max(b.clerk_id) as clerk_id
    from base b where b.clerk_id is not null
    group by b.visitor_id
  ),
  firsts as (
    select distinct on (b.visitor_id)
      b.visitor_id,
      coalesce(b.utm_source, b.referrer_host) as first_source,
      b.path as first_path
    from base b
    order by b.visitor_id, b.created_at
  ),
  agg as (
    select b.visitor_id,
           count(*)::bigint as views,
           count(distinct (b.created_at at time zone 'UTC')::date)::bigint as active_days,
           min(b.created_at) as first_seen,
           max(b.created_at) as last_seen
    from base b group by b.visitor_id
  )
  select a.visitor_id,
         i.clerk_id,
         u.email,
         a.views, a.active_days, a.first_seen, a.last_seen,
         f.first_source, f.first_path,
         (i.clerk_id is not null) as signed_up
  from agg a
  left join identity i on i.visitor_id = a.visitor_id
  left join firsts   f on f.visitor_id = a.visitor_id
  left join users    u on u.clerk_id  = i.clerk_id
  order by a.last_seen desc
  limit p_limit;
$function$;

create function public.ops_map_place(p_country text, p_region text, p_since timestamptz, p_online_seconds integer default 90, p_likely_real boolean default false)
returns jsonb
language sql
stable
set search_path to 'public', 'pg_temp'
as $function$
  with pv_loc as (
    select distinct on (pv.clerk_id) pv.clerk_id, pv.country, pv.region
    from page_views pv where pv.clerk_id is not null
    order by pv.clerk_id, pv.created_at desc
  ),
  here_all as (
    select u.id, u.clerk_id, u.created_at as joined,
           coalesce(nullif(trim(concat_ws(' ', u.first_name, u.last_name)), ''),
                    u.username, u.email, u.clerk_id) as label,
           u.username, u.email,
           a.state as session_state, a.dialer_mode, a.device,
           (coalesce(a.last_heartbeat > now() - make_interval(secs => p_online_seconds), false)
             or coalesce(u.last_active_at > now() - make_interval(secs => p_online_seconds), false)) as online,
           a.last_heartbeat,
           u.last_active_at
    from users u
    left join agent_sessions a on a.user_id = u.id
    left join pv_loc pv on pv.clerk_id = u.clerk_id
    where u.is_admin is not true
      and coalesce(a.country, pv.country) is not distinct from p_country
      and coalesce(a.region,  pv.region)  is not distinct from p_region
  ),
  here as (
    select h.* from here_all h
    where h.joined >= p_since
       or (h.last_heartbeat is not null and h.last_heartbeat >= p_since)
       or (h.last_active_at is not null and h.last_active_at >= p_since)
       or exists (select 1 from calls k
                  where k.user_id = h.clerk_id and k.created_at >= p_since)
       or exists (select 1 from page_views pv2
                  where pv2.clerk_id = h.clerk_id and pv2.created_at >= p_since)
  ),
  place_views as (
    select pv.* from page_views pv
    where pv.is_admin = false
      and pv.created_at >= p_since
      and pv.country is not distinct from p_country
      and pv.region  is not distinct from p_region
      and (not p_likely_real
           or coalesce(pv.visitor_id, pv.visitor_hash) in (select public.page_view_likely_real(p_since)))
  )
  select jsonb_build_object(
    'people', coalesce((
      select jsonb_agg(x order by x->>'label')
      from (
        select jsonb_build_object(
          'label', h.label, 'username', h.username, 'email', h.email,
          'joined', h.joined, 'online', coalesce(h.online, false),
          'device', h.device, 'mode', h.dialer_mode, 'state', h.session_state,
          'lastHeartbeat', h.last_heartbeat,
          'status', (select s.status from subscriptions s
                     where s.user_id = h.clerk_id order by s.created_at desc limit 1),
          'plan',   (select s.plan from subscriptions s
                     where s.user_id = h.clerk_id order by s.created_at desc limit 1),
          'calls',  (select count(*) from calls k
                     where k.user_id = h.clerk_id and k.created_at >= p_since),
          'answered', (select count(*) from calls k
                       where k.user_id = h.clerk_id and k.created_at >= p_since
                         and k.answered_at is not null),
          'lastCall', (select max(k.created_at) from calls k
                       where k.user_id = h.clerk_id and k.created_at >= p_since),
          'campaigns', (select count(*) from campaigns c where c.user_id = h.clerk_id),
          'leads', (select count(*) from leads l join campaigns c2 on c2.id = l.campaign_id
                    where c2.user_id = h.clerk_id)
        ) as x
        from here h
      ) q
    ), '[]'::jsonb),

    'peopleTotal', (select count(*) from here_all),

    'traffic', (
      select jsonb_build_object(
        'visitors', count(distinct coalesce(pv.visitor_id, pv.visitor_hash)),
        'views', count(*),
        'authed', count(*) filter (where pv.is_authed),
        'firstSeen', min(pv.created_at),
        'lastSeen', max(pv.created_at),
        'signups', (select count(*) from here_all),
        'signupsInRange', (select count(*) from here_all h where h.joined >= p_since)
      )
      from place_views pv
    ),

    'topPaths', coalesce((
      select jsonb_agg(jsonb_build_object('path', t.path, 'views', t.views) order by t.views desc)
      from (
        select pv.path, count(*) as views from place_views pv
        group by pv.path order by 2 desc limit 8
      ) t
    ), '[]'::jsonb),

    'sources', coalesce((
      select jsonb_agg(jsonb_build_object('source', t.src, 'views', t.views) order by t.views desc)
      from (
        select coalesce(pv.utm_source, pv.referrer_host, 'direct') as src, count(*) as views
        from place_views pv
        group by 1 order by 2 desc limit 6
      ) t
    ), '[]'::jsonb)
  );
$function$;

notify pgrst, 'reload schema';
