-- Label the earlier attempts of 2x/3x sequences that were left with no
-- disposition (1 Oct 2026).
--
-- The dialer sends one NO_ANSWER when a sequence ends, and it lands on the
-- newest call only, so every earlier unanswered attempt stayed blank. From
-- now on /api/calls/outbound labels the earlier attempt when the redial is
-- placed; this applies the same rule to history.
--
-- Same conditions as the code: nobody picked up, no label yet, the carrier
-- ended it, the agent did not end it, and the same agent dialled the same
-- lead again within five minutes.
--
-- Reversible: the ids changed are kept in calls_disposition_backfill_20261001.
--   update calls set disposition = null
--   where id in (select id from calls_disposition_backfill_20261001);

create table if not exists calls_disposition_backfill_20261001 (
  id uuid primary key,
  backfilled_at timestamptz not null default now()
);

with targets as (
  select c.id from calls c
  where c.answered_at is null
    and c.disposition is null
    and c.ended_by_agent_at is null
    and c.hangup_cause is not null
    and c.lead_id is not null
    and exists (
      select 1 from calls n
      where n.lead_id = c.lead_id
        and n.user_id = c.user_id
        and n.created_at > c.created_at
        and n.created_at < c.created_at + interval '5 minutes'
    )
), kept as (
  insert into calls_disposition_backfill_20261001 (id)
  select id from targets
  on conflict (id) do nothing
  returning id
)
update calls set disposition = 'NO_ANSWER'
where id in (select id from kept);
