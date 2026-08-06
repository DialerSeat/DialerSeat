import { createClient } from '@supabase/supabase-js'
import {
  extractAreaCode,
  getAreaCodeInfo,
  type Region,
} from './areaCode'
import {
  acquireNumberByAreaCode,
  releaseNumber as telnyxReleaseNumber,
} from './telnyxProvision'
import { getPlatformConfig } from './platformConfig'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * Calls a single pool number may place per day.
 *
 * One constant rather than a literal repeated across every insert path
 * (manual buy, ratio automation, Telnyx sync, import-existing) — those had
 * drifted independently before, which meant the pool's real capacity depended
 * on which code path happened to create a given number.
 *
 * This is a DELIVERABILITY dial, not just a throughput one: the more calls a
 * single number places per day, the faster carriers flag it as spam. Raising
 * it increases capacity per number and increases that risk together.
 */
export const DEFAULT_DAILY_CAP = 125

export interface PoolNumber {
  id: string
  phone_number: string
  area_code: string
  state: string | null
  region: string | null
  provider_number_id: string
  status: 'active' | 'resting' | 'flagged' | 'released'
  daily_call_count: number
  daily_cap: number
  lifetime_call_count: number
  last_called_at: string | null
}























export async function pickNumberForLead(
  leadPhone: string,
  dialerMode?: string
): Promise<PoolNumber | null> {
  
  
  
  
  if (dialerMode === 'predictive') {
    return findActive({})
  }

  
  
  
  
  const areaCode = extractAreaCode(leadPhone)
  const info = areaCode ? getAreaCodeInfo(areaCode) : null
  const state = info?.state ?? null
  const region = info?.region ?? null

  if (areaCode) {
    const exact = await findActive({ areaCode })
    if (exact) return exact
  }

  if (state) {
    const stateMatch = await findActive({ state })
    if (stateMatch) return stateMatch
  }

  if (region && region !== 'unknown') {
    const regionMatch = await findActive({ region })
    if (regionMatch) return regionMatch
  }

  
  
  return findActive({})
}

async function findActive(filter: {
  areaCode?: string
  state?: string
  region?: string
}): Promise<PoolNumber | null> {
  let query = supabase
    .from('phone_numbers')
    .select('*')
    .eq('status', 'active')
    .order('last_called_at', { ascending: true, nullsFirst: true })
    .limit(20)

  if (filter.areaCode) query = query.eq('area_code', filter.areaCode)
  if (filter.state) query = query.eq('state', filter.state)
  if (filter.region) query = query.eq('region', filter.region)

  const { data, error } = await query

  if (error) {
    console.error('[numberPool] findActive error:', error)
    return null
  }

  const available = (data ?? []).find((n) => n.daily_call_count < n.daily_cap)
  return (available as PoolNumber) ?? null
}

export async function recordUsage(numberId: string): Promise<void> {
  const { data: current, error: readErr } = await supabase
    .from('phone_numbers')
    .select('daily_call_count, daily_cap, lifetime_call_count')
    .eq('id', numberId)
    .single()

  if (readErr || !current) {
    console.error('[numberPool] recordUsage read failed:', readErr)
    return
  }

  const newDaily = current.daily_call_count + 1
  const newLifetime = current.lifetime_call_count + 1
  const hitCap = newDaily >= current.daily_cap

  const { error: updateErr } = await supabase
    .from('phone_numbers')
    .update({
      daily_call_count: newDaily,
      lifetime_call_count: newLifetime,
      last_called_at: new Date().toISOString(),
      ...(hitCap ? { status: 'resting' } : {}),
    })
    .eq('id', numberId)

  if (updateErr) {
    console.error('[numberPool] recordUsage update failed:', updateErr)
  }
}

export async function markFlagged(
  numberId: string,
  reason: string = 'unknown'
): Promise<void> {
  const { error } = await supabase
    .from('phone_numbers')
    .update({
      status: 'flagged',
      last_flagged_at: new Date().toISOString(),
      flag_reason: reason,
    })
    .eq('id', numberId)

  if (error) console.error('[numberPool] markFlagged failed:', error)
}

export async function releasePoolNumber(numberId: string): Promise<void> {
  // provider_number_id holds Telnyx's own number id. The column was called
  // signalwire_sid until the 2026-08-05 rename; the legacy name still exists
  // alongside it and is kept in sync by a trigger until the contract-phase
  // migration drops it. The value's role (provider's
  // own identifier for this number, needed to release/delete it later)
  // is identical regardless of provider. Revisit naming only at actual
  // cutover time, not before — same reasoning as placeOutboundCall.ts's
  // reuse of call_control_id for the Telnyx call sid.
  const { data: number, error: readErr } = await supabase
    .from('phone_numbers')
    .select('provider_number_id')
    .eq('id', numberId)
    .single()

  if (readErr || !number) {
    console.error('[numberPool] release: number not found:', numberId)
    return
  }

  try {
    await telnyxReleaseNumber(number.provider_number_id)
  } catch (err) {
    console.error('[numberPool] Telnyx release failed:', err)
    throw err
  }

  await supabase
    .from('phone_numbers')
    .update({ status: 'released' })
    .eq('id', numberId)
}

