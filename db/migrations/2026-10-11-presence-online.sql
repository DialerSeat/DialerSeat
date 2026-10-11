-- The Map's "online" no longer needs an active subscription.
--
-- Online used to mean one thing: an agent_sessions heartbeat in the last 90s.
-- Only the dialer sends that heartbeat, and only for an active plan (it is
-- also the predictive engine), so anybody without one could be signed in and
-- using the dashboard and never show online or produce "is online".
--
-- Every signed-in page now pings /api/presence, which stamps
-- users.last_active_at. Online is the heartbeat OR that stamp, same window.
-- agent_sessions is untouched: it still means "at the dialer", and the
-- dialer's own logic (seats, watchdog, predictive) reads only that.

alter table public.users
  add column if not exists last_active_at timestamptz,
  add column if not exists presence_notified_at timestamptz;

-- ops_map: 'online' mode and online_count.
create or replace function public.ops_map(p_mode text default 'all'::text, p_online_seconds integer default 90)
 returns table(country text, region text, user_count bigint, online_count bigint, names text[])
 language sql
 stable
 set search_path to 'public', 'pg_temp'
as $function$
  with pv_loc as (
    select distinct on (pv.clerk_id) pv.clerk_id, pv.country, pv.region
    from page_views pv where pv.clerk_id is not null
    order by pv.clerk_id, pv.created_at desc
  ),
  sess as (
    select a.user_id, a.country, a.region,
           (a.last_heartbeat > now() - make_interval(secs => p_online_seconds)) as is_online
    from agent_sessions a
  ),
  latest_sub as (
    select distinct on (s.user_id) s.user_id, s.status, s.cancel_at_period_end, s.paused_at
    from subscriptions s
    order by s.user_id, s.created_at desc
  ),
  sel as (
    select u.id, u.clerk_id,
           coalesce(nullif(trim(concat_ws(' ', u.first_name, u.last_name)), ''),
                    u.username, u.email, u.clerk_id) as label,
           coalesce(u.last_active_at > now() - make_interval(secs => p_online_seconds), false) as present
    from users u
    where u.is_admin is not true
      and (
        p_mode = 'all'
        or (p_mode = 'subscribed'
            and coalesce(u.exclude_from_analytics, false) = false
            and exists (
              select 1 from latest_sub ls
              where ls.user_id = u.clerk_id
                and ls.status = 'active'
                and coalesce(ls.cancel_at_period_end, false) = false
                and ls.paused_at is null))
        or (p_mode = 'online' and (
              u.last_active_at > now() - make_interval(secs => p_online_seconds)
              or exists (
                select 1 from agent_sessions a2
                where a2.user_id = u.id
                  and a2.last_heartbeat > now() - make_interval(secs => p_online_seconds))))
      )
  ),
  placed as (
    select s.label,
           coalesce(se.country, pv.country) as country,
           coalesce(se.region,  pv.region)  as region,
           (coalesce(se.is_online, false) or s.present) as is_online
    from sel s
    left join sess   se on se.user_id  = s.id
    left join pv_loc pv on pv.clerk_id = s.clerk_id
  )
  select p.country, p.region,
         count(*)::bigint,
         count(*) filter (where p.is_online)::bigint,
         array_agg(p.label order by p.label)
  from placed p
  group by p.country, p.region;
$function$;

-- ops_map_people: the People tab's online flag and ordering.
create or replace function public.ops_map_people(p_online_seconds integer default 90)
 returns table(clerk_id text, label text, username text, email text, joined timestamp with time zone, country text, region text, device text, dialer_state text, dialer_mode text, online boolean, last_heartbeat timestamp with time zone, status text, plan text, seat_payer text, seat_team text, calls bigint, answered bigint, last_call timestamp with time zone, campaigns bigint, leads bigint, reached bigint)
 language sql
 stable
 set search_path to 'public', 'pg_temp'
