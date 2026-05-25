import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/requireAdmin'

// =============================================================================
// /api/admin/notes/[id]
// =============================================================================
// PATCH  → update title and/or body (debounced autosave from Notes app)
// DELETE → hard delete
//
// All ops verify ownership: the note's owner_clerk_id must match the caller's
// clerk_id. Service-role key bypasses RLS, so the .eq('owner_clerk_id') in
// every query IS the authorization check. Do not relax it.
// =============================================================================

const supabaseAdmin = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

interface PatchBody {
  title?: string
  body?: string
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

  // Whitelist updatable fields. updated_at is set server-side.
  const updates: Record<string, any> = { updated_at: new Date().toISOString() }
  if (typeof body.title === 'string') updates.title = body.title.slice(0, 500)
  if (typeof body.body === 'string') updates.body = body.body.slice(0, 100_000) // 100kb cap

  // If neither field provided, return early — no-op
  if (Object.keys(updates).length === 1) {
    return NextResponse.json({ note: null, noop: true })
  }

  const supabase = supabaseAdmin()
  const { data, error } = await supabase
    .from('admin_notes')
    .update(updates)
    .eq('id', id)
    .eq('owner_clerk_id', gate.clerkId)   // ← authorization
    .select('id, title, body, created_at, updated_at')
    .single()

  if (error) {
    console.error('[PATCH /api/admin/notes/:id]', error)
    return NextResponse.json({ error: 'Failed to update note' }, { status: 500 })
  }
  if (!data) {
    // Either doesn't exist or isn't owned by caller
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