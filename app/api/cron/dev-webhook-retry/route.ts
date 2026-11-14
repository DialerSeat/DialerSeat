import { NextResponse } from 'next/server'
import { devStore } from '@/lib/developers/store'
import { deliver } from '@/lib/developers/webhooks'
import { nextAttemptAt } from '@/lib/developers/retry'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

// =============================================================================
// DEVELOPER WEBHOOK RETRIES — dev.dialerseat.com only
// =============================================================================
// Every five minutes: resend developer-platform webhook deliveries that failed
// and are due (schedule in lib/developers/retry.ts). Reads and writes only the
// dev_webhook_* tables; nothing on dialerseat.com is touched. A disabled or
// deleted endpoint stops its retries.
// =============================================================================

const BATCH = 50

export async function GET(req: Request) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const store = devStore()
  const due = await store.dueDeliveries(BATCH)
  let delivered = 0, rescheduled = 0, failed = 0

  await Promise.all(due.map(async ({ delivery, endpoint }) => {
    const attempts = delivery.attempts + 1
    if (endpoint.disabled_at) {
      await store.updateDelivery(delivery.id, { status: 'failed', attempts: delivery.attempts, next_attempt_at: null, last_error: 'Endpoint disabled; retries stopped.' })
      failed++
      return
    }
    const r = await deliver(endpoint.url, endpoint.signing_secret, delivery.payload as object)
    if (r.ok) {
      await store.updateDelivery(delivery.id, { status: 'delivered', attempts, next_attempt_at: null, last_status_code: r.status, last_error: null, delivered_at: new Date().toISOString() })
      delivered++
      return
    }
    const next = nextAttemptAt(new Date(delivery.created_at), attempts)
    await store.updateDelivery(delivery.id, {
      status: next ? 'pending' : 'failed', attempts, next_attempt_at: next ? next.toISOString() : null,
      last_status_code: r.status, last_error: r.error,
    })
    if (next) rescheduled++; else failed++
  }))

  return NextResponse.json({ due: due.length, delivered, rescheduled, failed })
}
