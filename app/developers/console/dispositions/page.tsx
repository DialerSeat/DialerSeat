import type { Metadata } from 'next'
import { PageHead } from '@/components/developers/ConsoleShell'
import { DispositionsManager } from '@/components/developers/console/DispositionsManager'
import { consoleContext } from '@/lib/developers/server'
import { devStore } from '@/lib/developers/store'

export const metadata: Metadata = { title: 'Dispositions' }
export const dynamic = 'force-dynamic'

export default async function DispositionsPage() {
  const { platform } = await consoleContext()
  const rows = await devStore().listDispositions(platform.id)
  return (
    <>
      <PageHead title="Dispositions" sub="The outcomes your agents pick in the miniplayer. Each has your code, which comes back in every webhook, the label agents see, and an outcome class so redials, reporting and do-not-call keep working." />
      <DispositionsManager rows={rows.map(r => ({ id: r.id, code: r.code, label: r.label, outcome: r.outcome, sort: r.sort }))} />
    </>
  )
}
