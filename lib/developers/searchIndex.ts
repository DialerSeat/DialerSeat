// =============================================================================
// EVERYTHING THE CONSOLE SEARCH CAN FIND
// =============================================================================
// Console pages, every individual setting on them (linked to its anchor), every
// docs section, every endpoint, every webhook event and the concepts a
// developer might type. Built from the same data the pages render, so a
// result can never point at something that says otherwise.
// =============================================================================

import { CONSOLE_NAV, CONSOLE_SETTINGS } from './consoleNav'
import { DOCS, blockText } from './docs'
import { ENDPOINTS, WEBHOOK_EVENTS, DIAL_MODES, TIERS } from './catalog'
import type { SearchEntry } from './search'

export function endpointAnchor(method: string, path: string): string {
  return (method + '-' + path).toLowerCase().replace(/[{}]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function docsEntries(): SearchEntry[] {
  const out: SearchEntry[] = []
  for (const d of DOCS) {
    out.push({
      id: `doc:${d.slug}`, kind: 'doc', title: d.title, section: `Docs › ${d.group}`,
      href: `/docs/${d.slug}`, keywords: d.keywords,
      body: [d.summary, ...d.blocks.map(blockText)].join(' '), boost: 0.1,
    })
    // Each heading becomes its own result with the text beneath it.
    let current: { id: string; text: string; body: string[] } | null = null
    const flush = () => {
      if (!current) return
      out.push({
        id: `doc:${d.slug}#${current.id}`, kind: 'doc',
        title: current.text.replace(/^\d+\.\s*/, ''), section: `Docs › ${d.title}`,
        href: `/docs/${d.slug}#${current.id}`, keywords: d.keywords.slice(0, 4),
        body: current.body.join(' '),
      })
    }
    for (const b of d.blocks) {
      if (b.t === 'h') { flush(); current = { id: b.id, text: b.text, body: [] } }
      else if (current) current.body.push(blockText(b))
    }
    flush()
  }
  return out
}

export function buildSearchEntries(): SearchEntry[] {
  const entries: SearchEntry[] = []

  for (const n of CONSOLE_NAV) {
    entries.push({
      id: `page:${n.href}`, kind: 'page', title: n.label, section: `Console › ${n.group}`,
      href: n.href, keywords: n.keywords, body: n.description, boost: 0.25,
    })
  }
  for (const s of CONSOLE_SETTINGS) {
    entries.push({
      id: `setting:${s.href}`, kind: 'setting', title: s.label, section: `Console › ${s.page}`,
      href: s.href, keywords: s.keywords, body: s.description, boost: 0.15,
    })
  }

  entries.push(...docsEntries())

  for (const e of ENDPOINTS) {
    entries.push({
      id: `endpoint:${e.method} ${e.path}`, kind: 'endpoint',
      title: `${e.title}`, section: `API › ${e.method} ${e.path}`,
      href: `/docs/api#${endpointAnchor(e.method, e.path)}`,
      keywords: [e.method, e.path, e.group, ...(e.keywords || [])],
      body: e.summary,
    })
  }

  for (const ev of WEBHOOK_EVENTS) {
    entries.push({
      id: `event:${ev.type}`, kind: 'event', title: ev.type, section: 'Webhooks › Events',
      href: `/docs/webhooks#events`, keywords: ['webhook', 'event', ...ev.type.split('.'), ...(ev.keywords || [])],
      body: ev.summary,
    })
  }

  for (const m of DIAL_MODES) {
    entries.push({
      id: `mode:${m.id}`, kind: 'concept', title: `${m.name} dialing`, section: 'Concepts › Dial modes',
      href: '/console/dial-modes', keywords: ['dial mode', m.id, 'lines', 'pacing'], body: m.summary,
    })
  }

  for (const t of TIERS) {
    entries.push({
      id: `tier:${t.id}`, kind: 'concept', title: `${t.name} tier`, section: 'Concepts › Tiers',
      href: '/console/billing#tiers', keywords: ['tier', 'plan', 'pricing', t.price, t.priceNote],
      body: `${t.who} ${t.features.join('. ')}.`,
    })
  }

  entries.push(
    { id: 'concept:amd', kind: 'concept', title: 'Answering-machine detection (AMD)', section: 'Concepts › Campaigns',
      href: '/docs/campaigns-and-leads', keywords: ['amd', 'answering machine', 'voicemail detection', 'machine', 'human', 'beep', 'voicemail drop'],
      body: 'Turn AMD on per campaign. call.answered carries the AMD result; a voicemail drop plays your recording after the beep.' },
    { id: 'concept:any-crm', kind: 'concept', title: 'Works with any CRM', section: 'Concepts › Integration',
      href: '/docs/quickstart', keywords: ['hubspot', 'salesforce', 'gohighlevel', 'highlevel', 'pipedrive', 'zoho', 'follow up boss', 'custom crm', 'own platform', 'saas'],
      body: 'There is no per-CRM connector to wait for. If your app can make an HTTPS request and render a script tag, it can embed DialerSeat.' },
    { id: 'concept:not-a-developer', kind: 'concept', title: 'Go back to dialerseat.com', section: 'Account',
      href: '/welcome', keywords: ['not a developer', 'wrong site', 'my dialer', 'leave', 'exit', 'main site', 'back'],
      body: 'Your dialerseat.com account is separate. Go back signed in: the demo if you are not subscribed, your dashboard if you are.' },
    { id: 'concept:sales', kind: 'concept', title: 'Talk to sales', section: 'Billing',
      href: '/console/billing#rates', keywords: ['sales', 'contact', 'email', 'negotiate', 'volume pricing', 'discount', 'sales@dialerseat.com'],
      body: 'Platform rates are negotiated on volume and leverage with sales@dialerseat.com.' },
  )

  return entries
}
