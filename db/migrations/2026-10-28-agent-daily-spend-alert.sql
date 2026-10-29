-- A warning when one agent's carrier spend for the day passes a threshold
-- ($3 to start, platform_config.agent_daily_spend_alert_usd). Joshua's call,
-- 28 Oct 2026: warn him and keep dialing, never stop the agent.
--
-- Spend is Telnyx's own itemised call.cost for every leg that agent caused:
--   the lead leg (calls.call_control_id),
--   the agent leg (calls.agent_call_control_id),
--   a predictive seat (call_events 'predictive_seat' placing),
--   and each of those legs' twin on the credential connection, found through
--   the shared call_session_id (on 27-28 Oct that matched 1,247 of 1,249),
-- plus detection at $0.002 per verdict, plus tax. call.cost arrives when a leg
-- ENDS, so a leg still up is not counted yet; the figure only ever rises.
--
-- The day is a US Eastern calendar day, the dialing day for these teams.

alter table public.platform_config
  add column if not exists agent_daily_spend_alert_usd numeric not null default 3;

alter table public.admin_notification_prefs
  add column if not exists agent_spend boolean not null default true;

create table if not exists public.agent_spend_alerts (
  user_id    text not null,
  day        date not null,
  spend_usd  numeric not null,
  dials      integer not null,
  alerted_at timestamptz not null default now(),
  primary key (user_id, day)
);
alter table public.agent_spend_alerts enable row level security;

create or replace function public.agent_spend_for_day(
  p_day date,
  p_amd_usd numeric default 0.002,
  p_tax_rate numeric default 0.058
)
returns table(user_id text, dials bigint, call_cost numeric, amd_legs bigint, spend_usd numeric)
language sql
stable
set search_path to 'public', 'pg_temp'
as $$
  with bounds as (
    select (p_day::timestamp at time zone 'America/New_York') as t0,
           ((p_day + 1)::timestamp at time zone 'America/New_York') as t1
  ),
  c as (
    select k.user_id, k.call_control_id, k.agent_call_control_id, k.amd_result
    from calls k, bounds b
    where k.created_at >= b.t0 and k.created_at < b.t1 and k.user_id is not null
  ),
  r as (
    select l.payload->>'call_control_id' as ccid, l.payload->>'call_session_id' as sess, l.cost
    from telnyx_ledger_records l, bounds b
    where l.record_type = 'call.cost' and l.capture_window = 'webhook'
      and l.occurred_at >= b.t0 and l.occurred_at < b.t1 + interval '2 hours'
  ),
  owned as (
    select user_id, call_control_id as ccid from c where call_control_id is not null
    union
    select user_id, agent_call_control_id from c where agent_call_control_id is not null
    union
    select e.user_id, e.call_control_id
    from call_events e, bounds b
    where e.event_type = 'predictive_seat' and e.status = 'placing'
      and e.created_at >= b.t0 and e.created_at < b.t1 and e.user_id is not null
  ),
  -- Each session's owner, from the leg in it we placed; then every billed leg
  -- in that session (the leg itself and its twin) once.
  sess_owner as (
    select distinct on (r.sess) r.sess, o.user_id
    from r join owned o on o.ccid = r.ccid
    where r.sess is not null
    order by r.sess
  ),
  billed as (
    select distinct on (r.ccid) so.user_id, r.ccid, r.cost
    from r join sess_owner so on so.sess = r.sess
    order by r.ccid
  ),
  costs as (select user_id, sum(cost) as cost from billed group by user_id),
  dials as (
    select user_id, count(*) as dials, count(*) filter (where amd_result is not null) as amd
    from c group by user_id
  )
  select d.user_id, d.dials, coalesce(x.cost, 0), d.amd,
         round((coalesce(x.cost, 0) + d.amd * p_amd_usd) * (1 + p_tax_rate), 4)
  from dials d left join costs x on x.user_id = d.user_id;
$$;

revoke all on function public.agent_spend_for_day(date, numeric, numeric) from public, anon, authenticated;
grant execute on function public.agent_spend_for_day(date, numeric, numeric) to service_role;
