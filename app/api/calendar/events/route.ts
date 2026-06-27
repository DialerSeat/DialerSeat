import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getServiceClient } from '@/lib/supabase'
import { apiError, apiUnauthorized } from '@/lib/apiError'
import { expandEvents, type CalendarEvent } from '@/lib/calendar'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const db = getServiceClient('calendar/events')

// =============================================================================
// GET /api/calendar/events?from=ISO&to=ISO
// Returns the signed-in agent's events whose occurrences fall in [from, to],
// with recurring events expanded into concrete occurrences. Scoped to the
// authenticated user only — an agent never sees anyone else's events.
// =============================================================================
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return apiUnauthorized()

    const { searchParams } = new URL(req.url)
    const fromParam = searchParams.get('from')
    const toParam = searchParams.get('to')

    // Default to the current month +/- a buffer if no window given.
    const now = new Date()
    const from = fromParam ? new Date(fromParam) : new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const to = toParam ? new Date(toParam) : new Date(now.getFullYear(), now.getMonth() + 2, 0)

    if (isNaN(from.getTime()) || isNaN(to.getTime())) {
      return apiError(new Error('invalid date window'), {
        route: 'calendar/events', status: 400, clientMessage: 'Invalid date range.',
      })
    }

    // Fetch: (a) non-recurring events overlapping the window, and (b) ALL
    // recurring events for this user (a recurring event's base starts_at can
    // precede the window yet still have occurrences inside it). Expansion then
    // narrows to the window. Recurring events per agent are few, so this is cheap.
    const [{ data: windowed, error: e1 }, { data: recurring, error: e2 }] = await Promise.all([
      db.from('calendar_events')
        .select('*')
        .eq('user_id', userId)
        .is('rrule', null)
        .lte('starts_at', to.toISOString())
        .gte('starts_at', new Date(from.getTime() - 1000 * 60 * 60 * 24 * 2).toISOString()),
      db.from('calendar_events')
        .select('*')
        .eq('user_id', userId)
        .not('rrule', 'is', null),
    ])

    if (e1) return apiError(e1, { route: 'calendar/events' })
    if (e2) return apiError(e2, { route: 'calendar/events' })

    const events = [...(windowed || []), ...(recurring || [])] as CalendarEvent[]
    const occurrences = expandEvents(events, from, to)

    return NextResponse.json({ success: true, events: occurrences })
  } catch (err) {
    return apiError(err, { route: 'calendar/events' })
  }
}

// =============================================================================
// POST /api/calendar/events
// Create an event for the signed-in agent. Body:
//   { title, description?, starts_at, ends_at?, all_day?, rrule?,
//     recurrence_until?, event_type?, color?, lead_id?, call_id? }
// source is forced to 'manual' here (the dialer uses a separate internal path).
// =============================================================================
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return apiUnauthorized()

    const body = await req.json()
    const title = typeof body.title === 'string' ? body.title.trim() : ''
    if (!title) {
      return apiError(new Error('title required'), {
        route: 'calendar/events', status: 400, clientMessage: 'A title is required.',
      })
    }
    if (!body.starts_at || isNaN(new Date(body.starts_at).getTime())) {
      return apiError(new Error('starts_at required'), {
        route: 'calendar/events', status: 400, clientMessage: 'A valid start date/time is required.',
      })
    }

    const row = {
      user_id: userId,
      title,
      description: typeof body.description === 'string' ? body.description : null,
      starts_at: new Date(body.starts_at).toISOString(),
      ends_at: body.ends_at && !isNaN(new Date(body.ends_at).getTime())
        ? new Date(body.ends_at).toISOString() : null,
      all_day: body.all_day === true,
      rrule: typeof body.rrule === 'string' && body.rrule.trim() ? body.rrule.trim() : null,
      recurrence_until: body.recurrence_until && !isNaN(new Date(body.recurrence_until).getTime())
        ? new Date(body.recurrence_until).toISOString() : null,
      source: 'manual' as const,
      event_type: ['event', 'callback', 'appointment'].includes(body.event_type) ? body.event_type : 'event',
      color: typeof body.color === 'string' ? body.color : null,
      lead_id: typeof body.lead_id === 'string' ? body.lead_id : null,
      call_id: typeof body.call_id === 'string' ? body.call_id : null,
    }

    const { data, error } = await db.from('calendar_events').insert(row).select().single()
    if (error) return apiError(error, { route: 'calendar/events' })

    return NextResponse.json({ success: true, event: data })
  } catch (err) {
    return apiError(err, { route: 'calendar/events' })
  }
}
