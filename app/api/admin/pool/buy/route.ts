import { NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { addNumberByAreaCode, getPoolConfig, recordBuy } from '@/lib/numberPool'
import { requireAdmin } from '@/lib/requireAdmin'
import { apiError } from '@/lib/apiError'

const supabase = getServiceClient('admin/pool/buy')

export async function POST(req: Request) {
  const gate = await requireAdmin()
  if (!gate.ok) return NextResponse.json({ error: gate.message }, { status: gate.status })

  const body = await req.json().catch(() => ({}))
  const areaCode = String(body?.areaCode ?? '').trim()
  if (!/^\d{3}$/.test(areaCode)) {
    return NextResponse.json({ error: 'Invalid area code' }, { status: 400 })
  }

  const config = await getPoolConfig()

  // ── COUNT TODAY'S BUYS, NOT WHATEVER WAS LEFT IN THE COLUMN ─────────────
  // buys_today is only meaningful alongside buys_today_date. recordBuy()
  // resets the counter when the date rolls over, but that reset happens on a
  // SUCCESSFUL buy — so the raw column can sit stale for days (live example:
  // buys_today = 3 dated four days earlier).
  //
  // Comparing the stale value against the cap is not just inaccurate, it can
  // deadlock: if the counter was at the cap on some earlier day, every
  // purchase is rejected with "Daily buy cap reached … Resets tomorrow", and
  // it never does reset, because the only thing that resets it is a
  // successful buy. Manual purchasing would be permanently blocked with a
  // message actively telling the admin to wait.
  //
  // Same normalization lib/poolCycling.ts already applies.
  const today = new Date().toISOString().split('T')[0]
  const buysToday = config.buys_today_date === today ? config.buys_today : 0

  if (buysToday >= config.daily_buy_cap) {
    return NextResponse.json({
      error: `Daily buy cap reached (${buysToday}/${config.daily_buy_cap}). Resets tomorrow.`,
    }, { status: 429 })
  }

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
    return apiError(err, { route: 'admin/pool/buy' })
  }
}