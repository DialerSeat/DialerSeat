import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { supabaseAdmin } from '@/lib/supabase'
import { apiError } from '@/lib/apiError'

// Marks the owner's accept/decline as seen. Called when the agent opens the
// Requests view — the decision was news once, and looking at it is what makes
// it stop being news. A badge that survives being read teaches people to ignore
// badges, which costs far more than this one notification is worth.
export async function POST() {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { data, error } = await supabaseAdmin
      .from('team_members')
      .update({ decision_seen_at: new Date().toISOString() })
      .eq('user_id', userId)
      .in('status', ['active', 'removed'])
      .is('decision_seen_at', null)
      .select('id')

    if (error) throw error
    return NextResponse.json({ success: true, seen: (data || []).length })
  } catch (error: any) {
    console.error('seen-decision error:', error)
    return apiError(error, { route: 'teams/members/seen-decision' })
  }
}
