import type { Metadata } from 'next'
import { PageHead } from '@/components/developers/ConsoleShell'
import { WebhooksManager } from '@/components/developers/console/WebhooksManager'
import { consoleContext } from '@/lib/developers/server'
import { devStore } from '@/lib/developers/store'

export const metadata: Metadata = { title: 'Webhooks' }
export const dynamic = 'force-dynamic'

export default async function WebhooksPage() {
  const { platform } = await consoleContext()
  const store = devStore()
  const endpoints = await store.listWebhooks(platform.id)
  const deliveries = await store.listDeliveries(endpoints.map(e => e.id), 30)
  return (
    <>
      <PageHead title="Webhooks" sub="Endpoints on your server that receive call, disposition and seat events. Every delivery is signed with the endpoint's own secret so you can prove it came from DialerSeat." />
      <WebhooksManager
        endpoints={endpoints}
        deliveries={deliveries.map(d => ({ id: d.id, endpoint_id: d.endpoint_id, event_type: d.event_type, status: d.status, last_status_code: d.last_status_code, last_error: d.last_error, created_at: d.created_at, payload: d.payload }))}
      />
    </>
  )
}
