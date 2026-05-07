import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'
import { addNumberByAreaCode, getPoolConfig, recordBuy } from '@/lib/numberPool'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * Admin manual buy. Body: { areaCode: string }
 * Bypasses the utilization trigger but STILL respects the daily buy cap and
 * pool max size, so an over-eager admin can't blow past the safety net.
 */
export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: u } = await supabase
    .from('users').select('is_admin').eq('clerk_id', userId).single()
  if (!u?.is_admin) return NextResponse.json({ error: 'Admin only' }, { status: 403 })

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