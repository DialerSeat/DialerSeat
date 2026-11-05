import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { COMPETITORS, SEARCHED_PAIRS, crossShoppedPairs, matchupSlug } from '@/lib/competitors'
import { VERTICALS } from '@/lib/verticals'
import { isReservedSubdomain } from '@/lib/reservedSubdomains'

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
    // ── MATCH THE HREF, NOT A BARE SLUG ────────────────────────────────
    // This looked for `'readymode'` and the index writes `'/vs/readymode'`, so
    // the quote before the slug never lined up and all 25 pages failed. A test
    // that fails on everything says nothing about anything: it ran red for
    // weeks while one page, hookedcrm, was genuinely orphaned, and that page
    // was invisible among twenty-four false positives.
    //
    // Matching on the path with its closing quote is both correct and
    // stricter -- it cannot be satisfied by the slug appearing in prose.
    const missing = vsRouteSlugs()
      // teams is a distinct landing page with its own navigation entry.
      .filter(slug => slug !== 'teams')
      .filter(slug => !vsIndexSource.includes(`/vs/${slug}'`))
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

/**
 * The canonical URL a page declares, if it declares one. A page whose canonical
 * is some other URL is a duplicate by its own account, and Google's guidance is
 * to list only canonical URLs in a sitemap: the /faq/what-is-a-*-dialer pages
 * declare their /dialing-modes twins.
 */
