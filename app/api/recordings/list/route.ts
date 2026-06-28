import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { auth } from '@clerk/nextjs/server'
import { apiError } from '@/lib/apiError'

const supabase = getServiceClient('recordings/list')

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
    // AMD-detected voicemail/machine calls have no place in recordings — they're
    // not conversations. Exclude any call whose amd_result indicates a machine
    // (machine_start, machine_end_beep, unknown, fax, etc.). We KEEP amd_result
    // null (AMD off / not run) and 'human' (a real answered conversation).
    .or('amd_result.is.null,amd_result.eq.human')

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
    return apiError(error, { route: 'recordings/list' })
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