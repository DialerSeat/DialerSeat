import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { apiError } from '@/lib/apiError'
import { requireAdmin } from '@/lib/admin'

const supabase = getServiceClient('admin/user-data/campaigns-delete')

export async function POST(req: NextRequest) {
  try {
    await requireAdmin()
  } catch (res) {
    return res as Response
  }

  const body = await req.json().catch(() => ({}))
  const { campaign_id } = body

  if (!campaign_id) {
    return NextResponse.json({ success: false, error: 'Missing campaign_id' }, { status: 400 })
  }

  const { data: campaign } = await supabase
    .from('campaigns')
    .select('id')
    .eq('id', campaign_id)
    .maybeSingle()

  if (!campaign) {
    return NextResponse.json({ success: false, error: 'Campaign not found' }, { status: 404 })
  }

  // leads.campaign_id -> campaigns.id is ON DELETE CASCADE, so every lead in
  // this campaign is removed in the same operation — no separate cleanup step.
  const { error } = await supabase.from('campaigns').delete().eq('id', campaign_id)

  if (error) {
    return apiError(error, { route: 'admin/user-data/campaigns-delete' })
  }

  return NextResponse.json({ success: true })
}
