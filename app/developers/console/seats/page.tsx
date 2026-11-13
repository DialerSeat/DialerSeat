import type { Metadata } from 'next'
import { PageHead } from '@/components/developers/ConsoleShell'
import { CodeBlock } from '@/components/developers/ui'
import { consoleContext } from '@/lib/developers/server'
import { devStore } from '@/lib/developers/store'
import { API_BASE } from '@/lib/developers/catalog'

export const metadata: Metadata = { title: 'Seats' }
export const dynamic = 'force-dynamic'

const STATUS: Record<string, string> = { active: 'dv-badge dv-badge-green', pending: 'dv-badge dv-badge-amber', past_due: 'dv-badge dv-badge-red', disabled: 'dv-badge' }

export default async function SeatsPage({ searchParams }: { searchParams: Promise<{ env?: string }> }) {
  const { platform } = await consoleContext()
  const env = (await searchParams).env === 'live' ? 'live' : 'test'
  const all = await devStore().listSeats(platform.id)
  const seats = all.filter(s => s.env === env)
  const exceptions = (await devStore().listExceptions(platform.id)).filter(e => e.scope === 'seat')
  return (
    <>
      <PageHead title="Seats" sub="Every user on your platform who dials. Seats are created through the API, keyed on your own user ids, so this list always matches your platform." />
      <div className="dv-seg" style={{ marginBottom: 16 }}>
        <a href="?env=test"><button type="button" aria-pressed={env === 'test'}>Test · {all.filter(s => s.env === 'test').length}</button></a>
        <a href="?env=live"><button type="button" aria-pressed={env === 'live'}>Live · {all.filter(s => s.env === 'live').length}</button></a>
      </div>
      <div className="dv-card">
        <div className="dv-card-body">
          {seats.length === 0 ? (
            <div style={{ padding: '8px 4px' }}>
              <div className="dv-empty" style={{ paddingTop: 12 }}>No {env} seats yet. Create one from your server:</div>
              <CodeBlock lang="bash" title="terminal" code={`curl ${API_BASE}/seats \\\n  -H "Authorization: Bearer sk_${env}_..." \\\n  -H "Content-Type: application/json" \\\n  -d '{"external_user_id":"usr_829","email":"agent@yourcrm.com","name":"Agent Name"}'`} />
            </div>
          ) : (
            <div className="dv-table-wrap"><table className="dv-table">
              <thead><tr><th>Your user id</th><th>Name</th><th>Email</th><th>Status</th><th>Paid by</th><th>Dial mode</th><th>Created</th></tr></thead>
              <tbody>
                {seats.map(s => {
                  const ex = exceptions.find(e => e.external_id === s.external_user_id)
                  return (
                    <tr key={s.id}>
                      <td><code className="dv-inline-code">{s.external_user_id}</code></td>
                      <td>{s.name || <span className="dv-dim">—</span>}</td>
                      <td className="dv-muted">{s.email || '—'}</td>
                      <td><span className={STATUS[s.status]} style={{ textTransform: 'capitalize' }}>{s.status.replace('_', ' ')}</span></td>
                      <td style={{ textTransform: 'capitalize' }}>{s.billed_to}</td>
                      <td>{ex ? <span className="dv-badge dv-badge-blue" style={{ textTransform: 'capitalize' }}>{ex.dial_mode} · exception</span> : <span className="dv-muted" style={{ textTransform: 'capitalize' }}>{platform.default_dial_mode}</span>}</td>
                      <td className="dv-dim">{new Date(s.created_at).toLocaleDateString()}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table></div>
          )}
        </div>
      </div>
    </>
  )
}
