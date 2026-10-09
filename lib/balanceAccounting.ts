import { getServiceClient } from '@/lib/supabase'
import {
  COST_PER_AMD_LEG_USD, COST_PER_NUMBER_PURCHASE_USD, TAX_RATE,
} from '@/lib/telephonyCosts'

// =============================================================================
// WHAT LEFT THE TELNYX ACCOUNT, AND WHAT WE CAN NAME IT AS
// =============================================================================
// One calculation for every Balance screen, so the statement and the
// UNEXPLAINED tab cannot disagree about the same money.
//
// It replaced figures that called most of the spend "unexplained" (8 Oct 2026:
// ~$137 of the last 30 days, when about $104 had been spent at all):
//
//  1. SPEND counted every downward movement. Telnyx reserves against the
//     balance while calls run and returns what it over-reserved at the top of
//     the hour, so downward movements include reservations that came back. The
//     "net" figure beside it subtracted EVERY increase instead, top-ups
//     included, and so read $0.00 for any month with a deposit in it.
//     Now: downward movements minus the hourly settlement refunds only.
//
//  2. EXPLAINED was talk seconds x a per-minute rate. That misses the
//     60-second minimum on every answered call (voicemails above all), the
//     agent's own leg billed on two connections, and ring time. Telnyx sends
//     its own itemised cost for every leg (call.cost webhooks, kept in
//     telnyx_ledger_records), so that is what is used, plus what call.cost
//     never carries: detection, number purchases and rent, and tax.
//
// Credits are classified by when they land: settlements arrive in the first
// minutes of an hour (seen every day since 14 Sept), anything else is counted
// as money added. If one of those is really a settlement, spend reads high
// and UNEXPLAINED with it, the safe direction to be wrong in.
//
// The sums run in Postgres (balance_accounting_inputs). A REST read is capped
// at the project's max-rows setting, and a capped read does not fail, it
// quietly sums the first page.
// =============================================================================

const supabase = getServiceClient('balanceAccounting')

/** Minutes past the hour within which a balance increase is an hourly settlement. */
export const SETTLEMENT_MINUTES = 5

export interface BalanceAccounting {
  covered: boolean
  snapshots: number
  balanceStart: number | null
  balanceEnd: number | null
  /** Every downward movement, reservations included. */
  grossOutUsd: number
  /** Increases at the top of the hour: Telnyx returning what it over-reserved. */
  settlementCreditsUsd: number
  /** Every other increase: money added. Observed, not confirmed as a payment. */
  depositsUsd: number
  /** What was actually charged: gross out minus the settlement refunds. */
  spentUsd: number
  identified: {
    /** Telnyx's own itemised figure for every call leg (call.cost). */
    callsUsd: number
    callLegs: number
    /** Detection, which call.cost does not carry: our rate x calls with a verdict. */
    amdUsd: number
    amdLegs: number
    /** Numbers bought in the window, one-off fee each. */
    numberPurchasesUsd: number
    numbersBought: number
    /** Monthly rent of numbers held, for the share of the window they were held. */
    numberRentUsd: number
    numbersHeld: number
    taxUsd: number
    totalUsd: number
  }
  /** Spent minus everything identified. What is left to explain. */
  unexplainedUsd: number
}

export interface NumberRow {
  acquired_at: string | null
  monthly_cost_cents: number | null
  status: string | null
}

/** Number purchases and prorated rent over a window. Pure, for tests. */
export function numberCosts(numbers: NumberRow[], sinceMs: number, nowMs: number) {
  let bought = 0
  let rentUsd = 0
  let held = 0
  for (const n of numbers) {
    const acquiredMs = n.acquired_at ? Date.parse(n.acquired_at) : NaN
    if (Number.isFinite(acquiredMs) && acquiredMs >= sinceMs && acquiredMs <= nowMs) bought++
    // Released numbers carry no release date, so only numbers still held are
    // rented, for the part of the window each was held.
    if (n.status !== 'active') continue
    const heldFrom = Number.isFinite(acquiredMs) ? Math.max(acquiredMs, sinceMs) : sinceMs
    const heldDays = Math.max(0, (nowMs - heldFrom) / 86_400_000)
    if (heldDays <= 0) continue
    held++
    rentUsd += ((n.monthly_cost_cents ?? 0) / 100) * Math.min(1, heldDays / 30)
  }
  return { bought, purchasesUsd: bought * COST_PER_NUMBER_PURCHASE_USD, rentUsd, held }
}

export async function balanceAccounting(sinceIso: string): Promise<BalanceAccounting> {
  const nowMs = Date.now()
  const sinceMs = Date.parse(sinceIso)

  const [inputsRes, numbersRes] = await Promise.all([
    supabase.rpc('balance_accounting_inputs', {
      p_since: sinceIso,
      p_settlement_minutes: SETTLEMENT_MINUTES,
    }),
    supabase.from('phone_numbers').select('acquired_at, monthly_cost_cents, status'),
  ])
  if (inputsRes.error) throw inputsRes.error
  if (numbersRes.error) throw numbersRes.error

  const row = ((inputsRes.data || []) as Array<Record<string, number | string | null>>)[0] || {}
  const num = (k: string) => Number(row[k] ?? 0) || 0
  const nullable = (k: string) => (row[k] == null ? null : Number(row[k]))

  const grossOut = num('gross_out')
  const settlement = num('settlement_credits')
  const deposits = num('deposits')
  const spent = Math.max(0, grossOut - settlement)

  const callsUsd = num('call_cost')
  const amdLegs = num('amd_legs')
  const amdUsd = amdLegs * COST_PER_AMD_LEG_USD
  const n = numberCosts((numbersRes.data || []) as NumberRow[], sinceMs, nowMs)

  const preTax = callsUsd + amdUsd + n.purchasesUsd + n.rentUsd
  const taxUsd = preTax * TAX_RATE
  const identifiedTotal = preTax + taxUsd
  const snapshots = num('snapshots')

  return {
    covered: snapshots >= 2,
    snapshots,
    balanceStart: nullable('balance_start'),
    balanceEnd: nullable('balance_end'),
    grossOutUsd: round4(grossOut),
    settlementCreditsUsd: round4(settlement),
    depositsUsd: round4(deposits),
    spentUsd: round4(spent),
    identified: {
      callsUsd: round4(callsUsd),
      callLegs: num('call_legs'),
      amdUsd: round4(amdUsd),
      amdLegs,
      numberPurchasesUsd: round4(n.purchasesUsd),
      numbersBought: n.bought,
      numberRentUsd: round4(n.rentUsd),
      numbersHeld: n.held,
      taxUsd: round4(taxUsd),
      totalUsd: round4(identifiedTotal),
    },
    unexplainedUsd: round4(Math.max(0, spent - identifiedTotal)),
  }
}

/**
 * Every row of a query, a page at a time. A plain read stops at the project's
 * max-rows setting without saying so; 30 days is ~2,500 balance readings and
 * ~12,000 calls, so the statement was quietly built from the oldest 1,000.
 * The query must be ordered, or pages can overlap.
 */
export async function readAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: unknown; error: unknown }>,
  pageSize = 1000,
  max = 200_000,
): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; from < max; from += pageSize) {
    const { data, error } = await page(from, from + pageSize - 1)
    if (error) throw error
    const rows = (data || []) as T[]
    out.push(...rows)
    if (rows.length < pageSize) break
  }
  return out
}

function round4(x: number): number {
  return Math.round(x * 10000) / 10000
}
