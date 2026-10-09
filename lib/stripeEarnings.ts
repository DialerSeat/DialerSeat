import { stripe } from '@/lib/stripe'

// =============================================================================
// WHAT THE BUSINESS ACTUALLY TOOK IN, FOR A DATE RANGE
// =============================================================================
// Admin analytics showed run-rate only ("weekly revenue now"), which is the
// same number whatever range is picked. This is the money: Stripe's own
// balance transactions in the range, so it already reflects coupons, failed
// payments, refunds and disputes rather than modelling them.
//
// From the Stripe docs (balance_transaction object): `amount` is gross in
// cents, negative when money goes back out; `fee` is positive when assessed;
// `net` = amount - fee. Payouts, transfers, top-ups and reserves move money
// between balances rather than earning or losing it, so they are left out.
// =============================================================================

export interface Earnings {
  /** Charges and payments collected, before refunds and fees. */
  grossUsd: number
  /** Refunds given back, as a positive number. */
  refundsUsd: number
  /** Disputes lost (and reversals won back), net, as a positive number when lost. */
  disputesUsd: number
  /** Stripe's fees, as a positive number. */
  feesUsd: number
  /** gross - refunds - disputes - fees. */
  netUsd: number
  payments: number
  refunds: number
}

const GROSS = new Set(['charge', 'payment'])
const REFUND = new Set(['refund', 'payment_refund', 'refund_failure', 'payment_failure_refund'])
const DISPUTE = new Set(['adjustment', 'payment_reversal'])
const FEE_ONLY = new Set(['stripe_fee', 'stripe_fx_fee', 'tax_fee'])

export interface BalanceTxn { type: string; amount: number; fee: number; currency: string }

/** Pure, for tests. */
export function summariseEarnings(txns: BalanceTxn[]): Earnings {
  let gross = 0, refunds = 0, disputes = 0, fees = 0, payments = 0, refundCount = 0
  for (const t of txns) {
    if (t.currency !== 'usd') continue
    if (GROSS.has(t.type)) {
      gross += t.amount; fees += t.fee; payments++
    } else if (REFUND.has(t.type)) {
      refunds += -t.amount; fees += t.fee
      if (t.amount < 0) refundCount++
    } else if (DISPUTE.has(t.type)) {
      disputes += -t.amount; fees += t.fee
    } else if (FEE_ONLY.has(t.type)) {
      fees += -t.amount + t.fee
    }
  }
  const usd = (c: number) => Math.round(c) / 100
  return {
    grossUsd: usd(gross),
    refundsUsd: usd(refunds),
    disputesUsd: usd(disputes),
    feesUsd: usd(fees),
    netUsd: usd(gross - refunds - disputes - fees),
    payments,
    refunds: refundCount,
  }
}

const cache = new Map<string, { at: number; value: Earnings }>()
const CACHE_MS = 5 * 60_000

/** Earnings between two instants (ms). Cached five minutes per range. */
export async function stripeEarnings(startMs: number, endMs: number): Promise<Earnings> {
  // Rounded to the minute so "now" does not defeat the cache.
  const key = `${Math.floor(startMs / 60_000)}:${Math.floor(endMs / 60_000)}`
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value

  const created: { lte: number; gte?: number } = { lte: Math.floor(endMs / 1000) }
  if (startMs > 0) created.gte = Math.floor(startMs / 1000)
  const txns = await stripe.balanceTransactions
    .list({ created, limit: 100 })
    .autoPagingToArray({ limit: 10_000 })

  const value = summariseEarnings(txns as unknown as BalanceTxn[])
  cache.set(key, { at: Date.now(), value })
  return value
}
