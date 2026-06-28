import { NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { addNumberByAreaCode, getPoolConfig, recordBuy } from '@/lib/numberPool'
import { requireAdmin } from '@/lib/requireAdmin'

const supabase = getServiceClient('admin/pool/buy')

/**
 * Admin manual buy. Body: { areaCode: string }
 * Bypasses the utilization trigger but STILL respects the daily buy cap and
 * pool max size, so an over-eager admin can't blow past the safety net.
 */
export async function POST(req: Request) {
  const gate = await requireAdmin()
  if (!gate.ok) return NextResponse.json({ error: gate.message }, { status: gate.status })

  const body = await req.json().catch(() => ({}))
  const areaCode = String(body?.areaCode ?? '').trim()
  if (!/^\d{3}$/.test(areaCode)) {
    return NextResponse.json({ error: 'Invalid area code' }, { status: 400 })
  }

  const config = await getPoolConfig()

  // Daily cap check
  if (config.buys_today >= config.daily_buy_cap) {
    return NextResponse.json({
      error: `Daily buy cap reached (${config.buys_today}/${config.daily_buy_cap}). Resets tomorrow.`,
    }, { status: 429 })
  }

  // Pool size cap check
  const { count: poolCount } = await supabase
    .from('phone_numbers')
    .select('id', { count: 'exact', head: true })
    .neq('status', 'released')

  if ((poolCount ?? 0) >= config.max_pool_size) {
    return NextResponse.json({
      error: `Pool at max size (${poolCount}/${config.max_pool_size}). Raise the cap in pool config first.`,
    }, { status: 429 })
  }

  try {
    const result = await addNumberByAreaCode(areaCode)
    if (!result) {
      return NextResponse.json({
        error: `No numbers available in area code ${areaCode}. Try another.`,
      }, { status: 404 })
    }
    await recordBuy()
    return NextResponse.json({ success: true, number: result })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}