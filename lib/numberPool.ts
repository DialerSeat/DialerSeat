import { createClient } from '@supabase/supabase-js'
import {
  extractAreaCode,
  getAreaCodeInfo,
  stateToRegion,
  type Region,
} from './areaCode'
import { normalizeState } from './normalizeState'
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
// Raised 125 -> 200 on 2026-08-07 by account-owner decision. The tradeoff is
// unchanged: 200 is 60% more capacity per number and 60% more volume for a
// carrier to score. Watch health_answer_rate per number after the change --
// that is the signal that says whether the extra headroom cost anything.
export const DEFAULT_DAILY_CAP = 200

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























/**
 * Pick a caller ID for this lead AND record the usage, atomically.
 *
 * WHY THIS IS ONE OPERATION NOW: it used to be two — findActive() chose a
 * number, then recordUsage() counted the call afterwards. Both halves raced,
 * and a team is by definition concurrent:
 *
 *   STAMPEDE — findActive ordered by last_called_at ASC and returned the first
 *   number with headroom. Concurrent agents all read before any of them wrote,
 *   so every agent got the SAME number. The whole floor dialed from one caller
 *   ID while the rest of the pool idled, which is the fastest route to a
 *   "Spam Likely" label there is.
 *
 *   LOST INCREMENTS — recordUsage read the count, added one in JS, wrote it
 *   back. Two concurrent calls both read 10 and both wrote 11. Daily caps
 *   under-counted under exactly the load they exist to guard against.
 *
 * The claim_pool_number RPC does selection and increment in a single statement
 * with FOR UPDATE SKIP LOCKED, so concurrent callers get different numbers and
 * no increment is lost. Locality preference (area code, then state, then
 * region) is expressed in its ORDER BY rather than as separate round trips.
 */
export async function pickNumberForLead(
  leadPhone: string,
  dialerMode?: string,
  leadState?: string | null
): Promise<PoolNumber | null> {
  // ── PREDICTIVE MATCHES GEOGRAPHY LIKE EVERYTHING ELSE ────────────────────
  // This used to exclude predictive, on the reasoning that fanning out across
  // many leads at once makes matching a caller ID to "any single lead's
  // geography" meaningless. That reasoning does not hold: the fan-out places a
  // separate call per lead, each with its own destination, and this function is
  // called once per those calls with that lead's own number and state. There is
  // nothing shared to compromise between them.
  //
  // The cost of the exception was real. Predictive — the mode that places the
  // most calls, and the one whose answer rate matters most — was the only mode
  // dialing every prospect from whatever number happened to be freshest, while
  // preview, power and progressive all matched locally.
  //
  // Falls through the same ladder as every other mode: the lead's state first
  // when it contradicts their area code, then the area code, then the region,
  // then whatever has capacity.
  const useLocality = true
  void dialerMode

  let areaCode: string | null = null
  let state: string | null = null
  let region: string | null = null

  if (useLocality) {
    areaCode = extractAreaCode(leadPhone)
    const info = areaCode ? getAreaCodeInfo(areaCode) : null
    const areaCodeState = info?.state ?? null
    region = info?.region && info.region !== 'unknown' ? info.region : null

    // ── WHERE THEY LIVE BEATS WHERE THEY GOT THEIR NUMBER ─────────────────
    // The lead's own state column used to be ignored entirely here: `state`
    // was derived from the area code, so it could never disagree with it and
    // the RPC's state tier was decorative.
    //
    // Mobile numbers do not move when people do. Someone who moved New York to
    // Florida keeps their 212 number for years, and calling that person from a
    // New York caller ID is the wrong call — they live in Florida now, and a
    // Florida number is the one that reads as local to them.
    //
    // So when the lead's recorded state CONTRADICTS their area code, the area
    // code is dropped from the match entirely rather than merely outranked.
    // claim_pool_number ranks area code above state, so leaving it in would
    // keep handing back the New York number; passing null removes that tier
    // and lets the state tier decide. When the two agree, or the lead's state
    // is unknown, nothing changes — the area code is still the sharpest signal
    // available, since it pins a city rather than a whole state.
    // normalizeState returns null for anything it cannot resolve to a real
    // two-letter code — a blank, a typo, "N/A", a country, a mangled import.
    // Every one of those falls through to the area-code path below, which is
    // the correct fallback: a bad state field must never make the caller ID
    // WORSE than having no state field at all.
    const declaredState = normalizeState(leadState)
    if (declaredState && areaCodeState && declaredState !== areaCodeState) {
      areaCode = null
      state = declaredState
      // The region tier is re-derived from the lead's STATE, not left as the
      // area code's. Our pool will not always hold a number in every state, and
      // when it doesn't, the next best caller ID is one from the right part of
      // the country — Florida falling back to the southeast, not to whatever
      // region the number they moved away from happens to sit in, and not to
      // nothing at all.
      region = stateToRegion(declaredState)
    } else {
      state = declaredState ?? areaCodeState
    }
  }

  const { data, error } = await supabase.rpc('claim_pool_number', {
    p_area_code: areaCode,
    p_state: state,
    p_region: region,
  })

  if (error) {
    console.error('[numberPool] claim_pool_number failed:', error)
    return null
  }

  const rows = (data ?? []) as PoolNumber[]
  return rows[0] ?? null
}

/**
 * @deprecated Usage is now counted inside claim_pool_number, in the same
 * statement that selects the number.
 *
 * Kept as an explicit no-op rather than deleted: calling it after
 * pickNumberForLead would DOUBLE-COUNT every call, halving every number's
 * effective daily cap. Leaving a working-looking function here that silently
 * corrupts the counts is worse than leaving one that does nothing and says so.
 */
export async function recordUsage(numberId: string): Promise<void> {
  void numberId
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
      `[numberPool] Purchase of an ${areaCode} number BLOCKED, number buying is frozen ` +
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