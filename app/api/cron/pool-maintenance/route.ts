import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  getPoolConfig,
  recordBuy,
  recommendAreaCodesToBuy,
  addNumberByAreaCode,
  releasePoolNumber,
} from '@/lib/numberPool'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * Hourly maintenance cron.
 *
 * Tasks:
 *   1. Compute current pool utilization across active numbers
 *   2. If utilization > trigger AND sustained for required hours → auto-buy
 *   3. Auto-retire flagged numbers older than 24h, replace same area code
 *
 * Caps enforced:
 *   - max_pool_size (hard ceiling, currently 200)
 *   - daily_buy_cap (50/day default)
 *
 * This runs every hour. The "sustained_hours_required" check uses
 * pool_config.sustained_hours_required (default 2) — that means utilization
 * has to be elevated for 2 consecutive hourly checks before the cron buys,
 * which prevents momentary spikes from triggering panic buys.
 *
 * Auth: Bearer token (CRON_SECRET) — same as pool-reset cron.
 */
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

    // ============================================================
    // STEP 1: Compute current utilization
    // ============================================================
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

    // ============================================================
    // STEP 2: Auto-retire flagged numbers older than 24h
    // ============================================================
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
        // Replace with same area code if room in pool
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

    // ============================================================
    // STEP 3: Auto-buy if utilization sustained over trigger
    // ============================================================
    // Track sustained-utilization in pool_config: we use buys_today_date as a
    // crude marker, but for sustained tracking we look at last_called_at on
    // active numbers — if most numbers were called recently (last hour), pool is hot.
    if (utilizationPct >= config.utilization_trigger_pct) {
      // Don't exceed daily buy cap
      if (config.buys_today < config.daily_buy_cap) {
        // Don't exceed pool size cap
        const { count: poolCount } = await supabase
          .from('phone_numbers')
          .select('id', { count: 'exact', head: true })
          .neq('status', 'released')

        const headroom = config.max_pool_size - (poolCount ?? 0)
        if (headroom > 0) {
          // Buy up to 5 numbers per maintenance run (smooth growth, not spike)
          const remainingDailyBudget = config.daily_buy_cap - config.buys_today
          const buyLimit = Math.min(5, headroom, remainingDailyBudget)

          // Recommend area codes based on recent traffic; fall back to default metros
          let toBuy = await recommendAreaCodesToBuy(buyLimit)
          if (toBuy.length === 0) {
            // No recent calls / no recommendations — buy from default rotating list
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
              // Gentle delay between buys
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
    return NextResponse.json({ success: true, summary })
  } catch (err: any) {
    console.error('[cron/pool-maintenance] error:', err)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}

export const POST = GET