import { supabaseAdmin } from '@/lib/supabase'
import { NextResponse } from 'next/server'
import { requireActive } from '@/lib/subscription'
import { auth } from '@clerk/nextjs/server'

export async function POST(req: Request) {
  try {
    // Active subscription required to create campaigns
    const gate = await requireActive()
    if (gate) return gate

    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { name } = body

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json(
        { success: false, error: 'Campaign name required' },
        { status: 400 }
      )
    }

    // Always use the authenticated userId — never trust user_id from request body.
    // Previous version accepted user_id from the body, which let anyone create
    // campaigns under any user.
    const { data, error } = await supabaseAdmin
      .from('campaigns')
      .insert({ user_id: userId, name: name.trim() })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ success: true, campaign: data })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}