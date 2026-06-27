// lib/calendar.ts
// =============================================================================
// Calendar domain logic: recurrence expansion + types.
// =============================================================================
// We store recurring events as a single row with an RRULE-style string rather
// than exploding into one row per occurrence. This expands a recurring event
// into the concrete occurrences that fall inside a requested [from, to] window.
//
// SUPPORTED RULES (a focused, honest subset — what a dialer calendar needs):
//   FREQ=DAILY                          every day
//   FREQ=WEEKLY                         every week on the event's weekday
//   FREQ=WEEKLY;BYDAY=MO,WE,FR          specific weekdays
//   FREQ=MONTHLY                        same day-of-month each month
//   FREQ=YEARLY                         same month/day each year
//   ...optionally with INTERVAL=n       every n days/weeks/months/years
// Bounded by recurrence_until (inclusive) when set, else capped to the window.
// Anything we don't recognize is treated as a one-off (the base event only),
// which fails safe rather than silently dropping the event.
// =============================================================================

export interface CalendarEvent {
  id: string
  user_id: string
  title: string
  description: string | null
  starts_at: string // ISO
  ends_at: string | null
  all_day: boolean
  rrule: string | null
  recurrence_until: string | null
  source: 'manual' | 'disposition'
  event_type: 'event' | 'callback' | 'appointment'
  lead_id: string | null
  call_id: string | null
  color: string | null
  created_at: string
  updated_at: string
}

// A concrete occurrence the UI renders. Same fields as the event, plus the
// resolved occurrence start/end and a flag noting it came from a recurrence.
export interface EventOccurrence extends CalendarEvent {
  occurrence_start: string // ISO
  occurrence_end: string | null
  is_recurring_instance: boolean
}

const WEEKDAY_CODES: Record<string, number> = {
  SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6,
}

interface ParsedRule {
  freq: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY'
  interval: number
  byday: number[] | null // weekday numbers for WEEKLY
}

function parseRRule(rrule: string): ParsedRule | null {
  const parts: Record<string, string> = {}
  for (const seg of rrule.split(';')) {
    const [k, v] = seg.split('=')
    if (k && v) parts[k.trim().toUpperCase()] = v.trim().toUpperCase()
  }
  const freq = parts.FREQ as ParsedRule['freq']
  if (!freq || !['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'].includes(freq)) return null
  const interval = parts.INTERVAL ? Math.max(1, parseInt(parts.INTERVAL)) : 1
  let byday: number[] | null = null
  if (parts.BYDAY) {
    byday = parts.BYDAY.split(',')
      .map(d => WEEKDAY_CODES[d])
      .filter(n => n !== undefined)
    if (byday.length === 0) byday = null
  }
  return { freq, interval, byday }
}

function addDays(d: Date, n: number): Date { const x = new Date(d); x.setUTCDate(x.getUTCDate() + n); return x }
function addMonths(d: Date, n: number): Date { const x = new Date(d); x.setUTCMonth(x.getUTCMonth() + n); return x }
function addYears(d: Date, n: number): Date { const x = new Date(d); x.setUTCFullYear(x.getUTCFullYear() + n); return x }
function sameYMD(a: Date, b: Date): boolean {
  return a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth() && a.getUTCDate() === b.getUTCDate()
}

// Hard safety cap so a pathological rule can never spin forever.
const MAX_OCCURRENCES = 1000

/**
 * Expand a single event into the occurrences overlapping [windowFrom, windowTo].
 * Non-recurring events return their single occurrence if it overlaps the window.
 */
export function expandEvent(
  event: CalendarEvent,
  windowFrom: Date,
  windowTo: Date
): EventOccurrence[] {
  const start = new Date(event.starts_at)
  const durationMs = event.ends_at ? new Date(event.ends_at).getTime() - start.getTime() : 0

  const makeOccurrence = (occStart: Date, isRecurring: boolean): EventOccurrence => ({
    ...event,
    occurrence_start: occStart.toISOString(),
    occurrence_end: durationMs > 0 ? new Date(occStart.getTime() + durationMs).toISOString() : event.ends_at,
    is_recurring_instance: isRecurring,
  })

  // Non-recurring: include if it overlaps the window.
  if (!event.rrule) {
    const occEnd = durationMs > 0 ? new Date(start.getTime() + durationMs) : start
    if (occEnd >= windowFrom && start <= windowTo) return [makeOccurrence(start, false)]
    return []
  }

  const rule = parseRRule(event.rrule)
  if (!rule) {
    // Unrecognized rule → treat as one-off (fail safe).
    if (start >= windowFrom && start <= windowTo) return [makeOccurrence(start, false)]
    return []
  }

  const until = event.recurrence_until ? new Date(event.recurrence_until) : null
  const hardEnd = until && until < windowTo ? until : windowTo

  const out: EventOccurrence[] = []
  let guard = 0

  if (rule.freq === 'WEEKLY' && rule.byday && rule.byday.length > 0) {
    // Walk week by week from the event's week start; emit each selected weekday.
    // Begin at the Sunday of the event's starting week.
    let weekCursor = addDays(start, -start.getUTCDay())
    while (weekCursor <= hardEnd && guard < MAX_OCCURRENCES) {
      for (const wd of rule.byday) {
        const occ = addDays(weekCursor, wd)
        // Preserve the event's clock time.
        occ.setUTCHours(start.getUTCHours(), start.getUTCMinutes(), start.getUTCSeconds(), 0)
        if (occ >= start && occ >= windowFrom && occ <= hardEnd) {
          out.push(makeOccurrence(occ, true))
          guard++
        }
      }
      weekCursor = addDays(weekCursor, 7 * rule.interval)
    }
  } else {
    // DAILY / WEEKLY(no byday) / MONTHLY / YEARLY: step a single cursor.
    let cursor = new Date(start)
    while (cursor <= hardEnd && guard < MAX_OCCURRENCES) {
      if (cursor >= windowFrom) { out.push(makeOccurrence(cursor, true)); guard++ }
      if (rule.freq === 'DAILY') cursor = addDays(cursor, rule.interval)
      else if (rule.freq === 'WEEKLY') cursor = addDays(cursor, 7 * rule.interval)
      else if (rule.freq === 'MONTHLY') cursor = addMonths(cursor, rule.interval)
      else cursor = addYears(cursor, rule.interval)
    }
  }

  // Sort by occurrence time for stable rendering.
  out.sort((a, b) => a.occurrence_start.localeCompare(b.occurrence_start))
  return out
}

/**
 * Expand a list of events against a window, returning a flat, sorted list of
 * occurrences. This is what the calendar UI consumes for a given month view.
 */
export function expandEvents(
  events: CalendarEvent[],
  windowFrom: Date,
  windowTo: Date
): EventOccurrence[] {
  const all: EventOccurrence[] = []
  for (const ev of events) all.push(...expandEvent(ev, windowFrom, windowTo))
  all.sort((a, b) => a.occurrence_start.localeCompare(b.occurrence_start))
  return all
}

// Re-export the weekday codes for the UI's recurrence picker.
export { WEEKDAY_CODES }
void sameYMD // reserved for future "this occurrence only" edit support
