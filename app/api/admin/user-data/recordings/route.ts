import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { apiError } from '@/lib/apiError'
import { requireAdmin } from '@/lib/admin'

const supabase = getServiceClient('admin/user-data/recordings')

// Admin-only: list every call recording belonging to an arbitrary user, for
// the Data Explorer's Recordings tab. Mirrors /api/recordings/list (which
// derives the user from the Clerk session) but intentionally takes an
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

  const { data: recordings, error } = await supabase
    .from('calls')
    .select(
      'id, campaign_id, lead_id, phone_number, duration, disposition, recording_url, recording_status, recording_duration, recording_expires_at, created_at, amd_result, leads(first_name, last_name, phone), campaigns(name)'
    )
    .eq('user_id', userId)
    .not('recording_url', 'is', null)
    .order('created_at', { ascending: false })
    .limit(2000)

  if (error) {
    return apiError(error, { route: 'admin/user-data/recordings' })
  }

  return NextResponse.json({ success: true, recordings: recordings || [] })
}
