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
  const { data: number, error: readErr } = await supabase
    .from('phone_numbers')
    .select('signalwire_sid')
    .eq('id', numberId)
    .single()

  if (readErr || !number) {
    console.error('[numberPool] release: number not found:', numberId)
    return
  }

  try {
    await swReleaseNumber(number.signalwire_sid)
  } catch (err) {
    console.error('[numberPool] SignalWire release failed:', err)
    throw err
  }

  await supabase
    .from('phone_numbers')
    .update({ status: 'released' })
    .eq('id', numberId)
}

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
    try {
      await swReleaseNumber(purchased.sid)
    } catch (releaseErr) {
      console.error('[numberPool] CRITICAL: Bought a number we cannot insert AND cannot release:', purchased.sid, releaseErr)
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