as $function$
  with pv_loc as (
    select distinct on (pv.clerk_id) pv.clerk_id, pv.country, pv.region
    from page_views pv where pv.clerk_id is not null
    order by pv.clerk_id, pv.created_at desc
  ),
  sub as (
    select distinct on (s.user_id) s.user_id, s.status, s.plan
    from subscriptions s order by s.user_id, s.created_at desc
  ),
  seat as (
    select distinct on (tm.user_id)
      tm.user_id,
      coalesce(nullif(trim(concat_ws(' ', ow.first_name, ow.last_name)), ''),
               ow.username, ow.email) as payer,
      t.name as team_name
    from team_members tm
    join teams t on t.id = tm.team_id
    left join users ow on ow.clerk_id = t.owner_id
    where tm.billing_override = 'owner'
      and tm.status = 'active'
      and tm.removed_at is null
    order by tm.user_id, tm.created_at desc
  )
  select
    u.clerk_id,
    coalesce(nullif(trim(concat_ws(' ', u.first_name, u.last_name)), ''),
             u.username, u.email, u.clerk_id),
    u.username, u.email, u.created_at,
    coalesce(a.country, pv.country),
    coalesce(a.region,  pv.region),
    a.device, a.state, a.dialer_mode,
    (coalesce(a.last_heartbeat > now() - make_interval(secs => p_online_seconds), false)
      or coalesce(u.last_active_at > now() - make_interval(secs => p_online_seconds), false)),
    a.last_heartbeat,
    sub.status, sub.plan,
    seat.payer, seat.team_name,
    (select count(*) from calls k where k.user_id = u.clerk_id)::bigint,
    (select count(*) from calls k where k.user_id = u.clerk_id and k.answered_at is not null)::bigint,
    (select max(k.created_at) from calls k where k.user_id = u.clerk_id),
    (select count(*) from campaigns c where c.user_id = u.clerk_id)::bigint,
    (select count(*) from leads l join campaigns c2 on c2.id = l.campaign_id
      where c2.user_id = u.clerk_id)::bigint,
    (select count(*) from calls k
      where k.user_id = u.clerk_id
        and not (k.answered_at is null and coalesce(k.duration, 0) = 0))::bigint
  from users u
  left join agent_sessions a on a.user_id = u.id
  left join pv_loc pv on pv.clerk_id = u.clerk_id
  left join sub on sub.user_id = u.clerk_id
  left join seat on seat.user_id = u.clerk_id
  where u.is_admin is not true
  order by
    (coalesce(a.last_heartbeat > now() - make_interval(secs => p_online_seconds), false)
      or coalesce(u.last_active_at > now() - make_interval(secs => p_online_seconds), false)) desc,
    (select max(k.created_at) from calls k where k.user_id = u.clerk_id) desc nulls last,
    u.created_at desc;
$function$;

-- ops_map_place: a place's people list. Only the online flag changes.
create or replace function public.ops_map_place(p_country text, p_region text, p_since timestamp with time zone, p_online_seconds integer default 90)
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
      from page_views pv
      where pv.is_admin = false
        and pv.created_at >= p_since
        and pv.country is not distinct from p_country
        and pv.region  is not distinct from p_region
    ),

    'topPaths', coalesce((
      select jsonb_agg(jsonb_build_object('path', t.path, 'views', t.views) order by t.views desc)
      from (
        select pv.path, count(*) as views from page_views pv
        where pv.is_admin = false and pv.created_at >= p_since
          and pv.country is not distinct from p_country
          and pv.region  is not distinct from p_region
        group by pv.path order by 2 desc limit 8
      ) t
    ), '[]'::jsonb),

    'sources', coalesce((
      select jsonb_agg(jsonb_build_object('source', t.src, 'views', t.views) order by t.views desc)
      from (
        select coalesce(pv.utm_source, pv.referrer_host, 'direct') as src, count(*) as views
        from page_views pv
        where pv.is_admin = false and pv.created_at >= p_since
          and pv.country is not distinct from p_country
          and pv.region  is not distinct from p_region
        group by 1 order by 2 desc limit 6
      ) t
    ), '[]'::jsonb)
  );
$function$;
