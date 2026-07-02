import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getServiceClient } from '@/lib/supabase'

const supabaseAdmin = () =>
  getServiceClient('manager/notes')

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