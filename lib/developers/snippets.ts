// The code a platform pastes, for each way of putting the dialer in. One
// source for the setup page, the docs and the playground, so the three never
// disagree. Every snippet is plain and runnable; placeholders are named in
// capitals.

import type { Approach } from './store'
import { API_BASE, EMBED_SRC } from './catalog'

const DEV_ORIGIN = 'https://dev.dialerseat.com'

/** Server: make (or update) the seat, then a one-use session. Hosted and iframe send the leads with the session. */
export function serverSnippet(approach: Approach): string {
  const withLeads = approach === 'hosted' || approach === 'iframe' || approach === 'headless'
  return `// On your server. Keep the secret key here, never in the browser.
const DS = '${API_BASE}'
const headers = { Authorization: \`Bearer \${process.env.DIALERSEAT_SECRET_KEY}\`, 'Content-Type': 'application/json' }

export async function openDialerFor(user${withLeads ? ', leads' : ''}) {
  // 1. The seat: one per user who dials, keyed on your own user id.
  const seat = await fetch(\`\${DS}/seats\`, {
    method: 'POST', headers,
    body: JSON.stringify({ external_user_id: user.id, email: user.email, name: user.name }),
  }).then(r => r.json())

  // 2. A session: signs that seat into the dialer once, for 15 minutes.
  const session = await fetch(\`\${DS}/seats/\${seat.id}/sessions\`, {
    method: 'POST', headers,${withLeads ? `
    // The list travels with the session, so the page needs no script.
    body: JSON.stringify({ campaign: 'YOUR_CAMPAIGN_ID', leads }),` : `
    body: JSON.stringify({}),`}
  }).then(r => r.json())

  return session.token // hand this to the page that opens the dialer
}`
}

/** Front end, per approach. */
export function frontSnippet(approach: Approach, publishableKey: string): { lang: string; title: string; code: string; note: string } {
  const pk = publishableKey || 'dpk_test_YOUR_PUBLISHABLE_KEY'
  switch (approach) {
    case 'script':
      return {
        lang: 'html', title: 'your-page.html',
        note: 'The script mounts the dialer into the div and passes your leads in from the page. Events come back to the page as well as to your webhooks.',
        code: `<script src="${EMBED_SRC}" data-key="${pk}"></script>
<div id="dialer" style="width:380px;height:640px"></div>
<script>
  // SESSION_TOKEN comes from your server (openDialerFor above)
  const dialer = DialerSeat.mount('#dialer', {
    session: SESSION_TOKEN,
    campaign: 'YOUR_CAMPAIGN_ID',
    leads: [{ external_id: 'c_5501', first_name: 'Dana', phone: '+15125550142' }],
    theme: 'dark',
  })
  dialer.on('disposition', (e) => {
    // e.code is your own disposition code (SKIP when the agent skipped)
    // e.lead.external_id is your record
  })
</script>`,
      }
    case 'react':
      return {
        lang: 'tsx', title: 'DialerSeatDialer.tsx',
        note: 'A small component around the same script. Mount it with a fresh session token each time it opens.',
        code: `'use client'
import { useEffect, useRef } from 'react'

type Dialer = { on: (type: string, fn: (e: any) => void) => Dialer; setLeads: (l: object[]) => Dialer; destroy: () => void }
declare global { interface Window { DialerSeat?: { mount: (el: HTMLElement, o: object) => Dialer } } }

const SRC = '${EMBED_SRC}'
const KEY = '${pk}'

function loadDialerSeat(): Promise<void> {
  if (window.DialerSeat) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = SRC
    s.setAttribute('data-key', KEY)
    s.onload = () => resolve()
    s.onerror = () => reject(new Error('DialerSeat did not load'))
    document.head.appendChild(s)
  })
}

export function DialerSeatDialer({ session, campaign, leads, onDisposition }: {
  session: string
  campaign?: string
  leads: { external_id: string; first_name?: string; phone: string }[]
  onDisposition?: (e: { code: string; label: string; lead: { external_id: string } }) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    let dialer: Dialer | undefined
    let gone = false
    loadDialerSeat().then(() => {
      if (gone || !ref.current || !window.DialerSeat) return
      dialer = window.DialerSeat.mount(ref.current, { session, campaign, leads, theme: 'dark' })
      dialer.on('disposition', e => onDisposition?.(e))
    })
    return () => { gone = true; dialer?.destroy() }
    // A new session means a new dialer; leads changes go through setLeads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session])
  return <div ref={ref} style={{ width: 380, height: 640 }} />
}`,
      }
    case 'iframe':
      return {
        lang: 'html', title: 'your-page.html',
        note: 'No script on your page. The leads came with the session. To hear events in the page, listen for messages from dev.dialerseat.com; your webhooks get them either way.',
        code: `<iframe
  src="${DEV_ORIGIN}/embed/dialer?k=${pk}&theme=dark#s=SESSION_TOKEN"
  allow="microphone; autoplay"
  style="width:380px;height:640px;border:0;border-radius:4px"
  title="DialerSeat dialer"></iframe>

<script>
  window.addEventListener('message', (e) => {
    if (e.origin !== '${DEV_ORIGIN}') return
    const m = e.data
    if (m && m.__dialerseat === 1 && m.type === 'disposition') {
      // m.payload.code, m.payload.lead.external_id
    }
  })
</script>`,
      }
    case 'hosted':
      return {
        lang: 'html', title: 'your-page.html',
        note: 'The dialer opens in its own window, so there is nothing to embed and no origin to allow. Results reach you by webhook.',
        code: `<button id="open-dialer">Open dialer</button>
<script>
  document.getElementById('open-dialer').addEventListener('click', async () => {
    // Ask your server for a session (with the leads) when the agent clicks.
    const { token } = await fetch('/your-server/dialer-session', { method: 'POST' }).then(r => r.json())
    window.open(
      '${DEV_ORIGIN}/embed/dialer?k=${pk}&theme=dark#s=' + encodeURIComponent(token),
      'dialerseat',
      'width=420,height=720',
    )
  })
</script>`,
      }
    case 'headless':
      return {
        lang: 'js', title: 'webhook-handler.js',
        note: 'Early access. Your own screens list leads and show results; agents still place calls in the dialer (open it as a hosted window). Every result arrives here, signed.',
        code: `import crypto from 'node:crypto'

// POST /webhooks/dialerseat on your server
export async function handle(req, res) {
  const raw = await readRawBody(req)
  if (!verify(raw, req.headers['dialerseat-signature'], process.env.DIALERSEAT_WEBHOOK_SECRET)) return res.status(400).end()
  const event = JSON.parse(raw)
  if (event.type === 'call.dispositioned') {
    // event.data.disposition.code is your code; event.data.call.lead.external_id is your record
  }
  if (event.type === 'subscription.recorded') {
    // a seat was activated or renewed for event.data.seat.external_user_id
  }
  res.status(200).end()
}

function verify(raw, header, secret) {
  const parts = Object.fromEntries(String(header || '').split(',').map(p => p.split('=')))
  if (!parts.t || !parts.v1 || Math.abs(Date.now() / 1000 - Number(parts.t)) > 300) return false
  const want = crypto.createHmac('sha256', secret).update(parts.t + '.' + raw).digest('hex')
  return want.length === parts.v1.length && crypto.timingSafeEqual(Buffer.from(want), Buffer.from(parts.v1))
}`,
      }
  }
}

/** Whether the approach loads the dialer inside the platform's own pages (so its origins must be allowed). */
export function needsOrigins(approach: Approach): boolean {
  return approach === 'script' || approach === 'react' || approach === 'iframe'
}
