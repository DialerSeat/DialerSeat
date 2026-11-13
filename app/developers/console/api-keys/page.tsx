import type { Metadata } from 'next'
import { PageHead } from '@/components/developers/ConsoleShell'
import { KeysManager, type KeyView } from '@/components/developers/console/KeysManager'
import { consoleContext, consoleEnv } from '@/lib/developers/server'
import { devStore } from '@/lib/developers/store'

export const metadata: Metadata = { title: 'API keys' }
export const dynamic = 'force-dynamic'

export default async function ApiKeysPage() {
  const { platform } = await consoleContext()
  const keys = await devStore().listKeys(platform.id)
  const env = await consoleEnv()
  // The hash never leaves the server. A publishable key is public by design,
  // so its full text is shown; a secret key is only its prefix and last four.
  const view: KeyView[] = keys.map(k => ({
    id: k.id, kind: k.kind, env: k.env, name: k.name, prefix: k.prefix, last4: k.last4,
    token: k.kind === 'publishable' ? k.token : null,
    created_at: k.created_at, last_used_at: k.last_used_at, revoked_at: k.revoked_at,
  }))
  return (
    <>
      <PageHead title="API keys" sub="Secret keys authenticate your server. Publishable keys identify your platform to the miniplayer in the browser. Test keys never dial. Live keys dial once live dialing is active." />
      {/* Keyed on the environment so the top bar's Test / Live switch resets the tabs. */}
      <KeysManager key={env} keys={view} liveActive={platform.live_status === 'active'} initialEnv={env} />
    </>
  )
}
