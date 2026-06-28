// app/api/scripts/reorder/route.ts
// =============================================================================
// GLOBAL SCRIPTS LIBRARY — REORDER
// =============================================================================
// Reorders the caller's personal library. Accepts { order: [scriptId, ...] }.
// Only the caller's own scripts are reordered; ids not owned are ignored.
// =============================================================================

import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'
import { apiError } from '@/lib/apiError'

export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { order } = await req.json()
    if (!Array.isArray(order)) {
      return NextResponse.json({ success: false, error: 'order array required' }, { status: 400 })
    }

    const { data: owned } = await supabaseAdmin
      .from('scripts')
      .select('id')
      .eq('user_id', userId)
    const ownedSet = new Set((owned || []).map(s => s.id))

    let i = 0
    for (const id of order) {
      if (!ownedSet.has(id)) continue
      await supabaseAdmin
        .from('scripts')
        .update({ sort_order: i, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('user_id', userId)
      i++
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('scripts/reorder error:', error)
    return apiError(error, { route: 'scripts/reorder' })
  }
}
