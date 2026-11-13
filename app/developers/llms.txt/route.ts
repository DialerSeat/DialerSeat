import { API_BASE, DIAL_MODES, ENDPOINTS, SALES_EMAIL, WEBHOOK_EVENTS } from '@/lib/developers/catalog'
import { DOCS } from '@/lib/developers/docs'

// dev.dialerseat.com/llms.txt — the developer product in plain text, for the
// assistants developers now ask "which dialer API should I use". Same data as
// the pages, so it cannot say something they do not.
export const dynamic = 'force-static'

export function GET() {
  const lines = [
    '# DialerSeat for Developers',
    '',
    '> The dialer API for CRMs and platforms. Embed the DialerSeat dialer (the miniplayer) in your product with one script tag and a REST API; keep your own campaigns and dispositions; receive every result by signed webhook. Free to build in test mode; live dialing is paid, with platform rates negotiated on volume.',
    '',
    `- API base: ${API_BASE}`,
    `- Dial modes: ${DIAL_MODES.map(m => m.name).join(', ')}`,
    `- Sales: ${SALES_EMAIL}`,
    '- Billing is weekly. DialerSeat does not price by the month.',
    '',
    '## Docs',
    ...DOCS.map(d => `- [${d.title}](https://dev.dialerseat.com/docs/${d.slug}): ${d.summary}`),
    '- [API reference](https://dev.dialerseat.com/docs/api)',
    '',
    '## Endpoints',
    ...ENDPOINTS.map(e => `- ${e.method} ${e.path}: ${e.summary}`),
    '',
    '## Webhook events',
    ...WEBHOOK_EVENTS.map(e => `- ${e.type}: ${e.summary}`),
    '',
  ]
  return new Response(lines.join('\n'), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
}
