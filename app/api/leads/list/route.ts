import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireUser } from '@/lib/requireUser'
import { apiError } from '@/lib/apiError'

const PAGE_SIZE = 50

const SUB_DISPOSITIONS: Record<string, string> = {
  appointments: 'APPOINTMENT',
  not_interested: 'NOT_INTERESTED',
}

export async function GET(req: NextRequest) {
  const gate = await requireUser()
  if (!gate.ok) return gate.response
  const userId = gate.userId

  const { searchParams } = new URL(req.url)
  const rawCampaignId = searchParams.get('campaign_id') || 'all'
  const disposition = searchParams.get('disposition') || 'all'
  const search = searchParams.get('search')?.trim() || ''
  const sort = searchParams.get('sort') || 'created_desc'
  const cursor = parseInt(searchParams.get('cursor') || '0', 10)

  let campaignId = rawCampaignId
  let virtualDispositionFilter: string | null = null
  if (campaignId !== 'all' && campaignId.includes(':')) {
    const [parentId, subType] = campaignId.split(':')
    if (parentId && subType && SUB_DISPOSITIONS[subType]) {
      campaignId = parentId
      virtualDispositionFilter = SUB_DISPOSITIONS[subType]
    } else {

      return NextResponse.json({
        success: true,
        leads: [],
        total: 0,
        nextCursor: null,
      })
    }
  }

  let query = supabaseAdmin
    .from('leads')
    .select('*', { count: 'exact' })
    .eq('user_id', userId)

  if (campaignId !== 'all') {
    query = query.eq('campaign_id', campaignId)
  }

  if (virtualDispositionFilter) {
    query = query.eq('disposition', virtualDispositionFilter)
  } else if (disposition !== 'all') {
    if (disposition === 'uncalled') {
      query = query.is('disposition', null)
    } else {
      query = query.eq('disposition', disposition)
    }
  }

  if (search) {

    const safe = search.replace(/[%,()]/g, '')
    query = query.or(
      `first_name.ilike.%${safe}%,last_name.ilike.%${safe}%,phone.ilike.%${safe}%`
    )
  }

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

  query = query.order('id', { ascending: false })

  query = query.range(cursor, cursor + PAGE_SIZE - 1)

  const { data, error, count } = await query

  if (error) {
    console.error('leads list error', error)
    return apiError(error, { route: 'leads/list' })
  }

  return NextResponse.json({
    success: true,
    leads: data || [],
    total: count || 0,
    nextCursor: (data && data.length === PAGE_SIZE) ? cursor + PAGE_SIZE : null,
  })
}