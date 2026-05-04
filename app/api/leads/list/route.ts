import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const PAGE_SIZE = 50

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('user_id')
  const campaignId = searchParams.get('campaign_id') || 'all'
  const disposition = searchParams.get('disposition') || 'all'
  const search = searchParams.get('search')?.trim() || ''
  const sort = searchParams.get('sort') || 'created_desc'
  const cursor = parseInt(searchParams.get('cursor') || '0', 10)

  if (!userId) {
    return NextResponse.json({ success: false, error: 'user_id required' }, { status: 400 })
  }

  let query = supabase
    .from('leads')
    .select('*', { count: 'exact' })
    .eq('user_id', userId)

  if (campaignId !== 'all') {
    query = query.eq('campaign_id', campaignId)
  }

  if (disposition !== 'all') {
    if (disposition === 'uncalled') {
      query = query.is('disposition', null)
    } else {
      query = query.eq('disposition', disposition)
    }
  }

  if (search) {
    // Search across name, phone fields. Supabase OR syntax.
    const safe = search.replace(/[%,()]/g, '')
    query = query.or(
      `first_name.ilike.%${safe}%,last_name.ilike.%${safe}%,phone.ilike.%${safe}%`
    )
  }

  // Sorting
  switch (sort) {
    case 'created_asc':
      query = query.order('created_at', { ascending: true })
      break
    case 'last_called_desc':
      query = query.order('last_called_at', { ascending: false, nullsFirst: false })
      break
    case 'attempts_desc':
      query = query.order('dial_attempts', { ascending: false })
      break
    case 'created_desc':
    default:
      query = query.order('created_at', { ascending: false })
  }

  // Add a stable secondary sort so pagination is deterministic
  query = query.order('id', { ascending: false })

  query = query.range(cursor, cursor + PAGE_SIZE - 1)

  const { data, error, count } = await query

  if (error) {
    console.error('leads list error', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    leads: data || [],
    total: count || 0,
    nextCursor: (data && data.length === PAGE_SIZE) ? cursor + PAGE_SIZE : null,
  })
}