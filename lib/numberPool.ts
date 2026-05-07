import { createClient } from '@supabase/supabase-js'
import {
  extractAreaCode,
  getAreaCodeInfo,
  type Region,
} from './areaCode'
import {
  acquireNumberByAreaCode,
  releaseNumber as swReleaseNumber,
} from './signalwireProvision'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export interface PoolNumber {
  id: string
  phone_number: string
  area_code: string
  state: string | null
  region: string | null
  signalwire_sid: string
  status: 'active' | 'resting' | 'flagged' | 'released'
  daily_call_count: number
  daily_cap: number
  lifetime_call_count: number
  last_called_at: string | null
}

/**
 * Pick a pool number to dial FROM, given the lead's phone number.
 *
 * Selection cascade:
 *   1. Exact area-code match (e.g. lead 803 → pool 803)
 *   2. Same state (e.g. lead 803 SC → pool 843 SC)
 *   3. Same region (e.g. lead 803 SC → any southeast number)
 *   4. Any active pool number (true random fallback)
 *
 * At every level, only consider numbers under their daily cap.
 * Returns null only if pool is completely exhausted.
 *
 * NOTE: This is a SELECT only. Caller must follow up with recordUsage() when
 * the call is actually placed, to increment the counter.
 */
export async function pickNumberForLead(leadPhone: string): Promise<PoolNumber | null> {
  const areaCode = extractAreaCode(leadPhone)
  const info = areaCode ? getAreaCodeInfo(areaCode) : null
  const state = info?.state ?? null
  const region = info?.region ?? null

  // Level 1: exact area code match
  if (areaCode) {
    const exact = await findActive({ areaCode })
    if (exact) return exact
  }

  // Level 2: same state
  if (state) {
    const stateMatch = await findActive({ state })
    if (stateMatch) return stateMatch
  }

  // Level 3: same region
  if (region && region !== 'unknown') {
    const regionMatch = await findActive({ region })
    if (regionMatch) return regionMatch
  }

  // Level 4: any active number
  return findActive({})
}

/**
 * Internal: find an active pool number matching given filter, under daily cap,
 * preferring the one called least recently (so traffic spreads across the pool).
 */
async function findActive(filter: {
  areaCode?: string
  state?: string
  region?: string
}): Promise<PoolNumber | null> {
  let query = supabase
    .from('phone_numbers')
    .select('*')
    .eq('status', 'active')
    // Note: we can't reference daily_cap directly in a filter, so we fetch and
    // filter in JS. For pools up to ~100 numbers this is trivially cheap.
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

  // Filter out numbers that have hit their daily cap
  const available = (data ?? []).find((n) => n.daily_call_count < n.daily_cap)
  return (available as PoolNumber) ?? null
}

/**
 * Increment the daily call count + lifetime count + update last_called_at.
 * Called immediately AFTER a successful dial initiation, BEFORE waiting for the call to connect.
 * (We charge the call against the number even if it doesn't connect, because each dial attempt
 * uses up the number's reputation budget with carriers.)
 *
 * If the post-increment count hits the daily cap, also flips status to 'resting'
 * so the picker stops choosing it until the daily reset cron runs.
 */
