-- =============================================================================
-- A CALL THE AGENT ENDED IS NOT A LINE THAT FAILED
-- =============================================================================
-- The hangup webhook files a call as AGENT_LEG_FAILED ("agent browser did not
-- answer its leg; lead never rang") whenever the lead was never answered and
-- the agent's browser side ended its leg. An agent pressing SKIP, STOP or
-- ABORT while the lead's phone is ringing produces exactly that shape.
--
-- 15-18 Sept 2026: of 85 AGENT_LEG_FAILED calls, 48 were the dialer asking to
-- hang up first. Their lead legs had rung ~12 s on average, yet each was
-- recorded as never rung: the attempt was not counted, the pool number's usage
-- was refunded, and the Florida three-a-day count (which excludes
-- AGENT_LEG_FAILED) did not see them. They also inflated the failure rate the
-- socket-health breaker and the dial-agent-on-answer decision read.
--
-- Stamped by /api/calls/hangup and /api/dialer/abort BEFORE the hangup is sent,
-- on the call row the webhook already reads, so there is no ordering race with
-- Telnyx's own hangup event.
-- =============================================================================

alter table public.calls
  add column if not exists ended_by_agent_at timestamptz;

comment on column public.calls.ended_by_agent_at is
  'When the dialer asked to end this call (skip, stop, abort). Set before the hangup is sent. A call with this set is never AGENT_LEG_FAILED.';
