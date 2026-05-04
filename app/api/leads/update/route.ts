import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { lead_id, user_id, disposition, notes } = body

    if (!lead_id || !user_id) {
      return NextResponse.json({ success: false, error: 'lead_id and user_id required' }, { status: 400 })
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
      .eq('user_id', user_id)
      .select()
      .single()

    if (error) {
      console.error('lead update error', error)
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, lead: data })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}