export async function recordUsage(numberId: string): Promise<void> {
  // Read current values
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

/**
 * Mark a number as flagged (carrier-reported spam, customer complaint, etc.)
 * It's pulled from rotation but still in our SignalWire account.
 * Maintenance cron decides whether to release it back to SignalWire and replace.
 */
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

/**
 * Release a number entirely — both from our pool and back to SignalWire.
 * This stops the $1/mo charge. Used by maintenance cron when a flagged number
 * is being replaced.
 */
export async function releasePoolNumber(numberId: string): Promise<void> {
  const { data: number, error: readErr } = await supabase
    .from('phone_numbers')
    .select('signalwire_sid')
    .eq('id', numberId)
    .single()

  if (readErr || !number) {
    console.error('[numberPool] release: number not found:', numberId)
    return
  }

  // Release from SignalWire first (stops billing). If it fails, we keep the row
  // so we can retry rather than orphaning a SignalWire number.
  try {
    await swReleaseNumber(number.signalwire_sid)
  } catch (err) {
    console.error('[numberPool] SignalWire release failed:', err)
    throw err
  }

  // Mark our row as released. We KEEP the row for audit purposes — never delete.
  await supabase
    .from('phone_numbers')
    .update({ status: 'released' })
    .eq('id', numberId)
}

/**
 * Add a number to the pool. Used by the auto-buy code AND by manual admin "buy now" flow.
 * Buys from SignalWire, then inserts the row.
 */
export async function addNumberByAreaCode(areaCode: string): Promise<PoolNumber | null> {
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
      signalwire_sid: purchased.sid,
      status: 'active',
      daily_call_count: 0,
      daily_cap: 50,
      monthly_cost_cents: 100,
    })
    .select()
    .single()

  if (error) {
    console.error('[numberPool] DB insert failed after SignalWire purchase:', error)
    // Try to release the number back so we don't pay for an orphan
    try {
      await swReleaseNumber(purchased.sid)
    } catch (releaseErr) {
      console.error('[numberPool] CRITICAL: Bought a number we cannot insert AND cannot release:', purchased.sid, releaseErr)
    }
    return null
  }

  return data as PoolNumber
}

/**
 * Pool stats for admin dashboard.
 */
export async function getPoolStats(): Promise<{
  total: number
  active: number
  resting: number
  flagged: number
  released: number
  utilizationPct: number  // % of active numbers over 70% of daily cap
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

// ============================================================
// Wave 3 additions: pool config + auto-buy recommendations
// ============================================================

export interface PoolConfig {
  max_pool_size: number
  daily_buy_cap: number
  utilization_trigger_pct: number
  sustained_hours_required: number
  buys_today: number
  buys_today_date: string
}

/**
 * Read the current pool config (caps + thresholds).
 * Used by both the maintenance cron and the admin dashboard.
 */
export async function getPoolConfig(): Promise<PoolConfig> {
  const { data, error } = await supabase
    .from('pool_config')
    .select('*')
    .eq('id', 1)
    .single()

  if (error || !data) {
    console.error('[numberPool] getPoolConfig failed, using fallback defaults:', error)
    return {
      max_pool_size: 200,
      daily_buy_cap: 50,
      utilization_trigger_pct: 70,
      sustained_hours_required: 2,
      buys_today: 0,
      buys_today_date: new Date().toISOString().split('T')[0],
    }
  }

  return data as PoolConfig
}

/**
 * Atomically increment the buys_today counter, resetting it if the date rolled over.
 * Returns the new count (post-increment). Used by the maintenance cron right after
 * a successful purchase to track against daily_buy_cap.
 */
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

/**
 * Look at recent call traffic and suggest area codes that should be in the pool
 * but aren't (or that are over-pressured).
 *
 * Strategy: count calls in the last 24h grouped by destination area code.
 * For the top 5 most-called area codes, check if the pool has at least 1 active
 * number in that area code. If not, recommend buying it.
 *
 * Returns a list of area codes ranked by how badly we need them.
 */
export async function recommendAreaCodesToBuy(limit = 5): Promise<string[]> {
  // Recent calls
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { data: recent } = await supabase
    .from('calls')
    .select('phone_number')
    .gte('created_at', oneDayAgo)
    .not('phone_number', 'is', null)

  if (!recent || recent.length === 0) return []

  // Tally area codes from recent calls
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

  // Filter to those NOT already in pool with active status
  const { data: existing } = await supabase
    .from('phone_numbers')
    .select('area_code')
    .eq('status', 'active')

  const haveAreaCodes = new Set((existing ?? []).map((n) => n.area_code))
  const missing = ranked.filter((ac) => !haveAreaCodes.has(ac))

  return missing.slice(0, limit)
}