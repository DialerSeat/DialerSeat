import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireUser } from '@/lib/requireUser'

// SECURITY (was IDOR): scoped only by client-supplied ?user_id with no auth.
// Identity now comes from the Clerk session.

export async function GET(req: NextRequest) {
  const gate = await requireUser()
  if (!gate.ok) return gate.response
  const userId = gate.userId

  const { searchParams } = new URL(req.url)
  const start = searchParams.get('start')
  const end = searchParams.get('end')

  let query = supabaseAdmin.from('calls').select('disposition').eq('user_id', userId)
  if (start) query = query.gte('created_at', start)
  if (end) query = query.lte('created_at', end)

  const { data, error } = await query
  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }

  const counts: Record<string, number> = {}
  for (const c of data || []) {
    const d = c.disposition || 'NO ANSWER'
    counts[d] = (counts[d] || 0) + 1
  }

  const breakdown = Object.entries(counts)
    .map(([disposition, count]) => ({ disposition, count }))
    .sort((a, b) => b.count - a.count)

  return NextResponse.json({ success: true, breakdown })
}