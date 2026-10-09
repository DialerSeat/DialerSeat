-- The Balance app's totals, summed where the rows are (lib/balanceAccounting).
--
-- Done in SQL because 30 days is ~2,500 balance readings and ~12,000 call.cost
-- records, and a REST read is capped at the project's max-rows setting: a
-- capped read would not error, it would quietly sum the first page.
--
-- Settlement credits: increases landing in the first SETTLEMENT minutes of an
-- hour, which is when Telnyx returns what it over-reserved. Every other
-- increase is counted as money added.

create or replace function public.balance_accounting_inputs(
  p_since timestamptz,
  p_settlement_minutes integer default 5
)
returns table(
  snapshots bigint,
  balance_start numeric,
  balance_end numeric,
  gross_out numeric,
  settlement_credits numeric,
  deposits numeric,
  call_cost numeric,
  call_legs bigint,
  amd_legs bigint
)
language sql
stable
set search_path to 'public', 'pg_temp'
as $$
  with s as (
    select at, balance::numeric as v,
           lag(balance::numeric) over (order by at) as pv
    from telnyx_balance_snapshots
    where at >= p_since and balance is not null
  ),
  d as (
    select at, v - pv as delta from s where pv is not null
  )
  select
    (select count(*) from s),
    (select v from s order by at asc limit 1),
    (select v from s order by at desc limit 1),
    coalesce((select sum(-delta) from d where delta < 0), 0),
    coalesce((select sum(delta) from d where delta > 0
              and extract(minute from at at time zone 'UTC') < p_settlement_minutes), 0),
    coalesce((select sum(delta) from d where delta > 0
              and extract(minute from at at time zone 'UTC') >= p_settlement_minutes), 0),
    coalesce((select sum(cost) from telnyx_ledger_records
              where record_type = 'call.cost' and capture_window = 'webhook'
                and occurred_at >= p_since), 0),
    (select count(*) from telnyx_ledger_records
     where record_type = 'call.cost' and capture_window = 'webhook'
       and occurred_at >= p_since),
    (select count(*) from calls where created_at >= p_since and amd_result is not null);
$$;

revoke all on function public.balance_accounting_inputs(timestamptz, integer) from public, anon, authenticated;
grant execute on function public.balance_accounting_inputs(timestamptz, integer) to service_role;
