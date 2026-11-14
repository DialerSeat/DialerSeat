import { NextResponse, type NextRequest } from 'next/server'
import { randomBytes } from 'node:crypto'
import { recordSubscription } from '@/lib/developers/billing'
import { consoleEnv, jsonError, requirePlatform } from '@/lib/developers/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Test mode only: pretend one of your users just paid you, so the seat, the
 * ledger row and the subscription.recorded webhook can be seen end to end
 * before any code is written.
 */
export async function POST(req: NextRequest) {
  const r = await requirePlatform(); if ('res' in r) return r.res
  if ((await consoleEnv()) !== 'test') return jsonError(400, 'test_only', 'Switch the console to Test to simulate a signup.')
  let b: { amount?: unknown; interval?: unknown } = {}
  try { b = await req.json() } catch { /* defaults */ }
  const amount = Number.isInteger(b.amount) && (b.amount as number) > 0 ? (b.amount as number) : 4900
  const interval = b.interval === 'week' || b.interval === 'year' ? b.interval : 'month'
  const id = randomBytes(3).toString('hex')
  const res = await recordSubscription(r.ctx.platform, 'test', {
    external_user_id: `test_user_${id}`, name: `Test user ${id}`, email: null,
    external_subscription_id: `test_sub_${id}`, amount, currency: 'usd', interval,
  }, 'console', `console:${id}`)
  return NextResponse.json({ seat: res.seat.id, external_user_id: res.seat.external_user_id, fee: res.entry.fee_cents, paid_through: res.seat.paid_through })
}
