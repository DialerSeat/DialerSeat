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

  let query = supabase
    .from('calls')
    .select('*, leads(first_name, last_name, phone, notes), campaigns(name)', { count: 'exact' })
    .eq('user_id', userId)
    .or('recording_url.not.is.null,recording_id.not.is.null')

    // ── WHY THIS IS NOT JUST "amd_result = human" ──────────────────────────
    // This used to be `amd_result.is.null,amd_result.eq.human`, which hid
    // every call AMD tagged 'machine' or 'not_sure'. That was correct under
    // the old behavior: a machine detection hung the call up instantly with
    // no agent attached, so the recording was a few seconds of voicemail
    // greeting and pure noise in this tab.
    //
    // That is no longer true. AMD no longer hangs up a call an agent is
    // already bridged into (see the agentAlreadyBridged branch in
    // app/api/calls/events/route.ts) because 'greeting_end' misfires on real
    // people who answer and pause. So a 'machine' call can now be a genuine
    // conversation the agent actually had — and hiding its recording loses
    // the one artifact of that call.
    //
    // 'not_sure' is included outright: Telnyx's own guidance is to treat it
    // as human. And any call that was ANSWERED is included regardless of what
    // AMD guessed, because a recording of an answered call is real audio by
    // definition — AMD's opinion doesn't change that.
    .or('amd_result.is.null,amd_result.eq.human,amd_result.eq.not_sure,answered_at.not.is.null')

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