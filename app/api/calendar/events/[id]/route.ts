import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getServiceClient } from '@/lib/supabase'
import { apiError, apiUnauthorized } from '@/lib/apiError'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const db = getServiceClient('calendar/events/[id]')

// =============================================================================
// PATCH /api/calendar/events/[id]  — update an event the agent owns
// DELETE /api/calendar/events/[id] — delete an event the agent owns
// Both verify ownership explicitly (user_id match) before mutating, so one
// agent can never edit or delete another's event even though the server client
// bypasses RLS.
// =============================================================================

async function ownsEvent(id: string, userId: string): Promise<boolean> {
  const { data } = await db
    .from('calendar_events')
    .select('id')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle()
  return !!data
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth()
    if (!userId) return apiUnauthorized()
    const { id } = await params

    if (!(await ownsEvent(id, userId))) {
      return apiError(new Error('not found or not owner'), {
        route: 'calendar/events/[id]', status: 404, clientMessage: 'Event not found.',
      })
    }

    const body = await req.json()
    const updates: Record<string, any> = { updated_at: new Date().toISOString() }

    if (typeof body.title === 'string') {
      const t = body.title.trim()
      if (!t) return apiError(new Error('empty title'), {
        route: 'calendar/events/[id]', status: 400, clientMessage: 'Title cannot be empty.',
      })
      updates.title = t
    }
    if ('description' in body) updates.description = body.description ?? null
    if (body.starts_at && !isNaN(new Date(body.starts_at).getTime())) {
      updates.starts_at = new Date(body.starts_at).toISOString()
    }
    if ('ends_at' in body) {
      updates.ends_at = body.ends_at && !isNaN(new Date(body.ends_at).getTime())
        ? new Date(body.ends_at).toISOString() : null
    }
    if (typeof body.all_day === 'boolean') updates.all_day = body.all_day
    if ('rrule' in body) {
      updates.rrule = typeof body.rrule === 'string' && body.rrule.trim() ? body.rrule.trim() : null
    }
    if ('recurrence_until' in body) {
      updates.recurrence_until = body.recurrence_until && !isNaN(new Date(body.recurrence_until).getTime())
        ? new Date(body.recurrence_until).toISOString() : null
    }
    if (['event', 'callback', 'appointment'].includes(body.event_type)) updates.event_type = body.event_type
    if ('color' in body) updates.color = typeof body.color === 'string' ? body.color : null

    const { data, error } = await db
      .from('calendar_events')
      .update(updates)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single()
    if (error) return apiError(error, { route: 'calendar/events/[id]' })

    return NextResponse.json({ success: true, event: data })
  } catch (err) {
    return apiError(err, { route: 'calendar/events/[id]' })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth()
    if (!userId) return apiUnauthorized()
    const { id } = await params

    const { error } = await db
      .from('calendar_events')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)
    if (error) return apiError(error, { route: 'calendar/events/[id]' })

    return NextResponse.json({ success: true })
  } catch (err) {
    return apiError(err, { route: 'calendar/events/[id]' })
  }
}
