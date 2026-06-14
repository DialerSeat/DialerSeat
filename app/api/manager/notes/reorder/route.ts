import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'

// =============================================================================
// /api/manager/notes/reorder  — persist pinned-note drag order
// =============================================================================
// Auth-gated. Body: { orderedIds: string[] } — the caller's starred notes in
// their new top-to-bottom order. Writes pin_order = index for each, filtered
// by owner_clerk_id so a user can only reorder their own notes.
// =============================================================================

const supabaseAdmin = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Malformed JSON' }, { status: 400 })
  }

  const orderedIds: string[] = Array.isArray(body?.orderedIds) ? body.orderedIds : []
  if (orderedIds.length === 0) {
    return NextResponse.json({ success: true })
  }

  const supabase = supabaseAdmin()
  // One update per id, each filtered by owner so a user can't touch others'.
  await Promise.all(
    orderedIds.map((id, idx) =>
      supabase
        .from('admin_notes')
        .update({ pin_order: idx })
        .eq('id', id)
        .eq('owner_clerk_id', userId)
    )
  )

  return NextResponse.json({ success: true })
}