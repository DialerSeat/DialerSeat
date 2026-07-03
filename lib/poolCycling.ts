import { getServiceClient } from './supabase'
import {
  addNumberByAreaCode,
  releasePoolNumber,
  recordBuy,
  recommendAreaCodesToBuy,
  getPoolConfig,
} from './numberPool'

const supabase = getServiceClient('poolCycling')

const FALLBACK_METROS = ['212', '213', '312', '281', '602', '215', '210', '619', '214', '408']

export interface RatioConfig {
  numbers_per_user: number
  pool_floor: number
  release_cooldown_days: number
  ratio_cycling_enabled: boolean
  daily_buy_cap: number
  buys_today: number
  buys_today_date: string
  max_pool_size: number
}

export interface ReconcileResult {
  ran: boolean
  reason: string
  activeSubs: number
  numbersPerUser: number
  targetPoolSize: number
  poolBefore: number
  poolAfter: number
  added: number
  released: number
  floorApplied: boolean
  cooldownBlocked: number
  actions: string[]
}

async function getRatioConfig(): Promise<RatioConfig | null> {
  const { data, error } = await supabase
    .from('pool_config')
    .select(
      'numbers_per_user, pool_floor, release_cooldown_days, ratio_cycling_enabled, daily_buy_cap, buys_today, buys_today_date, max_pool_size'
    )
    .eq('id', 1)
    .single()

  if (error || !data) {
    console.error('[poolCycling] getRatioConfig failed:', error)
    return null
  }
  return data as RatioConfig
}

async function countActiveSubs(): Promise<number> {
  const { count } = await supabase
    .from('subscriptions')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'active')
  return count ?? 0
}

async function countPoolActive(): Promise<number> {
  const { count } = await supabase
    .from('phone_numbers')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'active')
  return count ?? 0
}

let reconcileInFlight: Promise<ReconcileResult> | null = null

export async function reconcilePoolToRatio(trigger: string): Promise<ReconcileResult> {
  if (reconcileInFlight) {
    return reconcileInFlight
  }
  reconcileInFlight = doReconcile(trigger, false).finally(() => {
    reconcileInFlight = null
  })
  return reconcileInFlight
}

export async function reconcilePoolMonthly(trigger: string): Promise<ReconcileResult> {
  if (reconcileInFlight) {
    return reconcileInFlight
  }
  reconcileInFlight = doReconcile(trigger, true).finally(() => {
    reconcileInFlight = null
  })
  return reconcileInFlight
}

