-- ============================================================================
-- Scheduling spine + calendar — applied live to ajknvwdojwrtxzrikpak
-- Date: 2026-06-27
-- ============================================================================
-- Additive only. The existing dialer/claim path is UNTOUCHED.

-- calendar_events: the full per-agent calendar (timed/all-day/recurring).
-- Events come from manual creation AND dialer dispositions (callback/appointment).
CREATE TABLE IF NOT EXISTS public.calendar_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         text NOT NULL,
  title           text NOT NULL,
  description     text,
  starts_at       timestamptz NOT NULL,
  ends_at         timestamptz,
  all_day         boolean NOT NULL DEFAULT false,
  rrule           text,
  recurrence_until timestamptz,
  source          text NOT NULL DEFAULT 'manual',  -- 'manual' | 'disposition'
  event_type      text NOT NULL DEFAULT 'event',   -- 'event' | 'callback' | 'appointment'
  lead_id         uuid,
  call_id         uuid,
  color           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_calendar_events_user_start ON public.calendar_events (user_id, starts_at);
CREATE INDEX IF NOT EXISTS idx_calendar_events_user_recurring ON public.calendar_events (user_id) WHERE rrule IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_calendar_events_lead ON public.calendar_events (lead_id) WHERE lead_id IS NOT NULL;
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;

-- dial_attempts: append-only attempt history (current-state lives on leads).
CREATE TABLE IF NOT EXISTS public.dial_attempts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id         uuid NOT NULL,
  campaign_id     uuid,
  user_id         text NOT NULL,
  call_id         uuid,
  attempt_number  integer,
  outcome         text,
  from_number     text,
  attempted_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_dial_attempts_lead ON public.dial_attempts (lead_id, attempted_at DESC);
CREATE INDEX IF NOT EXISTS idx_dial_attempts_campaign ON public.dial_attempts (campaign_id, attempted_at DESC);
ALTER TABLE public.dial_attempts ENABLE ROW LEVEL SECURITY;

-- leads.next_eligible_at: DORMANT forward-scheduling gate (NULL today; the claim
-- RPC is unchanged, so this changes nothing until re-dial scheduling is wired).
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS next_eligible_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_leads_next_eligible
  ON public.leads (campaign_id, next_eligible_at) WHERE next_eligible_at IS NOT NULL;
