import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { requireAdmin } from '@/lib/requireAdmin'

// =============================================================================
// /api/admin/notes/[id]
// =============================================================================
// PATCH  → update title, body, starred, and/or pin_order
// DELETE → hard delete
//
// All ops verify ownership: the note's owner_clerk_id must match the caller's
// clerk_id. Service-role key bypasses RLS, so the .eq('owner_clerk_id') in
// every query IS the authorization check. Do not relax it.
//
// v23 CHANGES:
//   - PATCH whitelist now includes `starred` (boolean) and `pin_order`
//     (number | null).
//   - When a note is starred (starred: true) and no pin_order is supplied,
//     we assign it pin_order = (max existing pin_order for this owner) + 1
//     so newly-pinned notes land at the BOTTOM of the pinned group (then the
//     user can drag to reorder). When unstarred, pin_order is reset to null.
// =============================================================================

const supabaseAdmin = () =>
  getServiceClient('admin/notes/[id]')

const NOTE_COLS = 'id, title, body, starred, pin_order, created_at, updated_at'

interface PatchBody {
  title?: string
  body?: string
  starred?: boolean
  pin_order?: number | null
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = await requireAdmin()
  if (!gate.ok) {
    return NextResponse.json({ error: gate.message }, { status: gate.status })
  }
  const { id } = await params

  let body: PatchBody
  try {
    body = (await req.json()) as PatchBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const supabase = supabaseAdmin()

  // Whitelist updatable fields. updated_at is set server-side.
  const updates: Record<string, any> = { updated_at: new Date().toISOString() }
  if (typeof body.title === 'string') updates.title = body.title.slice(0, 500)
  if (typeof body.body === 'string') updates.body = body.body.slice(0, 100_000) // 100kb cap

  // ── Starring ──────────────────────────────────────────────────────────
  // - star=true  → set starred true; if no explicit pin_order given, place
  //   at the bottom of the pinned group (max+1) so it doesn't jump above
  //   existing pins.
  // - star=false → clear starred AND pin_order (it leaves the pinned group).
  if (typeof body.starred === 'boolean') {
    updates.starred = body.starred
    if (body.starred === false) {
      updates.pin_order = null
    } else if (body.starred === true && typeof body.pin_order !== 'number') {
      // Compute max pin_order for this owner to append at the end.
      const { data: maxRow } = await supabase
        .from('admin_notes')
        .select('pin_order')
        .eq('owner_clerk_id', gate.clerkId)
        .not('pin_order', 'is', null)
        .order('pin_order', { ascending: false })
        .limit(1)
        .maybeSingle()
      const nextOrder = (maxRow?.pin_order ?? -1) + 1
      updates.pin_order = nextOrder
    }
  }

  // Explicit pin_order override (e.g. single-note nudge). Allow number|null.
  if (typeof body.pin_order === 'number' || body.pin_order === null) {
    updates.pin_order = body.pin_order
  }

  // If only updated_at would change, no-op.
  if (Object.keys(updates).length === 1) {
    return NextResponse.json({ note: null, noop: true })
  }

  const { data, error } = await supabase
    .from('admin_notes')
    .update(updates)
    .eq('id', id)
    .eq('owner_clerk_id', gate.clerkId)   // ← authorization
    .select(NOTE_COLS)
    .single()

  if (error) {
    console.error('[PATCH /api/admin/notes/:id]', error)
    return NextResponse.json({ error: 'Failed to update note' }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ error: 'Note not found' }, { status: 404 })
  }

  return NextResponse.json({ note: data })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = await requireAdmin()
  if (!gate.ok) {
    return NextResponse.json({ error: gate.message }, { status: gate.status })
  }
  const { id } = await params

  const supabase = supabaseAdmin()
  const { error, count } = await supabase
    .from('admin_notes')
    .delete({ count: 'exact' })
    .eq('id', id)
    .eq('owner_clerk_id', gate.clerkId)

  if (error) {
    console.error('[DELETE /api/admin/notes/:id]', error)
    return NextResponse.json({ error: 'Failed to delete note' }, { status: 500 })
  }
  if (!count) {
    return NextResponse.json({ error: 'Note not found' }, { status: 404 })
  }

  return NextResponse.json({ ok: true })
}