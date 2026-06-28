import { NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { apiError } from '@/lib/apiError'

const supabase = getServiceClient('cron/pool-reset')

// Daily cron — runs at 00:00 UTC.
// Resets daily_call_count to 0 for all numbers, and revives any numbers
// that hit their cap (status='resting') back to active.
// Flagged numbers stay flagged (only the maintenance cron releases those).
//
// Vercel Cron sends a special header (CRON_SECRET) that we verify, so this
// can't be triggered from outside. Set CRON_SECRET in Vercel env vars.
export async function GET(req: Request) {
  // Verify Vercel Cron auth
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Reset all numbers' daily counters
    const { data: resetData, error: resetErr } = await supabase
      .from('phone_numbers')
      .update({ daily_call_count: 0 })
      .neq('status', 'released')
      .select('id')

    if (resetErr) throw resetErr

    // Revive resting numbers back to active
    const { data: revivedData, error: reviveErr } = await supabase
      .from('phone_numbers')
      .update({ status: 'active' })
      .eq('status', 'resting')
      .select('id')

    if (reviveErr) throw reviveErr

    const result = {
      success: true,
      reset_count: resetData?.length ?? 0,
      revived_count: revivedData?.length ?? 0,
      timestamp: new Date().toISOString(),
    }
    console.log('[cron/pool-reset]', result)

    return NextResponse.json(result)
  } catch (err: any) {
    console.error('[cron/pool-reset] error:', err)
    return apiError(err, { route: 'cron/pool-reset' })
  }
}

export const POST = GET