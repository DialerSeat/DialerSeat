import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { COMPETITORS } from '@/lib/competitors'
import { RELATED_BY_ROUTE, relatedForCompetitor, type RelatedLink } from '@/lib/relatedLinks'
import { ENABLED_LOCALES } from '@/lib/i18n/locales'
import { ENGLISH_ONLY_PATHS } from '@/lib/tools/registry'

const pageExists = (route: string) =>
  existsSync(join(process.cwd(), 'app', route, 'page.tsx'))

// These two answer with a canonical at /dialing-modes/*, so a link to them would
// spend itself on a page that points elsewhere.
const NOT_CANONICAL = ['/faq/what-is-a-power-dialer', '/faq/what-is-a-predictive-dialer']

const check = (from: string, links: RelatedLink[]) => {
  for (const l of links) {
    expect(pageExists(l.href), `${from} links to ${l.href}, which has no page`).toBe(true)
    expect(NOT_CANONICAL, `${from} links to non-canonical ${l.href}`).not.toContain(l.href)
    expect(l.href, `${from} links to itself`).not.toBe(from)
    expect(l.label.length).toBeGreaterThan(0)
  }
  expect(new Set(links.map((l) => l.href)).size, `${from} repeats a target`).toBe(links.length)
}

describe('related links', () => {
  it('every route in the list exists, and every target exists and is canonical', () => {
    for (const [route, links] of Object.entries(RELATED_BY_ROUTE)) {
      expect(pageExists(route), `${route} has no page`).toBe(true)
      check(route, links)
    }
  })

  it('every competitor page gets links, none to itself', () => {
    for (const c of COMPETITORS) {
      const links = relatedForCompetitor(c)
      expect(links.length, c.slug).toBeGreaterThan(2)
      check(`/vs/${c.slug}`, links)
    }
  })

  it('a page uses its own phrase over its segment phrase for the same target', () => {
    const links = relatedForCompetitor({ slug: 'gohighlevel', segment: 'sales_crm' })
    expect(links.find((l) => l.href === '/faq/send-leads-from-your-crm')?.label).toBe('Power dialer for GoHighLevel')
  })
})

describe('related links in every language', () => {
  const shownAbroad = [
    ...Object.values(RELATED_BY_ROUTE).flat(),
    ...COMPETITORS.flatMap((c) => relatedForCompetitor(c)),
  ].filter((l) => !ENGLISH_ONLY_PATHS.has(l.href))
  const labels = new Set(['Related', ...shownAbroad.map((l) => l.label)])

  for (const locale of ENABLED_LOCALES.filter((l) => l !== 'en')) {
    it(`${locale}: the browser dictionary has every label shown on a translated page`, () => {
      const dict = JSON.parse(readFileSync(join(process.cwd(), 'lib/i18n/dictionaries/client', `${locale}.json`), 'utf8'))
      expect([...labels].filter((k) => !dict[k]?.trim())).toEqual([])
    })
  }

  it('every competitor page still has links on a translated page', () => {
    for (const c of COMPETITORS) {
      expect(relatedForCompetitor(c).filter((l) => !ENGLISH_ONLY_PATHS.has(l.href)).length, c.slug).toBeGreaterThan(2)
    }
  })
})
