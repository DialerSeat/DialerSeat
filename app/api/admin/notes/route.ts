import { NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { requireAdmin } from '@/lib/requireAdmin'

// =============================================================================
// /api/admin/notes
// =============================================================================
// Admin-only personal scratchpad. Notes are owned by the calling admin's
// clerk_id — no sharing, no team notes (v1).
//
// GET   → list of {id, title, body, starred, pin_order, created_at, updated_at}
//          ordered: starred first (pin_order asc, nulls last), then the rest
//          by updated_at desc.
// POST  → create empty note, returns the new row
//
// Single-note ops (PATCH, DELETE) live in [id]/route.ts.
// Bulk reorder of pinned notes lives in reorder/route.ts.
//
// v23 CHANGES:
//   - SELECT now includes starred + pin_order.
//   - Ordering: starred DESC, pin_order ASC NULLS LAST, updated_at DESC so
//     starred notes float to the top in their manual drag order, and
//     unstarred notes follow by recency.
// =============================================================================

const supabaseAdmin = () =>
  getServiceClient('admin/notes')

const NOTE_COLS = 'id, title, body, starred, pin_order, created_at, updated_at'

export async function GET() {
  const gate = await requireAdmin()
  if (!gate.ok) {
    return NextResponse.json({ error: gate.message }, { status: gate.status })
  }

  const supabase = supabaseAdmin()
  const { data, error } = await supabase
    .from('admin_notes')
    .select(NOTE_COLS)
    .eq('owner_clerk_id', gate.clerkId)
    .order('starred', { ascending: false })
    .order('pin_order', { ascending: true, nullsFirst: false })
    .order('updated_at', { ascending: false })
    .limit(500)

  if (error) {
    console.error('[GET /api/admin/notes]', error)
    return NextResponse.json({ error: 'Failed to load notes' }, { status: 500 })
  }

  return NextResponse.json({ notes: data ?? [] })
}

export async function POST() {
  const gate = await requireAdmin()
  if (!gate.ok) {
    return NextResponse.json({ error: gate.message }, { status: gate.status })
  }

  const supabase = supabaseAdmin()
  const { data, error } = await supabase
    .from('admin_notes')
    .insert({
      owner_clerk_id: gate.clerkId,
      title: '',
      body: '',
      starred: false,
      pin_order: null,
    })
    .select(NOTE_COLS)
    .single()

  if (error || !data) {
    console.error('[POST /api/admin/notes]', error)
    return NextResponse.json({ error: 'Failed to create note' }, { status: 500 })
  }

  return NextResponse.json({ note: data })
}