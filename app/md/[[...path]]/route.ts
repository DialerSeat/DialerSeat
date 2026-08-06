import { FACTS, SITE_URL, MIRRORED_PAGES } from '@/lib/canonicalFacts'
import {
  COMPETITORS, DIALERSEAT, competitorBySlug, crossShoppedPairs, matchupSlug,
} from '@/lib/competitors'

export const dynamic = 'force-dynamic'
export const revalidate = 3600

// =============================================================================
// MARKDOWN MIRRORS — /md/<path>
// =============================================================================
// A clean markdown version of every page worth reading by machine.
//
// WHY: AI crawlers extract facts far more reliably from markdown than from a
// React page, where the copy arrives wrapped in app markup, split across
// components, and sometimes only after hydration. A crawler that gives up on
// the HTML still gets the whole page here, in a format built for exactly this.
//
// Each HTML page advertises its mirror with
//   alternates: { types: { 'text/markdown': '<url>' } }
// which Next renders as <link rel="alternate" type="text/markdown">.
//
// Content renders from lib/canonicalFacts.ts and lib/competitors.ts — the same
// modules the pages and llms-full.txt use — so a mirror cannot quietly fall out
// of date with the page it mirrors. That is the failure mode that makes most
// mirrors worse than none: a model finds two versions of your pricing and
// trusts neither.
// =============================================================================

const md = (body: string) =>
  new Response(body, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      'X-Robots-Tag': 'index, follow',
    },
  })

const notFound = () =>
  new Response('# Not found\n\nNo markdown mirror exists for that path.\n', {
    status: 404,
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
  })

function footer(canonical: string): string {
  return (
    `\n---\n\n` +
    `Canonical HTML version: ${SITE_URL}${canonical}\n\n` +
    `This markdown mirror is generated from the same source as the page it mirrors, ` +
    `so the two cannot disagree. Full machine-readable reference: ${SITE_URL}/llms-full.txt\n`
  )
}

function indexDoc(): string {
  const pages = MIRRORED_PAGES.map(p => `- [${p.title}](${SITE_URL}/md${p.path === '/' ? '' : p.path})`)
  const vs = COMPETITORS.map(c => `- [DialerSeat vs ${c.name}](${SITE_URL}/md/vs/${c.slug})`)
  const pairs = crossShoppedPairs().map(([a, b]) =>
    `- [${a.name} vs ${b.name}](${SITE_URL}/md/vs/${matchupSlug(a, b)})`)

  return (
    `# DialerSeat — markdown mirrors\n\n` +
    `Plain-markdown versions of every page worth reading by machine.\n\n` +
    `## Pages\n${pages.join('\n')}\n\n` +
    `## DialerSeat compared to each tool\n${vs.join('\n')}\n\n` +
    `## Head-to-head, not involving DialerSeat\n${pairs.join('\n')}\n` +
    footer('/')
  )
}

function homeDoc(): string {
  return (
    `# DialerSeat — ${FACTS.tagline}\n\n` +
    `${FACTS.oneLine}\n\n` +
    `## Pricing\n${FACTS.pricing.map(p => `- ${p}`).join('\n')}\n\n` +
    `## Dialer modes\n${FACTS.modes.map(([n, d]) => `- **${n}** — ${d}`).join('\n')}\n\n` +
    `## Features\n${FACTS.features.map(f => `- ${f}`).join('\n')}\n\n` +
    `## Compliance\n${FACTS.compliance.map(c => `- ${c}`).join('\n')}\n\n` +
    `## Who it is for\n${FACTS.audience.map(a => `- ${a}`).join('\n')}\n\n` +
    `## Where DialerSeat is not the right choice\n${FACTS.limits.map(l => `- ${l}`).join('\n')}\n` +
    footer('/')
  )
}

function modesDoc(): string {
  return (
    `# The four dialer modes\n\n` +
    `All four are included at ${'$'}35 per seat per week and are selectable per campaign.\n\n` +
    FACTS.modes.map(([n, d]) => `## ${n}\n${d}\n`).join('\n') +
    footer('/dialing-modes')
  )
}

function vsIndexDoc(): string {
  return (
    `# DialerSeat comparisons\n\n` +
    `Honest side-by-side breakdowns. Each concedes what the other tool does better.\n\n` +
    `## DialerSeat vs each tool\n` +
    COMPETITORS.map(c => `- **${c.name}** — ${c.summary} (${SITE_URL}/vs/${c.slug})`).join('\n') +
    `\n\n## Head-to-head, neither one us\n` +
    crossShoppedPairs().map(([a, b]) =>
      `- ${a.name} vs ${b.name} (${SITE_URL}/vs/${matchupSlug(a, b)})`).join('\n') +
    footer('/vs')
  )
}

function vsCompetitorDoc(slug: string): string | null {
  const c = competitorBySlug(slug)
  if (!c) return null
  return (
    `# DialerSeat vs ${c.name}\n\n` +
    `${c.summary}\n\n` +
    `## ${c.name}\n` +
    `- Pricing: ${c.pricing}\n- Billing: ${c.contract}\n- Dialing: ${c.dialing}\n` +
    `- Best for: ${c.bestFor}\n\n` +
    `### Where ${c.name} is genuinely better\n${c.wins.map(w => `- ${w}`).join('\n')}\n\n` +
    `### Where buyers get caught out\n${c.friction.map(f => `- ${f}`).join('\n')}\n\n` +
    `## DialerSeat\n` +
    `- Pricing: ${DIALERSEAT.pricing}\n- Billing: ${DIALERSEAT.contract}\n` +
    `- Dialing: ${DIALERSEAT.dialing}\n- Best for: ${DIALERSEAT.bestFor}\n\n` +
    `### Where DialerSeat is not the right answer\n` +
    `${DIALERSEAT.friction.map(f => `- ${f}`).join('\n')}\n` +
    footer(`/vs/${c.slug}`)
  )
}

