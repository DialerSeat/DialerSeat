import { NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { addNumberForTarget, getPoolConfig, recordBuy } from '@/lib/numberPool'
import { getAreaCodeInfo } from '@/lib/areaCode'
import { requireAdmin } from '@/lib/requireAdmin'
import { apiError } from '@/lib/apiError'

const supabase = getServiceClient('admin/pool/buy')

export async function POST(req: Request) {
  const gate = await requireAdmin()
  if (!gate.ok) return NextResponse.json({ error: gate.message }, { status: gate.status })

  const body = await req.json().catch(() => ({}))

  // ── ONE AREA CODE OR A COMMA-SEPARATED LIST ──────────────────────────────
  // Buying six numbers meant six round trips through the dialog, each of which
  // could fail on its own for a reason the previous one did not. A list is one
  // action with one report at the end.
  //
  // Split on anything that is not a digit, so "404, 229 / 323" and
  // "404,229,323" both work -- somebody assembling a list from a spreadsheet
  // should not have to think about the separator.
  const raw = String(body?.areaCode ?? body?.areaCodes ?? '').trim()
  const areaCodes = [...new Set(raw.split(/[^0-9]+/).filter(Boolean))]

  if (areaCodes.length === 0 || areaCodes.some(c => !/^\d{3}$/.test(c))) {
    return NextResponse.json({
      error: 'Give one or more 3-digit area codes, separated by commas.',
    }, { status: 400 })
  }

  // A cap on how many one press can spend. Six is the largest sensible batch
  // and a typo that turns into forty numbers is a bill, not an inconvenience.
  const MAX_PER_REQUEST = 20
  if (areaCodes.length > MAX_PER_REQUEST) {
    return NextResponse.json({
      error: `Too many at once (${areaCodes.length}). ${MAX_PER_REQUEST} is the limit per press.`,
    }, { status: 400 })
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

  // Budget for the whole batch, so a list cannot walk past the daily cap or
  // the pool ceiling halfway through.
  const remainingBudget = Math.min(
    config.daily_buy_cap - buysToday,
    config.max_pool_size - (poolCount ?? 0)
  )

  const results: Array<{
    requested: string
    ok: boolean
    phone_number?: string
    via?: string
    note?: string
    error?: string
  }> = []

  try {
    for (const areaCode of areaCodes) {
      if (results.filter(r => r.ok).length >= remainingBudget) {
        results.push({ requested: areaCode, ok: false, error: 'Stopped: daily or pool cap reached' })
        continue
      }

      // The state behind the requested NPA is the fallback. Asking for 404
      // means asking for Atlanta, and Atlanta has no free 404s -- see
      // acquireNumber for the ladder.
      const state = getAreaCodeInfo(areaCode)?.state ?? undefined
      const bought = await addNumberForTarget({ areaCodes: [areaCode], state })

      if (!bought) {
        results.push({
          requested: areaCode,
          ok: false,
          error: state
            ? `Nothing available in ${areaCode} or anywhere in ${state}.`
            : `Nothing available in ${areaCode}, and it maps to no known state.`,
        })
        continue
      }

      await recordBuy()

      // Say plainly when the number is not the area code that was asked for.
      // A silent substitution is how somebody discovers a fortnight later that
      // their Atlanta number is a 470.
      const actual = bought.number.area_code
      results.push({
        requested: areaCode,
        ok: true,
        phone_number: bought.number.phone_number,
        via: bought.via,
        note: actual === areaCode
          ? undefined
          : `No ${areaCode} was free — bought ${actual}${state ? ` in ${state}` : ''} instead.`,
      })
    }

    const bought = results.filter(r => r.ok)
    return NextResponse.json({
      success: bought.length > 0,
      bought: bought.length,
      requested: areaCodes.length,
      results,
      // Kept so the existing single-buy UI keeps rendering a number.
      number: bought.length === 1
        ? { phone_number: bought[0].phone_number }
        : undefined,
      error: bought.length === 0
        ? results.map(r => r.error).filter(Boolean).join(' ')
        : undefined,
    })
  } catch (err: any) {
    return apiError(err, { route: 'admin/pool/buy' })
  }
}