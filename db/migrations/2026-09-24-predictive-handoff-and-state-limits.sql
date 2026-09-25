-- Applied to production 2026-09-24 as migration predictive_handoff_and_state_limits.

-- The agent whose predictive seat actually took the call (clerk id). Set by the
-- server at the moment a lead joins a seat, so a teammate who is handed a
-- surplus answer can poll, end and disposition the call they are on.
alter table public.calls
  add column if not exists handled_by text;

create index if not exists idx_calls_handled_by_lead
  on public.calls (lead_id, handled_by)
  where handled_by is not null;

-- Florida allows three calls a day to the same person (Fla. Stat.
-- 501.616(6)(b)); placement counts the last 24 hours by number.
create index if not exists idx_calls_phone_created
  on public.calls (phone_number, created_at desc);
