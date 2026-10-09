-- The Storage app's CLEAR buttons (app/api/admin/db-capacity, POST).
--
-- "Safe to delete" names tables, but every one of them still has a reader for
-- its recent rows, so a clear never empties a table. Each target keeps exactly
-- what something still depends on, and the rules live here, in one place, so
-- the preview and the delete cannot disagree:
--
--   call_events    drop monthly partitions whose month ended more than 30 days
--                  ago. Never the current month, a future month, or the
--                  default partition. Dropping returns the space at once.
--   stripe_events  processed or skipped rows received more than 30 days ago.
--                  Stripe retries for 3 days; failed rows are kept so a retry
--                  still finds them.
--   telnyx_events  rows past the 24 hour retry window, the same rule as the
--                  10 minute sweep (lib/telnyxIdempotency), on demand.
--   page_views     rows older than 90 days, except each signed-in account's
--                  newest view: the Map places people from it.
--
-- Service role only. The admin route is the only caller.

create or replace function public.storage_clear_preview()
returns table(target text, rows_to_clear bigint, bytes_estimate bigint, detail text)
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  cutoff_month date := (date_trunc('month', now() - interval '30 days'))::date;
begin
  -- Partitions named call_events_YYYY_MM whose month ENDED more than 30 days
  -- ago: the month after it starts on or before now() - 30 days.
  return query
    select 'call_events'::text,
           coalesce(sum(c.reltuples)::bigint, 0),
           coalesce(sum(pg_total_relation_size(c.oid))::bigint, 0),
           coalesce(string_agg(c.relname::text, ', ' order by c.relname), '')
    from pg_inherits i
    join pg_class c on c.oid = i.inhrelid
    join pg_class p on p.oid = i.inhparent
    where p.relname = 'call_events'
      and c.relname ~ '^call_events_[0-9]{4}_[0-9]{2}$'
      and (to_date(substring(c.relname from 13), 'YYYY_MM') + interval '1 month')::date <= cutoff_month;

  return query
    select 'stripe_events'::text, count(*)::bigint, null::bigint, 'older than 30 days, processed or skipped'::text
    from stripe_events
    where received_at < now() - interval '30 days'
      and processing_status in ('processed', 'skipped');

  return query
    select 'telnyx_events'::text, count(*)::bigint, null::bigint, 'older than 24 hours'::text
    from telnyx_events
    where created_at < now() - interval '24 hours';

  return query
    select 'page_views'::text, count(*)::bigint, null::bigint,
           'older than 90 days, keeping each account''s newest view'::text
    from page_views pv
    where pv.created_at < now() - interval '90 days'
      and not exists (
        select 1 from (
          select distinct on (x.clerk_id) x.id
          from page_views x where x.clerk_id is not null
          order by x.clerk_id, x.created_at desc
        ) newest where newest.id = pv.id);
end;
$$;

create or replace function public.storage_clear(p_target text)
returns table(rows_cleared bigint, detail text)
language plpgsql
volatile
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  cutoff_month date := (date_trunc('month', now() - interval '30 days'))::date;
  r record;
  n bigint := 0;
  names text := '';
begin
  if p_target = 'call_events' then
    for r in
      select c.relname::text as relname, c.reltuples::bigint as est
      from pg_inherits i
      join pg_class c on c.oid = i.inhrelid
      join pg_class p on p.oid = i.inhparent
      where p.relname = 'call_events'
        and c.relname ~ '^call_events_[0-9]{4}_[0-9]{2}$'
        and (to_date(substring(c.relname from 13), 'YYYY_MM') + interval '1 month')::date <= cutoff_month
      order by c.relname
    loop
      execute format('drop table public.%I', r.relname);
      n := n + greatest(r.est, 0);
      names := names || case when names = '' then '' else ', ' end || r.relname;
    end loop;
    return query select n, names;

  elsif p_target = 'stripe_events' then
    delete from stripe_events
    where received_at < now() - interval '30 days'
      and processing_status in ('processed', 'skipped');
    get diagnostics n = row_count;
    return query select n, 'stripe_events'::text;

  elsif p_target = 'telnyx_events' then
    delete from telnyx_events where created_at < now() - interval '24 hours';
    get diagnostics n = row_count;
    return query select n, 'telnyx_events'::text;

  elsif p_target = 'page_views' then
    delete from page_views pv
    where pv.created_at < now() - interval '90 days'
      and not exists (
        select 1 from (
          select distinct on (x.clerk_id) x.id
          from page_views x where x.clerk_id is not null
          order by x.clerk_id, x.created_at desc
        ) newest where newest.id = pv.id);
    get diagnostics n = row_count;
    return query select n, 'page_views'::text;

  else
    raise exception 'unknown storage target: %', p_target;
  end if;
end;
$$;

revoke all on function public.storage_clear_preview() from public, anon, authenticated;
revoke all on function public.storage_clear(text) from public, anon, authenticated;
grant execute on function public.storage_clear_preview() to service_role;
grant execute on function public.storage_clear(text) to service_role;