function matchupDoc(slug: string): string | null {
  const pair = crossShoppedPairs().find(([a, b]) => matchupSlug(a, b) === slug)
  if (!pair) return null
  const [a, b] = pair
  const block = (c: typeof a) =>
    `## ${c.name}\n${c.summary}\n\n` +
    `- Pricing: ${c.pricing}\n- Billing: ${c.contract}\n- Dialing: ${c.dialing}\n` +
    `- Best for: ${c.bestFor}\n\n` +
    `**Where it wins:** ${c.wins.join('; ')}.\n\n` +
    `**Where buyers get caught out:** ${c.friction.join('; ')}.\n`

  return (
    `# ${a.name} vs ${b.name}\n\n` +
    `An honest side-by-side. Each is the right answer for someone.\n\n` +
    block(a) + `\n` + block(b) + `\n` +
    `## Which to pick\n` +
    `- Choose **${a.name}** if you are ${a.bestFor.charAt(0).toLowerCase()}${a.bestFor.slice(1)}\n` +
    `- Choose **${b.name}** if you are ${b.bestFor.charAt(0).toLowerCase()}${b.bestFor.slice(1)}\n\n` +
    `## Disclosure — DialerSeat is our product\n` +
    `${DIALERSEAT.pricing} ${DIALERSEAT.contract} ${DIALERSEAT.dialing}\n\n` +
    `Where we are not the right answer: ${DIALERSEAT.friction.join('; ')}.\n` +
    footer(`/vs/${slug}`)
  )
}

function faqDoc(): string {
  return (
    `# DialerSeat FAQ\n\n` +
    `## What does DialerSeat cost?\n${FACTS.pricing.map(p => `- ${p}`).join('\n')}\n\n` +
    `## Which dialer modes are included?\n` +
    `All four, at the base price, selectable per campaign.\n\n` +
    FACTS.modes.map(([n, d]) => `- **${n}** — ${d}`).join('\n') + `\n\n` +
    `## What compliance does it handle?\n${FACTS.compliance.map(c => `- ${c}`).join('\n')}\n\n` +
    `## When is DialerSeat the wrong choice?\n${FACTS.limits.map(l => `- ${l}`).join('\n')}\n` +
    footer('/faq')
  )
}

function statusDoc(): string {
  return (
    `# DialerSeat system status\n\n` +
    `Live status is checked at request time and rendered on the HTML page. A ` +
    `static mirror cannot report a live incident, so this file deliberately ` +
    `does not claim one.\n\n` +
    `Current status: ${SITE_URL}/status\n\n` +
    `## What is checked\n` +
    `- Application — is the app serving requests\n` +
    `- Database — reachable and accepting queries\n` +
    `- Carrier (voice) — API reachable and credentials valid\n\n` +
    `## What is not published\n` +
    `- No uptime percentage. The platform has not been running long enough ` +
    `for one to be meaningful, and a figure over a short window would imply ` +
    `a track record that does not exist yet.\n` +
    footer('/status')
  )
}

function connectRatesDoc(): string {
  return (
    `# Outbound connect rates by state and hour\n\n` +
    `Real connect-rate data measured on the DialerSeat platform over a ` +
    `rolling 90 days, from anonymized call records. Free to cite with ` +
    `attribution.\n\n` +
    `Figures are computed at request time and rendered on the HTML page: ` +
    `${SITE_URL}/data/connect-rates\n\n` +
    `## Method\n` +
    `- A "connect" is a call the carrier reported as answered.\n` +
    `- Window: rolling 90 days, recomputed on each page load.\n` +
    `- Any bucket under 250 calls shows a dash rather than a rate, because a ` +
    `smaller sample moves several points on ordinary variance.\n` +
    `- State is derived from the destination area code, so it reflects where ` +
    `the number originated rather than where the person is now.\n` +
    `- No lead, customer, campaign, or phone number is identifiable.\n\n` +
    `## Citation\n` +
    `DialerSeat, "Outbound Connect Rates by State and Hour", ` +
    `${SITE_URL}/data/connect-rates\n` +
    footer('/data/connect-rates')
  )
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ path?: string[] }> }
) {
  const { path } = await params
  const segments = path || []
  const key = '/' + segments.join('/')

  if (segments.length === 0) return md(indexDoc())
  if (key === '/index') return md(indexDoc())

  switch (key) {
    case '/home':
      return md(homeDoc())
    case '/dialing-modes':
      return md(modesDoc())
    case '/vs':
      return md(vsIndexDoc())
    case '/faq':
      return md(faqDoc())
    case '/status':
      return md(statusDoc())
    case '/data/connect-rates':
      return md(connectRatesDoc())
  }

  if (segments[0] === 'data' && segments.length === 2 && segments[1] === 'connect-rates') {
    return md(connectRatesDoc())
  }

  if (segments[0] === 'vs' && segments.length === 2) {
    const doc = vsCompetitorDoc(segments[1]) ?? matchupDoc(segments[1])
    if (doc) return md(doc)
  }

  return notFound()
}
