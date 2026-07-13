import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { apiError } from '@/lib/apiError'
import { requireAdmin } from '@/lib/admin'

const supabase = getServiceClient('admin/user-data/campaigns')

// Admin-only: list every campaign belonging to an arbitrary user, for the
// Data Explorer's research/QA drill-down. Unlike /api/campaigns/list (which
// derives the user from the Clerk session), this intentionally takes an
// arbitrary user_id — that's the whole point — so it must stay gated behind
// requireAdmin() and never be reachable by a regular user.
export async function GET(req: NextRequest) {
  try {
    await requireAdmin()
  } catch (res) {
    return res as Response
  }

  const userId = req.nextUrl.searchParams.get('user_id')
  if (!userId) {
    return NextResponse.json({ success: false, error: 'Missing user_id' }, { status: 400 })
  }

  const { data: campaigns, error } = await supabase
    .from('campaigns')
    .select(
      'id, name, status, total_leads, called_leads, created_at, dialer_mode, amd_enabled, predictive_lines_per_agent, enable_appointments_sub, enable_not_interested_sub'
    )
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    return apiError(error, { route: 'admin/user-data/campaigns' })
  }

  const rows = campaigns || []
  if (rows.length === 0) {
    return NextResponse.json({ success: true, campaigns: [] })
  }

  // Small per-campaign preview (up to 8 leads each) so a card can be
  // visually scanned for formatting problems without opening it. Done as
  // one query per campaign rather than one combined query so a campaign
  // with a lot of recent leads can't crowd out another campaign's preview.
  const previews = await Promise.all(
    rows.map(c =>
      supabase
        .from('leads')
        .select('id, first_name, last_name, phone, email, state, city, extra_data')
        .eq('campaign_id', c.id)
        .order('created_at', { ascending: false })
        .limit(8)
        .then(r => r.data || [])
    )
  )

  const result = rows.map((c, i) => ({ ...c, preview_leads: previews[i] }))

  return NextResponse.json({ success: true, campaigns: result })
}
