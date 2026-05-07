import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { auth } from '@clerk/nextjs/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    // Always use authenticated user — never trust body.user_id
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { lead_id, disposition, notes } = body

    if (!lead_id) {
      return NextResponse.json({ success: false, error: 'lead_id required' }, { status: 400 })
    }

    // Verify ownership
    const { data: existing, error: fetchErr } = await supabase
      .from('leads')
      .select('id, user_id, disposition')
      .eq('id', lead_id)
      .single()

    if (fetchErr || !existing) {
      return NextResponse.json({ success: false, error: 'Lead not found' }, { status: 404 })
    }
    if (existing.user_id !== userId) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const updates: Record<string, any> = {}
    if (disposition !== undefined) updates.disposition = disposition || null
    if (notes !== undefined) updates.notes = notes

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ success: false, error: 'nothing to update' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('leads')
      .update(updates)
      .eq('id', lead_id)
      .eq('user_id', userId)
      .select()
      .single()

    if (error) {
      console.error('lead update error', error)
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    // Append to notes history if notes were provided AND non-empty
    const trimmedNotes = String(notes ?? '').trim()
    if (trimmedNotes) {
      await supabase.from('lead_notes').insert({
        lead_id,
        user_id: userId,
        note: trimmedNotes,
        disposition: disposition ?? null,
        source: 'leads_tab',
      })
    }

    return NextResponse.json({ success: true, lead: data })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}