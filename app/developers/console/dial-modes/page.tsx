import type { Metadata } from 'next'
import { PageHead } from '@/components/developers/ConsoleShell'
import { DialModePolicy } from '@/components/developers/console/DialModePolicy'
import { consoleContext } from '@/lib/developers/server'
import { devStore } from '@/lib/developers/store'

export const metadata: Metadata = { title: 'Dial modes' }
export const dynamic = 'force-dynamic'

export default async function DialModesPage() {
  const { platform } = await consoleContext()
  const exceptions = await devStore().listExceptions(platform.id)
  return (
    <>
      <PageHead title="Dial modes" sub="Choose how your whole platform dials, then make exceptions: one seat on predictive while everyone else stays on power, or one campaign locked to preview." />
      <DialModePolicy
        policy={{ default_dial_mode: platform.default_dial_mode, allowed_dial_modes: platform.allowed_dial_modes, seats_may_choose_mode: platform.seats_may_choose_mode }}
        exceptions={exceptions}
      />
    </>
  )
}
