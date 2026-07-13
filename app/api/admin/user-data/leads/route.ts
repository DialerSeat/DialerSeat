import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { apiError } from '@/lib/apiError'
import { requireAdmin } from '@/lib/admin'

const supabase = getServiceClient('admin/user-data/leads')

export async function GET(req: NextRequest) {
  try {
    await requireAdmin()
  } catch (res) {
    return res as Response
  }

  const campaignId = req.nextUrl.searchParams.get('campaign_id')
  if (!campaignId) {
    return NextResponse.json({ success: false, error: 'Missing campaign_id' }, { status: 400 })
  }

  const { data: campaign, error: campaignError } = await supabase
    .from('campaigns')
    .select('id, name, user_id')
    .eq('id', campaignId)
    .maybeSingle()

  if (campaignError) {
    return apiError(campaignError, { route: 'admin/user-data/leads' })
  }
  if (!campaign) {
    return NextResponse.json({ success: false, error: 'Campaign not found' }, { status: 404 })
  }

  const { data: leads, error } = await supabase
    .from('leads')
    .select(
      'id, first_name, last_name, phone, email, address, city, state, zip, disposition, dial_attempts, last_called_at, notes, extra_data, consent_date, consent_source, created_at'
    )
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: false })
    .limit(2000)

  if (error) {
    return apiError(error, { route: 'admin/user-data/leads' })
  }

  return NextResponse.json({ success: true, campaign, leads: leads || [] })
}