function declaredCanonical(dir: string, slug: string): string | null {
  const src = readFileSync(join(APP, dir, slug, 'page.tsx'), 'utf8')
  const m = src.match(/canonical:\s*['"`](https:\/\/dialerseat\.com[^'"`]*)['"`]/)
  // A template like `https://dialerseat.com${ROUTE}` is the page's own URL.
  if (!m || m[1].includes('${')) return null
  return m[1]
}

describe('every /faq page is in the sitemap', () => {
  it('has no unlisted FAQ pages', () => {
    // Industry pages are generated from VERTICALS, the same way competitor
    // pages are generated from COMPETITORS.
    const verticalSlugs = new Set(VERTICALS.map(v => `dialer-for-${v.slug}`))
    const derivedFromVerticals = sitemapSource.includes('VERTICALS.map')

    const missing = faqRouteSlugs().filter(slug => {
      if (derivedFromVerticals && verticalSlugs.has(slug)) return false
      const canonical = declaredCanonical('faq', slug)
      if (canonical && canonical !== `https://dialerseat.com/faq/${slug}`) return false
      return !sitemapSource.includes(`/faq/${slug}`)
    })
    expect(missing, 'these /faq pages are not in the sitemap').toEqual([])
  })

  it('does not list a page that declares another URL as canonical', () => {
    const listedDuplicates = faqRouteSlugs().filter(slug => {
      const canonical = declaredCanonical('faq', slug)
      return canonical && canonical !== `https://dialerseat.com/faq/${slug}` &&
        sitemapSource.includes(`'/faq/${slug}'`)
    })
    expect(listedDuplicates, 'non-canonical pages listed in the sitemap').toEqual([])
  })
})

describe('head-to-head pages', () => {
  it('only pairs tools within the same segment, or pairs people search', () => {
    // The gate that keeps 21 competitors from becoming 210 near-identical
    // pages. A cross-segment pair means the segment check regressed, unless it
    // is one of the autocomplete-verified SEARCHED_PAIRS.
    const searched = new Set(SEARCHED_PAIRS.flatMap(([x, y]) => [`${x}-vs-${y}`, `${y}-vs-${x}`]))
    const crossSegment = crossShoppedPairs()
      .filter(([a, b]) => a.segment !== b.segment)
      .map(([a, b]) => matchupSlug(a, b))
      .filter((slug) => !searched.has(slug))
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

// =============================================================================
// A PUBLIC PAGE HAS TO BE REGISTERED IN FIVE PLACES
// =============================================================================
// /screenshots shipped on 3 November and was never added to isPublicRoute in
// proxy.ts, so Clerk's auth.protect() rewrote every signed-out request to a
// 404 — Googlebot included. Verified with curl on 4 November: 404 with
// X-Clerk-Auth-Reason: protect-rewrite, while /features and /resources beside
// it returned 200. The page built so that assistants would stop illustrating
// DialerSeat with a competitor's screenshots was unreachable to every machine
// that would have read it, and the sitemap was advertising it the whole time.
//
// Nothing failed. The page worked perfectly for the signed-in author, which is
// the only person who never sees the bug.
//
// Writing the page is one step of five, and the other four are all invisible
// from a browser that is signed in:
//   proxy.ts isPublicRoute        — or a crawler gets a 404
//   proxy.ts MARKETING_ONLY_PATHS — or our page renders under a reseller brand
//   app/sitemap.ts                — or nothing tells Google it exists
//   scripts/gen-page-dates.mjs    — or it stamps the site-wide fallback date
//   lib/reservedSubdomains.ts     — or a tenant can claim its name
// =============================================================================

const proxySource = readFileSync(join(process.cwd(), 'proxy.ts'), 'utf8')
const pageDatesSource = readFileSync(join(process.cwd(), 'scripts', 'gen-page-dates.mjs'), 'utf8')

/**
 * Top-level routes a signed-out visitor is meant to reach. Derived from the
 * filesystem, so a new page is in scope the moment it exists.
 */
function publicTopLevelRoutes(): string[] {
  // Signed-in destinations, not marketing pages.
  const PRIVATE = new Set(['billing', 'dashboard', 'welcome'])
  return readdirSync(APP, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name)
    .filter(name => !name.startsWith('[') && !name.startsWith('_'))
    .filter(name => !PRIVATE.has(name))
    .filter(name => existsSync(join(APP, name, 'page.tsx')))
    .sort()
}

/** The lines of the array literal that starts at `from`, up to its closing `]`. */
function blockBody(from: number): string[] {
  const rest = proxySource.slice(from)
  const end = rest.search(/^\]\)?/m)
  return rest.slice(0, end < 0 ? undefined : end).split(/\r?\n/)
}

/** The route patterns inside a createRouteMatcher([...]) assigned to `name`. */
function matcherPatterns(name: string): string[] {
  const start = proxySource.indexOf(`const ${name} = createRouteMatcher([`)
  if (start < 0) throw new Error(`${name} not found in proxy.ts`)
  // ── STRIP THE COMMENTS BEFORE PAIRING QUOTES ───────────────────────
  // proxy.ts is more comment than code, and the prose says "the client's
  // cookie guess". One apostrophe puts quote-pairing out of phase for the
  // rest of the block: the first version of this read 28 of the 44 patterns
  // and called /faq, /vs, /terms, /privacy and /dialing-modes unprotected
  // pages. They were listed all along, below the apostrophe.
  return blockBody(start)
    .filter(line => !line.trim().startsWith('//'))
    .flatMap(line => [...line.matchAll(/'([^']+)'/g)].map(m => m[1]))
}

describe('every public page is registered where it has to be', () => {
  it('is public in proxy.ts, so a signed-out crawler is not rewritten to a 404', () => {
    const patterns = matcherPatterns('isPublicRoute')
    const missing = publicTopLevelRoutes().filter(
      name => !patterns.some(p => p === `/${name}` || p.startsWith(`/${name}(`))
    )
    expect(missing, 'these pages are behind auth.protect()').toEqual([])
  })

  it('is in the sitemap', () => {
    const missing = publicTopLevelRoutes().filter(name => !sitemapSource.includes(`'/${name}'`))
    expect(missing, 'these pages are in no sitemap entry').toEqual([])
  })

  it('is in PUBLIC_PREFIXES, so it stamps its own date and not the fallback', () => {
    const missing = publicTopLevelRoutes().filter(name => !pageDatesSource.includes(`'/${name}'`))
    expect(missing, 'these pages will print the site-wide fallback date').toEqual([])
  })

  it('redirects to the apex on a tenant subdomain', () => {
    // Our prices and our name under somebody else's brand. The exception is
    // deliberate and narrow: /status reports the platform the reseller is
    // selling, so it stays reachable on their subdomain.
    const EXEMPT = new Set(['status'])
    const start = proxySource.indexOf('const MARKETING_ONLY_PATHS = [')
    const patterns = blockBody(start)
      .filter(line => !line.trim().startsWith('//'))
      .join(' ')
    const missing = publicTopLevelRoutes()
      .filter(name => !EXEMPT.has(name))
      // The entries are regex literals, so the slash is escaped: /^\/faq…
      .filter(name => !patterns.includes(String.raw`\/` + name))
    expect(missing, 'these pages render under a reseller brand').toEqual([])
  })

  it('has its name reserved, so no tenant can claim the subdomain', () => {
    const missing = publicTopLevelRoutes().filter(name => !isReservedSubdomain(name))
    expect(missing, 'a tenant could take these subdomains').toEqual([])
  })
})
