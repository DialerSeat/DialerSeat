-- =============================================================================
-- DialerSeat — Database Schema (baseline snapshot)
-- =============================================================================
-- Generated from the live Supabase instance (project ajknvwdojwrtxzrikpak)
-- on 2026-06-21. This is the authoritative, version-controlled record of the
-- database structure that previously existed ONLY in the live database.
--
-- PURPOSE
--   1. Disaster recovery — rebuild the schema from scratch if needed.
--   2. Change history — future schema changes should be made as NEW migration
--      files committed alongside this baseline, not by editing the dashboard.
--   3. Review — schema changes go through the same PR review as app code.
--
-- WHAT THIS FILE CONTAINS
--   - Extensions
--   - Tables (columns, defaults, NOT NULL)
--   - Constraints (PK, FK, UNIQUE, CHECK)
--   - Indexes
--   - Functions (incl. the predictive lead-claiming engine)
--   - Views
--   - Triggers + the trigger functions
--   - The ensure_rls event trigger (auto-enables RLS on new public tables)
--   - Row-Level Security policies
--
-- WHAT THIS FILE DOES NOT CONTAIN
--   - Row data (this is structure only)
--   - Supabase-managed schemas (auth, storage, etc.)
--   - Roles/grants beyond what's needed for the app
--
-- IMPORTANT NOTES ON SECURITY POSTURE (see SECURITY.md):
--   RLS is ENABLED on all public tables via the `ensure_rls` event trigger,
--   but the application uses the service-role key which BYPASSES RLS. The
--   policies are defense-in-depth scaffolding; the real authorization boundary
--   is in the application layer. Do not assume RLS protects a table accessed
--   with the service-role key.
-- =============================================================================

-- Order matters for a clean rebuild: extensions → tables (FK order) → indexes
-- → functions → views → triggers → policies. This file is organized so it can
-- be run top-to-bottom on an empty database.

SET statement_timeout = 0;
SET client_min_messages = warning;

-- =============================================================================
-- EXTENSIONS
-- =============================================================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";      -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pg_cron";        -- scheduled jobs (pool maintenance, etc.)


-- =============================================================================
-- TABLES
-- =============================================================================
-- Tables are defined with columns + defaults + NOT NULL inline. Foreign keys,
-- CHECK constraints, and indexes are added in later sections so that table
-- creation order doesn't fight FK dependencies.

-- ---- users (identity mirror of Clerk) --------------------------------------
CREATE TABLE IF NOT EXISTS public.users (
  id                     uuid NOT NULL DEFAULT gen_random_uuid(),
  clerk_id               text NOT NULL,
  email                  text,
  first_name             text,
  last_name              text,
  phone                  text,
  subscription_status    text DEFAULT 'trial'::text,
  created_at             timestamptz DEFAULT now(),
  stripe_customer_id     text,
  is_admin               boolean NOT NULL DEFAULT false,
  last_seen_at           timestamptz,
  has_data               boolean NOT NULL DEFAULT false,
  exclude_from_analytics boolean NOT NULL DEFAULT false,
  wl_onboarding_status   text NOT NULL DEFAULT 'not_started'::text,
  wl_subscription_id     text,
  active_tenant_id       uuid,
  username               text
);

-- ---- white_label_tenants (Manager+ reseller branding) ----------------------
CREATE TABLE IF NOT EXISTS public.white_label_tenants (
  id                    uuid NOT NULL DEFAULT gen_random_uuid(),
  slug                  text NOT NULL,
  custom_domain         text,
  status                text NOT NULL DEFAULT 'active'::text,
  owner_clerk_id        text NOT NULL,
  brand_name            text NOT NULL,
  logo_url              text,
  favicon_url           text,
  primary_color         text NOT NULL DEFAULT '#b8a3e0'::text,
  secondary_color       text NOT NULL DEFAULT '#2a6eff'::text,
  accent_color          text NOT NULL DEFAULT '#1a1a2e'::text,
  background_color      text NOT NULL DEFAULT '#f0f1f4'::text,
  text_color            text NOT NULL DEFAULT '#1a1c24'::text,
  support_email         text NOT NULL,
  footer_text           text DEFAULT 'Hosted by DialerSeat'::text,
  custom_landing        jsonb DEFAULT '{}'::jsonb,
  stripe_customer_id    text,
  stripe_subscription_id text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  is_active             boolean NOT NULL DEFAULT true,
  slug_changed_at       timestamptz DEFAULT now(),
  sidebar_color         text NOT NULL DEFAULT '#e4e6eb'::text,
  page_bg_color         text NOT NULL DEFAULT '#f1ecf7'::text,
  header_bg_color       text NOT NULL DEFAULT '#1a1c24'::text,
  last_applied_theme_id uuid,
  login_link_label      text,
  login_link_url        text,
  login_link_text       text
);

-- ---- campaigns -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.campaigns (
  id                         uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id                    text NOT NULL,                    -- Clerk id
  name                       text NOT NULL,
  status                     text DEFAULT 'inactive'::text,
  total_leads                integer DEFAULT 0,
  called_leads               integer DEFAULT 0,
  created_at                 timestamptz DEFAULT now(),
  script                     text DEFAULT ''::text,
  dialer_mode                text NOT NULL DEFAULT 'power'::text,
  amd_enabled                boolean NOT NULL DEFAULT false,
  voicemail_drop_url         text,
  predictive_lines_per_agent numeric(3,1) NOT NULL DEFAULT 1.5, -- per-agent multiplier (CHECK 1.0-3.0)
  predictive_lines_min       integer NOT NULL DEFAULT 2,
  predictive_lines_max       integer NOT NULL DEFAULT 5,
  disconnect_behavior        text NOT NULL DEFAULT 'auto'::text,
  enable_appointments_sub    boolean NOT NULL DEFAULT false,
  enable_not_interested_sub  boolean NOT NULL DEFAULT false
);

-- ---- leads -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.leads (
  id                    uuid NOT NULL DEFAULT gen_random_uuid(),
  campaign_id           uuid,
  user_id               text NOT NULL,                          -- Clerk id
  first_name            text,
  last_name             text,
  phone                 text NOT NULL,
  email                 text,
  address               text,
  city                  text,
  state                 text,
  zip                   text,
  status                text DEFAULT 'uncalled'::text,
  disposition           text,
  call_count            integer DEFAULT 0,
  last_called           timestamptz,
  created_at            timestamptz DEFAULT now(),
  extra_data            jsonb DEFAULT '{}'::jsonb,
  dial_attempts         integer DEFAULT 0,
  last_called_at        timestamptz,
  notes                 text DEFAULT ''::text,
  consent_date          timestamptz,
  consent_source        text,
  consent_description   text,
  consent_proof_url     text,
  claimed_at            timestamptz,                            -- predictive claim lock
  claimed_by_session_id uuid
);

-- ---- calls -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.calls (
  id                   uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id              text NOT NULL,                           -- Clerk id
  campaign_id          uuid,
  lead_id              uuid,
  phone_number         text,
  duration             integer DEFAULT 0,
  disposition          text,
  recording_url        text,
  signalwire_call_id   text,
  created_at           timestamptz DEFAULT now(),
  recording_status     text DEFAULT 'pending'::text,
  recording_duration   integer DEFAULT 0,
  recording_expires_at timestamptz,
  team_id              uuid,
  was_abandoned        boolean NOT NULL DEFAULT false,          -- FTC abandon-rate numerator
  amd_result           text,
  buffer_state         text,
  buffer_started_at    timestamptz,
  dial_group_id        uuid
);

-- ---- call_rooms (two-leg conference tracking) ------------------------------
CREATE TABLE IF NOT EXISTS public.call_rooms (
  room_name      text NOT NULL,
  user_id        text NOT NULL,
  phone_number   text,
  lead_call_sid  text,
  agent_call_sid text,
  created_at     timestamptz DEFAULT now(),
  pool_number_id uuid
);

