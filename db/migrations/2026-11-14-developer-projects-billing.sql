-- =============================================================================
-- DialerSeat for Developers — projects, the signup survey, and owner billing
-- =============================================================================
-- Applied 14 Nov 2026 (Joshua, 13 Nov evening ET: projects created before any
-- code is shown, a survey of what the project is, platform-billed by default,
-- and "a trigger api event when a user signs up to a service ... dialerseat
-- takes its cut from the owner of the service").
--
-- PROJECTS. A developer account (dev_accounts) owns any number of projects.
-- A project is a dev_platforms row: its own keys, webhooks, seats, calls and
-- ledger. The account is free; activating it no longer creates a project.
--
-- BILLING. The platform charges its own user however it likes. When that user
-- signs up or renews, the platform tells us (POST /v1/subscriptions, or by
-- forwarding its Stripe webhook). We activate the seat through the period
-- paid for, and record DialerSeat's cut against the project. The cut is owed
-- by the project owner and paid from the console. No rate is published yet:
-- until sales sets one on the project, a row's fee is null ("rate not set").
-- =============================================================================

create table if not exists public.dev_accounts (
  user_id              uuid primary key references public.users(id) on delete cascade,
  activated_at         timestamptz not null default now(),
  current_platform_id  uuid references public.dev_platforms(id) on delete set null
);
insert into public.dev_accounts (user_id, activated_at, current_platform_id)
select distinct on (owner_user_id) owner_user_id, activated_at, id
from public.dev_platforms order by owner_user_id, created_at
on conflict (user_id) do nothing;

-- Many projects per owner.
drop index if exists public.dev_platforms_owner_idx;
create index if not exists dev_platforms_owner_lookup_idx on public.dev_platforms(owner_user_id, created_at);

alter table public.dev_platforms
  add column if not exists profile jsonb not null default '{}'::jsonb,
  add column if not exists integration_approach text
    check (integration_approach in ('script','iframe','react','headless','hosted')),
  add column if not exists setup_completed_at timestamptz,
  add column if not exists cut_model text not null default 'seat_week'
    check (cut_model in ('seat_week','revenue_share'));
alter table public.dev_platforms alter column billing_model set default 'platform';
-- Platform-billed is the default from 13 Nov; the one project made before it moves too.
update public.dev_platforms set billing_model = 'platform' where billing_model = 'user';

alter table public.dev_seats alter column billed_to set default 'platform';
alter table public.dev_seats
  add column if not exists paid_through timestamptz,
  add column if not exists external_subscription_id text,
  add column if not exists canceled_at timestamptz;
update public.dev_seats set billed_to = 'platform' where billed_to = 'user';

-- Every customer payment a platform reports, DialerSeat's cut of it, and every
-- payment the owner makes against the balance. Balance = sum(fee_cents).
create table if not exists public.dev_ledger (
  id                        uuid primary key default gen_random_uuid(),
  platform_id               uuid not null references public.dev_platforms(id) on delete cascade,
  env                       text not null check (env in ('test','live')),
  kind                      text not null check (kind in ('signup','renewal','refund','owner_payment','adjustment')),
  seat_id                   uuid references public.dev_seats(id) on delete set null,
  external_user_id          text,
  external_subscription_id  text,
  customer_amount_cents     integer,
  fee_cents                 integer,
  currency                  text not null default 'usd',
  period_start              timestamptz,
  period_end                timestamptz,
  source                    text not null check (source in ('api','stripe','checkout','console')),
  idempotency_key           text,
  note                      text,
  created_at                timestamptz not null default now(),
  unique (platform_id, env, idempotency_key)
);
create index if not exists dev_ledger_platform_idx on public.dev_ledger(platform_id, env, created_at desc);
create index if not exists dev_ledger_sub_idx on public.dev_ledger(platform_id, env, external_subscription_id);

-- Where a platform's own billing system tells us about its customers. Today:
-- Stripe, by forwarding its webhook to /v1/billing/stripe/{token}.
create table if not exists public.dev_billing_sources (
  id              uuid primary key default gen_random_uuid(),
  platform_id     uuid not null references public.dev_platforms(id) on delete cascade,
  env             text not null check (env in ('test','live')),
  kind            text not null check (kind in ('stripe')),
  token           text not null unique,
  signing_secret  text,
  created_at      timestamptz not null default now(),
  last_event_at   timestamptz,
  disabled_at     timestamptz,
  unique (platform_id, env, kind)
);

alter table public.dev_accounts        enable row level security;
alter table public.dev_ledger          enable row level security;
alter table public.dev_billing_sources enable row level security;

insert into public.retention_policy (table_name, retention_class, keep_days, timestamp_column, notes)
values
  ('dev_accounts', 'evidence', null, 'activated_at',
   'Who activated a developer account. People.'),
  ('dev_ledger', 'evidence', null, 'created_at',
   'Customer payments platforms reported and DialerSeat''s cut of each. Money.'),
  ('dev_billing_sources', 'evidence', null, 'created_at',
   'Billing systems (Stripe) a platform connected so signups reach us. Configuration.')
on conflict (table_name) do nothing;

-- A session can carry the seat's lead list and campaign, so a hosted dialer
-- link or a plain iframe works with no script on the page.
alter table public.dev_seat_sessions
  add column if not exists leads jsonb,
  add column if not exists campaign text;
