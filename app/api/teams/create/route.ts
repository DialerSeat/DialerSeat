import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireSelfSub } from '@/lib/subscription'
import { apiError } from '@/lib/apiError'

export async function POST(req: Request) {
  try {
    const gate = await requireSelfSub()
    if (gate) return gate

    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { name, description } = body

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json(
        { success: false, error: 'Team name required' },
        { status: 400 }
      )
    }

    if (name.trim().length > 100) {
      return NextResponse.json(
        { success: false, error: 'Team name too long (max 100 chars)' },
        { status: 400 }
      )
    }

    const { data, error } = await supabaseAdmin
      .from('teams')
      .insert({
        owner_id: userId,
        name: name.trim(),
        description: description?.trim() || null,
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ success: true, team: data })
  } catch (error: any) {
    console.error('Team create error:', error)
    return apiError(error, { route: 'teams/create' })
  }
}