# Deploy fix + opportunistic stuck-session recovery

## 1. THE DEPLOY BLOCKER (vercel.json) — this is why git push stopped deploying
The stale-call-reaper cron was scheduled every 15 min (*/15 * * * *). Vercel
HOBBY plan only allows ONCE-PER-DAY crons — any more frequent expression FAILS
THE BUILD with "Hobby accounts are limited to daily cron jobs." So every push
reached Vercel and errored during deployment (looked like auto-deploy broke).
FIX: reaper rescheduled to daily (0 4 * * *). All three crons are now daily and
pass Hobby validation, so deploys go through again.

## 2. Opportunistic stuck-session recovery (heartbeat) — replaces the need for a
##    frequent reaper cron for agent recovery
app/api/dialer/heartbeat/route.ts: before the session upsert, if the call the
session would be pinned to is finished (has a disposition), missing, or older
than 30 min, current_call_id is cleared. So a wedged agent (browser crashed
mid-call) self-heals the instant their dialer sends its next heartbeat — no cron
wait. A genuine in-progress call (recent + no disposition) is preserved untouched.

Cost: ONE extra indexed PK lookup, and ONLY when the agent reports being on a
call (idle/ready beats add zero cost). The heartbeat is the hottest route, so
this conditional matters — verified it's gated behind `if (effectiveCallId)`.

## Division of labor now
- Active / returning agents → self-heal instantly via heartbeat (any plan).
- Truly-gone agents (crashed, never returned) → daily reaper backstop clears
  their leaked room + session. Nobody waits 24h for recovery anymore, because
  anyone actually using the app heals on their next beat.

If you later move to Vercel Pro, you can raise the reaper back to every 15 min
for faster cleanup of the truly-gone case — but it's no longer urgent.

## Apply
Replace vercel.json (unblocks deploys) and app/api/dialer/heartbeat/route.ts.
