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

// =============================================================================
// CROSS-INSTANCE RECONCILE LOCK
// =============================================================================
// This was a module-level `reconcileInFlight` promise, which only serializes
// callers inside a SINGLE process. On Vercel each request may run on its own
// serverless instance with its own module scope, so the monthly cron and an
// admin pressing "Run Reconcile Now" — or two admins — sail past that guard
// simultaneously and EACH buy up to daily_buy_cap. At a 50/day cap that is 50
// surplus numbers per concurrent run, billing every month, with nothing in the
// UI to reveal it.
//
// The database is the only thing every instance shares, so the lock lives
// there (pool_config.reconcile_locked_until). Claiming is one conditional
// UPDATE — exactly one caller can match "free or expired", the loser gets zero
// rows — and the TTL means a crashed run releases itself instead of disabling
// pool automation permanently.
// =============================================================================

/** Long enough for a full buy loop (50 numbers × ~250ms + API latency). */
const RECONCILE_LOCK_TTL_MS = 5 * 60 * 1000

async function claimReconcileLock(): Promise<boolean> {
  const nowIso = new Date().toISOString()
  const until = new Date(Date.now() + RECONCILE_LOCK_TTL_MS).toISOString()

  const { data, error } = await supabase
    .from('pool_config')
    .update({ reconcile_locked_until: until })
    .eq('id', 1)
    .or(`reconcile_locked_until.is.null,reconcile_locked_until.lt.${nowIso}`)
    .select('id')

  if (error) {
    // Fail CLOSED. If we cannot establish that we hold the lock, we must not
    // spend money — an unavailable lock is not permission to proceed.
    console.error('[poolCycling] could not claim reconcile lock, refusing to run:', error)
    return false
  }
  return (data?.length ?? 0) > 0
}

async function releaseReconcileLock(): Promise<void> {
  const { error } = await supabase
    .from('pool_config')
    .update({ reconcile_locked_until: null })
    .eq('id', 1)
  if (error) {
    // Non-fatal: the TTL will free it. Worst case the next reconcile waits.
    console.error('[poolCycling] failed to release reconcile lock (TTL will expire it):', error)
  }
}

async function runGuarded(trigger: string, monthlyOnly: boolean): Promise<ReconcileResult> {
  const got = await claimReconcileLock()
  if (!got) {
    console.warn(`[poolCycling] reconcile already running elsewhere — skipping "${trigger}"`)
    return {
      ran: false,
      reason: 'already_running',
      activeSubs: 0,
      numbersPerUser: 0,
      targetPoolSize: 0,
      poolBefore: 0,
      poolAfter: 0,
      added: 0,
      released: 0,
      floorApplied: false,
      cooldownBlocked: 0,
      actions: ['Another reconcile is in progress; this run was skipped.'],
    }
  }
  try {
    return await doReconcile(trigger, monthlyOnly)
  } finally {
    await releaseReconcileLock()
  }
}

export async function reconcilePoolToRatio(trigger: string): Promise<ReconcileResult> {
  return runGuarded(trigger, false)
}

export async function reconcilePoolMonthly(trigger: string): Promise<ReconcileResult> {
  return runGuarded(trigger, true)
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
      // ── BUY PLAN: toBuyCount NUMBERS, NOT toBuyCount AREA CODES ─────────
      // This loop used to iterate a list of DISTINCT area codes and buy one
      // number from each, so the number of purchases was capped by the number
      // of distinct codes available — FALLBACK_METROS has 10 entries, so a
      // run could never buy more than roughly (recommended + 10) numbers no
      // matter that daily_buy_cap is 50. With leads concentrated in a few
      // regions (which is the normal case) that ceiling was closer to 10, or
      // ~3 new subscribers' worth per reconcile at 3 numbers/user. The pool
      // could not keep up with growth by design.
      //
      // Area codes are now CYCLED to fill the requested count, so asking for
      // 30 numbers across 8 codes buys 30 numbers, several per code. That is
      // also fine for deliverability — multiple numbers in a metro the leads
      // actually live in is the point of area-code matching.
      const recommended = await recommendAreaCodesToBuy(toBuyCount)
      const codePalette = recommended.length > 0
        ? [...recommended, ...FALLBACK_METROS.filter((m) => !recommended.includes(m))]
        : [...FALLBACK_METROS]

      const buyPlan: string[] = []
      for (let i = 0; i < toBuyCount; i++) {
        buyPlan.push(codePalette[i % codePalette.length])
      }

      for (const ac of buyPlan) {
        try {
          const result = await addNumberByAreaCode(ac)
          if (result) {
            added++
            await recordBuy()
            // ── NO SEEDED "ANALYTICS" ────────────────────────────────────
            // This used to stamp every newly purchased number with INVENTED
            // usage: daily_call_count = 5-24, lifetime = +0-120, and a
            // last_called_at of now. Removed, because those columns are not
            // cosmetic — the system reads them back and makes decisions:
            //
            //   utilization %      = sum(daily_call_count)/sum(daily_cap).
            //                        Buying 10 numbers injected 50-240
            //                        phantom calls into "today", so the
            //                        pool dashboard reported load that did
            //                        not exist.
            //   utilization_trigger_pct fires off that same figure, so the
            //                        automation could trigger itself on
            //                        fabricated demand.
            //   release ordering   is `daily_call_count ASC` = coldest
            //                        first. A brand new number seeded with
            //                        5-24 calls looked WARMER than a
            //                        genuinely idle one, so downsizing
            //                        released aged numbers with real
            //                        history and kept the new ones —
            //                        backwards for deliverability.
            //   pickNumberForLead  gates on daily_call_count < daily_cap,
            //                        so a seed of 24 against a cap of 50
            //                        silently destroyed half of that
            //                        number's first-day capacity.
            //
            // A new number has made no calls. The columns already default to
            // 0, which is the truth.
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
