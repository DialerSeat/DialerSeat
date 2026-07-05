import { NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { requireAdmin } from '@/lib/requireAdmin'

const supabaseAdmin = () =>
  getServiceClient('admin/notes')

const NOTE_COLS = 'id, title, body, starred, pin_order, created_at, updated_at, content_edited_at'

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