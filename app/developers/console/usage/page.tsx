import type { Metadata } from 'next'
import { PageHead } from '@/components/developers/ConsoleShell'
import { RequestTable } from '@/components/developers/console/RequestTable'
import { consoleContext } from '@/lib/developers/server'
import { devStore } from '@/lib/developers/store'

export const metadata: Metadata = { title: 'Usage' }
export const dynamic = 'force-dynamic'

/**
 * Real numbers only. Seats and requests are counted from records; dials and
 * seat-weeks show a dash until live dialing has produced some, because a
 * number that has not been measured is not shown as one that has.
 */
export default async function UsagePage() {
  const { platform } = await consoleContext()
  const store = devStore()
  const [seats, requests] = await Promise.all([store.listSeats(platform.id), store.listRequests(platform.id, 200)])
  const live = seats.filter(s => s.env === 'live')
  const errors = requests.filter(r => r.status >= 400)
  const byPath = new Map<string, number>()
  for (const r of requests) byPath.set(`${r.method} ${r.path.replace(/\/[0-9a-f-]{36}/gi, '/{id}')}`, (byPath.get(`${r.method} ${r.path.replace(/\/[0-9a-f-]{36}/gi, '/{id}')}`) || 0) + 1)
  const top = [...byPath.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)

  const box = (label: string, value: React.ReactNode, note: string) => (
    <div className="dv-card" style={{ padding: 20 }}>
      <div className="dv-dim" style={{ fontSize: 12 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 600, margin: '8px 0 4px' }}>{value}</div>
      <div className="dv-dim" style={{ fontSize: 12 }}>{note}</div>
    </div>
  )

  return (
    <>
      <PageHead title="Usage" sub="What your platform has used, counted from records. Live dials and seat-weeks appear once live dialing produces them. What you are billed for is under Billing." />
      <div className="dv-grid-3" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
        {box('Live seats', live.filter(s => s.status === 'active').length, `${live.length} created · ${live.filter(s => s.status === 'pending').length} waiting for payment`)}
        {box('Live dials this week', '—', 'Counted once live dialing is active')}
        {box('Seat-weeks this week', '—', 'Counted once live dialing is active')}
        {box('API requests', requests.length, requests.length ? `${errors.length} errors in the last ${requests.length}` : 'None yet')}
      </div>
      <div className="dv-grid-2" style={{ marginTop: 16, gridTemplateColumns: 'minmax(0, 1fr) 320px', alignItems: 'start' }}>
        <div className="dv-card">
          <div className="dv-card-head"><h2 className="dv-card-title">Request log</h2><p className="dv-card-desc">The last 200 API requests, newest first. Kept for 30 days.</p></div>
          <div className="dv-card-body"><RequestTable rows={requests.slice(0, 60)} /></div>
        </div>
        <div className="dv-card">
          <div className="dv-card-head"><h2 className="dv-card-title">Most called</h2></div>
          <div className="dv-card-body">
            {top.length === 0 ? <div className="dv-empty">Nothing yet.</div> : (
              <div style={{ display: 'grid', gap: 10 }}>
                {top.map(([k, n]) => (
                  <div key={k}>
                    <div className="dv-row" style={{ justifyContent: 'space-between', fontSize: 12.5 }}><code style={{ overflowWrap: 'anywhere' }}>{k}</code><span className="dv-muted">{n}</span></div>
                    <div style={{ height: 4, borderRadius: 4, background: 'var(--dv-panel-2)', marginTop: 5 }}><div style={{ width: `${(n / top[0][1]) * 100}%`, height: '100%', borderRadius: 4, background: 'var(--dv-accent)' }} /></div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      <style>{`@media (max-width: 1000px) { .dv-console-main .dv-grid-3, .dv-console-main .dv-grid-2 { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; } } @media (max-width: 640px) { .dv-console-main .dv-grid-3, .dv-console-main .dv-grid-2 { grid-template-columns: minmax(0, 1fr) !important; } }`}</style>
    </>
  )
}
