import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { apiError } from '@/lib/apiError'
import { requireAdmin } from '@/lib/admin'

const supabase = getServiceClient('admin/user-data/leads-delete')

export async function POST(req: NextRequest) {
  try {
    await requireAdmin()
  } catch (res) {
    return res as Response
  }

  const body = await req.json().catch(() => ({}))
  const leadIds: string[] = Array.isArray(body.lead_ids)
    ? body.lead_ids
    : body.lead_id
      ? [body.lead_id]
      : []

  if (leadIds.length === 0) {
    return NextResponse.json({ success: false, error: 'Missing lead_id(s)' }, { status: 400 })
  }

  const { data: found, error: findErr } = await supabase
    .from('leads')
    .select('id, campaign_id')
    .in('id', leadIds)

  if (findErr) {
    return apiError(findErr, { route: 'admin/user-data/leads-delete' })
  }
  if (!found || found.length === 0) {
    return NextResponse.json({ success: false, error: 'Lead(s) not found' }, { status: 404 })
  }

  const affectedCampaignIds = Array.from(new Set(found.map(l => l.campaign_id).filter(Boolean)))

  const { error: delErr } = await supabase.from('leads').delete().in('id', leadIds)
  if (delErr) {
    return apiError(delErr, { route: 'admin/user-data/leads-delete' })
  }

  // Recount rather than decrement — matches the fix already in
  // /api/leads/delete. Decrementing by the requested count silently drifts
  // from the real row count if anything about the request doesn't exactly
  // match reality; recounting from the actual rows can't drift.
  await Promise.all(
    affectedCampaignIds.map(async cid => {
      const { count } = await supabase
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .eq('campaign_id', cid)
      await supabase.from('campaigns').update({ total_leads: count ?? 0 }).eq('id', cid)
    })
  )

  return NextResponse.json({ success: true, deleted: found.length })
}
