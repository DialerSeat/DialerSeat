import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { auth } from '@clerk/nextjs/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const PAGE_SIZE = 50

export async function GET(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const campaignId = searchParams.get('campaign_id') || 'all'
  const disposition = searchParams.get('disposition') || 'all'
  const search = searchParams.get('search')?.trim() || ''
  const cursor = parseInt(searchParams.get('cursor') || '0', 10)

  // Always scope to authenticated user — never trust user_id from query string
  let query = supabase
    .from('calls')
    .select('*, leads(first_name, last_name, phone, notes), campaigns(name)', { count: 'exact' })
    .eq('user_id', userId)
    .not('recording_url', 'is', null)

  if (campaignId !== 'all') {
    query = query.eq('campaign_id', campaignId)
  }
  if (disposition !== 'all') {
    query = query.eq('disposition', disposition)
  }

  query = query
    .order('created_at', { ascending: false })
    .range(cursor, cursor + PAGE_SIZE - 1)

  const { data, error, count } = await query

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }

  let recordings = data || []
  if (search) {
    const s = search.toLowerCase()
    recordings = recordings.filter((r: any) => {
      const lead = r.leads
      if (!lead) return false
      return (
        (lead.first_name || '').toLowerCase().includes(s) ||
        (lead.last_name || '').toLowerCase().includes(s) ||
        (lead.phone || '').includes(s)
      )
    })
  }

  return NextResponse.json({
    success: true,
    recordings,
    total: count || 0,
    nextCursor: (data && data.length === PAGE_SIZE) ? cursor + PAGE_SIZE : null,
  })
}