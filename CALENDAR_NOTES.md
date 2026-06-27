# Calendar + scheduling spine — what shipped

## Database (live)
- calendar_events — full per-agent calendar: timed / all-day / recurring (RRULE).
  Two sources: manual UI creation, and dialer dispositions (appointment/callback).
- dial_attempts — append-only attempt history (powers future cadence / best-time).
- leads.next_eligible_at — DORMANT re-dial gate (NULL everywhere; claim path
  unchanged). Added now so future cadence/callback re-dialing has the column.
All three: RLS enabled, no policies (anon denied; server uses service-role).
Advisor: no new ERRORs/WARNs — they sit in the same safe posture as every other table.

## API
- GET/POST /api/calendar/events  — list (with recurrence expansion) + create
- PATCH/DELETE /api/calendar/events/[id] — edit/delete (ownership-checked)
All use getServiceClient() + apiError(), scoped to the authenticated agent.
Each agent sees ONLY their own events.

## UI
- /dashboard/calendar — month grid (date-accurate), date search, click/double-
  click a day to create, click an event to edit/delete, full recurrence picker
  (daily/weekly-by-weekday/monthly/yearly + until). All colors via tenant-
  overridable --brand-* tokens.
- Sidebar: CALENDAR button for ALL users, just below GO TO DESKTOP (manager+),
  above the profile row — same nav-tab styling.

## Dialer integration (no popups)
- Dispositioning APPOINTMENT reveals an inline date/time scheduler in the
  disposition sheet. "ADD TO CALENDAR" creates an appointment event linked to the
  lead; "SKIP SCHEDULING" advances without one. The event simply appears on the
  agent's calendar — no notifications, per your design.

## Recurrence engine (lib/calendar.ts)
Focused, dependency-free RRULE expander: FREQ=DAILY/WEEKLY/MONTHLY/YEARLY,
optional INTERVAL=n, weekly BYDAY. Unknown rules fail safe to one-off. Verified
the occurrence math (weekly MO,WE,FR and daily interval=3) produces exact dates.
