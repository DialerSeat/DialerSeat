-- =============================================================================
-- DialerSeat for Developers — the platform tables
-- =============================================================================
-- NOT APPLIED. Written on the local `developers` branch, 13 Nov 2026. Apply it
-- when Joshua says the developer product is ready to go live (docs/developers/
-- ROADMAP.md, section 9). Nothing reads these tables on dialerseat.com.
--
-- INDEPENDENCE. Developer status lives here and only here. A users row is the
-- shared login and nothing more: the main site's subscription, demo and team
-- rules never read dev_*, and dev.dialerseat.com never reads subscriptions to
-- decide what a developer can do. One login, two accounts.
--
-- ACTIVATION IS TWO STEPS.
--   1. Developer account   — free. A dev_platforms row exists. Full console,
--                            keys, API, webhooks, settings. Test mode only.
--   2. Live dialing        — paid. live_status = 'active'. Only then does a
--                            live key place a real call.
--
-- SECRETS. Secret API keys are stored as a SHA-256 hash and shown once.
-- Publishable keys are public by design and stored as written. Webhook signing
-- secrets must be readable to sign deliveries, so they are stored as written;
-- every table here has RLS on and no policy, so only the service role reads it.
--
-- RETENTION. Each table is classified below in the same migration, so
-- /api/cron/data-retention never reports them as unclassified.
-- =============================================================================

