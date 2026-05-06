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