export async function addNumberByAreaCode(areaCode: string): Promise<PoolNumber | null> {
  // ── BUYING FREEZE ────────────────────────────────────────────────────────
  // Checked HERE rather than at each caller on purpose. Five paths buy
  // numbers today — the admin buy route, the admin seed route, two branches
  // of pool-maintenance, and the ratio automation in poolCycling — and a
  // freeze that has to be re-implemented at each one is a freeze that the
  // sixth caller silently ignores. This is the chokepoint they all share, so
  // the switch holds by construction.
  //
  // Money is the reason it exists: runaway ratio automation buying numbers at
  // ~$1/mo each, or a bad area-code loop, is a bill that keeps growing until
  // someone notices. This stops it in under 30 seconds with no deploy.
  const { number_buying_frozen } = await getPlatformConfig()
  if (number_buying_frozen) {
    console.warn(
      `[numberPool] Purchase of an ${areaCode} number BLOCKED — number buying is frozen ` +
      `in platform_config. Unfreeze in admin settings to resume.`
    )
    return null
  }

  const purchased = await acquireNumberByAreaCode(areaCode)
  if (!purchased) {
    console.warn(`[numberPool] No numbers available in area code ${areaCode}`)
    return null
  }

  const info = getAreaCodeInfo(areaCode)

  const { data, error } = await supabase
    .from('phone_numbers')
    .insert({
      phone_number: purchased.phone_number,
      area_code: areaCode,
      state: info?.state ?? null,
      region: info?.region ?? null,
      // Telnyx's PurchasedNumber uses `.id` (their internal number id),
      // not `.sid` — different provider, different field name, same role.
      // See the column-reuse note on releasePoolNumber above.
      provider_number_id: purchased.id,
      status: 'active',
      daily_call_count: 0,
      daily_cap: DEFAULT_DAILY_CAP,
      monthly_cost_cents: 100,
    })
    .select()
    .single()

  if (error) {
    console.error('[numberPool] DB insert failed after Telnyx purchase:', error)
    try {
      await telnyxReleaseNumber(purchased.id)
    } catch (releaseErr) {
      console.error('[numberPool] CRITICAL: Bought a number we cannot insert AND cannot release:', purchased.id, releaseErr)
    }
    return null
  }

  return data as PoolNumber
}

export async function getPoolStats(): Promise<{
  total: number
  active: number
  resting: number
  flagged: number
  released: number
  utilizationPct: number
  totalDailyCalls: number
}> {
  const { data } = await supabase
    .from('phone_numbers')
    .select('status, daily_call_count, daily_cap')

  const all = data ?? []
  const active = all.filter((n) => n.status === 'active')
  const totalDailyCalls = all.reduce((sum, n) => sum + n.daily_call_count, 0)
  const burning = active.filter((n) => n.daily_call_count >= n.daily_cap * 0.7).length
  const utilizationPct = active.length > 0
    ? Math.round((burning / active.length) * 100)
    : 0

  return {
    total: all.filter((n) => n.status !== 'released').length,
    active: active.length,
    resting: all.filter((n) => n.status === 'resting').length,
    flagged: all.filter((n) => n.status === 'flagged').length,
    released: all.filter((n) => n.status === 'released').length,
    utilizationPct,
    totalDailyCalls,
  }
}

export interface PoolConfig {
  max_pool_size: number
  daily_buy_cap: number
  utilization_trigger_pct: number
  sustained_hours_required: number
  buys_today: number
  buys_today_date: string
  numbers_per_user?: number
  pool_floor?: number
  release_cooldown_days?: number
  ratio_cycling_enabled?: boolean
  last_ratio_reconcile_at?: string | null
  last_target_pool_size?: number | null
}

export async function getPoolConfig(): Promise<PoolConfig> {
  const { data, error } = await supabase
    .from('pool_config')
    .select('*')
    .eq('id', 1)
    .single()

  if (error || !data) {
    console.error('[numberPool] getPoolConfig failed, using fallback defaults:', error)
    return {
      max_pool_size: 10000,
      daily_buy_cap: 50,
      utilization_trigger_pct: 70,
      sustained_hours_required: 2,
      buys_today: 0,
      buys_today_date: new Date().toISOString().split('T')[0],
      numbers_per_user: 3,
      pool_floor: 5,
      release_cooldown_days: 30,
      ratio_cycling_enabled: true,
    }
  }

  return data as PoolConfig
}

export async function recordBuy(): Promise<number> {
  const today = new Date().toISOString().split('T')[0]
  const { data: current } = await supabase
    .from('pool_config')
    .select('buys_today, buys_today_date')
    .eq('id', 1)
    .single()

  if (!current) return 0

  const isNewDay = current.buys_today_date !== today
  const newCount = isNewDay ? 1 : current.buys_today + 1

  await supabase
    .from('pool_config')
    .update({
      buys_today: newCount,
      buys_today_date: today,
      updated_at: new Date().toISOString(),
    })
    .eq('id', 1)

  return newCount
}

export async function recommendAreaCodesToBuy(limit = 5): Promise<string[]> {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { data: recent } = await supabase
    .from('calls')
    .select('phone_number')
    .gte('created_at', oneDayAgo)
    .not('phone_number', 'is', null)

  if (!recent || recent.length === 0) return []

  const tally = new Map<string, number>()
  for (const c of recent) {
    const ac = (c.phone_number || '').replace(/\D/g, '').slice(-10, -7)
    if (ac && ac.length === 3) {
      tally.set(ac, (tally.get(ac) ?? 0) + 1)
    }
  }

  const ranked = Array.from(tally.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([ac]) => ac)

  const { data: existing } = await supabase
    .from('phone_numbers')
    .select('area_code')
    .eq('status', 'active')

  const haveAreaCodes = new Set((existing ?? []).map((n) => n.area_code))
  const missing = ranked.filter((ac) => !haveAreaCodes.has(ac))

  return missing.slice(0, limit)
}