create table if not exists public.dev_platforms (
  id                    uuid primary key default gen_random_uuid(),
  owner_user_id         uuid not null references public.users(id) on delete restrict,
  name                  text not null,
  slug                  text not null unique,
  website               text,
  -- The developer account. Free; created by "Activate developer account".
  activated_at          timestamptz not null default now(),
  -- Live dialing. Paid. Until 'active', live keys authenticate but refuse to dial.
  live_status           text not null default 'not_activated'
                          check (live_status in ('not_activated','requested','active','past_due','paused')),
  live_requested_at     timestamptz,
  live_activated_at     timestamptz,
  tier                  text not null default 'sandbox'
                          check (tier in ('sandbox','launch','scale','partner')),
  billing_model         text not null default 'user'
                          check (billing_model in ('user','platform','mixed')),
  -- Dial-mode policy applied to every seat unless an exception says otherwise.
  default_dial_mode     text not null default 'power'
                          check (default_dial_mode in ('preview','progressive','power','predictive')),
  allowed_dial_modes    text[] not null default array['preview','progressive','power','predictive'],
  seats_may_choose_mode boolean not null default true,
  -- Miniplayer: origins allowed to frame it.
  allowed_origins       text[] not null default '{}',
  -- Negotiated terms, set by sales. Null until agreed; the console shows a dash.
  rate_seat_week        numeric(10,4),
  rate_included_dials   integer,
  rate_per_dial         numeric(10,6),
  revenue_share_pct     numeric(5,2),
  notes                 text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create unique index if not exists dev_platforms_owner_idx on public.dev_platforms(owner_user_id);

create table if not exists public.dev_api_keys (
  id            uuid primary key default gen_random_uuid(),
  platform_id   uuid not null references public.dev_platforms(id) on delete cascade,
  kind          text not null check (kind in ('secret','publishable')),
  env           text not null check (env in ('test','live')),
  name          text not null,
  -- Secret: sha256 of the full key. Publishable: null (the key is in `token`).
  key_hash      text unique,
  token         text unique,
  prefix        text not null,      -- e.g. sk_test_
  last4         text not null,
  scopes        text[] not null default array['*'],
  created_by    uuid references public.users(id),
  created_at    timestamptz not null default now(),
  last_used_at  timestamptz,
  revoked_at    timestamptz,
  check ((kind = 'secret' and key_hash is not null and token is null)
      or (kind = 'publishable' and token is not null))
);
create index if not exists dev_api_keys_platform_idx on public.dev_api_keys(platform_id);

create table if not exists public.dev_webhook_endpoints (
  id              uuid primary key default gen_random_uuid(),
  platform_id     uuid not null references public.dev_platforms(id) on delete cascade,
  env             text not null default 'test' check (env in ('test','live')),
  url             text not null,
  description     text,
  events          text[] not null default array['*'],
  signing_secret  text not null,
  created_at      timestamptz not null default now(),
  disabled_at     timestamptz
);
create index if not exists dev_webhook_endpoints_platform_idx on public.dev_webhook_endpoints(platform_id);

create table if not exists public.dev_dial_mode_exceptions (
  id            uuid primary key default gen_random_uuid(),
  platform_id   uuid not null references public.dev_platforms(id) on delete cascade,
  scope         text not null check (scope in ('seat','campaign')),
  external_id   text not null,
  dial_mode     text check (dial_mode in ('preview','progressive','power','predictive')),
  allowed_modes text[],
  note          text,
  created_at    timestamptz not null default now(),
  unique (platform_id, scope, external_id)
);

create table if not exists public.dev_dispositions (
  id            uuid primary key default gen_random_uuid(),
  platform_id   uuid not null references public.dev_platforms(id) on delete cascade,
  code          text not null,
  label         text not null,
  outcome       text not null check (outcome in
                  ('contact','conversion','callback','not_interested','no_answer',
                   'voicemail','bad_number','dnc','other')),
  sort          integer not null default 0,
  created_at    timestamptz not null default now(),
  unique (platform_id, code)
);

create table if not exists public.dev_seats (
  id                uuid primary key default gen_random_uuid(),
  platform_id       uuid not null references public.dev_platforms(id) on delete cascade,
  env               text not null default 'test' check (env in ('test','live')),
  external_user_id  text not null,
  user_id           uuid references public.users(id),
  email             text,
  name              text,
  status            text not null default 'pending'
                      check (status in ('pending','active','past_due','disabled')),
  billed_to         text not null default 'user' check (billed_to in ('user','platform')),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (platform_id, env, external_user_id)
);

-- One row per miniplayer session token. Stored hashed; single use; 15 minutes.
create table if not exists public.dev_seat_sessions (
  id           uuid primary key default gen_random_uuid(),
  seat_id      uuid not null references public.dev_seats(id) on delete cascade,
  token_hash   text not null unique,
  expires_at   timestamptz not null,
  used_at      timestamptz,
  created_at   timestamptz not null default now()
);

-- A platform's campaign tied to a DialerSeat campaign, without adding a column
-- to campaigns: the call path's tables are not touched by this product.
create table if not exists public.dev_campaign_links (
  id           uuid primary key default gen_random_uuid(),
  platform_id  uuid not null references public.dev_platforms(id) on delete cascade,
  env          text not null check (env in ('test','live')),
  external_id  text not null,
  campaign_id  uuid references public.campaigns(id) on delete set null,
  name         text not null,
  dial_mode    text check (dial_mode in ('preview','progressive','power','predictive')),
  created_at   timestamptz not null default now(),
  unique (platform_id, env, external_id)
);

-- Every webhook delivery attempt: the outbox and the log the console shows.
create table if not exists public.dev_webhook_deliveries (
  id               uuid primary key default gen_random_uuid(),
  endpoint_id      uuid not null references public.dev_webhook_endpoints(id) on delete cascade,
  event_type       text not null,
  payload          jsonb not null,
  status           text not null default 'pending' check (status in ('pending','delivered','failed')),
  attempts         integer not null default 0,
  next_attempt_at  timestamptz,
  last_status_code integer,
  last_error       text,
  delivered_at     timestamptz,
  created_at       timestamptz not null default now()
);
create index if not exists dev_webhook_deliveries_endpoint_idx on public.dev_webhook_deliveries(endpoint_id, created_at desc);
create index if not exists dev_webhook_deliveries_due_idx on public.dev_webhook_deliveries(next_attempt_at) where status = 'pending';

-- Every /v1 request: what the console's request log shows.
create table if not exists public.dev_request_log (
  id           bigint generated always as identity primary key,
  platform_id  uuid not null references public.dev_platforms(id) on delete cascade,
  key_id       uuid references public.dev_api_keys(id) on delete set null,
  env          text not null,
  method       text not null,
  path         text not null,
  status       integer not null,
  duration_ms  integer,
  created_at   timestamptz not null default now()
);
create index if not exists dev_request_log_platform_idx on public.dev_request_log(platform_id, created_at desc);

-- ── LIVE CALLING: A SEPARATE PLATFORM ────────────────────────────────
-- Developer calls run on their own Telnyx connection (DEV_TELNYX_*), with
-- their own caller-ID numbers, their own per-seat SIP credentials and their
-- own call records. DialerSeat's calls, number pool, agent credentials,
-- watchdog and concurrency count never see them, and nothing here writes to
-- a DialerSeat table.

-- One row per call, test or live. Test rows are simulated calls.
create table if not exists public.dev_calls (
  id                   text primary key,          -- call_{env}_…, signed to its frame
  platform_id          uuid not null references public.dev_platforms(id) on delete cascade,
  seat_id              uuid not null references public.dev_seats(id) on delete cascade,
  env                  text not null check (env in ('test','live')),
  campaign_external_id text,
  lead_external_id     text,
  phone                text not null,             -- E.164
  from_number          text,
  dial_mode            text,
  status               text not null default 'dialing'
                         check (status in ('dialing','ringing','connected','ended','failed')),
  amd_enabled          boolean not null default false,
  amd_result           text,
  agent_call_control_id text,
  lead_call_control_id  text,
  agent_answered_at    timestamptz,
  answered_at          timestamptz,
  ended_at             timestamptz,
  hangup_source        text,
  hangup_cause         text,
  talk_seconds         integer,
  disposition_code     text,
  disposition_outcome  text,
  notes                text,
  created_at           timestamptz not null default now()
);
create index if not exists dev_calls_platform_idx on public.dev_calls(platform_id, created_at desc);
create index if not exists dev_calls_lead_ccid_idx on public.dev_calls(lead_call_control_id);
create index if not exists dev_calls_agent_ccid_idx on public.dev_calls(agent_call_control_id);

-- A platform's own do-not-call list. Checked before every live dial.
create table if not exists public.dev_dnc (
  platform_id  uuid not null references public.dev_platforms(id) on delete cascade,
  env          text not null check (env in ('test','live')),
  phone        text not null,                     -- E.164
  source       text,
  created_at   timestamptz not null default now(),
  primary key (platform_id, env, phone)
);

-- Caller-ID numbers on the developer Telnyx connection. platform_id null is
-- the shared developer pool; a platform's own numbers are used first.
create table if not exists public.dev_numbers (
  id            uuid primary key default gen_random_uuid(),
  phone         text not null unique,             -- E.164
  platform_id   uuid references public.dev_platforms(id) on delete set null,
  area_code     text not null,
  active        boolean not null default true,
  last_used_at  timestamptz,
  created_at    timestamptz not null default now()
);

-- One Telnyx telephony credential per seat, the same shape DialerSeat gives
-- each agent. The SIP password is never stored; Telnyx returns it on demand.
create table if not exists public.dev_seat_credentials (
  seat_id                uuid primary key references public.dev_seats(id) on delete cascade,
  telnyx_credential_id   text not null unique,
  sip_username           text not null,
  created_at             timestamptz not null default now()
);

alter table public.dev_calls                enable row level security;
alter table public.dev_dnc                  enable row level security;
alter table public.dev_numbers              enable row level security;
alter table public.dev_seat_credentials     enable row level security;
alter table public.dev_seat_sessions        enable row level security;
alter table public.dev_campaign_links       enable row level security;
alter table public.dev_webhook_deliveries   enable row level security;
alter table public.dev_request_log          enable row level security;
alter table public.dev_platforms            enable row level security;
alter table public.dev_api_keys             enable row level security;
alter table public.dev_webhook_endpoints    enable row level security;
alter table public.dev_dial_mode_exceptions enable row level security;
alter table public.dev_dispositions         enable row level security;
alter table public.dev_seats                enable row level security;

insert into public.retention_policy (table_name, retention_class, keep_days, timestamp_column, notes)
values
  ('dev_platforms', 'evidence', null, 'created_at',
   'Developer accounts and their negotiated terms. Money and contracts.'),
  ('dev_api_keys', 'evidence', null, 'created_at',
   'API keys, hashed. Revoked keys stay so a leaked key can be traced.'),
  ('dev_webhook_endpoints', 'evidence', null, 'created_at',
   'Where a platform asked us to send its events.'),
  ('dev_dial_mode_exceptions', 'evidence', null, 'created_at',
   'Platform dial-mode policy exceptions. Configuration.'),
  ('dev_dispositions', 'evidence', null, 'created_at',
   'A platform''s own disposition list. Configuration.'),
  ('dev_seats', 'evidence', null, 'created_at',
   'Platform end users mapped to DialerSeat users. People.'),
  ('dev_campaign_links', 'evidence', null, 'created_at',
   'A platform campaign id mapped to a DialerSeat campaign.'),
  ('dev_seat_sessions', 'ephemeral', 7, 'created_at',
   'Miniplayer sign-in tokens, hashed. Each lives 15 minutes; a week of them is plenty to debug with.'),
  ('dev_webhook_deliveries', 'ephemeral', 30, 'created_at',
   'Webhook delivery attempts. Retries stop at 72 hours; a month covers any investigation.'),
  ('dev_request_log', 'ephemeral', 30, 'created_at',
   'API request log shown in the console. A developer debugging looks at this week.'),
  ('dev_calls', 'evidence', null, 'created_at',
   'Developer-platform call records, test and live. What a platform is billed on.'),
  ('dev_dnc', 'evidence', null, 'created_at',
   'Platform do-not-call lists. Compliance.'),
  ('dev_numbers', 'evidence', null, 'created_at',
   'Caller-ID numbers on the developer Telnyx connection.'),
  ('dev_seat_credentials', 'evidence', null, 'created_at',
   'Which Telnyx telephony credential belongs to which seat. No secrets.')
on conflict (table_name) do nothing;
