import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('user_id')
  const start = searchParams.get('start')
  const end = searchParams.get('end')

  if (!userId) {
    return NextResponse.json({ success: false, error: 'user_id required' }, { status: 400 })
  }

  let query = supabase.from('calls').select('disposition').eq('user_id', userId)
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