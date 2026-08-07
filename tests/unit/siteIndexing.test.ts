import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { COMPETITORS, crossShoppedPairs, matchupSlug } from '@/lib/competitors'

// =============================================================================
// A PAGE NOBODY LINKS TO AND NOTHING LISTS DOES NO WORK
// =============================================================================
// Three hand-maintained lists were describing the same set of pages: the route
// directories under app/vs, the COMPARISONS array the index renders, and the
// sitemap. All three had drifted.
//
// Eleven competitor pages were missing from the sitemap. /vs/orum existed and
// was linked from nowhere. Nothing failed, nothing logged — the pages simply
// sat there earning nothing, which is the same outcome as not having written
// them.
//
// These tests exist because that failure is invisible by construction. You
// cannot notice a missing sitemap entry by using the site.
// =============================================================================

const APP = join(process.cwd(), 'app')

/** Route segments under app/vs that render a real page. */
function vsRouteSlugs(): string[] {
  return readdirSync(join(APP, 'vs'), { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name)
    // [matchup] is dynamic and covered by its own assertions below.
    .filter(name => !name.startsWith('[') && !name.startsWith('_'))
    .filter(name => existsSync(join(APP, 'vs', name, 'page.tsx')))
}

function faqRouteSlugs(): string[] {
  return readdirSync(join(APP, 'faq'), { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name)
    .filter(name => !name.startsWith('[') && !name.startsWith('_'))
    .filter(name => existsSync(join(APP, 'faq', name, 'page.tsx')))
}

const sitemapSource = readFileSync(join(APP, 'sitemap.ts'), 'utf8')
const vsIndexSource = readFileSync(join(APP, 'vs', 'view.tsx'), 'utf8')

describe('every /vs page is discoverable', () => {
  it('is listed in the sitemap', () => {
    // Competitor pages are generated from COMPETITORS, so a registry entry is
    // as good as a literal. Anything outside the registry must appear by name.
    const registrySlugs = new Set(COMPETITORS.map(c => c.slug))
    const derivedFromRegistry = sitemapSource.includes('COMPETITORS.map')

    const missing = vsRouteSlugs().filter(slug => {
      if (derivedFromRegistry && registrySlugs.has(slug)) return false
      return !sitemapSource.includes(`/vs/${slug}`)
    })
    expect(missing, 'these /vs pages are not in the sitemap').toEqual([])
  })

  it('is linked from the /vs index', () => {
    // An orphan page has no internal links pointing at it, which is close to
    // the worst state a page can be in — it exists, it costs, and no crawler
    // has a reason to reach it.
    const missing = vsRouteSlugs()
      // teams is a distinct landing page with its own navigation entry.
      .filter(slug => slug !== 'teams')
      .filter(slug => !vsIndexSource.includes(`'${slug}'`))
    expect(missing, 'these /vs pages are linked from nowhere').toEqual([])
  })

  it('has a page for every competitor in the registry', () => {
    // The reverse direction: a registry entry with no page puts a dead link in
    // the sitemap, which is worse than an absent one.
    const routes = new Set(vsRouteSlugs())
    const missing = COMPETITORS.map(c => c.slug).filter(s => !routes.has(s))
    expect(missing, 'registry entries with no page').toEqual([])
  })
})

describe('every /faq page is in the sitemap', () => {
  it('has no unlisted FAQ pages', () => {
    const missing = faqRouteSlugs().filter(
      slug => !sitemapSource.includes(`/faq/${slug}`))
    expect(missing, 'these /faq pages are not in the sitemap').toEqual([])
  })
})

describe('head-to-head pages', () => {
  it('only pairs tools within the same segment', () => {
    // The gate that keeps 21 competitors from becoming 210 near-identical
    // pages. A cross-segment pair means the segment check regressed.
    const crossSegment = crossShoppedPairs()
      .filter(([a, b]) => a.segment !== b.segment)
      .map(([a, b]) => matchupSlug(a, b))
    expect(crossSegment).toEqual([])
  })

  it('stays within a sane page count', () => {
    // Not a style preference. Large sets of near-duplicate comparison pages are
    // the textbook shape of doorway content, and the penalty applies to the
    // whole site rather than the offending pages.
    expect(crossShoppedPairs().length).toBeLessThan(60)
  })

  it('generates a unique slug for every pair', () => {
    const slugs = crossShoppedPairs().map(([a, b]) => matchupSlug(a, b))
    expect(new Set(slugs).size).toBe(slugs.length)
  })
})
