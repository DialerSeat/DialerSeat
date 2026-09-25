-- Predictive v2 (docs/PREDICTIVE.md): one persistent agent seat per session,
-- rounds with per-lead 1x/2x/3x repeats, abandonment measured from calls.
-- Applied to production 2026-09-24 as migration predictive_v2_seat_and_rounds.

alter table public.agent_sessions
  add column if not exists predictive_seat_call_control_id text,
  add column if not exists predictive_seat_status text,
  add column if not exists predictive_seat_conference_id text,
  add column if not exists predictive_seat_placed_at timestamptz,
  add column if not exists predictive_seat_live_at timestamptz,
  add column if not exists predictive_seat_failures smallint not null default 0,
  add column if not exists predictive_tick_lock timestamptz,
  add column if not exists predictive_paused_until timestamptz;

alter table public.agent_sessions
  drop constraint if exists agent_sessions_predictive_seat_status_check;
alter table public.agent_sessions
  add constraint agent_sessions_predictive_seat_status_check
  check (predictive_seat_status is null or predictive_seat_status in ('placing', 'live'));

create index if not exists idx_agent_sessions_predictive_seat
  on public.agent_sessions (predictive_seat_call_control_id)
  where predictive_seat_call_control_id is not null;

create index if not exists idx_agent_sessions_predictive_conference
  on public.agent_sessions (predictive_seat_conference_id)
  where predictive_seat_conference_id is not null;

-- The abandon message plays at most once per call; this is the latch.
alter table public.calls
  add column if not exists abandon_message_at timestamptz;

-- One row per lead a predictive session has in play. Removed when the lead is
-- done (a person was reached, or its repeats are spent).
create table if not exists public.predictive_batch (
  session_id uuid not null references public.agent_sessions(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  campaign_id uuid not null,
  attempts smallint not null default 0,
  max_attempts smallint not null default 1,
  state text not null default 'waiting',
  last_call_id uuid,
  last_outcome text,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (session_id, lead_id),
  constraint predictive_batch_state_check check (state in ('ringing', 'waiting')),
  constraint predictive_batch_attempts_check check (attempts >= 0 and max_attempts between 1 and 3)
);

create index if not exists idx_predictive_batch_session_state
  on public.predictive_batch (session_id, state);
create index if not exists idx_predictive_batch_last_call
  on public.predictive_batch (last_call_id)
  where last_call_id is not null;

alter table public.predictive_batch enable row level security;

-- Claim leads owed a repeat, under exactly the rules a fresh claim uses
-- (claim_next_leads_for_campaign): dialable status, a phone, the runaway
-- breaker, and a claim that is free, stale, or already this session's.
create or replace function public.claim_predictive_repeats(p_session_id uuid, p_lead_ids uuid[])
returns setof public.leads
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  if p_lead_ids is null or array_length(p_lead_ids, 1) is null then
    return;
  end if;
  if array_length(p_lead_ids, 1) > 5 then
    raise exception 'at most 5 repeats per round, got %', array_length(p_lead_ids, 1);
  end if;

  return query
  with candidate as (
    select id
    from leads
    where id = any(p_lead_ids)
      and status in ('uncalled', 'no_answer')
      and phone is not null
      and phone != ''
      and coalesce(dial_attempts, 0) < 25
      and (
        claimed_at is null
        or claimed_by_session_id = p_session_id
        or claimed_at < (now() - interval '30 seconds')
      )
    for update skip locked
  ),
  claimed as (
    update leads
    set claimed_at = now(),
        claimed_by_session_id = p_session_id
    where id in (select id from candidate)
    returning leads.*
  )
  select * from claimed
  order by array_position(p_lead_ids, claimed.id);
end;
$function$;

-- The two numbers the abandonment rule is measured on, per campaign, plus the
-- human-answer rate that sets how many lines are safe.
create or replace function public.predictive_campaign_stats(p_campaign_ids uuid[])
returns table (
  campaign_id uuid,
  answered_30d bigint,
  abandoned_30d bigint,
  dials_14d bigint,
  humans_14d bigint
)
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select
    c.campaign_id,
    count(*) filter (
      where c.created_at >= now() - interval '30 days'
        and c.answered_at is not null
        and coalesce(c.amd_result, '') not in ('machine', 'fax_detected')
        and c.disposition is distinct from 'AGENT_LEG_FAILED'
    ) as answered_30d,
    count(*) filter (
      where c.created_at >= now() - interval '30 days'
        and c.was_abandoned is true
    ) as abandoned_30d,
    count(*) filter (
      where c.created_at >= now() - interval '14 days'
        and c.disposition is distinct from 'AGENT_LEG_FAILED'
    ) as dials_14d,
    count(*) filter (
      where c.created_at >= now() - interval '14 days'
        and c.answered_at is not null
        and coalesce(c.amd_result, '') not in ('machine', 'fax_detected')
        and c.disposition is distinct from 'AGENT_LEG_FAILED'
    ) as humans_14d
  from calls c
  where c.campaign_id = any(p_campaign_ids)
    and c.created_at >= now() - interval '30 days'
  group by c.campaign_id;
$function$;

revoke all on function public.claim_predictive_repeats(uuid, uuid[]) from public, anon, authenticated;
revoke all on function public.predictive_campaign_stats(uuid[]) from public, anon, authenticated;
