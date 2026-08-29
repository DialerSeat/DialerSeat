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

  // Per-engine registration state, attached to each number. is_registered is
  // only the summary ("filed with all three"); this is what says WHICH filing
  // is missing, which is the part that decides what goes in the next batch.
  const { data: regs, error: regError } = await supabase
    .from('number_registrations')
    .select('number_id, provider, status, submitted_at')
  if (regError) return apiError(regError, { route: 'admin/pool/list' })

  const regsByNumber = new Map<string, Record<string, { status: string; submitted_at: string | null }>>()
  for (const r of regs ?? []) {
    const entry = regsByNumber.get(r.number_id) ?? {}
    entry[r.provider] = { status: r.status, submitted_at: r.submitted_at }
    regsByNumber.set(r.number_id, entry)
  }

  const withRegs = (numbers ?? []).map(n => ({
    ...n,
    registrations: regsByNumber.get(n.id) ?? {},
  }))

  const config = await getPoolConfig()
  const stats = await getPoolStats()


  const totalDailyCalls = (numbers ?? []).reduce((s, n) => s + n.daily_call_count, 0)
  const totalDailyCapacity = (numbers ?? []).reduce((s, n) => s + n.daily_cap, 0)
  const liveUtilizationPct = totalDailyCapacity > 0
    ? Math.round((totalDailyCalls / totalDailyCapacity) * 100)
    : 0

  return NextResponse.json({
    success: true,
    numbers: withRegs,
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