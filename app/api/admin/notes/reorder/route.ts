import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { requireAdmin } from '@/lib/requireAdmin'

// =============================================================================
// /api/admin/notes/reorder
// =============================================================================
// POST { orderedIds: string[] }
//   orderedIds is the FULL list of pinned (starred) note IDs in their new
//   top-to-bottom order. We write pin_order = 0, 1, 2, ... in that sequence.
//
// This is the drag-reorder persistence for the starred group. One request
// per drop (option B) so the order is applied atomically-ish — we update
// each row, but a single failed row won't leave a half-applied order the
// way N independent client PATCHes could.
//
// Authorization: every update is scoped to the caller's clerk_id. A note ID
// in orderedIds that the caller doesn't own simply updates zero rows.
//
// We intentionally only touch the rows in orderedIds. Unstarred notes have
// pin_order = null and aren't included.
// =============================================================================

const supabaseAdmin = () =>
  getServiceClient('admin/notes/reorder')

interface ReorderBody {
  orderedIds?: string[]
}

export async function POST(req: NextRequest) {
  const gate = await requireAdmin()
  if (!gate.ok) {
    return NextResponse.json({ error: gate.message }, { status: gate.status })
  }

  let body: ReorderBody
  try {
    body = (await req.json()) as ReorderBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const ids = Array.isArray(body.orderedIds) ? body.orderedIds : null
  if (!ids) {
    return NextResponse.json({ error: 'orderedIds must be an array' }, { status: 400 })
  }
  if (ids.length === 0) {
    return NextResponse.json({ ok: true, updated: 0 })
  }
  if (ids.length > 500) {
    return NextResponse.json({ error: 'Too many ids' }, { status: 400 })
  }
  // All entries must be strings.
  if (!ids.every((x) => typeof x === 'string')) {
    return NextResponse.json({ error: 'orderedIds must be strings' }, { status: 400 })
  }

  const supabase = supabaseAdmin()
  const updatedAt = new Date().toISOString()

  // Write pin_order = index for each id. Run sequentially; small N (pinned
  // notes only). Each is scoped to owner_clerk_id for authorization.
  let updated = 0
  for (let i = 0; i < ids.length; i++) {
    const { error, count } = await supabase
      .from('admin_notes')
      .update({ pin_order: i, starred: true, updated_at: updatedAt }, { count: 'exact' })
      .eq('id', ids[i])
      .eq('owner_clerk_id', gate.clerkId)
    if (error) {
      console.error('[POST /api/admin/notes/reorder]', error)
      return NextResponse.json(
        { error: 'Failed to reorder', updatedSoFar: updated },
        { status: 500 }
      )
    }
    updated += count ?? 0
  }

  return NextResponse.json({ ok: true, updated })
}