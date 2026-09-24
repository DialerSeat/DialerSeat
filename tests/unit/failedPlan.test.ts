import { describe, it, expect, vi, beforeEach } from 'vitest'
import type Stripe from 'stripe'

// Every Stripe call is recorded in order, so the tests can hold the one rule
// that matters most here: a failed plan is cancelled BEFORE its invoice is
// voided (lib/failedPlan explains why the other order flips it to active).
const calls: string[] = []
const invoiceStatus: Record<string, string> = {}
const openBySub: Record<string, string[]> = {}
let cancelError: Error | null = null
let statusAfterFailedCancel = 'canceled'

vi.mock('@/lib/stripe', () => ({
  stripe: {
    subscriptions: {
      cancel: vi.fn(async (id: string, params: Stripe.SubscriptionCancelParams) => {
        calls.push(`cancel ${id} ${params.cancellation_details?.comment ?? ''}`)
        if (cancelError) throw cancelError
      }),
      retrieve: vi.fn(async (id: string) => {
        calls.push(`retrieve ${id}`)
        return { id, status: statusAfterFailedCancel }
      }),
    },
    invoices: {
      retrieve: vi.fn(async (id: string) => {
        calls.push(`invoice ${id}`)
        return { id, status: invoiceStatus[id] ?? 'open' }
      }),
      list: vi.fn(async ({ subscription, status }: { subscription: string; status: string }) => {
        calls.push(`list ${subscription} ${status}`)
        const ids = status === 'open' ? openBySub[subscription] ?? [] : []
        return { data: ids.map(id => ({ id })) }
      }),
      voidInvoice: vi.fn(async (id: string) => {
        calls.push(`void ${id}`)
      }),
    },
  },
}))

import {
  REPLACED_FAILED_PLAN,
  closeFailedPlans,
  endedOnFailedPayment,
  isReplacedFailedPlan,
  unpaidAccessEnd,
} from '@/lib/failedPlan'

const sub = (over: Partial<Stripe.Subscription>) =>
  ({ id: 'sub_old', status: 'past_due', latest_invoice: 'in_failed', cancellation_details: null, ...over }) as Stripe.Subscription

beforeEach(() => {
  calls.length = 0
  for (const k of Object.keys(invoiceStatus)) delete invoiceStatus[k]
  for (const k of Object.keys(openBySub)) delete openBySub[k]
  cancelError = null
  statusAfterFailedCancel = 'canceled'
  vi.spyOn(console, 'log').mockImplementation(() => {})
})

describe('closeFailedPlans', () => {
  it('cancels with the replacement mark, then voids what the plan still owes', async () => {
    openBySub.sub_old = ['in_failed']
    const failed = [sub({})]
    expect(await closeFailedPlans(failed, failed)).toBeNull()
    expect(calls).toEqual([
      `cancel sub_old ${REPLACED_FAILED_PLAN}`,
      'invoice in_failed',
      'list sub_old open',
      'void in_failed',
      'list sub_old uncollectible',
    ])
  })

  it('stops, and voids nothing, when a retry paid the plan as it was cancelled', async () => {
    invoiceStatus.in_failed = 'paid'
    openBySub.sub_old = ['in_other']
    const failed = [sub({})]
    expect(await closeFailedPlans(failed, failed)).toEqual({ paidMeanwhile: 'sub_old' })
    expect(calls.some(c => c.startsWith('void'))).toBe(false)
  })

  it('carries on when another tab already cancelled the plan', async () => {
    cancelError = new Error('already canceled')
    const failed = [sub({})]
    expect(await closeFailedPlans(failed, failed)).toBeNull()
  })

  it('fails when the cancel failed and the plan is still live', async () => {
    cancelError = new Error('stripe down')
    statusAfterFailedCancel = 'past_due'
    const failed = [sub({})]
    await expect(closeFailedPlans(failed, failed)).rejects.toThrow('stripe down')
    expect(calls.some(c => c.startsWith('void'))).toBe(false)
  })

  it('voids leftovers of a plan ended earlier without cancelling anything', async () => {
    openBySub.sub_prev = ['in_left']
    const ended = sub({
      id: 'sub_prev',
      status: 'canceled',
      cancellation_details: { comment: null, feedback: null, reason: 'payment_failed' },
    })
    expect(await closeFailedPlans([], [ended])).toBeNull()
    expect(calls.some(c => c.startsWith('cancel'))).toBe(false)
    expect(calls).toContain('void in_left')
  })
})

describe('which plans ended on a failed payment', () => {
  const replaced = { comment: REPLACED_FAILED_PLAN, feedback: null, reason: 'cancellation_requested' as const }

  it('counts a replaced plan and one Stripe cancelled after its last retry', () => {
    expect(endedOnFailedPayment(sub({ status: 'canceled', cancellation_details: replaced }))).toBe(true)
    expect(isReplacedFailedPlan(sub({ status: 'canceled', cancellation_details: replaced }))).toBe(true)
    expect(endedOnFailedPayment(sub({
      status: 'canceled',
      cancellation_details: { comment: null, feedback: null, reason: 'payment_failed' },
    }))).toBe(true)
  })

  it('does not count a customer cancelling, or a signup that never paid', () => {
    expect(endedOnFailedPayment(sub({
      status: 'canceled',
      cancellation_details: { comment: null, feedback: null, reason: 'cancellation_requested' },
    }))).toBe(false)
    expect(endedOnFailedPayment(sub({ status: 'incomplete_expired' }))).toBe(false)
    expect(endedOnFailedPayment(sub({ status: 'past_due' }))).toBe(false)
  })
})

describe('unpaidAccessEnd', () => {
  const ended = 1_790_000_000
  const endedIso = new Date(ended * 1000).toISOString()

  it('ends access when the plan ended, for a week that was never paid', async () => {
    const s = sub({
      status: 'canceled',
      ended_at: ended,
      cancellation_details: { comment: REPLACED_FAILED_PLAN, feedback: null, reason: 'cancellation_requested' },
    })
    expect(await unpaidAccessEnd(s)).toBe(endedIso)
  })

  it('leaves a paid week alone, even on a plan that was being replaced', async () => {
    invoiceStatus.in_failed = 'paid'
    const s = sub({
      status: 'canceled',
      ended_at: ended,
      cancellation_details: { comment: REPLACED_FAILED_PLAN, feedback: null, reason: 'cancellation_requested' },
    })
    expect(await unpaidAccessEnd(s)).toBeNull()
  })

  it('reads an expanded invoice without asking Stripe again', async () => {
    const s = sub({
      status: 'canceled',
      ended_at: ended,
      latest_invoice: { id: 'in_x', status: 'open' } as Stripe.Invoice,
      cancellation_details: { comment: null, feedback: null, reason: 'payment_failed' },
    })
    expect(await unpaidAccessEnd(s)).toBe(endedIso)
    expect(calls).toEqual([])
  })

  it('never touches an ordinary cancellation, which keeps its paid days', async () => {
    const s = sub({
      status: 'canceled',
      ended_at: ended,
      cancellation_details: { comment: null, feedback: null, reason: 'cancellation_requested' },
    })
    expect(await unpaidAccessEnd(s)).toBeNull()
    expect(calls).toEqual([])
  })
})
