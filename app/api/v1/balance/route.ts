import type { NextRequest } from 'next/server'
import { withV1, v1Json } from '@/lib/developers/v1'
import { balanceFor } from '@/lib/developers/billing'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** What you owe DialerSeat, and the latest ledger entries behind it. */
export async function GET(req: NextRequest) {
  return withV1(req, async ({ platform, env }) => {
    const { balance, rows } = await balanceFor(platform, env)
    return v1Json({
      object: 'balance', livemode: env === 'live', currency: balance.currency,
      amount_due: balance.due_cents, fees: balance.fees_cents, paid: balance.paid_cents,
      entries_without_rate: balance.rate_not_set,
      entries: rows.slice(0, 50).map(e => ({
        id: e.id, kind: e.kind, external_user_id: e.external_user_id, external_subscription_id: e.external_subscription_id,
        customer_amount: e.customer_amount_cents, fee: e.fee_cents, currency: e.currency,
        period: e.period_start ? { start: e.period_start, end: e.period_end } : null, source: e.source, created_at: e.created_at,
      })),
    })
  })
}
