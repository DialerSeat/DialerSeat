-- The Map's ACTIVE SUB mode counted anyone with ANY subscription row whose
-- status was 'active'. Stripe reports a paused subscription as 'active', and
-- one set to cancel stays 'active' until its period ends, so on 8 Oct 2026 the
-- map showed 6 active subscribers when, by the Overview's own rule, there were
-- none: 4 paused, 1 cancelling, 1 internal test account.
--
-- It now uses the same rule as the Overview (lib/subscriptionStatus
-- isSubscriptionTrulyActive, and app/api/admin/users): each person's NEWEST
-- subscription row, status 'active', not set to cancel, not paused, and not an
-- account excluded from analytics. Everything else in the function is as it was.

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
                    u.username, u.email, u.clerk_id) as label
    from users u
    where u.is_admin is not true
      and (
        p_mode = 'all'
        -- The Overview's "active": newest row active, not cancelling, not
        -- paused, and a real customer rather than a test account.
        or (p_mode = 'subscribed'
            and coalesce(u.exclude_from_analytics, false) = false
            and exists (
              select 1 from latest_sub ls
              where ls.user_id = u.clerk_id
                and ls.status = 'active'
                and coalesce(ls.cancel_at_period_end, false) = false
                and ls.paused_at is null))
        or (p_mode = 'online' and exists (
              select 1 from agent_sessions a2
              where a2.user_id = u.id
                and a2.last_heartbeat > now() - make_interval(secs => p_online_seconds)))
      )
  ),
  placed as (
    select s.label,
           coalesce(se.country, pv.country) as country,
           coalesce(se.region,  pv.region)  as region,
           coalesce(se.is_online, false)    as is_online
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
