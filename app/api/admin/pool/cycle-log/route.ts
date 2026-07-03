import { NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { requireAdmin } from '@/lib/requireAdmin'
import { apiError } from '@/lib/apiError'

const supabase = getServiceClient('admin/pool/cycle-log')

export async function GET() {
  const gate = await requireAdmin()
  if (!gate.ok) return NextResponse.json({ error: gate.message }, { status: gate.status })

  try {
    const { data: entries, error } = await supabase
      .from('pool_cycle_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(60)

    if (error) return apiError(error, { route: 'admin/pool/cycle-log' })

    const { data: cfg } = await supabase
      .from('pool_config')
      .select(
        'numbers_per_user, pool_floor, release_cooldown_days, ratio_cycling_enabled, last_ratio_reconcile_at, last_target_pool_size, last_reconcile_month'
      )
      .eq('id', 1)
      .maybeSingle()

    const { count: activeSubs } = await supabase
      .from('subscriptions')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active')

    const { count: poolActive } = await supabase
      .from('phone_numbers')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active')

    return NextResponse.json({
      success: true,
      config: cfg ?? null,
      activeSubs: activeSubs ?? 0,
      poolActive: poolActive ?? 0,
      entries: entries ?? [],
    })
  } catch (err: any) {
    return apiError(err, { route: 'admin/pool/cycle-log' })
  }
}
