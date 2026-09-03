import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { requireAdmin } from '@/lib/admin'

// =============================================================================
// /api/admin/suggestions — what the desktop's Suggestions app reads and writes
// =============================================================================
// The public counterpart is app/api/suggestions, which anyone can POST to.
// This one is admin-only, and it is the only way anything reads the table back:
// suggestions carry a visitor's email and free text, so nothing about them is
// exposed to a browser that has not passed requireAdmin().
// =============================================================================

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const supabase = getServiceClient('admin/suggestions')

const STATUSES = new Set(['new', 'read', 'archived'])
const PAGE_SIZE = 100

export async function GET(req: NextRequest) {
  try {
    await requireAdmin()
  } catch (res) {
    return res as Response
  }

  const status = req.nextUrl.searchParams.get('status')

  let query = supabase
    .from('suggestions')
    .select('id, created_at, kind, message, email, source_path, status')
    .order('created_at', { ascending: false })
    .limit(PAGE_SIZE)

  // No filter means "everything except archived". Archived is a place things
  // go to stop being in the way, so showing it by default would defeat it.
  if (status && STATUSES.has(status)) {
    query = query.eq('status', status)
  } else {
    query = query.neq('status', 'archived')
  }

  const { data, error } = await query
  if (error) {
    console.error('[admin/suggestions] read failed:', error)
    return NextResponse.json({ error: 'Could not load suggestions.' }, { status: 500 })
  }

  // The unread count drives the app's badge, and it has to be counted across
  // the whole table rather than the page above — a badge that only counts the
  // first hundred rows stops being true exactly when it matters.
  const { count: unread } = await supabase
    .from('suggestions')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'new')

  return NextResponse.json({ suggestions: data ?? [], unread: unread ?? 0 })
}

export async function PATCH(req: NextRequest) {
  try {
    await requireAdmin()
  } catch (res) {
    return res as Response
  }

  let payload: unknown
  try {
    payload = await req.json()
  } catch {
    return NextResponse.json({ error: 'Expected JSON.' }, { status: 400 })
  }

  const body = (payload ?? {}) as Record<string, unknown>
  const id = typeof body.id === 'string' ? body.id : ''
  const status = typeof body.status === 'string' ? body.status : ''

  if (!id) return NextResponse.json({ error: 'Missing id.' }, { status: 400 })
  if (!STATUSES.has(status)) {
    return NextResponse.json({ error: 'Unknown status.' }, { status: 400 })
  }

  const { error } = await supabase.from('suggestions').update({ status }).eq('id', id)
  if (error) {
    console.error('[admin/suggestions] update failed:', error)
    return NextResponse.json({ error: 'Could not update that.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
