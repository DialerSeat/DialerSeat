import { supabaseAdmin } from '@/lib/supabase'
import { NextResponse } from 'next/server'
import { apiError } from '@/lib/apiError'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { id, script } = body

    const { error } = await supabaseAdmin
      .from('campaigns')
      .update({ script })
      .eq('id', id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return apiError(error, { route: 'campaigns/script' })
  }
}