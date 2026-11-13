'use client'

import { useState } from 'react'
import { CodeBlock } from './ui'
import { API_BASE, EMBED_SRC } from '@/lib/developers/catalog'

const TABS = [
  {
    id: 'server', label: '1 · Your server', lang: 'js', title: 'server.js',
    code: `// Create the seat once, then a session each time the user opens the dialer
const seat = await fetch('${API_BASE}/seats', {
  method: 'POST',
  headers: { Authorization: \`Bearer \${process.env.DIALERSEAT_SECRET}\` },
  body: JSON.stringify({ external_user_id: user.id, email: user.email }),
}).then(r => r.json())

const { token } = await fetch(\`${API_BASE}/seats/\${seat.id}/sessions\`, {
  method: 'POST',
  headers: { Authorization: \`Bearer \${process.env.DIALERSEAT_SECRET}\` },
}).then(r => r.json())`,
  },
  {
    id: 'browser', label: '2 · Your page', lang: 'html', title: 'crm-contact-list.html',
    code: `<script src="${EMBED_SRC}"></script>
<div id="dialer"></div>
<script>
  const dialer = DialerSeat.mount('#dialer', {
    session: token,               // from your server
    campaign: 'crm_campaign_77',  // your own id
  })
</script>`,
  },
  {
    id: 'webhook', label: '3 · Results', lang: 'js', title: 'webhooks.js',
    code: `// POST /webhooks/dialerseat
app.post('/webhooks/dialerseat', (req, res) => {
  if (!verify(req.rawBody, req.get('DialerSeat-Signature'), SECRET)) return res.sendStatus(400)
  const { type, data } = req.body
  if (type === 'call.dispositioned') {
    crm.contacts.update(data.call.lead.external_id, {
      status: data.disposition.code,   // your code, e.g. APPT_SET
    })
  }
  res.sendStatus(200)
})`,
  },
]

export function HeroCode() {
  const [tab, setTab] = useState(TABS[0].id)
  const t = TABS.find(x => x.id === tab)!
  return (
    <div>
      <div className="dv-seg" role="tablist" style={{ marginBottom: 10 }}>
        {TABS.map(x => (
          <button key={x.id} type="button" role="tab" aria-selected={x.id === tab} onClick={() => setTab(x.id)}>{x.label}</button>
        ))}
      </div>
      <CodeBlock code={t.code} lang={t.lang} title={t.title} />
    </div>
  )
}
