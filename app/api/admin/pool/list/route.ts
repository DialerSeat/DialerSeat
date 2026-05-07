import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'
import { getPoolConfig, getPoolStats } from '@/lib/numberPool'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: u } = await supabase
    .from('users').select('is_admin').eq('clerk_id', userId).single()
  if (!u?.is_admin) return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const { data: numbers, error } = await supabase
    .from('phone_numbers')
    .select('*')
    .neq('status', 'released')
    .order('acquired_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const config = await getPoolConfig()
  const stats = await getPoolStats()

  // Compute the live utilization metric for the dashboard's growth meter
  const totalDailyCalls = (numbers ?? []).reduce((s, n) => s + n.daily_call_count, 0)
  const totalDailyCapacity = (numbers ?? []).reduce((s, n) => s + n.daily_cap, 0)
  const liveUtilizationPct = totalDailyCapacity > 0
    ? Math.round((totalDailyCalls / totalDailyCapacity) * 100)
    : 0

  return NextResponse.json({
    success: true,
    numbers: numbers ?? [],
    config,
    stats,
    liveUtilization: {
      pct: liveUtilizationPct,
      dailyCalls: totalDailyCalls,
      dailyCapacity: totalDailyCapacity,
      triggerPct: config.utilization_trigger_pct,
      pctUntilTrigger: Math.max(0, config.utilization_trigger_pct - liveUtilizationPct),
    },
  })
}