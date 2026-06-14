import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'

// =============================================================================
// /api/manager/notes/[id]  — update / delete one of the caller's notes
// =============================================================================
// Auth-gated (not admin). Every query is filtered by owner_clerk_id = caller,
// so a user can only ever touch their own notes even if they guess an id.
//
// PATCH  body: { title?, body?, starred? } → partial update, returns the row
// DELETE                                    → removes the note
// =============================================================================

const supabaseAdmin = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

const NOTE_COLS = 'id, title, body, starred, pin_order, created_at, updated_at'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await params

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Malformed JSON' }, { status: 400 })
  }

  const patch: Record<string, any> = { updated_at: new Date().toISOString() }
  if (typeof body.title === 'string') patch.title = body.title
  if (typeof body.body === 'string') patch.body = body.body
  if (typeof body.starred === 'boolean') patch.starred = body.starred

  const supabase = supabaseAdmin()
  const { data, error } = await supabase
    .from('admin_notes')
    .update(patch)
    .eq('id', id)
    .eq('owner_clerk_id', userId)   // ownership filter — can't edit others' notes
    .select(NOTE_COLS)
    .maybeSingle()

  if (error) {
    console.error('[PATCH /api/manager/notes/[id]]', error)
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
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await params

  const supabase = supabaseAdmin()
  const { error } = await supabase
    .from('admin_notes')
    .delete()
    .eq('id', id)
    .eq('owner_clerk_id', userId)   // ownership filter

  if (error) {
    console.error('[DELETE /api/manager/notes/[id]]', error)
    return NextResponse.json({ error: 'Failed to delete note' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}