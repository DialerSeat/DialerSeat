import { NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import { apiError } from '@/lib/apiError'
import {
  getPoolConfig,
  recordBuy,
  recommendAreaCodesToBuy,
  addNumberByAreaCode,
  releasePoolNumber,
} from '@/lib/numberPool'

const supabase = getServiceClient('cron/pool-maintenance')

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const config = await getPoolConfig()
    const summary: any = {
      timestamp: new Date().toISOString(),
      config,
      actions: [] as string[],
    }

    const { data: activeNums } = await supabase
      .from('phone_numbers')
      .select('id, daily_call_count, daily_cap')
      .eq('status', 'active')

    const active = activeNums ?? []
    const totalDailyCalls = active.reduce((s, n) => s + n.daily_call_count, 0)
    const totalDailyCapacity = active.reduce((s, n) => s + n.daily_cap, 0)
    const utilizationPct = totalDailyCapacity > 0
      ? Math.round((totalDailyCalls / totalDailyCapacity) * 100)
      : 0

    summary.utilization = {
      pct: utilizationPct,
      activeCount: active.length,
      dailyCalls: totalDailyCalls,
      dailyCapacity: totalDailyCapacity,
    }

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { data: stale } = await supabase
      .from('phone_numbers')
      .select('id, area_code, last_flagged_at')
      .eq('status', 'flagged')
      .lt('last_flagged_at', oneDayAgo)

    let retired = 0
    let replaced = 0
    for (const num of stale ?? []) {
      try {
        await releasePoolNumber(num.id)
        retired++
        summary.actions.push(`Retired flagged ${num.id} (area ${num.area_code})`)

        const totalActive = (await supabase
          .from('phone_numbers')
          .select('id', { count: 'exact', head: true })
          .neq('status', 'released')).count ?? 0

        if (totalActive < config.max_pool_size) {
          const replacement = await addNumberByAreaCode(num.area_code)
          if (replacement) {
            replaced++
            await recordBuy()
            summary.actions.push(`Replaced with new ${num.area_code}: ${replacement.phone_number}`)
          } else {
            summary.actions.push(`Could not replace ${num.area_code} — no inventory`)
          }
        }
      } catch (err: any) {
        summary.actions.push(`Retire failed for ${num.id}: ${err.message}`)
      }
    }
    summary.retired = retired
    summary.replaced = replaced

    if (utilizationPct >= config.utilization_trigger_pct) {

      if (config.buys_today < config.daily_buy_cap) {

        const { count: poolCount } = await supabase
          .from('phone_numbers')
          .select('id', { count: 'exact', head: true })
          .neq('status', 'released')

        const headroom = config.max_pool_size - (poolCount ?? 0)
        if (headroom > 0) {

          const remainingDailyBudget = config.daily_buy_cap - config.buys_today
          const buyLimit = Math.min(5, headroom, remainingDailyBudget)

          let toBuy = await recommendAreaCodesToBuy(buyLimit)
          if (toBuy.length === 0) {

            const fallbackMetros = ['212', '213', '312', '281', '602', '215', '210', '619', '214', '408']
            toBuy = fallbackMetros.slice(0, buyLimit)
          }

          let bought = 0
          for (const ac of toBuy) {
            try {
              const result = await addNumberByAreaCode(ac)
              if (result) {
                bought++
                await recordBuy()
                summary.actions.push(`Auto-bought ${ac}: ${result.phone_number}`)
              } else {
                summary.actions.push(`Auto-buy failed for ${ac} — no inventory`)
              }

              await new Promise((r) => setTimeout(r, 250))
            } catch (err: any) {
              summary.actions.push(`Auto-buy error for ${ac}: ${err.message}`)
            }
          }
          summary.bought = bought
        } else {
          summary.actions.push(`Pool at max size (${poolCount}/${config.max_pool_size}) — admin must raise cap`)
        }
      } else {
        summary.actions.push(`Daily buy cap reached (${config.buys_today}/${config.daily_buy_cap})`)
      }
    } else {
      summary.actions.push(`Utilization ${utilizationPct}% under trigger ${config.utilization_trigger_pct}% — no buy`)
    }

    console.log('[cron/pool-maintenance]', JSON.stringify(summary, null, 2))

    try {
      const { reconcilePoolToRatio } = await import('@/lib/poolCycling')
      const ratio = await reconcilePoolToRatio('cron:pool-maintenance')
      summary.ratioCycling = ratio
    } catch (err: any) {
      summary.actions.push(`Ratio reconcile failed: ${err?.message ?? 'unknown'}`)
    }

    return NextResponse.json({ success: true, summary })
  } catch (err: any) {
    console.error('[cron/pool-maintenance] error:', err)
    return apiError(err, { route: 'cron/pool-maintenance' })
  }
}

export const POST = GET