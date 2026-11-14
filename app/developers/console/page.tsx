import { ArrowRight, CircleCheck, Circle } from 'lucide-react'
import { PageHead } from '@/components/developers/ConsoleShell'
import { DevLink } from '@/components/developers/base'
import { CodeBlock } from '@/components/developers/ui'
import { consoleContext } from '@/lib/developers/server'
import { devStore } from '@/lib/developers/store'
import { API_BASE } from '@/lib/developers/catalog'
import { RequestTable } from '@/components/developers/console/RequestTable'

export const dynamic = 'force-dynamic'

/** Rows created in the last `days` days. Kept out of the component: the clock is not render input. */
function withinDays<T extends { created_at: string }>(rows: T[], days: number): T[] {
  const since = Date.now() - days * 86400_000
  return rows.filter(r => new Date(r.created_at).getTime() >= since)
}

export default async function Overview() {
  const { platform } = await consoleContext()
  const store = devStore()
  const [keys, hooks, seats, dispositions, requests] = await Promise.all([
    store.listKeys(platform.id), store.listWebhooks(platform.id), store.listSeats(platform.id),
    store.listDispositions(platform.id), store.listRequests(platform.id, 50),
  ])
  const testSecret = keys.find(k => k.kind === 'secret' && k.env === 'test' && !k.revoked_at)
  const recent = withinDays(requests, 7)

  const steps = [
    { done: true, title: 'Activate your developer account', href: '/console/settings', body: 'Done. Free, and separate from your dialerseat.com account.' },
    { done: keys.some(k => k.kind === 'secret' && !k.revoked_at), title: 'Have a secret key', href: '/console/api-keys', body: 'Your server authenticates every API call with it.' },
    { done: requests.length > 0, title: 'Make your first API call', href: '/docs/quickstart', body: 'GET /v1/me with your test key is the quickest check.' },
    { done: seats.length > 0, title: 'Create a seat', href: '/docs/seats-and-sessions', body: 'One per user who dials, keyed on your own user id.' },
    { done: dispositions.length > 0, title: 'Add your dispositions', href: '/console/dispositions', body: 'The outcomes agents pick from, with your codes.' },
    { done: platform.allowed_origins.length > 0, title: 'Allow your app\'s origin', href: '/console/miniplayer', body: 'Where the miniplayer is allowed to load.' },
    { done: hooks.some(h => !h.disabled_at), title: 'Add a webhook endpoint', href: '/console/webhooks', body: 'Where results are sent.' },
    { done: platform.live_status === 'active', title: 'Activate live dialing', href: '/console/billing#live', body: 'The step that turns real calls on.' },
  ]
  const doneCount = steps.filter(s => s.done).length
  const next = steps.find(s => !s.done)

  const stat = (label: string, value: React.ReactNode, note: string) => (
    <div className="dv-card" style={{ padding: 20 }}>
      <div className="dv-dim" style={{ fontSize: 12, letterSpacing: .4 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 600, margin: '8px 0 4px' }}>{value}</div>
      <div className="dv-dim" style={{ fontSize: 12 }}>{note}</div>
    </div>
  )

  return (
    <>
      <PageHead title="Overview" sub={<>Where <strong style={{ color: 'var(--dv-text)' }}>{platform.name}</strong> stands, and the next step to take.</>} />

      <div className="dv-grid-3 dv-stats" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
        {stat('Seats', seats.filter(s => s.status !== 'disabled').length, `${seats.filter(s => s.env === 'live').length} live · ${seats.filter(s => s.env === 'test').length} test`)}
        {stat('API requests, 7 days', recent.length, recent.length ? `${recent.filter(r => r.status >= 400).length} returned an error` : 'None yet')}
        {stat('Webhook endpoints', hooks.filter(h => !h.disabled_at).length, hooks.length ? `${hooks.filter(h => h.disabled_at).length} paused` : 'None yet')}
        {stat('Live dials', '—', platform.live_status === 'active' ? 'Counted from live calls' : 'Starts with live dialing')}
      </div>

      <div className="dv-grid-2" style={{ marginTop: 16, gridTemplateColumns: 'minmax(0, 1.3fr) minmax(0, 1fr)', alignItems: 'start' }}>
        <div className="dv-card">
          <div className="dv-card-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 className="dv-card-title">Set up your integration</h2>
            <span className="dv-badge">{doneCount} of {steps.length}</span>
          </div>
          <div style={{ margin: '14px 22px 0', height: 6, borderRadius: 999, background: 'var(--dv-panel-2)', overflow: 'hidden' }}>
            <div style={{ width: `${(doneCount / steps.length) * 100}%`, height: '100%', background: 'var(--dv-accent)' }} />
          </div>
          <div className="dv-card-body" style={{ display: 'grid', gap: 4 }}>
            {steps.map(s => (
              <DevLink key={s.title} href={s.href} className="dv-step" style={{ display: 'flex', gap: 12, padding: '10px 10px', borderRadius: 10, background: next === s ? 'var(--dv-accent-soft)' : 'transparent' }}>
                {s.done ? <CircleCheck size={18} color="var(--dv-green)" style={{ flexShrink: 0, marginTop: 1 }} /> : <Circle size={18} color={next === s ? 'var(--dv-accent)' : 'var(--dv-dim)'} style={{ flexShrink: 0, marginTop: 1 }} />}
                <span style={{ flex: 1 }}>
                  <span style={{ display: 'block', fontSize: 14, color: s.done ? 'var(--dv-muted)' : 'var(--dv-text)', textDecoration: s.done ? 'line-through' : undefined, textDecorationColor: 'var(--dv-dim)' }}>{s.title}</span>
                  {!s.done && <span className="dv-dim" style={{ display: 'block', fontSize: 12.5, marginTop: 2 }}>{s.body}</span>}
                </span>
                {next === s && <ArrowRight size={15} color="var(--dv-accent)" style={{ marginTop: 2 }} />}
              </DevLink>
            ))}
          </div>
        </div>

        <div className="dv-stack">
          <div className="dv-card">
            <div className="dv-card-head"><h2 className="dv-card-title">Check your key</h2><p className="dv-card-desc">Run this with your test secret key. A 200 means you&apos;re connected.</p></div>
            <div className="dv-card-body">
              <CodeBlock lang="bash" title="terminal" code={`curl ${API_BASE}/me \\\n  -H "Authorization: Bearer ${testSecret ? `${testSecret.prefix}…${testSecret.last4}` : 'dsk_test_…'}"`} />
              <p className="dv-help">Replace the key with your full test secret key. It was shown once when it was created. If you didn&apos;t save it, <DevLink href="/console/api-keys" className="dv-link">make a new one</DevLink>.</p>
            </div>
          </div>
          <div className="dv-card">
            <div className="dv-card-head"><h2 className="dv-card-title">Your accounts</h2></div>
            <div className="dv-card-body dv-muted" style={{ fontSize: 13.5, lineHeight: 1.6 }}>
              This developer account and your dialerseat.com account are separate. Your plan, your dialer and your teams on dialerseat.com are not affected by anything here.
            </div>
          </div>
        </div>
      </div>

      <div className="dv-card" style={{ marginTop: 16 }}>
        <div className="dv-card-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 className="dv-card-title">Recent API requests</h2>
          <DevLink href="/console/usage" className="dv-link" style={{ fontSize: 13, padding: '8px 0' }}>All requests</DevLink>
        </div>
        <div className="dv-card-body"><RequestTable rows={requests.slice(0, 8)} /></div>
      </div>
      <style>{`.dv-step:hover { background: var(--dv-panel-2) !important; } @media (max-width: 1000px) { .dv-console-main .dv-grid-3, .dv-console-main .dv-grid-2 { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; } } @media (max-width: 640px) { .dv-console-main .dv-grid-3, .dv-console-main .dv-grid-2 { grid-template-columns: minmax(0, 1fr) !important; } .dv-console-main .dv-stats { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; gap: 10px !important; } .dv-stats > .dv-card { padding: 14px !important; } } @media (max-width: 330px) { .dv-console-main .dv-stats { grid-template-columns: minmax(0, 1fr) !important; } }`}</style>
    </>
  )
}
