import type { Metadata } from 'next'
import { SetupGuide } from '@/components/developers/console/SetupGuide'
import { consoleContext } from '@/lib/developers/server'
import { devStore } from '@/lib/developers/store'

export const metadata: Metadata = { title: 'Setup' }
export const dynamic = 'force-dynamic'

/**
 * Where a new project lands. Each step is checked against what really exists
 * (keys, seats, calls, webhooks, origins, billing events) in test mode, so the
 * ticks are earned, not clicked.
 */
export default async function SetupPage() {
  const { platform } = await consoleContext()
  const store = devStore()
  const [keys, seats, calls, hooks, ledger, source] = await Promise.all([
    store.listKeys(platform.id), store.listSeats(platform.id, 'test'), store.listCalls(platform.id, 'test', null, 1),
    store.listWebhooks(platform.id), store.listLedger(platform.id, 'test', 1), store.getBillingSource(platform.id, 'test'),
  ])
  const pk = keys.find(k => k.kind === 'publishable' && k.env === 'test' && !k.revoked_at)
  return (
    <SetupGuide
      project={{ id: platform.id, name: platform.name, approach: platform.integration_approach || 'script', profile: platform.profile || {}, done: !!platform.setup_completed_at, origins: platform.allowed_origins }}
      publishableKey={pk?.token || ''}
      state={{
        secretKey: keys.some(k => k.kind === 'secret' && k.env === 'test' && !k.revoked_at),
        seat: seats.length > 0,
        call: calls.length > 0,
        webhook: hooks.some(h => h.env === 'test' && !h.disabled_at),
        billing: ledger.length > 0 || !!source?.signing_secret,
      }}
    />
  )
}
