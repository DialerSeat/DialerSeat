import type { NextRequest } from 'next/server'
import { withV1, v1Json, v1Error, readJson, str, seatOut } from '@/lib/developers/v1'
import { recordSubscription, type Interval } from '@/lib/developers/billing'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * One of your users paid you: a signup or a renewal. Call it from wherever
 * your billing confirms the payment. The seat is created or renewed and dials
 * through the period paid for; DialerSeat's cut for that period goes on your
 * balance. Send the same Idempotency-Key (or event_id) again and nothing is
 * recorded twice.
 */
export async function POST(req: NextRequest) {
  return withV1(req, async ({ platform, env }) => {
    const r = await readJson(req); if ('res' in r) return r.res
    const b = r.body
    const external = str(b.external_user_id, 120)
    if (!external) return v1Error('invalid_request', 'external_user_id is required: your own id for the user who paid.', 'external_user_id')
    const amount = Number(b.amount)
    if (!Number.isInteger(amount) || amount < 0) return v1Error('invalid_request', 'amount is required: what the user paid you for this period, in cents (4900 for $49.00).', 'amount')
    const currency = str(b.currency, 3)?.toLowerCase() || 'usd'
    if (!/^[a-z]{3}$/.test(currency)) return v1Error('invalid_request', 'currency is a three-letter code such as usd.', 'currency')
    const email = str(b.email, 200)
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return v1Error('invalid_request', 'email is not an email address.', 'email')

    let interval: Interval | undefined
    if (b.interval !== undefined) {
      if (b.interval !== 'week' && b.interval !== 'month' && b.interval !== 'year') return v1Error('invalid_request', 'interval is week, month or year.', 'interval')
      interval = b.interval
    }
    const parseDate = (v: unknown): Date | undefined | 'bad' => {
      if (v === undefined || v === null || v === '') return undefined
      const d = typeof v === 'number' ? new Date(v < 1e12 ? v * 1000 : v) : new Date(String(v))
      return Number.isNaN(d.getTime()) ? 'bad' : d
    }
    const start = parseDate(b.period_start)
    const end = parseDate(b.period_end)
    if (start === 'bad') return v1Error('invalid_request', 'period_start is not a date. Send ISO 8601 or a Unix timestamp.', 'period_start')
    if (end === 'bad') return v1Error('invalid_request', 'period_end is not a date. Send ISO 8601 or a Unix timestamp.', 'period_end')
    if (start && end && end.getTime() <= start.getTime()) return v1Error('invalid_request', 'period_end must be after period_start.', 'period_end')
    if (!end && !interval) return v1Error('invalid_request', 'Send period_end, or interval (week, month or year) so the paid period is known.', 'interval')

    const key = str(req.headers.get('idempotency-key'), 200) || str(b.event_id, 200)
    const result = await recordSubscription(platform, env, {
      external_user_id: external, email, name: str(b.name, 120),
      external_subscription_id: str(b.external_subscription_id, 200),
      amount, currency, period_start: start, period_end: end, interval,
    }, 'api', key ? `api:${key}` : null)

    const e = result.entry
    return v1Json({
      object: 'subscription_event',
      livemode: env === 'live',
      kind: e.kind,
      duplicate: result.duplicate,
      seat: seatOut(result.seat),
      period: { start: e.period_start, end: e.period_end },
      customer_amount: e.customer_amount_cents,
      currency: e.currency,
      fee: { amount: e.fee_cents, status: e.fee_cents == null ? 'rate_not_set' : 'owed' },
    }, result.duplicate ? 200 : 201)
  })
}