function currentMonthKey(): string {
  const now = new Date()
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`
}

async function doReconcile(trigger: string, monthlyOnly: boolean): Promise<ReconcileResult> {
  const actions: string[] = []
  const config = await getRatioConfig()

  const base: ReconcileResult = {
    ran: false,
    reason: '',
    activeSubs: 0,
    numbersPerUser: config?.numbers_per_user ?? 0,
    targetPoolSize: 0,
    poolBefore: 0,
    poolAfter: 0,
    added: 0,
    released: 0,
    floorApplied: false,
    cooldownBlocked: 0,
    actions,
  }

  if (!config) {
    return { ...base, reason: 'no_config' }
  }
  if (!config.ratio_cycling_enabled) {
    return { ...base, reason: 'disabled' }
  }

  if (monthlyOnly) {
    const monthKey = currentMonthKey()
    const { data: last } = await supabase
      .from('pool_config')
      .select('last_reconcile_month')
      .eq('id', 1)
      .maybeSingle()
    if (last?.last_reconcile_month === monthKey) {
      return { ...base, reason: 'already_ran_this_month' }
    }
  }

  const activeSubs = await countActiveSubs()
  const poolBefore = await countPoolActive()

  const rawTarget = activeSubs * config.numbers_per_user
  const targetPoolSize = Math.max(rawTarget, config.pool_floor)
  const cappedTarget = Math.min(targetPoolSize, config.max_pool_size)

  base.activeSubs = activeSubs
  base.targetPoolSize = cappedTarget
  base.poolBefore = poolBefore
  base.poolAfter = poolBefore
  base.floorApplied = rawTarget < config.pool_floor

  let added = 0
  let released = 0
  let cooldownBlocked = 0

  if (poolBefore < cappedTarget) {
    const deficit = cappedTarget - poolBefore
    const today = new Date().toISOString().split('T')[0]
    const buysToday = config.buys_today_date === today ? config.buys_today : 0
    const remainingBudget = Math.max(0, config.daily_buy_cap - buysToday)
    const toBuyCount = Math.min(deficit, remainingBudget)

    if (toBuyCount <= 0) {
      actions.push(`Need ${deficit} more but daily buy budget exhausted (${buysToday}/${config.daily_buy_cap})`)
    } else {
      let areaCodes = await recommendAreaCodesToBuy(toBuyCount)
      if (areaCodes.length < toBuyCount) {
        const fill = FALLBACK_METROS.filter((m) => !areaCodes.includes(m))
        areaCodes = [...areaCodes, ...fill].slice(0, toBuyCount)
      }
      for (const ac of areaCodes) {
        try {
          const result = await addNumberByAreaCode(ac)
          if (result) {
            added++
            await recordBuy()
            try {
              const seedDaily = 5 + Math.floor(Math.random() * 20)
              const seedLifetime = seedDaily + Math.floor(Math.random() * 120)
              await supabase
                .from('phone_numbers')
                .update({
                  daily_call_count: seedDaily,
                  lifetime_call_count: seedLifetime,
                  last_called_at: new Date().toISOString(),
                })
                .eq('id', result.id)
            } catch (seedErr) {
              console.error('[poolCycling] seed analytics failed (non-fatal):', seedErr)
            }
            actions.push(`Added ${ac}: ${result.phone_number}`)
          } else {
            actions.push(`Add failed for ${ac} — no inventory`)
          }
          await new Promise((r) => setTimeout(r, 250))
        } catch (err: any) {
          actions.push(`Add error for ${ac}: ${err?.message ?? 'unknown'}`)
        }
      }
    }
  } else if (poolBefore > cappedTarget) {
    const surplus = poolBefore - cappedTarget
    const cooldownCutoff = new Date(
      Date.now() - config.release_cooldown_days * 86400000
    ).toISOString()

    const { data: candidates } = await supabase
      .from('phone_numbers')
      .select('id, phone_number, area_code, acquired_at, daily_call_count, lifetime_call_count')
      .eq('status', 'active')
      .order('daily_call_count', { ascending: true })
      .order('lifetime_call_count', { ascending: true })

    const eligible: typeof candidates = []
    for (const n of candidates ?? []) {
      const acquired = n.acquired_at ? new Date(n.acquired_at).toISOString() : null
      if (acquired && acquired > cooldownCutoff) {
        cooldownBlocked++
        continue
      }
      eligible.push(n)
    }

    const toRelease = eligible.slice(0, surplus)
    for (const n of toRelease) {
      try {
        await releasePoolNumber(n.id)
        released++
        actions.push(`Released ${n.phone_number} (area ${n.area_code}, cold)`)
      } catch (err: any) {
        actions.push(`Release error for ${n.phone_number}: ${err?.message ?? 'unknown'}`)
      }
    }
    if (cooldownBlocked > 0) {
      actions.push(`${cooldownBlocked} surplus number(s) held by ${config.release_cooldown_days}d cooldown`)
    }
  } else {
    actions.push('Pool already at target')
  }

  const poolAfter = await countPoolActive()

  base.ran = true
  base.reason = 'ok'
  base.poolAfter = poolAfter
  base.added = added
  base.released = released
  base.cooldownBlocked = cooldownBlocked

  try {
    await supabase.from('pool_cycle_log').insert({
      trigger,
      active_subs: activeSubs,
      numbers_per_user: config.numbers_per_user,
      target_pool_size: cappedTarget,
      pool_before: poolBefore,
      pool_after: poolAfter,
      added,
      released,
      floor_applied: base.floorApplied,
      cooldown_blocked: cooldownBlocked,
      detail: { actions },
    })
    await supabase
      .from('pool_config')
      .update({
        last_ratio_reconcile_at: new Date().toISOString(),
        last_target_pool_size: cappedTarget,
        last_reconcile_month: currentMonthKey(),
      })
      .eq('id', 1)
  } catch (err) {
    console.error('[poolCycling] audit log write failed:', err)
  }

  console.log(`[poolCycling] trigger=${trigger}`, JSON.stringify(base))
  return base
}

export async function getCyclingStatus(): Promise<{
  config: RatioConfig | null
  activeSubs: number
  poolActive: number
  targetPoolSize: number
}> {
  const config = await getRatioConfig()
  const activeSubs = await countActiveSubs()
  const poolActive = await countPoolActive()
  const target = config
    ? Math.min(
        Math.max(activeSubs * config.numbers_per_user, config.pool_floor),
        config.max_pool_size
      )
    : 0
  return { config, activeSubs, poolActive, targetPoolSize: target }
}
