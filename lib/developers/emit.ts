// =============================================================================
// SENDING A PLATFORM ITS EVENTS
// =============================================================================
// Every endpoint on the platform that listens in this environment and to this
// event gets one signed POST, in parallel, and every attempt is written to
// dev_webhook_deliveries so the console shows it. A failed delivery is kept
// with next_attempt_at set for the retry job (roadmap Phase 2); nothing here
// blocks the caller for longer than one 10-second delivery.
// =============================================================================

import 'server-only'
import { randomUUID } from 'node:crypto'
import { devStore, type Env, type Platform } from './store'
import { deliver } from './webhooks'

export interface Emitted { endpoints: number; delivered: number }

export async function emitEvent(platform: Platform, env: Env, type: string, data: Record<string, unknown>): Promise<Emitted> {
  const store = devStore()
  const endpoints = (await store.listWebhooks(platform.id)).filter(ep =>
    !ep.disabled_at && ep.env === env && (ep.events.includes('*') || ep.events.includes(type)))
  if (!endpoints.length) return { endpoints: 0, delivered: 0 }

  const event = {
    id: 'evt_' + randomUUID().replace(/-/g, '').slice(0, 24),
    type,
    created_at: new Date().toISOString(),
    livemode: env === 'live',
    platform_id: platform.id,
    data,
  }
  const results = await Promise.all(endpoints.map(async ep => {
    const r = await deliver(ep.url, ep.signing_secret, event)
    await store.insertDelivery({
      endpoint_id: ep.id, event_type: type, payload: event,
      status: r.ok ? 'delivered' : 'pending', attempts: 1,
      next_attempt_at: r.ok ? null : new Date(Date.now() + 60_000).toISOString(),
      last_status_code: r.status, last_error: r.error,
      delivered_at: r.ok ? new Date().toISOString() : null,
    })
    return r.ok
  }))
  return { endpoints: endpoints.length, delivered: results.filter(Boolean).length }
}
