import { NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { getPoolConfig, getPoolStats } from '@/lib/numberPool'
import { requireAdmin } from '@/lib/requireAdmin'
import { apiError } from '@/lib/apiError'

const supabase = getServiceClient('admin/pool/list')

export async function GET() {
  const gate = await requireAdmin()
  if (!gate.ok) return NextResponse.json({ error: gate.message }, { status: gate.status })

  const { data: numbers, error } = await supabase
    .from('phone_numbers')
    .select('*')
    .neq('status', 'released')
    .order('acquired_at', { ascending: false })

  if (error) return apiError(error, { route: 'admin/pool/list' })

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