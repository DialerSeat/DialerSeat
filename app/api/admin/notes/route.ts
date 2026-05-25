import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/requireAdmin'

// =============================================================================
// /api/admin/notes
// =============================================================================
// Admin-only personal scratchpad. Notes are owned by the calling admin's
// clerk_id — no sharing, no team notes (v1).
//
// GET   → list of {id, title, body, created_at, updated_at}, newest first
// POST  → create empty note, returns the new row
//
// Single-note ops (PATCH, DELETE) live in [id]/route.ts.
// =============================================================================

const supabaseAdmin = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

export async function GET() {
  const gate = await requireAdmin()
  if (!gate.ok) {
    return NextResponse.json({ error: gate.message }, { status: gate.status })
  }

  const supabase = supabaseAdmin()
  const { data, error } = await supabase
    .from('admin_notes')
    .select('id, title, body, created_at, updated_at')
    .eq('owner_clerk_id', gate.clerkId)
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
    })
    .select('id, title, body, created_at, updated_at')
    .single()

  if (error || !data) {
    console.error('[POST /api/admin/notes]', error)
    return NextResponse.json({ error: 'Failed to create note' }, { status: 500 })
  }

  return NextResponse.json({ note: data })
}