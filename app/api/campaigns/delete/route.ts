import { supabaseAdmin } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { id } = body

    // Delete leads first
    await supabaseAdmin.from('leads').delete().eq('campaign_id', id)
    
    // Delete calls
    await supabaseAdmin.from('calls').delete().eq('campaign_id', id)
    
    // Delete campaign
    const { error } = await supabaseAdmin.from('campaigns').delete().eq('id', id)
    
    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}