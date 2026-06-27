-- ============================================================================
-- Telephony webhook idempotency — applied live to ajknvwdojwrtxzrikpak
-- Date: 2026-06-27
-- ============================================================================
-- Mirrors the stripe_events pattern for SignalWire call webhooks. Fixes the
-- "call lasted 0s" bug class: at-least-once, out-of-order webhook delivery let
-- a duplicate or stale callback overwrite a real call duration/disposition.

CREATE TABLE IF NOT EXISTS public.telephony_events (
  event_key         text PRIMARY KEY,           -- "<CallSid>:<webhook>:<status>"
  call_sid          text NOT NULL,
  webhook           text NOT NULL,              -- 'status' | 'amd' | 'recording'
  status            text,                        -- CallStatus / AnsweredBy / RecordingStatus
  sequence_no       integer,                     -- SignalWire SequenceNumber (nullable)
  processing_status text NOT NULL DEFAULT 'received',  -- received|processed|failed|skipped
  received_at       timestamptz NOT NULL DEFAULT now(),
  processed_at      timestamptz,
  error_message     text,
  attempts          integer NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_telephony_events_call_sid
  ON public.telephony_events (call_sid, received_at DESC);

ALTER TABLE public.telephony_events ENABLE ROW LEVEL SECURITY;
-- No policies → anon/authenticated denied; server uses service-role (bypasses RLS).

-- Verified live: duplicate event_key insert conflicts (dedup); a stale
-- SequenceNumber (<= highest processed) is rejected (ordering), so a late/dup
-- callback can no longer clobber a real duration.
