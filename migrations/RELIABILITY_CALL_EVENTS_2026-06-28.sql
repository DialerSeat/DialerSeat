-- ============================================================================
-- Reliability tier: call_events log — applied live to ajknvwdojwrtxzrikpak
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.call_events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id       uuid,
  signalwire_call_id text,
  user_id       text,
  campaign_id   uuid,
  lead_id       uuid,
  event_type    text NOT NULL,
  status        text,
  source        text NOT NULL DEFAULT 'system',
  detail        jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_call_events_call_id ON public.call_events (call_id, created_at);
CREATE INDEX IF NOT EXISTS idx_call_events_sid ON public.call_events (signalwire_call_id, created_at);
CREATE INDEX IF NOT EXISTS idx_call_events_created ON public.call_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_call_events_user ON public.call_events (user_id, created_at DESC);
ALTER TABLE public.call_events ENABLE ROW LEVEL SECURITY;
