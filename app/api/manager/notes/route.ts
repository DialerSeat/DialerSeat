import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'

// =============================================================================
// /api/manager/notes  — per-user private notes for the Manager+ desktop
// =============================================================================
// Same admin_notes table, but gated on AUTH (any signed-in user) instead of
// admin. Every row is keyed by owner_clerk_id = the caller, so each user only
// ever sees and edits THEIR OWN notes — no sharing, no cross-tenant leakage.
// This is the same privacy model the admin notes route uses; it's just not
// admin-restricted, so a Manager+ owner isn't 403'd.
//
// GET  → caller's notes, starred first (pin_order asc nulls last), then recent
// POST → create an empty note owned by the caller
// Single-note ops live in [id]/route.ts, reorder in reorder/route.ts.
// =============================================================================

const supabaseAdmin = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

const NOTE_COLS = 'id, title, body, starred, pin_order, created_at, updated_at'

export async function GET() {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = supabaseAdmin()
  const { data, error } = await supabase
    .from('admin_notes')
    .select(NOTE_COLS)
    .eq('owner_clerk_id', userId)
    .order('starred', { ascending: false })
    .order('pin_order', { ascending: true, nullsFirst: false })
    .order('updated_at', { ascending: false })
    .limit(500)

  if (error) {
    console.error('[GET /api/manager/notes]', error)
    return NextResponse.json({ error: 'Failed to load notes' }, { status: 500 })
  }

  return NextResponse.json({ notes: data ?? [] })
}

export async function POST() {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = supabaseAdmin()
  const { data, error } = await supabase
    .from('admin_notes')
    .insert({
      owner_clerk_id: userId,
      title: '',
      body: '',
      starred: false,
      pin_order: null,
    })
    .select(NOTE_COLS)
    .single()

  if (error || !data) {
    console.error('[POST /api/manager/notes]', error)
    return NextResponse.json({ error: 'Failed to create note' }, { status: 500 })
  }

  return NextResponse.json({ note: data })
}