import type { Metadata } from 'next'
import { API_BASE, ENDPOINTS, WEBHOOK_EVENTS, type ApiEndpoint } from '@/lib/developers/catalog'
import { endpointAnchor } from '@/lib/developers/searchIndex'
import { CodeBlock, MethodPill } from '@/components/developers/ui'
import { DevLink } from '@/components/developers/base'

export const metadata: Metadata = {
  title: 'API reference',
  description: 'Every DialerSeat API endpoint: seats, sessions, campaigns, leads, calls, dispositions, do-not-call and usage.',
  alternates: { canonical: 'https://dev.dialerseat.com/docs/api' },
}

// Example request bodies for the endpoints that take one. Shown as written in
// the docs; the field names are the ones the routes in app/api/v1 accept.
const BODIES: Record<string, string> = {
  'POST /seats': '{\n  "external_user_id": "usr_829",\n  "email": "ana@acme.com",\n  "name": "Ana Ruiz",\n  "billed_to": "user"\n}',
  'PATCH /seats/{id}': '{\n  "billed_to": "platform"\n}',
  'POST /campaigns': '{\n  "external_id": "crm_campaign_77",\n  "name": "November renewals",\n  "dial_mode": "power"\n}',
  'POST /campaigns/{id}/leads': '{\n  "leads": [\n    { "external_id": "c_5501", "phone": "+15125550142", "first_name": "Dana", "consent_source": "web form" }\n  ]\n}',
  'POST /dispositions': '{\n  "code": "APPT_SET",\n  "label": "Appointment set",\n  "outcome": "conversion"\n}',
  'POST /dnc': '{\n  "phone": "+15125550142"\n}',
}

function example(e: ApiEndpoint): string {
  const path = e.path.replace('{id}', e.group === 'Campaigns' || e.group === 'Leads' ? 'crm_campaign_77' : 'seat_123').replace('{external_id}', 'c_5501')
  const body = BODIES[`${e.method} ${e.path}`]
  const lines = [`curl${e.method === 'GET' ? '' : ` -X ${e.method}`} ${API_BASE}${path} \\`, '  -H "Authorization: Bearer dsk_test_..."']
  if (body) { lines[lines.length - 1] += ' \\'; lines.push('  -H "Content-Type: application/json" \\', `  -d '${body.replace(/\n\s*/g, ' ')}'`) }
  return lines.join('\n')
}

const GROUP_ORDER: ApiEndpoint['group'][] = ['Account', 'Seats', 'Sessions', 'Campaigns', 'Leads', 'Dispositions', 'Calls', 'Compliance', 'Usage']

export default function ApiReference() {
  return (
    <div style={{ maxWidth: 900 }}>
      <div style={{ fontSize: 12, letterSpacing: 1.4, textTransform: 'uppercase', color: 'var(--dv-accent)', marginBottom: 10 }}>Reference</div>
      <h1 style={{ fontSize: 34, fontWeight: 600, margin: '0 0 12px' }}>API reference</h1>
      <p className="dv-muted" style={{ fontSize: 16, lineHeight: 1.65, margin: '0 0 22px' }}>
        REST over HTTPS with JSON bodies. Authenticate with a secret key as a bearer token (<DevLink href="/docs/authentication" className="dv-link">authentication</DevLink>). Test keys see only test data and never dial. Errors follow one shape (<DevLink href="/docs/errors" className="dv-link">errors and limits</DevLink>).
      </p>
      <div className="dv-inset" style={{ padding: '12px 14px', display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 13, marginBottom: 32 }}>
        <span className="dv-dim">Base URL</span><code style={{ overflowWrap: 'anywhere' }}>{API_BASE}</code>
      </div>

      {GROUP_ORDER.map(g => {
        const items = ENDPOINTS.filter(e => e.group === g)
        if (!items.length) return null
        return (
          <section key={g} style={{ marginBottom: 40 }}>
            <h2 style={{ fontSize: 22, fontWeight: 600, margin: '0 0 14px' }}>{g}</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 14 }}>
              {items.map(e => (
                <div key={e.method + e.path} id={endpointAnchor(e.method, e.path)} className="dv-card" style={{ scrollMarginTop: 110 }}>
                  <div className="dv-card-head">
                    <div className="dv-row" style={{ flexWrap: 'wrap' }}>
                      <MethodPill method={e.method} />
                      <code style={{ fontSize: 14, overflowWrap: 'anywhere', minWidth: 0 }}>{e.path}</code>
                    </div>
                    <h3 style={{ fontSize: 16, fontWeight: 600, margin: '12px 0 4px' }}>{e.title}</h3>
                    <p className="dv-card-desc">{e.summary}</p>
                  </div>
                  <div className="dv-card-body"><CodeBlock lang="bash" title="request" code={example(e)} /></div>
                </div>
              ))}
            </div>
          </section>
        )
      })}

      <section id="events" style={{ marginBottom: 40, scrollMarginTop: 110 }}>
        <h2 style={{ fontSize: 22, fontWeight: 600, margin: '0 0 6px' }}>Webhook events</h2>
        <p className="dv-muted" style={{ fontSize: 14, margin: '0 0 14px' }}>Signed with your endpoint&apos;s secret. <DevLink href="/docs/webhooks#verify" className="dv-link">How to verify</DevLink>.</p>
        <div className="dv-card dv-table-wrap">
          <table className="dv-table">
            <thead><tr><th>Event</th><th>Sent when</th></tr></thead>
            <tbody>{WEBHOOK_EVENTS.map(ev => <tr key={ev.type}><td><code className="dv-inline-code">{ev.type}</code></td><td className="dv-muted">{ev.summary}</td></tr>)}</tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