-- ---- agent_sessions (live dialer presence + predictive state) --------------
CREATE TABLE IF NOT EXISTS public.agent_sessions (
  id                    uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id               uuid NOT NULL,
  team_id               uuid,
  campaign_id           uuid,
  dialer_mode           text,
  state                 text NOT NULL DEFAULT 'ready'::text,    -- ready|dialing|on_call|wrapping|paused|offline
  current_call_id       uuid,
  current_dial_group_id uuid,
  last_heartbeat        timestamptz NOT NULL DEFAULT now(),
  session_started_at    timestamptz NOT NULL DEFAULT now(),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

-- ---- predictive_dial_groups (one row per predictive fan-out burst) ---------
CREATE TABLE IF NOT EXISTS public.predictive_dial_groups (
  id                  uuid NOT NULL DEFAULT gen_random_uuid(),
  campaign_id         uuid NOT NULL,
  triggering_agent_id uuid,
  lines_attempted     integer NOT NULL,
  lines_lookup        jsonb NOT NULL DEFAULT '[]'::jsonb,
  status              text NOT NULL DEFAULT 'active'::text,
  winning_call_id     uuid,
  winning_agent_id    uuid,
  routed_at           timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  resolved_at         timestamptz
);

-- ---- pacing_metrics (daily per-campaign counters; feeds abandon-rate view) --
CREATE TABLE IF NOT EXISTS public.pacing_metrics (
  id                      uuid NOT NULL DEFAULT gen_random_uuid(),
  campaign_id             uuid NOT NULL,
  metric_date             date NOT NULL DEFAULT CURRENT_DATE,
  total_dials             integer NOT NULL DEFAULT 0,
  total_answers           integer NOT NULL DEFAULT 0,
  total_amd_detected      integer NOT NULL DEFAULT 0,
  total_abandons          integer NOT NULL DEFAULT 0,
  total_connects          integer NOT NULL DEFAULT 0,
  total_predictive_groups integer NOT NULL DEFAULT 0,
  updated_at              timestamptz NOT NULL DEFAULT now()
);

-- ---- dialer_sessions (legacy session tracking) -----------------------------
CREATE TABLE IF NOT EXISTS public.dialer_sessions (
  id               uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id          text NOT NULL,
  campaign_id      uuid,
  team_id          uuid,
  started_at       timestamptz NOT NULL DEFAULT now(),
  last_heartbeat_at timestamptz NOT NULL DEFAULT now(),
  ended_at         timestamptz
);

-- ---- campaign_scripts (multi-script support per campaign) ------------------
CREATE TABLE IF NOT EXISTS public.campaign_scripts (
  id          uuid NOT NULL DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL,
  name        text NOT NULL DEFAULT 'Main Script'::text,
  body        text NOT NULL DEFAULT ''::text,
  is_default  boolean NOT NULL DEFAULT false,
  sort_order  integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ---- lead_notes ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lead_notes (
  id          uuid NOT NULL DEFAULT gen_random_uuid(),
  lead_id     uuid NOT NULL,
  user_id     text NOT NULL,
  note        text NOT NULL,
  disposition text,
  source      text NOT NULL DEFAULT 'dialer'::text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ---- phone_numbers (the carrier anti-spam DID pool) ------------------------
CREATE TABLE IF NOT EXISTS public.phone_numbers (
  id                 uuid NOT NULL DEFAULT gen_random_uuid(),
  phone_number       text NOT NULL,
  area_code          text NOT NULL,
  region             text,
  state              text,
  signalwire_sid     text NOT NULL,
  status             text NOT NULL DEFAULT 'active'::text,     -- active|resting|flagged|released
  daily_call_count   integer NOT NULL DEFAULT 0,
  daily_cap          integer NOT NULL DEFAULT 50,
  lifetime_call_count integer NOT NULL DEFAULT 0,
  last_called_at     timestamptz,
  last_flagged_at    timestamptz,
  flag_reason        text,
  monthly_cost_cents integer DEFAULT 100,
  acquired_at        timestamptz NOT NULL DEFAULT now(),
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  is_registered      boolean NOT NULL DEFAULT false
);

-- ---- pool_config (singleton row controlling pool auto-scaling) -------------
CREATE TABLE IF NOT EXISTS public.pool_config (
  id                      integer NOT NULL DEFAULT 1,           -- CHECK (id = 1) singleton
  max_pool_size           integer NOT NULL DEFAULT 200,
  daily_buy_cap           integer NOT NULL DEFAULT 50,
  utilization_trigger_pct integer NOT NULL DEFAULT 70,
  sustained_hours_required integer NOT NULL DEFAULT 2,
  buys_today              integer NOT NULL DEFAULT 0,
  buys_today_date         date NOT NULL DEFAULT CURRENT_DATE,
  updated_at              timestamptz NOT NULL DEFAULT now(),
  updated_by              text
);

-- ---- subscriptions (Stripe self-pay) ---------------------------------------
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id                     uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id                text NOT NULL,                         -- FK -> users(clerk_id)
  stripe_customer_id     text NOT NULL,
  stripe_subscription_id text NOT NULL,
  stripe_price_id        text NOT NULL,
  status                 text NOT NULL,
  current_period_start   timestamptz,
  current_period_end     timestamptz,
  trial_start            timestamptz,
  trial_end              timestamptz,
  cancel_at_period_end   boolean NOT NULL DEFAULT false,
  canceled_at            timestamptz,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  discount_coupon        text,
  -- Stripe event `created` timestamp (not our received time) for whichever
  -- webhook event most recently wrote this row. See
  -- migrations/SUBSCRIPTIONS_EVENT_ORDERING_2026-07-18.sql — guards against
  -- an out-of-order older event clobbering a newer status.
  last_event_at          timestamptz
);
CREATE INDEX IF NOT EXISTS idx_subscriptions_last_event_at ON public.subscriptions (last_event_at);

-- ---- stripe_events (webhook idempotency ledger) ----------------------------
CREATE TABLE IF NOT EXISTS public.stripe_events (
  event_id          text NOT NULL,
  event_type        text NOT NULL,
  livemode          boolean NOT NULL,
  received_at       timestamptz NOT NULL DEFAULT now(),
  processed_at      timestamptz,
  processing_status text NOT NULL DEFAULT 'received'::text,
  error_message     text,
  attempts          integer NOT NULL DEFAULT 1
);

-- ---- teams -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.teams (
  id          uuid NOT NULL DEFAULT gen_random_uuid(),
  owner_id    text NOT NULL,
  name        text NOT NULL,
  description text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  tenant_id   uuid
);

-- ---- team_members ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.team_members (
  id                        uuid NOT NULL DEFAULT gen_random_uuid(),
  team_id                   uuid NOT NULL,
  user_id                   text NOT NULL,
  status                    text NOT NULL DEFAULT 'pending'::text,
  joined_via_code           text,
  accepted_at               timestamptz,
  removed_at                timestamptz,
  created_at                timestamptz NOT NULL DEFAULT now(),
  billing_override          text,
  seat_price_override_cents integer
);

-- ---- team_campaigns (which campaigns a team can dial) ----------------------
CREATE TABLE IF NOT EXISTS public.team_campaigns (
  team_id     uuid NOT NULL,
  campaign_id uuid NOT NULL,
  access_mode text NOT NULL DEFAULT 'owner_pays'::text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ---- team_campaign_access (per-member campaign access grants) ---------------
CREATE TABLE IF NOT EXISTS public.team_campaign_access (
  id                  uuid NOT NULL DEFAULT gen_random_uuid(),
  team_id             uuid NOT NULL,
  team_member_id      uuid NOT NULL,
  campaign_id         uuid NOT NULL,
  access_source       text NOT NULL DEFAULT 'code'::text,
  granted_via_code_id uuid,
  payer               text NOT NULL,
  is_active           boolean NOT NULL DEFAULT true,
  granted_at          timestamptz NOT NULL DEFAULT now(),
  revoked_at          timestamptz
);

-- ---- team_codes (invite/seat codes) ----------------------------------------
CREATE TABLE IF NOT EXISTS public.team_codes (
  id                       uuid NOT NULL DEFAULT gen_random_uuid(),
  team_id                  uuid NOT NULL,
  code                     text NOT NULL,
  code_type                text NOT NULL,                       -- seat|recruit
  is_active                boolean NOT NULL DEFAULT true,
  created_at               timestamptz NOT NULL DEFAULT now(),
  campaign_id              uuid,
  payer                    text NOT NULL DEFAULT 'owner'::text,
  max_uses                 integer,
  use_count                integer NOT NULL DEFAULT 0,
  seat_price_override_cents integer
);

-- ---- team_agent_payments (per-seat Stripe subs) ----------------------------
CREATE TABLE IF NOT EXISTS public.team_agent_payments (
  id                     uuid NOT NULL DEFAULT gen_random_uuid(),
  team_id                uuid NOT NULL,
  campaign_id            uuid,
  agent_id               text NOT NULL,
  stripe_subscription_id text,
  status                 text NOT NULL DEFAULT 'active'::text,
  created_at             timestamptz NOT NULL DEFAULT now(),
  canceled_at            timestamptz
);

-- ---- team_seat_charges (per-seat billing ledger) ---------------------------
CREATE TABLE IF NOT EXISTS public.team_seat_charges (
  id                          uuid NOT NULL DEFAULT gen_random_uuid(),
  team_id                     uuid,
  owner_id                    text NOT NULL,
  agent_id                    text NOT NULL,
  team_member_id              uuid,
  stripe_invoice_id           text,
  stripe_subscription_item_id text,
  amount_cents                integer NOT NULL,
  status                      text NOT NULL DEFAULT 'pending'::text,
  period_start                timestamptz NOT NULL,
  period_end                  timestamptz NOT NULL,
  refunded_amount_cents       integer NOT NULL DEFAULT 0,
  created_at                  timestamptz NOT NULL DEFAULT now()
);

-- ---- tenant_invites (white-label team invites) -----------------------------
CREATE TABLE IF NOT EXISTS public.tenant_invites (
  id               uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL,
  team_id          uuid NOT NULL,
  email            text NOT NULL,                               -- CHECK lower(email)
  token            text NOT NULL,
  invited_by       text NOT NULL,
  status           text NOT NULL DEFAULT 'pending'::text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  expires_at       timestamptz NOT NULL DEFAULT (now() + '14 days'::interval),
  accepted_at      timestamptz,
  accepted_by      text,
  billing_override text
);

-- ---- subdomain_history (slug change redirects) -----------------------------
CREATE TABLE IF NOT EXISTS public.subdomain_history (
  id              uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL,
  old_slug        text NOT NULL,
  new_slug        text NOT NULL,
  redirects_until timestamptz NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- ---- custom_themes (saved white-label color themes) ------------------------
CREATE TABLE IF NOT EXISTS public.custom_themes (
  id              uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id         text NOT NULL,
  name            text NOT NULL,                                -- CHECK 1-40 chars
  sidebar_color   text NOT NULL,
  header_bg_color text NOT NULL,
  primary_color   text NOT NULL,
  page_bg_color   text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  logo_url        text
);

-- ---- gmail_oauth_tokens (⚠ tokens currently stored plaintext — see Step 9) --
CREATE TABLE IF NOT EXISTS public.gmail_oauth_tokens (
  id            uuid NOT NULL DEFAULT gen_random_uuid(),
  clerk_id      text NOT NULL,
  email         text NOT NULL,
  access_token  text NOT NULL,
  refresh_token text,
  token_type    text NOT NULL DEFAULT 'Bearer'::text,
  expires_at    timestamptz NOT NULL,
  scopes        text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- ---- support_submissions ---------------------------------------------------
CREATE TABLE IF NOT EXISTS public.support_submissions (
  id               uuid NOT NULL DEFAULT gen_random_uuid(),
  type             text NOT NULL,                               -- support|bug|exit|suggestion
  clerk_id         text,
  snap_name        text,
  snap_username    text,
  snap_email       text,
  tenant_id        uuid,
  disposition      text,
  subject          text,
  body             text NOT NULL DEFAULT ''::text,
  status           text NOT NULL DEFAULT 'new'::text,
  responded_at     timestamptz,
  responded_by     text,
  response_body    text,
  response_channel text DEFAULT 'email'::text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- ---- agencies (legacy/auxiliary) -------------------------------------------
CREATE TABLE IF NOT EXISTS public.agencies (
  id         uuid NOT NULL DEFAULT gen_random_uuid(),
  owner_id   text NOT NULL,
  name       text NOT NULL,
  seat_count integer DEFAULT 1,
  created_at timestamptz DEFAULT now()
);

-- ---- agent_predictive_prefs (per-agent line preference) --------------------
CREATE TABLE IF NOT EXISTS public.agent_predictive_prefs (
  id              uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL,
  campaign_id     uuid NOT NULL,
  preferred_lines integer NOT NULL,                             -- CHECK 1-5
  set_by_owner    boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- ---- data_preserved_users (don't-wipe-on-cancel registry) ------------------
CREATE TABLE IF NOT EXISTS public.data_preserved_users (
  clerk_id     text NOT NULL,
  reason       text NOT NULL DEFAULT 'has_data'::text,
  preserved_at timestamptz DEFAULT now()
);

-- ---- feature_flags ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.feature_flags (
  key         text NOT NULL,
  enabled     boolean NOT NULL DEFAULT false,
  description text NOT NULL DEFAULT ''::text,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ---- Admin/Manager desktop OS-style UI prefs -------------------------------
CREATE TABLE IF NOT EXISTS public.admin_desktop_prefs (
  clerk_id       text NOT NULL,
  icon_positions jsonb NOT NULL DEFAULT '{}'::jsonb,
  background     jsonb,
  updated_at     timestamptz NOT NULL DEFAULT now(),
  installed_apps jsonb NOT NULL DEFAULT '[]'::jsonb,
  hidden_apps    jsonb NOT NULL DEFAULT '[]'::jsonb
);

CREATE TABLE IF NOT EXISTS public.manager_desktop_prefs (
  clerk_id       text NOT NULL,
  icon_positions jsonb NOT NULL DEFAULT '{}'::jsonb,
  background     jsonb,
  installed_apps jsonb NOT NULL DEFAULT '[]'::jsonb,
  hidden_apps    jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.admin_notes (
  id             uuid NOT NULL DEFAULT gen_random_uuid(),
  owner_clerk_id text NOT NULL,
  title          text NOT NULL DEFAULT ''::text,
  body           text NOT NULL DEFAULT ''::text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  content_edited_at timestamptz NOT NULL DEFAULT now(), -- bumped only on title/body changes, not star/pin — drives the "Edited X ago" indicator
  starred        boolean NOT NULL DEFAULT false,
  pin_order      integer
);

CREATE TABLE IF NOT EXISTS public.desktop_prefs (
  clerk_id         text NOT NULL,
  background_id    text,
  top_z            integer NOT NULL DEFAULT 100,
  focused_window_id text,
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.desktop_icons (
  clerk_id   text NOT NULL,
  app_id     text NOT NULL,
  grid_x     integer NOT NULL,
  grid_y     integer NOT NULL,
  pinned     boolean NOT NULL DEFAULT true,
  installed  boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.desktop_windows (
  id            text NOT NULL,
  clerk_id      text NOT NULL,
  app_id        text NOT NULL,
  x             integer NOT NULL,
  y             integer NOT NULL,
  width         integer NOT NULL,
  height        integer NOT NULL,
  z_index       integer NOT NULL,
  minimized     boolean NOT NULL DEFAULT false,
  maximized     boolean NOT NULL DEFAULT false,
  pre_maximize  jsonb,
  opened_at     timestamptz NOT NULL,
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- =============================================================================
-- PRIMARY KEYS
-- =============================================================================
ALTER TABLE public.users                  ADD CONSTRAINT users_pkey PRIMARY KEY (id);
ALTER TABLE public.white_label_tenants    ADD CONSTRAINT white_label_tenants_pkey PRIMARY KEY (id);
ALTER TABLE public.campaigns              ADD CONSTRAINT campaigns_pkey PRIMARY KEY (id);
ALTER TABLE public.leads                  ADD CONSTRAINT leads_pkey PRIMARY KEY (id);
ALTER TABLE public.calls                  ADD CONSTRAINT calls_pkey PRIMARY KEY (id);
ALTER TABLE public.call_rooms             ADD CONSTRAINT call_rooms_pkey PRIMARY KEY (room_name);
ALTER TABLE public.agent_sessions         ADD CONSTRAINT agent_sessions_pkey PRIMARY KEY (id);
ALTER TABLE public.predictive_dial_groups ADD CONSTRAINT predictive_dial_groups_pkey PRIMARY KEY (id);
ALTER TABLE public.pacing_metrics         ADD CONSTRAINT pacing_metrics_pkey PRIMARY KEY (id);
ALTER TABLE public.dialer_sessions        ADD CONSTRAINT dialer_sessions_pkey PRIMARY KEY (id);
ALTER TABLE public.campaign_scripts       ADD CONSTRAINT campaign_scripts_pkey PRIMARY KEY (id);
ALTER TABLE public.lead_notes             ADD CONSTRAINT lead_notes_pkey PRIMARY KEY (id);
ALTER TABLE public.phone_numbers          ADD CONSTRAINT phone_numbers_pkey PRIMARY KEY (id);
ALTER TABLE public.pool_config            ADD CONSTRAINT pool_config_pkey PRIMARY KEY (id);
ALTER TABLE public.subscriptions          ADD CONSTRAINT subscriptions_pkey PRIMARY KEY (id);
ALTER TABLE public.stripe_events          ADD CONSTRAINT stripe_events_pkey PRIMARY KEY (event_id);
ALTER TABLE public.teams                  ADD CONSTRAINT teams_pkey PRIMARY KEY (id);
ALTER TABLE public.team_members           ADD CONSTRAINT team_members_pkey PRIMARY KEY (id);
ALTER TABLE public.team_campaigns         ADD CONSTRAINT team_campaigns_pkey PRIMARY KEY (team_id, campaign_id);
ALTER TABLE public.team_campaign_access   ADD CONSTRAINT team_campaign_access_pkey PRIMARY KEY (id);
ALTER TABLE public.team_codes             ADD CONSTRAINT team_codes_pkey PRIMARY KEY (id);
ALTER TABLE public.team_agent_payments    ADD CONSTRAINT team_agent_payments_pkey PRIMARY KEY (id);
ALTER TABLE public.team_seat_charges      ADD CONSTRAINT team_seat_charges_pkey PRIMARY KEY (id);
ALTER TABLE public.tenant_invites         ADD CONSTRAINT tenant_invites_pkey PRIMARY KEY (id);
ALTER TABLE public.subdomain_history      ADD CONSTRAINT subdomain_history_pkey PRIMARY KEY (id);
ALTER TABLE public.custom_themes          ADD CONSTRAINT custom_themes_pkey PRIMARY KEY (id);
ALTER TABLE public.gmail_oauth_tokens     ADD CONSTRAINT gmail_oauth_tokens_pkey PRIMARY KEY (id);
ALTER TABLE public.support_submissions    ADD CONSTRAINT support_submissions_pkey PRIMARY KEY (id);
ALTER TABLE public.agencies               ADD CONSTRAINT agencies_pkey PRIMARY KEY (id);
ALTER TABLE public.agent_predictive_prefs ADD CONSTRAINT agent_predictive_prefs_pkey PRIMARY KEY (id);
ALTER TABLE public.data_preserved_users   ADD CONSTRAINT data_preserved_users_pkey PRIMARY KEY (clerk_id);
ALTER TABLE public.feature_flags          ADD CONSTRAINT feature_flags_pkey PRIMARY KEY (key);
ALTER TABLE public.admin_desktop_prefs    ADD CONSTRAINT admin_desktop_prefs_pkey PRIMARY KEY (clerk_id);
ALTER TABLE public.manager_desktop_prefs  ADD CONSTRAINT manager_desktop_prefs_pkey PRIMARY KEY (clerk_id);
ALTER TABLE public.admin_notes            ADD CONSTRAINT admin_notes_pkey PRIMARY KEY (id);
ALTER TABLE public.desktop_prefs          ADD CONSTRAINT desktop_prefs_pkey PRIMARY KEY (clerk_id);
ALTER TABLE public.desktop_icons          ADD CONSTRAINT desktop_icons_pkey PRIMARY KEY (clerk_id, app_id);
ALTER TABLE public.desktop_windows        ADD CONSTRAINT desktop_windows_pkey PRIMARY KEY (id);

-- =============================================================================
-- UNIQUE CONSTRAINTS
-- =============================================================================
ALTER TABLE public.users               ADD CONSTRAINT users_clerk_id_key UNIQUE (clerk_id);
ALTER TABLE public.users               ADD CONSTRAINT users_stripe_customer_id_key UNIQUE (stripe_customer_id);
ALTER TABLE public.white_label_tenants ADD CONSTRAINT white_label_tenants_slug_key UNIQUE (slug);
ALTER TABLE public.white_label_tenants ADD CONSTRAINT white_label_tenants_custom_domain_key UNIQUE (custom_domain);
ALTER TABLE public.phone_numbers       ADD CONSTRAINT phone_numbers_phone_number_key UNIQUE (phone_number);
ALTER TABLE public.phone_numbers       ADD CONSTRAINT phone_numbers_signalwire_sid_key UNIQUE (signalwire_sid);
ALTER TABLE public.subscriptions       ADD CONSTRAINT subscriptions_stripe_subscription_id_key UNIQUE (stripe_subscription_id);
ALTER TABLE public.team_codes          ADD CONSTRAINT team_codes_code_key UNIQUE (code);
ALTER TABLE public.tenant_invites      ADD CONSTRAINT tenant_invites_token_key UNIQUE (token);
ALTER TABLE public.gmail_oauth_tokens  ADD CONSTRAINT gmail_oauth_tokens_clerk_id_key UNIQUE (clerk_id);
ALTER TABLE public.gmail_oauth_tokens  ADD CONSTRAINT gmail_oauth_tokens_user_id_google_email_key UNIQUE (clerk_id, email);

-- =============================================================================
-- CHECK CONSTRAINTS
-- =============================================================================
ALTER TABLE public.campaigns ADD CONSTRAINT campaigns_dialer_mode_check
  CHECK (dialer_mode = ANY (ARRAY['preview','power','progressive','predictive']::text[]));
ALTER TABLE public.campaigns ADD CONSTRAINT campaigns_disconnect_behavior_check
  CHECK (disconnect_behavior = ANY (ARRAY['auto','hangup','reroute']::text[]));
-- NOTE: per-agent multiplier capped at 3.0 here; the ABSOLUTE simultaneous-line
-- cap (5) is enforced separately in claim_next_leads_for_campaign + app code.
ALTER TABLE public.campaigns ADD CONSTRAINT campaigns_predictive_lines_check
  CHECK (predictive_lines_per_agent >= 1.0 AND predictive_lines_per_agent <= 3.0);
ALTER TABLE public.agent_predictive_prefs ADD CONSTRAINT agent_predictive_prefs_preferred_lines_check
  CHECK (preferred_lines >= 1 AND preferred_lines <= 5);
ALTER TABLE public.pool_config ADD CONSTRAINT pool_config_singleton CHECK (id = 1);
ALTER TABLE public.custom_themes ADD CONSTRAINT custom_themes_name_check
  CHECK (length(TRIM(BOTH FROM name)) > 0 AND length(name) <= 40);
ALTER TABLE public.stripe_events ADD CONSTRAINT stripe_events_processing_status_check
  CHECK (processing_status = ANY (ARRAY['received','processed','failed','skipped']::text[]));
ALTER TABLE public.support_submissions ADD CONSTRAINT support_submissions_status_check
  CHECK (status = ANY (ARRAY['new','open','responded','resolved','closed']::text[]));
ALTER TABLE public.support_submissions ADD CONSTRAINT support_submissions_type_check
  CHECK (type = ANY (ARRAY['support','bug','exit','suggestion']::text[]));
ALTER TABLE public.team_agent_payments ADD CONSTRAINT team_agent_payments_status_check
  CHECK (status = ANY (ARRAY['active','canceled','past_due']::text[]));
ALTER TABLE public.team_campaign_access ADD CONSTRAINT team_campaign_access_access_source_check
  CHECK (access_source = ANY (ARRAY['code','manual','all_campaigns_grant']::text[]));
ALTER TABLE public.team_campaign_access ADD CONSTRAINT team_campaign_access_payer_check
  CHECK (payer = ANY (ARRAY['owner','agent','free']::text[]));
ALTER TABLE public.team_campaigns ADD CONSTRAINT team_campaigns_access_mode_check
  CHECK (access_mode = ANY (ARRAY['owner_pays','agent_pays','public','free']::text[]));
ALTER TABLE public.team_codes ADD CONSTRAINT team_codes_code_type_check
  CHECK (code_type = ANY (ARRAY['seat','recruit']::text[]));
ALTER TABLE public.team_codes ADD CONSTRAINT team_codes_payer_check
  CHECK (payer = ANY (ARRAY['owner','agent']::text[]));
ALTER TABLE public.team_codes ADD CONSTRAINT chk_code_campaign_match
  CHECK ((code_type = 'recruit' AND campaign_id IS NULL) OR code_type = 'seat');
ALTER TABLE public.team_members ADD CONSTRAINT team_members_billing_override_check
  CHECK (billing_override = ANY (ARRAY['agency_pays','agent_pays_self']::text[]));
ALTER TABLE public.team_members ADD CONSTRAINT team_members_status_check
  CHECK (status = ANY (ARRAY['pending','active','removed']::text[]));
ALTER TABLE public.team_seat_charges ADD CONSTRAINT team_seat_charges_status_check
  CHECK (status = ANY (ARRAY['pending','paid','failed','refunded','voided']::text[]));
ALTER TABLE public.tenant_invites ADD CONSTRAINT tenant_invites_billing_override_check
  CHECK (billing_override = ANY (ARRAY['agency_pays','agent_pays_self']::text[]));
ALTER TABLE public.tenant_invites ADD CONSTRAINT tenant_invites_email_check CHECK (email = lower(email));
ALTER TABLE public.tenant_invites ADD CONSTRAINT tenant_invites_status_check
  CHECK (status = ANY (ARRAY['pending','accepted','expired','revoked']::text[]));
ALTER TABLE public.users ADD CONSTRAINT users_wl_onboarding_status_check
  CHECK (wl_onboarding_status = ANY (ARRAY['not_started','pending','complete']::text[]));
ALTER TABLE public.white_label_tenants ADD CONSTRAINT white_label_tenants_status_check
  CHECK (status = ANY (ARRAY['active','suspended','cancelled']::text[]));
ALTER TABLE public.white_label_tenants ADD CONSTRAINT white_label_tenants_brand_name_check
  CHECK (length(brand_name) >= 1 AND length(brand_name) <= 80);
ALTER TABLE public.white_label_tenants ADD CONSTRAINT white_label_tenants_slug_check
  CHECK (slug ~ '^[a-z0-9][a-z0-9-]{0,28}[a-z0-9]$'::text);
ALTER TABLE public.white_label_tenants ADD CONSTRAINT white_label_tenants_support_email_check
  CHECK (support_email ~ '^[^@]+@[^@]+\.[^@]+$'::text);
ALTER TABLE public.white_label_tenants ADD CONSTRAINT white_label_tenants_primary_color_check   CHECK (primary_color   ~ '^#[0-9a-fA-F]{6}$'::text);
ALTER TABLE public.white_label_tenants ADD CONSTRAINT white_label_tenants_secondary_color_check CHECK (secondary_color ~ '^#[0-9a-fA-F]{6}$'::text);
ALTER TABLE public.white_label_tenants ADD CONSTRAINT white_label_tenants_accent_color_check    CHECK (accent_color    ~ '^#[0-9a-fA-F]{6}$'::text);
ALTER TABLE public.white_label_tenants ADD CONSTRAINT white_label_tenants_background_color_check CHECK (background_color ~ '^#[0-9a-fA-F]{6}$'::text);
ALTER TABLE public.white_label_tenants ADD CONSTRAINT white_label_tenants_text_color_check      CHECK (text_color      ~ '^#[0-9a-fA-F]{6}$'::text);

-- =============================================================================
-- FOREIGN KEYS
-- =============================================================================
ALTER TABLE public.agent_predictive_prefs ADD CONSTRAINT agent_predictive_prefs_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE;
ALTER TABLE public.agent_predictive_prefs ADD CONSTRAINT agent_predictive_prefs_user_id_fkey     FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE public.agent_sessions ADD CONSTRAINT agent_sessions_campaign_id_fkey     FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE SET NULL;
ALTER TABLE public.agent_sessions ADD CONSTRAINT agent_sessions_current_call_id_fkey FOREIGN KEY (current_call_id) REFERENCES calls(id) ON DELETE SET NULL;
ALTER TABLE public.agent_sessions ADD CONSTRAINT agent_sessions_team_id_fkey         FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE;
ALTER TABLE public.agent_sessions ADD CONSTRAINT agent_sessions_user_id_fkey         FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE public.call_rooms ADD CONSTRAINT call_rooms_pool_number_id_fkey FOREIGN KEY (pool_number_id) REFERENCES phone_numbers(id) ON DELETE SET NULL;
ALTER TABLE public.calls ADD CONSTRAINT calls_campaign_id_fkey   FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE SET NULL;
ALTER TABLE public.calls ADD CONSTRAINT calls_dial_group_id_fkey FOREIGN KEY (dial_group_id) REFERENCES predictive_dial_groups(id) ON DELETE SET NULL;
ALTER TABLE public.calls ADD CONSTRAINT calls_lead_id_fkey       FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE SET NULL;
ALTER TABLE public.calls ADD CONSTRAINT calls_team_id_fkey       FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE SET NULL;
ALTER TABLE public.campaign_scripts ADD CONSTRAINT campaign_scripts_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE;
ALTER TABLE public.dialer_sessions ADD CONSTRAINT dialer_sessions_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE;
ALTER TABLE public.dialer_sessions ADD CONSTRAINT dialer_sessions_team_id_fkey     FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE SET NULL;
ALTER TABLE public.lead_notes ADD CONSTRAINT lead_notes_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE;
ALTER TABLE public.leads ADD CONSTRAINT leads_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE;
ALTER TABLE public.pacing_metrics ADD CONSTRAINT pacing_metrics_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE;
ALTER TABLE public.predictive_dial_groups ADD CONSTRAINT predictive_dial_groups_campaign_id_fkey         FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE;
ALTER TABLE public.predictive_dial_groups ADD CONSTRAINT predictive_dial_groups_triggering_agent_id_fkey FOREIGN KEY (triggering_agent_id) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public.predictive_dial_groups ADD CONSTRAINT predictive_dial_groups_winning_agent_id_fkey    FOREIGN KEY (winning_agent_id) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public.predictive_dial_groups ADD CONSTRAINT predictive_dial_groups_winning_call_id_fkey     FOREIGN KEY (winning_call_id) REFERENCES calls(id) ON DELETE SET NULL;
ALTER TABLE public.subdomain_history ADD CONSTRAINT subdomain_history_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES white_label_tenants(id) ON DELETE CASCADE;
ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(clerk_id) ON DELETE CASCADE;
ALTER TABLE public.team_agent_payments ADD CONSTRAINT team_agent_payments_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE SET NULL;
ALTER TABLE public.team_agent_payments ADD CONSTRAINT team_agent_payments_team_id_fkey     FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE;
ALTER TABLE public.team_campaign_access ADD CONSTRAINT team_campaign_access_campaign_id_fkey       FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE;
ALTER TABLE public.team_campaign_access ADD CONSTRAINT team_campaign_access_granted_via_code_id_fkey FOREIGN KEY (granted_via_code_id) REFERENCES team_codes(id) ON DELETE SET NULL;
ALTER TABLE public.team_campaign_access ADD CONSTRAINT team_campaign_access_team_id_fkey           FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE;
ALTER TABLE public.team_campaign_access ADD CONSTRAINT team_campaign_access_team_member_id_fkey    FOREIGN KEY (team_member_id) REFERENCES team_members(id) ON DELETE CASCADE;
ALTER TABLE public.team_campaigns ADD CONSTRAINT team_campaigns_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE;
ALTER TABLE public.team_campaigns ADD CONSTRAINT team_campaigns_team_id_fkey     FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE;
ALTER TABLE public.team_codes ADD CONSTRAINT team_codes_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE;
ALTER TABLE public.team_codes ADD CONSTRAINT team_codes_team_id_fkey     FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE;
ALTER TABLE public.team_members ADD CONSTRAINT team_members_team_id_fkey FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE;
ALTER TABLE public.team_seat_charges ADD CONSTRAINT team_seat_charges_team_id_fkey        FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE SET NULL;
ALTER TABLE public.team_seat_charges ADD CONSTRAINT team_seat_charges_team_member_id_fkey FOREIGN KEY (team_member_id) REFERENCES team_members(id) ON DELETE SET NULL;
ALTER TABLE public.teams ADD CONSTRAINT teams_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES white_label_tenants(id) ON DELETE SET NULL;
ALTER TABLE public.tenant_invites ADD CONSTRAINT tenant_invites_team_id_fkey   FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE;
ALTER TABLE public.tenant_invites ADD CONSTRAINT tenant_invites_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES white_label_tenants(id) ON DELETE CASCADE;
ALTER TABLE public.users ADD CONSTRAINT users_active_tenant_id_fkey FOREIGN KEY (active_tenant_id) REFERENCES white_label_tenants(id) ON DELETE SET NULL;
ALTER TABLE public.white_label_tenants ADD CONSTRAINT white_label_tenants_last_applied_theme_id_fkey FOREIGN KEY (last_applied_theme_id) REFERENCES custom_themes(id) ON DELETE SET NULL;

-- =============================================================================
-- INDEXES
-- =============================================================================
-- leads — the predictive claim hot path. idx_leads_claim_lookup is a partial
-- index matching claim_next_leads_for_campaign exactly. Do not drop it.
CREATE INDEX IF NOT EXISTS idx_leads_claim_lookup ON public.leads USING btree (campaign_id, status, claimed_at, dial_attempts) WHERE (status = ANY (ARRAY['uncalled'::text, 'no_answer'::text]));
CREATE INDEX IF NOT EXISTS idx_leads_campaign_id_status        ON public.leads USING btree (campaign_id, status);
CREATE INDEX IF NOT EXISTS idx_leads_campaign_id_last_called_at ON public.leads USING btree (campaign_id, last_called_at NULLS FIRST);
CREATE INDEX IF NOT EXISTS idx_leads_user_id_created_at        ON public.leads USING btree (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_phone                     ON public.leads USING btree (phone);
CREATE INDEX IF NOT EXISTS idx_leads_disposition               ON public.leads USING btree (disposition) WHERE (disposition IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_leads_consent_check             ON public.leads USING btree (campaign_id) WHERE (consent_date IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_leads_consent_date              ON public.leads USING btree (user_id, consent_date) WHERE (consent_date IS NOT NULL);

-- calls — analytics + abandon-rate + recording lookups
CREATE INDEX IF NOT EXISTS idx_calls_campaign_id_created_at ON public.calls USING btree (campaign_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_calls_lead_id_created_at     ON public.calls USING btree (lead_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_calls_user_id_created_at     ON public.calls USING btree (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_calls_team_id                ON public.calls USING btree (team_id);
CREATE INDEX IF NOT EXISTS idx_calls_team_id_created_at     ON public.calls USING btree (team_id, created_at DESC) WHERE (team_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_calls_disposition            ON public.calls USING btree (disposition);
CREATE INDEX IF NOT EXISTS idx_calls_signalwire_call_id     ON public.calls USING btree (signalwire_call_id) WHERE (signalwire_call_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_calls_dial_group             ON public.calls USING btree (dial_group_id) WHERE (dial_group_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_calls_abandoned_campaign     ON public.calls USING btree (campaign_id, was_abandoned, created_at) WHERE (was_abandoned = true);
CREATE INDEX IF NOT EXISTS idx_calls_was_abandoned          ON public.calls USING btree (campaign_id, created_at DESC) WHERE (was_abandoned = true);
CREATE INDEX IF NOT EXISTS idx_calls_buffer_state           ON public.calls USING btree (buffer_state, buffer_started_at) WHERE (buffer_state = 'buffering'::text);
CREATE INDEX IF NOT EXISTS idx_calls_recording_url          ON public.calls USING btree (user_id, created_at DESC) WHERE (recording_url IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_calls_recording_expires_at   ON public.calls USING btree (recording_expires_at) WHERE (recording_expires_at IS NOT NULL);

-- agent_sessions — predictive readiness + presence
CREATE INDEX IF NOT EXISTS idx_agent_sessions_campaign_ready    ON public.agent_sessions USING btree (campaign_id, state, last_heartbeat DESC) WHERE (state = 'ready'::text);
CREATE INDEX IF NOT EXISTS idx_agent_sessions_team             ON public.agent_sessions USING btree (team_id, state, last_heartbeat DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_sessions_user_active ON public.agent_sessions USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_agent_sessions_user_current_call ON public.agent_sessions USING btree (user_id) INCLUDE (current_call_id, state, dialer_mode, campaign_id);

-- call_rooms
CREATE INDEX IF NOT EXISTS call_rooms_pool_number_idx ON public.call_rooms USING btree (pool_number_id);
CREATE INDEX IF NOT EXISTS call_rooms_user_idx        ON public.call_rooms USING btree (user_id);

-- pacing_metrics needs a unique (campaign_id, metric_date) for the upsert in
-- increment_pacing_metric's ON CONFLICT clause.
CREATE UNIQUE INDEX IF NOT EXISTS idx_pacing_metrics_campaign_date ON public.pacing_metrics USING btree (campaign_id, metric_date);

-- =============================================================================
-- FUNCTIONS
-- =============================================================================

-- ---- claim_next_leads_for_campaign -----------------------------------------
-- THE atomic lead-claiming engine for predictive dialing. FOR UPDATE SKIP
-- LOCKED guarantees two agents never claim the same lead. 30s claim expiry.
-- Hard-caps requested count at 5 (defense-in-depth alongside the app clamp).
CREATE OR REPLACE FUNCTION public.claim_next_leads_for_campaign(p_campaign_id uuid, p_session_id uuid, p_count integer)
 RETURNS SETOF leads
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF p_count < 1 OR p_count > 5 THEN
    RAISE EXCEPTION 'p_count must be between 1 and 5, got %', p_count;
  END IF;

  RETURN QUERY
  WITH candidate AS (
    SELECT id
    FROM leads
    WHERE campaign_id = p_campaign_id
      AND status IN ('uncalled', 'no_answer')
      AND phone IS NOT NULL
      AND phone != ''
      AND (claimed_at IS NULL OR claimed_at < (now() - interval '30 seconds'))
    ORDER BY dial_attempts ASC NULLS FIRST, created_at ASC
    LIMIT p_count
    FOR UPDATE SKIP LOCKED
  ),
  claimed AS (
    UPDATE leads
    SET claimed_at = now(),
        claimed_by_session_id = p_session_id
    WHERE id IN (SELECT id FROM candidate)
    RETURNING leads.*
  )
  SELECT * FROM claimed;
END;
$function$;

-- ---- release_lead_claim ----------------------------------------------------
CREATE OR REPLACE FUNCTION public.release_lead_claim(p_lead_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE leads
  SET claimed_at = NULL,
      claimed_by_session_id = NULL
  WHERE id = p_lead_id;
END;
$function$;

-- ---- release_stale_lead_claims (cron-called safety net) ---------------------
CREATE OR REPLACE FUNCTION public.release_stale_lead_claims()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  released_count integer;
BEGIN
  WITH released AS (
    UPDATE leads
    SET claimed_at = NULL,
        claimed_by_session_id = NULL
    WHERE claimed_at IS NOT NULL
      AND claimed_at < (now() - interval '30 seconds')
    RETURNING id
  )
  SELECT COUNT(*) INTO released_count FROM released;
  RETURN released_count;
END;
$function$;

-- ---- claim_team_code_use (atomic invite-code redemption) --------------------
CREATE OR REPLACE FUNCTION public.claim_team_code_use(p_code_id uuid)
 RETURNS TABLE(claimed boolean)
 LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN QUERY
  UPDATE team_codes
     SET use_count = use_count + 1
   WHERE id = p_code_id
     AND is_active = true
     AND (max_uses IS NULL OR use_count < max_uses)
  RETURNING true;
END;
$function$;

-- ---- increment_called_leads ------------------------------------------------
CREATE OR REPLACE FUNCTION public.increment_called_leads(campaign_id_input uuid)
 RETURNS void
 LANGUAGE sql
AS $function$
  update public.campaigns
  set called_leads = called_leads + 1
  where id = campaign_id_input;
$function$;

-- ---- increment_pacing_metric (daily counter upsert) ------------------------
CREATE OR REPLACE FUNCTION public.increment_pacing_metric(p_campaign_id uuid, p_metric text, p_amount integer DEFAULT 1)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
  INSERT INTO pacing_metrics (campaign_id, metric_date)
  VALUES (p_campaign_id, CURRENT_DATE)
  ON CONFLICT (campaign_id, metric_date) DO NOTHING;

  CASE p_metric
    WHEN 'dials'             THEN UPDATE pacing_metrics SET total_dials = total_dials + p_amount, updated_at = NOW() WHERE campaign_id = p_campaign_id AND metric_date = CURRENT_DATE;
    WHEN 'answers'           THEN UPDATE pacing_metrics SET total_answers = total_answers + p_amount, updated_at = NOW() WHERE campaign_id = p_campaign_id AND metric_date = CURRENT_DATE;
    WHEN 'amd_detected'      THEN UPDATE pacing_metrics SET total_amd_detected = total_amd_detected + p_amount, updated_at = NOW() WHERE campaign_id = p_campaign_id AND metric_date = CURRENT_DATE;
    WHEN 'abandons'          THEN UPDATE pacing_metrics SET total_abandons = total_abandons + p_amount, updated_at = NOW() WHERE campaign_id = p_campaign_id AND metric_date = CURRENT_DATE;
    WHEN 'connects'          THEN UPDATE pacing_metrics SET total_connects = total_connects + p_amount, updated_at = NOW() WHERE campaign_id = p_campaign_id AND metric_date = CURRENT_DATE;
    WHEN 'predictive_groups' THEN UPDATE pacing_metrics SET total_predictive_groups = total_predictive_groups + p_amount, updated_at = NOW() WHERE campaign_id = p_campaign_id AND metric_date = CURRENT_DATE;
    ELSE RAISE EXCEPTION 'Unknown pacing metric: %', p_metric;
  END CASE;
END;
$function$;

-- ---- mark_stale_agents_offline (cron; 15s heartbeat staleness) --------------
-- NOTE: 15s here must stay in sync with STALE_HEARTBEAT_SECONDS in
-- lib/dialerConstants.ts (the app side).
CREATE OR REPLACE FUNCTION public.mark_stale_agents_offline()
 RETURNS integer
 LANGUAGE plpgsql
AS $function$
DECLARE
  affected_count INT;
BEGIN
  UPDATE agent_sessions
  SET state = 'offline', updated_at = NOW()
  WHERE state != 'offline'
    AND last_heartbeat < NOW() - INTERVAL '15 seconds';
  GET DIAGNOSTICS affected_count = ROW_COUNT;
  RETURN affected_count;
END;
$function$;

-- ---- mark_user_has_data ----------------------------------------------------
CREATE OR REPLACE FUNCTION public.mark_user_has_data(p_clerk_id text)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
  UPDATE users SET has_data = TRUE
  WHERE clerk_id = p_clerk_id AND has_data = FALSE;
END;
$function$;

-- ---- Trigger functions: updated_at touchers --------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger LANGUAGE plpgsql AS $function$
begin new.updated_at = now(); return new; end;
$function$;

CREATE OR REPLACE FUNCTION public.custom_themes_set_updated_at()
 RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$function$;

CREATE OR REPLACE FUNCTION public.gmail_oauth_tokens_touch_updated_at()
 RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$function$;

CREATE OR REPLACE FUNCTION public.phone_numbers_set_updated_at()
 RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$function$;

CREATE OR REPLACE FUNCTION public.update_campaign_scripts_updated_at()
 RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$function$;

CREATE OR REPLACE FUNCTION public.update_subscriptions_updated_at()
 RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$function$;

-- ---- Trigger functions: has_data / data preservation -----------------------
CREATE OR REPLACE FUNCTION public.trg_mark_user_has_data()
 RETURNS trigger LANGUAGE plpgsql AS $function$
DECLARE uid TEXT; row_data jsonb;
BEGIN
  row_data := to_jsonb(NEW);
  uid := COALESCE(row_data->>'user_id', row_data->>'owner_id');
  IF uid IS NOT NULL THEN
    UPDATE users SET has_data = TRUE WHERE clerk_id = uid AND has_data = FALSE;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.preserve_user_from_call()
 RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN
  IF NEW.user_id IS NOT NULL THEN
    INSERT INTO data_preserved_users (clerk_id, reason) VALUES (NEW.user_id, 'has_calls') ON CONFLICT (clerk_id) DO NOTHING;
  END IF; RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.preserve_user_from_campaign()
 RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN
  IF NEW.user_id IS NOT NULL THEN
    INSERT INTO data_preserved_users (clerk_id, reason) VALUES (NEW.user_id, 'has_campaigns') ON CONFLICT (clerk_id) DO NOTHING;
  END IF; RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.preserve_user_from_lead()
 RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN
  IF NEW.user_id IS NOT NULL THEN
    INSERT INTO data_preserved_users (clerk_id, reason) VALUES (NEW.user_id, 'has_leads') ON CONFLICT (clerk_id) DO NOTHING;
  END IF; RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.preserve_user_from_team()
 RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN
  IF NEW.owner_id IS NOT NULL THEN
    INSERT INTO data_preserved_users (clerk_id, reason) VALUES (NEW.owner_id, 'has_team') ON CONFLICT (clerk_id) DO NOTHING;
  END IF; RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.preserve_user_from_team_member()
 RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN
  IF NEW.user_id IS NOT NULL AND NEW.status = 'active' THEN
    INSERT INTO data_preserved_users (clerk_id, reason) VALUES (NEW.user_id, 'team_member') ON CONFLICT (clerk_id) DO NOTHING;
  END IF; RETURN NEW;
END;
$function$;

-- ---- rls_auto_enable (event trigger fn — auto-enables RLS on new tables) ----
CREATE OR REPLACE FUNCTION public.rls_auto_enable()
 RETURNS event_trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE cmd record;
BEGIN
  FOR cmd IN
    SELECT * FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public')
        AND cmd.schema_name NOT IN ('pg_catalog','information_schema')
        AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION WHEN OTHERS THEN
        RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     END IF;
  END LOOP;
END;
$function$;

-- =============================================================================
-- VIEWS
-- =============================================================================

-- ---- campaign_abandon_rate_30d (FTC abandon-rate, computed from pacing_metrics)
CREATE OR REPLACE VIEW public.campaign_abandon_rate_30d AS
  SELECT campaign_id,
    sum(total_answers)  AS answers_30d,
    sum(total_abandons) AS abandons_30d,
    CASE
      WHEN sum(total_answers) = 0 THEN 0::numeric
      ELSE round(sum(total_abandons)::numeric / sum(total_answers)::numeric * 100::numeric, 2)
    END AS abandon_rate_pct
  FROM pacing_metrics
  WHERE metric_date >= (CURRENT_DATE - '30 days'::interval)
  GROUP BY campaign_id;

-- ---- tenant_branding (read projection of white_label_tenants) ---------------
CREATE OR REPLACE VIEW public.tenant_branding AS
  SELECT id, slug, status, brand_name, logo_url, favicon_url, footer_text,
    primary_color, secondary_color, accent_color, background_color, text_color,
    custom_landing, sidebar_color, page_bg_color, header_bg_color,
    login_link_label, login_link_text, login_link_url
  FROM white_label_tenants;

-- =============================================================================
-- TRIGGERS
-- =============================================================================
CREATE TRIGGER trg_preserve_user_call          AFTER INSERT ON public.calls FOR EACH ROW EXECUTE FUNCTION preserve_user_from_call();
CREATE TRIGGER campaign_scripts_updated_at_trigger BEFORE UPDATE ON public.campaign_scripts FOR EACH ROW EXECUTE FUNCTION update_campaign_scripts_updated_at();
CREATE TRIGGER has_data_on_campaign_insert      AFTER INSERT ON public.campaigns FOR EACH ROW EXECUTE FUNCTION trg_mark_user_has_data();
CREATE TRIGGER trg_preserve_user_campaign       AFTER INSERT ON public.campaigns FOR EACH ROW EXECUTE FUNCTION preserve_user_from_campaign();
CREATE TRIGGER trg_custom_themes_updated_at     BEFORE UPDATE ON public.custom_themes FOR EACH ROW EXECUTE FUNCTION custom_themes_set_updated_at();
CREATE TRIGGER gmail_oauth_tokens_touch         BEFORE UPDATE ON public.gmail_oauth_tokens FOR EACH ROW EXECUTE FUNCTION gmail_oauth_tokens_touch_updated_at();
CREATE TRIGGER has_data_on_lead_insert          AFTER INSERT ON public.leads FOR EACH ROW EXECUTE FUNCTION trg_mark_user_has_data();
CREATE TRIGGER trg_preserve_user_lead           AFTER INSERT ON public.leads FOR EACH ROW EXECUTE FUNCTION preserve_user_from_lead();
CREATE TRIGGER phone_numbers_updated_at         BEFORE UPDATE ON public.phone_numbers FOR EACH ROW EXECUTE FUNCTION phone_numbers_set_updated_at();
CREATE TRIGGER subscriptions_updated_at         BEFORE UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION update_subscriptions_updated_at();
CREATE TRIGGER has_data_on_team_member_insert   AFTER INSERT ON public.team_members FOR EACH ROW EXECUTE FUNCTION trg_mark_user_has_data();
CREATE TRIGGER trg_preserve_user_team_member    AFTER INSERT OR UPDATE ON public.team_members FOR EACH ROW EXECUTE FUNCTION preserve_user_from_team_member();
CREATE TRIGGER has_data_on_team_insert          AFTER INSERT ON public.teams FOR EACH ROW EXECUTE FUNCTION trg_mark_user_has_data();
CREATE TRIGGER trg_preserve_user_team           AFTER INSERT ON public.teams FOR EACH ROW EXECUTE FUNCTION preserve_user_from_team();
CREATE TRIGGER trg_teams_updated_at             BEFORE UPDATE ON public.teams FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_white_label_tenants_updated_at BEFORE UPDATE ON public.white_label_tenants FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =============================================================================
-- EVENT TRIGGER — auto-enable RLS on every new public table
-- =============================================================================
-- This is why RLS is ON across the board. (Supabase-managed event triggers like
-- pgrst_ddl_watch, grant_pg_cron_access, etc. are NOT included here — they're
-- provisioned by the platform, not the app.)
DROP EVENT TRIGGER IF EXISTS ensure_rls;
CREATE EVENT TRIGGER ensure_rls ON ddl_command_end
  WHEN TAG IN ('CREATE TABLE','CREATE TABLE AS','SELECT INTO')
  EXECUTE FUNCTION rls_auto_enable();

-- =============================================================================
-- ROW-LEVEL SECURITY
-- =============================================================================
-- IMPORTANT REALITY CHECK (see SECURITY.md for the full discussion):
--
-- RLS is ENABLED on all of these tables (via the ensure_rls event trigger),
-- but the application connects with the SERVICE-ROLE key, which BYPASSES RLS
-- entirely. So in practice these policies are NOT the live authorization
-- boundary — the app layer (requireUser / requireAdmin) is.
--
-- Worse, most of the policies below key off current_setting('app.clerk_id'),
-- a session variable that the application NEVER sets. If you ever switched the
-- app to the anon/authenticated key expecting these to protect data, they would
-- evaluate clerk_id = '' for everyone and effectively deny-all (or, for the
-- permissive 'true' policies, allow-all). Do not rely on them as written.
--
-- They are preserved here exactly as they exist in the live database, because
-- (a) this file must faithfully reflect reality, and (b) they are the scaffold
-- you'd harden if you ever move enforcement into the database. If/when you do
-- that, the app must set app.clerk_id (or switch the policies to auth.jwt()->>'sub'
-- consistently) per connection.
-- =============================================================================

-- Enable RLS on every application table (mirrors what ensure_rls does on create).
ALTER TABLE public.admin_desktop_prefs    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_notes            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agencies               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_predictive_prefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_sessions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_rooms             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calls                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_scripts       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_themes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_preserved_users   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.desktop_icons          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.desktop_prefs          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.desktop_windows        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dialer_sessions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_flags          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gmail_oauth_tokens     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_notes             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manager_desktop_prefs  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pacing_metrics         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.phone_numbers          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pool_config            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.predictive_dial_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_events          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subdomain_history      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_submissions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_agent_payments    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_campaign_access   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_campaigns         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_codes             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_seat_charges      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_invites         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.white_label_tenants    ENABLE ROW LEVEL SECURITY;

-- ---- Policies (verbatim from live DB) --------------------------------------
-- NOTE: the tables not listed below have RLS enabled but NO policies, which
-- under the service-role key is irrelevant (bypassed), and under any other role
-- means deny-all. This is intentional given the service-role architecture.

-- agencies
CREATE POLICY "Users can manage own agencies" ON public.agencies
  FOR ALL TO public
  USING (owner_id = current_setting('app.clerk_id'::text, true));

-- agent_predictive_prefs (owner via campaign ownership, and self via user link)
CREATE POLICY agent_predictive_prefs_owner_read ON public.agent_predictive_prefs
  FOR SELECT TO public
  USING (campaign_id IN (SELECT campaigns.id FROM campaigns WHERE campaigns.user_id = (auth.jwt() ->> 'sub'::text)));
CREATE POLICY agent_predictive_prefs_owner_write ON public.agent_predictive_prefs
  FOR ALL TO public
  USING (campaign_id IN (SELECT campaigns.id FROM campaigns WHERE campaigns.user_id = (auth.jwt() ->> 'sub'::text)));
CREATE POLICY agent_predictive_prefs_self_read ON public.agent_predictive_prefs
  FOR SELECT TO public
  USING (user_id = (SELECT users.id FROM users WHERE users.clerk_id = (auth.jwt() ->> 'sub'::text)));
CREATE POLICY agent_predictive_prefs_self_write ON public.agent_predictive_prefs
  FOR ALL TO public
  USING (user_id = (SELECT users.id FROM users WHERE users.clerk_id = (auth.jwt() ->> 'sub'::text)));

-- agent_sessions
CREATE POLICY "team sees team sessions" ON public.agent_sessions
  FOR SELECT TO public
  USING (team_id IN (SELECT agent_sessions.team_id FROM users WHERE users.id = auth.uid()));
CREATE POLICY "users see own session" ON public.agent_sessions
  FOR SELECT TO public
  USING (auth.uid() = user_id);

-- calls
CREATE POLICY "Users can manage own calls" ON public.calls
  FOR ALL TO public
  USING (user_id = current_setting('app.clerk_id'::text, true));

-- campaigns
CREATE POLICY "Users can manage own campaigns" ON public.campaigns
  FOR ALL TO public
  USING (user_id = current_setting('app.clerk_id'::text, true));

-- leads
CREATE POLICY "Users can manage own leads" ON public.leads
  FOR ALL TO public
  USING (user_id = current_setting('app.clerk_id'::text, true));

-- tenant_invites (service role only)
CREATE POLICY "Service role full access invites" ON public.tenant_invites
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- users (permissive — effectively open; app layer is the gate)
CREATE POLICY "Allow all operations on users" ON public.users
  FOR ALL TO public
  USING (true) WITH CHECK (true);

-- white_label_tenants
CREATE POLICY "Owner reads own tenant" ON public.white_label_tenants
  FOR SELECT TO authenticated
  USING (owner_clerk_id = COALESCE(((current_setting('request.jwt.claims'::text, true))::json ->> 'sub'::text), ''::text));
CREATE POLICY "Service role full access tenants" ON public.white_label_tenants
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- =============================================================================
-- END OF SCHEMA
-- =============================================================================
-- ============================================================================
-- RELIABILITY / IDEMPOTENCY TABLES (appended — reflect live DB as of 2026-06-28)
-- ============================================================================

-- Append-only forensic trail of call lifecycle transitions. Enforced append-only
-- at the privilege level: service_role has INSERT+SELECT only (no UPDATE/DELETE/
-- TRUNCATE); anon/authenticated SELECT only; postgres retains full for retention.
CREATE TABLE IF NOT EXISTS public.call_events (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id            uuid,
  signalwire_call_id text,
  user_id            text,
  campaign_id        uuid,
  lead_id            uuid,
  event_type         text NOT NULL,
  status             text,
  source             text NOT NULL DEFAULT 'system',
  detail             jsonb,
  created_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_call_events_call_id ON public.call_events (call_id, created_at);
CREATE INDEX IF NOT EXISTS idx_call_events_sid     ON public.call_events (signalwire_call_id, created_at);
CREATE INDEX IF NOT EXISTS idx_call_events_created ON public.call_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_call_events_user    ON public.call_events (user_id, created_at DESC);
ALTER TABLE public.call_events ENABLE ROW LEVEL SECURITY;

-- Webhook idempotency ledger for SignalWire callbacks (dedup + ordering).
-- PK (event_key) dedupes; sequence_no enforces ordering; processing_status
-- tracks received/processed/failed with attempt counting.
CREATE TABLE IF NOT EXISTS public.telephony_events (
  event_key         text PRIMARY KEY,
  call_sid          text NOT NULL,
  webhook           text NOT NULL,
  status            text,
  sequence_no       integer,
  processing_status text NOT NULL DEFAULT 'received',
  received_at       timestamptz NOT NULL DEFAULT now(),
  processed_at      timestamptz,
  error_message     text,
  attempts          integer NOT NULL DEFAULT 1
);
ALTER TABLE public.telephony_events ENABLE ROW LEVEL SECURITY;

-- Append-only audit trail for account/subscription lifecycle events
-- (account_created, initial_sub, resub, renewal, cancel). Deliberately has
-- no foreign key to users — it carries a denormalized name/email snapshot
-- taken at write time so it keeps meaning after an account is deleted.
-- See migrations/BILLING_EVENTS_AUDIT_LOG_2026-07-18.sql for the full
-- rationale. Same append-only privilege pattern as call_events above.
CREATE TABLE IF NOT EXISTS public.billing_events (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_id         text NOT NULL,
  event_type       text NOT NULL CHECK (event_type IN (
                     'account_created', 'initial_sub', 'resub', 'renewal', 'cancel', 'account_deleted'
                   )),
  plan             text,
  amount_cents     integer NOT NULL DEFAULT 0,
  retention_weeks  integer,
  stripe_subscription_id text,
  user_name        text NOT NULL,
  user_email       text,
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_billing_events_created  ON public.billing_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_billing_events_clerk_id ON public.billing_events (clerk_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_billing_events_type     ON public.billing_events (event_type, created_at DESC);
ALTER TABLE public.billing_events ENABLE ROW LEVEL SECURITY;
