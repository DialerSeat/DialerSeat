-- ---- ops_map_people gains a `reached` column ----------------------------
--
-- The person card on the ops map divides answered by calls, and `calls`
-- includes the dead-socket rows: a lead leg created, torn down before it rang,
-- recorded NO_ANSWER against somebody who was never called.
--
-- For the account the original bug was reported against, 5,070 of 5,188 dials
-- never rang. Their card read 2.0%. Their real answer rate, over the calls that
-- reached a phone, is 88.1% — the best on the platform. Every judgement anybody
-- made about that agent from this screen was inverted.
--
--   Karol Amado     5,188 dials, 118 rang    2.0% shown -> 88.1%
--   Chris Harbison  2,178 dials, 797 rang    9.8% shown -> 26.7%
--   Tyje Christmas    745 dials, 459 rang   25.8% shown -> 41.8%
--
-- `calls` is unchanged: those dials were really attempted and really billed.
-- `reached` is the denominator the rate uses. The test matches
-- lib/dialOutcome.ts — no answer and no duration — and the two are kept in
-- step by hand, since one is Postgres and one is TypeScript.
--
-- Dropped and recreated rather than replaced, since adding an OUT column
-- changes the function's row type and CREATE OR REPLACE refuses it. Both
-- statements are in one migration, so there is no window where the function
-- does not exist.

DROP FUNCTION IF EXISTS public.ops_map_people(integer);

CREATE FUNCTION public.ops_map_people(p_online_seconds integer DEFAULT 90)
 RETURNS TABLE(clerk_id text, label text, username text, email text,
               joined timestamp with time zone, country text, region text,
               device text, dialer_state text, dialer_mode text, online boolean,
               last_heartbeat timestamp with time zone, status text, plan text,
               seat_payer text, seat_team text, calls bigint, answered bigint,
               last_call timestamp with time zone, campaigns bigint, leads bigint,
               reached bigint)
 LANGUAGE sql
 STABLE
AS $function$
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
    coalesce(a.last_heartbeat > now() - make_interval(secs => p_online_seconds), false),
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
    coalesce(a.last_heartbeat > now() - make_interval(secs => p_online_seconds), false) desc,
    (select max(k.created_at) from calls k where k.user_id = u.clerk_id) desc nulls last,
    u.created_at desc;
$function$;
