-- =============================================================================
-- EVERY CALL SAYS WHICH MODE PLACED IT
-- =============================================================================
-- Joshua, 25 Sept 2026: the live calls log should show the dialer mode
-- (power, predictive, progressive, manual, preview) left of the campaign.
--
-- calls had no mode. The server's copy lived only in the dialer's 'initiated'
-- call_event, and that was the CAMPAIGN's saved mode, which is not always what
-- the agent was dialing in: All Active and "let the agent choose" both let an
-- agent dial a campaign in another mode. From now on placeOutboundCall writes
-- the agent's live mode (agent_sessions.dialer_mode, which the heartbeat keeps
-- current), 'predictive' for a fan-out line and 'manual' for a campaign-less
-- dial.
--
-- Backfill, best available: 'predictive' for fan-out, 'manual' for a dial with
-- no lead and no campaign, otherwise the 'initiated' event's dialerMode.
-- Calls from before that event existed stay NULL and print a dash.
-- =============================================================================

alter table public.calls add column if not exists dialer_mode text;

comment on column public.calls.dialer_mode is
  'The mode this call was dialed in: preview, power, progressive, predictive or manual. Written by placeOutboundCall.';

update public.calls c
set dialer_mode = case
  when c.dial_source = 'controller_fanout' then 'predictive'
  when c.lead_id is null and c.campaign_id is null then 'manual'
  else (
    select e.detail->>'dialerMode'
    from public.call_events e
    where e.call_control_id = c.call_control_id
      and e.event_type = 'initiated'
      and e.source = 'dialer'
    order by e.created_at
    limit 1
  )
end
where c.dialer_mode is null
  and c.call_control_id is not null;

-- The live calls log reads the feed through this function.
drop function if exists public.ops_map_feed(integer);

create function public.ops_map_feed(p_limit integer default 60)
returns table(
  call_id uuid, at timestamp with time zone, agent text,
  agent_country text, agent_region text,
  pool_number text,
  phone text, duration integer, talk_seconds integer, answered boolean,
  disposition text, amd_result text, amd_requested boolean,
  dial_source text, dialer_mode text, campaign text, recording_status text
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
    k.dialer_mode,
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

grant execute on function public.ops_map_feed(integer) to service_role;
grant execute on function public.ops_map_feed(integer) to authenticated;
