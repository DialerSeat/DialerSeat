# Reliability tier: call event log + stale-call reaper

## 1. Append-only call event log (APPLIED LIVE)
- Table public.call_events — immutable forensic trail of call lifecycle
  transitions (initiated/ringing/answered/amd_result/bridged/completed/failed/
  abandoned/disposition_set/hangup_requested/recording_ready/reaped). RLS
  enabled, no policy (deny-all; server-only via service-role). Advisor: clean,
  no new ERROR/WARN.
- lib/callEvents.ts — logCallEvent(): FIRE-AND-FORGET. Never throws, never
  blocks the caller. A logging failure is swallowed + console'd so it can NEVER
  break a live call.

## 2. Stale-call reaper (cron)
- app/api/cron/stale-call-reaper/route.ts — every 15 min (vercel.json).
  CRON_SECRET-auth. Cleans TWO leak/wedge conditions:
    a) call_rooms older than 120 min — dead bridges that were never cleaned up
       (today they leak FOREVER: all 135 existing rooms are >2h old). No real
       call lasts 2h, so a live call is never touched.
    b) agent_sessions with current_call_id set but heartbeat dead >5 min —
       a wedged agent (browser crashed mid-call). Clears current_call_id and
       parks state='idle' so they can dial again.
  Every reap writes a call_events row (source 'reaper') for forensics.
  DRY-RUN verified against live data: would reap 135 dead rooms, free 0 wedged
  sessions, touch 0 active on-call sessions.

## 3. Event emission wired at 2 key points (fire-and-forget)
- leads/dispose → 'disposition_set' (with resolved call_id, duration)
- calls/status webhook → 'completed'/'failed'/'ringing'/'answered'
  More emit points (outbound 'initiated', amd-result) can be added incrementally.

## Apply
DB migration already live. Add lib/callEvents.ts + the reaper route, update
vercel.json (adds the reaper cron), replace leads/dispose + calls/status.
Requires CRON_SECRET (already used by pool crons).

## NOTE on call_rooms cleanup
The reaper is a SAFETY NET for leaked rooms. Ideally call_rooms rows are deleted
when a call ends (in the hangup/terminal-status path) — a future enhancement.
Until then, the reaper prevents unbounded growth.
